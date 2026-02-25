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
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError || !userData.user) {
      throw new Error("User not authenticated");
    }
    const userId = userData.user.id;

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const { data: challenge, error: challengeError } = await supabaseAdmin
      .from("quick_challenges")
      .select("id, created_by")
      .eq("id", challengeId)
      .single();

    if (challengeError || !challenge) {
      throw new Error("Challenge not found");
    }

    if (challenge.created_by !== userId) {
      throw new Error("Only the organizer can cancel this challenge");
    }

    const { data: paidSnapshots, error: paidSnapshotsError } = await supabaseAdmin
      .from("quick_challenge_payments")
      .select("id, user_id, court_amount")
      .eq("challenge_id", challengeId)
      .eq("status", "completed")
      .is("converted_to_credits_at", null);

    if (paidSnapshotsError) {
      console.error("Error loading paid snapshots:", paidSnapshotsError);
      throw new Error("Failed to load payment snapshots");
    }

    const convertedAt = new Date().toISOString();

    for (const payment of paidSnapshots || []) {
      const amountToCredit = Number(payment.court_amount || 0) / 100;

      if (amountToCredit > 0) {
        const { error: creditError } = await supabaseAdmin.rpc("add_user_credits", {
          p_user_id: payment.user_id,
          p_amount: amountToCredit,
          p_reason: "Quick challenge cancelled",
          p_session_id: null,
          p_payment_id: null,
        });

        if (creditError) {
          console.error("Error crediting user during organizer cancellation:", creditError);
          throw new Error("Failed to convert payments to credits");
        }
      }

      const { error: updatePaymentError } = await supabaseAdmin
        .from("quick_challenge_payments")
        .update({
          status: "converted_to_credits",
          converted_to_credits_at: convertedAt,
        })
        .eq("id", payment.id)
        .is("converted_to_credits_at", null);

      if (updatePaymentError) {
        console.error("Error marking payment as converted during organizer cancellation:", updatePaymentError);
        throw new Error("Failed to update payment conversion status");
      }
    }

    const { error: challengeUpdateError } = await supabaseAdmin
      .from("quick_challenges")
      .update({ status: "cancelled" })
      .eq("id", challengeId);

    if (challengeUpdateError) {
      console.error("Error cancelling challenge:", challengeUpdateError);
      throw new Error("Failed to cancel challenge");
    }

    return new Response(
      JSON.stringify({
        success: true,
        convertedCount: (paidSnapshots || []).length,
        message: "The challenge has been cancelled and paid amounts were converted to credits.",
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("Error in cancel-quick-challenge:", errorMessage);
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
