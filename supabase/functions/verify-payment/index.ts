import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const WEBHOOK_WAITING_STATUS = "paid_but_waiting_for_webhook";
const PENDING_STATUS = "pending";
const NEXT_ACTION = "poll_payments_table";

class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

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
  payment: { amount: unknown; paid_with_credits: unknown; paid_at: unknown } | null | undefined;
}) {
  return buildResponse({
    success: true,
    status,
    isConfirmed: false,
    webhookAuthority: true,
    payment: payment
      ? { amount: payment.amount, paidWithCredits: payment.paid_with_credits, paidAt: payment.paid_at }
      : null,
    nextAction: NEXT_ACTION,
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );

  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return new Response(JSON.stringify({ error: "Missing or invalid Authorization header" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 401,
    });
  }

  const supabaseAuth = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_ANON_KEY") ?? "",
    { global: { headers: { Authorization: authHeader } } }
  );

  try {
    const { data: { user }, error: userError } = await supabaseAuth.auth.getUser();
    if (userError || !user) {
      throw new HttpError(401, "Invalid or expired JWT");
    }

    const { sessionId, userId, checkoutSessionId } = await req.json();

    if (!userId) {
      throw new Error("userId is required");
    }

    if (user.id !== userId) {
      throw new HttpError(403, "Forbidden: user mismatch");
    }

    // ─── Deferred at_booking flow: sessionId may not be known yet ───
    if (!sessionId && checkoutSessionId) {
      return await handleDeferredVerification(checkoutSessionId, user.id, supabaseAdmin);
    }

    if (!sessionId) {
      throw new Error("sessionId is required");
    }

    // ─── Standard session-based verification ───
    const { data: payment, error: paymentError } = await supabaseAdmin
      .from("payments")
      .select("id, status, amount, paid_with_credits, paid_at, stripe_payment_intent_id")
      .eq("session_id", sessionId)
      .eq("user_id", user.id)
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
        .eq("user_id", user.id)
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
      const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
        apiVersion: "2024-12-18.acacia",
      });

      const checkoutSession = await stripe.checkout.sessions.retrieve(checkoutSessionId);

      if (checkoutSession.payment_status === "paid") {
        return buildPendingOrWaitingResponse({ status: WEBHOOK_WAITING_STATUS, payment });
      }

      return buildPendingOrWaitingResponse({ status: PENDING_STATUS, payment });
    }

    return buildPendingOrWaitingResponse({ status: PENDING_STATUS, payment });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const status = error instanceof HttpError ? error.status : 500;
    console.error("Error in verify-payment:", errorMessage);
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status,
    });
  }
});

// ─── Deferred verification: look up payment by Stripe checkout session ────
async function handleDeferredVerification(
  checkoutSessionId: string,
  userId: string,
  // deno-lint-ignore no-explicit-any
  supabaseAdmin: any
) {
  const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
    apiVersion: "2024-12-18.acacia",
  });

  const checkoutSession = await stripe.checkout.sessions.retrieve(checkoutSessionId);
  const paymentIntentId = checkoutSession.payment_intent as string;

  if (!paymentIntentId) {
    return buildPendingOrWaitingResponse({ status: PENDING_STATUS, payment: null });
  }

  // Look up payment by stripe_payment_intent_id (webhook creates this row)
  const { data: payment } = await supabaseAdmin
    .from("payments")
    .select("id, status, amount, paid_with_credits, paid_at, session_id")
    .eq("stripe_payment_intent_id", paymentIntentId)
    .eq("user_id", userId)
    .maybeSingle();

  if (payment && (payment.status === "completed" || payment.status === "transferred")) {
    return buildResponse({
      success: true,
      status: payment.status,
      isConfirmed: true,
      sessionId: payment.session_id, // Return the webhook-created session_id
      payment: {
        amount: payment.amount,
        paidWithCredits: payment.paid_with_credits,
        paidAt: payment.paid_at,
      },
      nextAction: "none",
    });
  }

  // Stripe shows paid but webhook hasn't processed yet
  if (checkoutSession.payment_status === "paid") {
    return buildPendingOrWaitingResponse({ status: WEBHOOK_WAITING_STATUS, payment: null });
  }

  return buildPendingOrWaitingResponse({ status: PENDING_STATUS, payment: null });
}
