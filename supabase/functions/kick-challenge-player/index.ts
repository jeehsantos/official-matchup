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
    const { challengeId, targetUserId, reason } = await req.json();

    if (!challengeId || !targetUserId) {
      throw new Error("challengeId and targetUserId are required");
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header");

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? ""
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } =
      await supabaseClient.auth.getUser(token);
    if (userError || !userData.user) throw new Error("Not authenticated");

    const callerId = userData.user.id;

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Verify caller is the challenge organizer
    const { data: challenge, error: challengeError } = await supabaseAdmin
      .from("quick_challenges")
      .select("id, created_by, payment_type, price_per_player")
      .eq("id", challengeId)
      .single();

    if (challengeError || !challenge) throw new Error("Challenge not found");

    if (challenge.created_by !== callerId) {
      throw new Error("Only the challenge organizer can kick players");
    }

    if (targetUserId === callerId) {
      throw new Error("Cannot kick yourself. Use cancel lobby instead.");
    }

    // Get player record
    const { data: playerRecord, error: playerError } = await supabaseAdmin
      .from("quick_challenge_players")
      .select("id, payment_status")
      .eq("challenge_id", challengeId)
      .eq("user_id", targetUserId)
      .single();

    if (playerError || !playerRecord) {
      throw new Error("Player not found in this challenge");
    }

    let creditsAdded = 0;

    // Handle refund if player paid (split payment model only)
    const isOrganizerPaid = challenge.payment_type === "single";

    if (
      !isOrganizerPaid &&
      playerRecord.payment_status === "paid" &&
      challenge.price_per_player > 0
    ) {
      const { data: paymentSnapshot } = await supabaseAdmin
        .from("quick_challenge_payments")
        .select("id, court_amount, status")
        .eq("challenge_id", challengeId)
        .eq("user_id", targetUserId)
        .eq("status", "completed")
        .limit(1)
        .maybeSingle();

      if (paymentSnapshot) {
        const amountToCredit = Number(paymentSnapshot.court_amount || 0) / 100;

        if (amountToCredit > 0) {
          const [creditResult, updateResult] = await Promise.all([
            supabaseAdmin.rpc("add_user_credits", {
              p_user_id: targetUserId,
              p_amount: amountToCredit,
              p_reason: "Kicked from quick challenge - refund to credits",
              p_session_id: null,
              p_payment_id: null,
            }),
            supabaseAdmin
              .from("quick_challenge_payments")
              .update({ status: "converted_to_credits" })
              .eq("id", paymentSnapshot.id)
              .eq("status", "completed"),
          ]);

          if (creditResult.error) {
            console.error("Error adding credits:", creditResult.error);
            throw new Error("Failed to refund credits");
          }

          if (updateResult.error) {
            console.error("Error updating payment:", updateResult.error);
          }

          creditsAdded = amountToCredit;
        }
      }
    }

    // Insert ban record
    const { error: banError } = await supabaseAdmin
      .from("quick_challenge_bans")
      .upsert(
        {
          challenge_id: challengeId,
          user_id: targetUserId,
          banned_by: callerId,
          reason: reason || null,
        },
        { onConflict: "challenge_id,user_id" }
      );

    if (banError) {
      console.error("Error creating ban:", banError);
      // Non-fatal, continue with removal
    }

    // Remove player
    const { error: deleteError } = await supabaseAdmin
      .from("quick_challenge_players")
      .delete()
      .eq("challenge_id", challengeId)
      .eq("user_id", targetUserId);

    if (deleteError) {
      console.error("Error removing player:", deleteError);
      throw new Error("Failed to kick player");
    }

    console.log(
      `Player ${targetUserId} kicked from challenge ${challengeId} by ${callerId}. Credits: ${creditsAdded}`
    );

    return new Response(
      JSON.stringify({
        success: true,
        creditsAdded,
        message: `Player has been kicked from the lobby${creditsAdded > 0 ? `. $${creditsAdded.toFixed(2)} refunded to their credits.` : "."}`,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error: unknown) {
    const errorMessage =
      error instanceof Error ? error.message : String(error);
    console.error("Error in kick-challenge-player:", errorMessage);
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
