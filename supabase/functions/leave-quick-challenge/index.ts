import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { challengeId } = await req.json();

    if (!challengeId) {
      throw new Error("Challenge ID is required");
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("No authorization header provided");
    }

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? ""
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } =
      await supabaseClient.auth.getUser(token);
    if (userError || !userData.user) {
      throw new Error("User not authenticated");
    }
    const userId = userData.user.id;

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Check the challenge exists
    const { data: challenge, error: challengeError } = await supabaseAdmin
      .from("quick_challenges")
      .select("id, created_by, price_per_player")
      .eq("id", challengeId)
      .single();

    if (challengeError || !challenge) {
      throw new Error("Challenge not found");
    }

    // Organizers should use the cancel challenge flow instead
    if (challenge.created_by === userId) {
      throw new Error("Organizers should use the cancel lobby action instead");
    }

    // Check if user is a participant
    const { data: playerRecord, error: playerError } = await supabaseAdmin
      .from("quick_challenge_players")
      .select("id, payment_status")
      .eq("challenge_id", challengeId)
      .eq("user_id", userId)
      .single();

    if (playerError || !playerRecord) {
      throw new Error("You are not a participant in this challenge");
    }

    let creditsAdded = 0;

    // Only convert payment to credits if the player actually paid (split mode).
    // In single (organizer-pays) mode, the player never paid, so skip credit conversion.
    if (
      playerRecord.payment_status === "paid" &&
      challenge.price_per_player > 0
    ) {
      // Check if there is a real payment snapshot for this player
      const { data: paymentSnapshot, error: paymentSnapshotError } = await supabaseAdmin
        .from("quick_challenge_payments")
        .select("id, payment_method_type, court_amount, status, converted_to_credits_at")
        .eq("challenge_id", challengeId)
        .eq("user_id", userId)
        .eq("status", "completed")
        .order("paid_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (paymentSnapshotError) {
        console.error("Error loading payment snapshot:", paymentSnapshotError);
        throw new Error("Failed to load payment snapshot");
      }

      // Only convert if a real payment exists (not organizer-covered)
      if (paymentSnapshot) {
        const amountToCredit = Number(paymentSnapshot.court_amount || 0) / 100;

        if (amountToCredit > 0) {
          const { error: creditError } = await supabaseAdmin.rpc(
            "add_user_credits",
            {
              p_user_id: userId,
              p_amount: amountToCredit,
              p_reason: "Quick challenge cancellation",
              p_session_id: null,
              p_payment_id: null,
            }
          );

          if (creditError) {
            console.error("Error adding credits:", creditError);
            throw new Error("Failed to convert payment to credits");
          }

          creditsAdded = amountToCredit;
        }

        const { error: markConvertedError } = await supabaseAdmin
          .from("quick_challenge_payments")
          .update({
            status: "converted_to_credits",
            converted_to_credits_at: new Date().toISOString(),
          })
          .eq("id", paymentSnapshot.id)
          .is("converted_to_credits_at", null);

        if (markConvertedError) {
          console.error("Error marking payment as converted_to_credits:", markConvertedError);
          throw new Error("Failed to convert payment snapshot");
        }
      }
    }

    // Remove player from the challenge
    const { error: deleteError } = await supabaseAdmin
      .from("quick_challenge_players")
      .delete()
      .eq("challenge_id", challengeId)
      .eq("user_id", userId);

    if (deleteError) {
      console.error("Error removing player:", deleteError);
      throw new Error("Failed to leave the challenge");
    }

    console.log(
      `Player ${userId} left challenge ${challengeId}. Credits added: ${creditsAdded}`
    );

    return new Response(
      JSON.stringify({
        success: true,
        creditsAdded,
        message:
          creditsAdded > 0
            ? `You have left the lobby. $${creditsAdded.toFixed(2)} has been added to your credits.`
            : "You have left the lobby.",
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error: unknown) {
    const errorMessage =
      error instanceof Error ? error.message : String(error);
    console.error("Error in leave-quick-challenge:", errorMessage);
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
