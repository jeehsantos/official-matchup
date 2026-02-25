import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";

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

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { checkoutSessionId, challengeId } = await req.json();

    if (!checkoutSessionId) {
      throw new Error("Checkout session ID is required");
    }

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
      apiVersion: "2024-12-18.acacia",
    });

    const checkoutSession = await stripe.checkout.sessions.retrieve(checkoutSessionId);
    const resolvedChallengeId = challengeId || checkoutSession.metadata?.challenge_id || null;

    if (checkoutSession.payment_status !== "paid") {
      return buildResponse({
        success: true,
        status: PENDING_STATUS,
        challengeId: resolvedChallengeId,
        webhookAuthority: true,
        nextAction: NEXT_ACTION,
      });
    }

    return buildResponse({
      success: true,
      status: WEBHOOK_WAITING_STATUS,
      challengeId: resolvedChallengeId,
      webhookAuthority: true,
      nextAction: NEXT_ACTION,
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
