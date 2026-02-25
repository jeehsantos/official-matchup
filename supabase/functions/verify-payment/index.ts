import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const WEBHOOK_WAITING_STATUS = "paid_but_waiting_for_webhook";
const PENDING_STATUS = "pending";
const NEXT_ACTION = "poll_payments_table";

function buildResponse(payload: Record<string, unknown>) {
  return new Response(JSON.stringify(payload), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
    status: 200,
  });
}

function buildPendingOrWaitingResponse({
  status,
  payment,
}: {
  status: typeof PENDING_STATUS | typeof WEBHOOK_WAITING_STATUS;
  payment:
    | {
        amount: unknown;
        paid_with_credits: unknown;
        paid_at: unknown;
      }
    | null
    | undefined;
}) {
  return buildResponse({
    success: true,
    status,
    isConfirmed: false,
    webhookAuthority: true,
    payment: payment
      ? {
          amount: payment.amount,
          paidWithCredits: payment.paid_with_credits,
          paidAt: payment.paid_at,
        }
      : null,
    nextAction: NEXT_ACTION,
  });
}

/**
 * verify-payment checks DB state first.
 * Stripe webhook is the only authority that can finalize DB payment state.
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

    if (isAlreadyCompleted) {
      const { data: player } = await supabaseAdmin
        .from("session_players")
        .select("is_confirmed")
        .eq("session_id", sessionId)
        .eq("user_id", userId)
        .maybeSingle();

      return buildResponse({
        success: true,
        status: payment.status,
        isConfirmed: player?.is_confirmed === true,
        payment: {
          amount: payment.amount,
          paidWithCredits: payment.paid_with_credits,
          paidAt: payment.paid_at,
        },
        nextAction: "none",
      });
    }

    if (checkoutSessionId) {
      console.log("Checking Stripe checkout session status for:", checkoutSessionId);

      const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
        apiVersion: "2024-12-18.acacia",
      });

      const checkoutSession = await stripe.checkout.sessions.retrieve(checkoutSessionId);

      if (checkoutSession.payment_status === "paid") {
        console.log("Stripe shows paid; waiting for webhook to update DB", {
          sessionId,
          userId,
          checkoutSessionId,
        });

        return buildPendingOrWaitingResponse({
          status: WEBHOOK_WAITING_STATUS,
          payment,
        });
      }

      return buildPendingOrWaitingResponse({
        status: PENDING_STATUS,
        payment,
      });
    }

    return buildPendingOrWaitingResponse({
      status: PENDING_STATUS,
      payment,
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
