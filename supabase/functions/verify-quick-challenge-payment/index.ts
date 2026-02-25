import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );

  try {
    const { checkoutSessionId, challengeId } = await req.json();

    if (!checkoutSessionId) {
      throw new Error("Checkout session ID is required");
    }

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
      apiVersion: "2024-12-18.acacia",
    });

    // Verify the checkout session
    const checkoutSession = await stripe.checkout.sessions.retrieve(checkoutSessionId);
    
    if (checkoutSession.payment_status !== "paid") {
      return new Response(JSON.stringify({ 
        success: false, 
        message: "Payment not completed" 
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    const metadata = checkoutSession.metadata || {};
    const playerRecordId = metadata.player_record_id;
    const userId = metadata.user_id;
    const actualChallengeId = metadata.challenge_id || challengeId;
    const paymentIntentId = checkoutSession.payment_intent as string | null;

    if (!playerRecordId) {
      throw new Error("Player record ID not found in session metadata");
    }

    // Update player payment status
    const { error: updateError } = await supabaseClient
      .from("quick_challenge_players")
      .update({
        payment_status: "paid",
        paid_at: new Date().toISOString(),
        stripe_session_id: checkoutSessionId,
      })
      .eq("id", playerRecordId);

    if (updateError) {
      console.error("Error updating player payment status:", updateError);
      throw new Error("Failed to update payment status");
    }

    const paidAt = new Date().toISOString();
    const courtAmountCents = Number(metadata.court_amount || 0);
    const platformProfitTargetCents = Number(metadata.platform_fee_target || 0);
    const serviceFeeTotalCents = Number(metadata.service_fee_total || 0);

    let stripeFeeActualCents: number | null = null;
    if (paymentIntentId) {
      try {
        const pi = await stripe.paymentIntents.retrieve(paymentIntentId, {
          expand: ["latest_charge.balance_transaction"],
        });
        const latestCharge = pi.latest_charge as Stripe.Charge | null;
        const balanceTx = latestCharge?.balance_transaction as Stripe.BalanceTransaction | null;
        if (balanceTx?.fee != null) {
          stripeFeeActualCents = balanceTx.fee;
        }
      } catch (feeErr) {
        console.error("Unable to retrieve Stripe fee for quick challenge verify (non-fatal):", feeErr);
      }
    }

    const quickChallengePaymentPayload = {
      challenge_id: actualChallengeId,
      user_id: userId,
      amount: checkoutSession.amount_total || 0,
      court_amount: courtAmountCents,
      platform_profit_target: platformProfitTargetCents,
      service_fee_total: serviceFeeTotalCents,
      payment_method_type: "card",
      stripe_payment_intent_id: paymentIntentId,
      stripe_fee_actual: stripeFeeActualCents,
      status: "completed",
      paid_at: paidAt,
    };

    if (paymentIntentId) {
      const { error: upsertQuickPaymentError } = await supabaseClient
        .from("quick_challenge_payments")
        .upsert(quickChallengePaymentPayload, {
          onConflict: "challenge_id,user_id,stripe_payment_intent_id",
        });

      if (upsertQuickPaymentError) {
        console.error("Error upserting quick challenge payment snapshot:", upsertQuickPaymentError);
        throw new Error("Failed to store quick challenge payment snapshot");
      }
    }

    // Check if all players are now paid and update challenge status
    await checkAndUpdateChallengeStatus(supabaseClient, actualChallengeId);

    // Process referral credit for the paying user (if they were referred)
    if (userId) {
      try {
        const { data: referralResult } = await supabaseClient.rpc("process_referral_credit", {
          p_referred_user_id: userId,
        });
        if (referralResult) {
          console.log("Referral credit awarded for user:", userId);
        }
      } catch (refError) {
        console.error("Error processing referral credit:", refError);
      }
    }

    console.log("Quick challenge payment verified:", {
      challengeId: actualChallengeId,
      playerId: playerRecordId,
      userId,
      amount: (checkoutSession.amount_total || 0) / 100,
    });

    return new Response(JSON.stringify({ 
      success: true,
      message: "Payment verified and confirmed",
      challengeId: actualChallengeId,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("Error verifying quick challenge payment:", errorMessage);
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});

async function checkAndUpdateChallengeStatus(
  supabaseAdmin: any,
  challengeId: string
) {
  // Get challenge and players
  const { data: challenge } = await supabaseAdmin
    .from("quick_challenges")
    .select("total_slots, quick_challenge_players(payment_status)")
    .eq("id", challengeId)
    .single();

  if (!challenge) return;

  const players = (challenge as any).quick_challenge_players || [];
  const paidCount = players.filter((p: { payment_status: string }) => p.payment_status === "paid").length;
  
  // If all slots are filled and paid, update status to "ready"
  if (paidCount >= (challenge as any).total_slots) {
    await supabaseAdmin
      .from("quick_challenges")
      .update({ status: "ready" })
      .eq("id", challengeId);
  } else if (players.length >= (challenge as any).total_slots) {
    // All slots filled but not all paid
    await supabaseAdmin
      .from("quick_challenges")
      .update({ status: "full" })
      .eq("id", challengeId);
  }
}
