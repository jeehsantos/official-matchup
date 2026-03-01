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

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

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

  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );

  try {
    const { data: { user }, error: userError } = await supabaseAuth.auth.getUser();
    if (userError || !user) {
      throw new HttpError(401, "Invalid or expired JWT");
    }

    const { checkoutSessionId, challengeId } = await req.json();

    if (!checkoutSessionId) {
      throw new Error("Checkout session ID is required");
    }

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
      apiVersion: "2024-12-18.acacia",
    });

    const checkoutSession = await stripe.checkout.sessions.retrieve(checkoutSessionId);
    const metadata = checkoutSession.metadata ?? {};

    if (metadata.user_id && metadata.user_id !== user.id) {
      throw new HttpError(403, "Forbidden: payment does not belong to caller");
    }

    const resolvedChallengeId = challengeId || metadata.challenge_id || null;
    if (!resolvedChallengeId) {
      throw new Error("Challenge ID could not be resolved");
    }

    const { data: challengePlayer, error: challengePlayerError } = await supabaseAdmin
      .from("quick_challenge_players")
      .select("id")
      .eq("challenge_id", resolvedChallengeId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (challengePlayerError) {
      throw new Error("Failed to verify challenge membership");
    }

    if (!challengePlayer) {
      throw new HttpError(403, "Forbidden: challenge does not belong to caller");
    }

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
    const status = error instanceof HttpError ? error.status : 500;
    console.error("Error verifying quick challenge payment:", errorMessage);
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status,
    });
  }
});
