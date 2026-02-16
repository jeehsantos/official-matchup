import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/**
 * verify-payment polls DB state first (webhook is source of truth).
 * If DB still shows "pending", falls back to checking Stripe API directly
 * and processes the payment inline — resilient against webhook delays.
 */
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );

  try {
    const { sessionId, userId, checkoutSessionId } = await req.json();

    if (!sessionId || !userId) {
      throw new Error("sessionId and userId are required");
    }

    // Check payment status from DB (set by webhook)
    const { data: payment, error: paymentError } = await supabaseAdmin
      .from("payments")
      .select("id, status, amount, paid_with_credits, paid_at, stripe_payment_intent_id")
      .eq("session_id", sessionId)
      .eq("user_id", userId)
      .maybeSingle();

    if (paymentError) {
      throw new Error("Failed to fetch payment status");
    }

    const isAlreadyCompleted = payment?.status === "completed" || payment?.status === "transferred";

    // If already completed by webhook, return immediately
    if (isAlreadyCompleted) {
      const { data: player } = await supabaseAdmin
        .from("session_players")
        .select("is_confirmed")
        .eq("session_id", sessionId)
        .eq("user_id", userId)
        .maybeSingle();

      return new Response(JSON.stringify({
        success: true,
        status: payment.status,
        isConfirmed: player?.is_confirmed === true,
        payment: {
          amount: payment.amount,
          paidWithCredits: payment.paid_with_credits,
          paidAt: payment.paid_at,
        },
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    // --- FALLBACK: Check Stripe directly if webhook hasn't processed yet ---
    if (checkoutSessionId && payment?.status === "pending") {
      console.log("DB still pending, checking Stripe directly for:", checkoutSessionId);

      const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
        apiVersion: "2024-12-18.acacia",
      });

      const checkoutSession = await stripe.checkout.sessions.retrieve(checkoutSessionId);

      if (checkoutSession.payment_status === "paid") {
        console.log("Stripe confirms payment — processing inline");

        const metadata = checkoutSession.metadata || {};
        const platformFeeCents = parseFloat(metadata.platform_fee || "0");
        const platformFeeDollars = platformFeeCents / 100;
        const totalChargeDollars = (checkoutSession.amount_total || 0) / 100;
        const creditsApplied = parseFloat(metadata.credits_applied || "0");
        const paymentIntentId = checkoutSession.payment_intent as string;

        // Update payment record
        await supabaseAdmin
          .from("payments")
          .update({
            amount: totalChargeDollars,
            paid_with_credits: creditsApplied,
            platform_fee: platformFeeDollars,
            status: "completed",
            paid_at: new Date().toISOString(),
            stripe_payment_intent_id: paymentIntentId,
          })
          .eq("session_id", sessionId)
          .eq("user_id", userId);

        // Confirm player participation
        await supabaseAdmin
          .from("session_players")
          .update({
            is_confirmed: true,
            confirmed_at: new Date().toISOString(),
          })
          .eq("session_id", sessionId)
          .eq("user_id", userId);

        // Update court availability payment status
        await supabaseAdmin
          .from("court_availability")
          .update({ payment_status: "completed" })
          .eq("booked_by_session_id", sessionId);

        // Process referral credit (non-fatal)
        try {
          await supabaseAdmin.rpc("process_referral_credit", {
            p_referred_user_id: userId,
          });
        } catch (refErr) {
          console.error("Referral credit error (non-fatal):", refErr);
        }

        // Recalculate session
        try {
          const { data: rpcResult } = await supabaseAdmin.rpc("recalculate_and_maybe_confirm_session", {
            p_session_id: sessionId,
          });
          const result = rpcResult as any;
          if (result?.session_confirmed) {
            console.log("Session confirmed via verify fallback — triggering payout");
            await fetch(
              `${Deno.env.get("SUPABASE_URL")}/functions/v1/payout-session`,
              {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
                },
                body: JSON.stringify({ sessionId }),
              }
            );
          }
        } catch (rpcErr) {
          console.error("Session recalculation error (non-fatal):", rpcErr);
        }

        console.log("Payment processed via verify fallback:", {
          sessionId,
          userId,
          totalCharge: totalChargeDollars,
          platformFee: platformFeeDollars,
        });

        return new Response(JSON.stringify({
          success: true,
          status: "completed",
          isConfirmed: true,
          payment: {
            amount: totalChargeDollars,
            paidWithCredits: creditsApplied,
            paidAt: new Date().toISOString(),
          },
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        });
      }
    }

    // Not yet completed
    return new Response(JSON.stringify({
      success: false,
      status: payment?.status || "not_found",
      isConfirmed: false,
      payment: payment ? {
        amount: payment.amount,
        paidWithCredits: payment.paid_with_credits,
        paidAt: payment.paid_at,
      } : null,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("Error in verify-payment:", errorMessage);
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
