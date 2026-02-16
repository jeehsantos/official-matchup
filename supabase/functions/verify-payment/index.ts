import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/**
 * verify-payment now only polls DB state (webhook is source of truth).
 * No Stripe API calls, no direct confirmation logic.
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
    const { sessionId, userId } = await req.json();

    if (!sessionId || !userId) {
      throw new Error("sessionId and userId are required");
    }

    // Check payment status from DB (set by webhook)
    const { data: payment, error: paymentError } = await supabaseAdmin
      .from("payments")
      .select("id, status, amount, paid_with_credits, paid_at")
      .eq("session_id", sessionId)
      .eq("user_id", userId)
      .maybeSingle();

    if (paymentError) {
      throw new Error("Failed to fetch payment status");
    }

    // Check player confirmation status
    const { data: player } = await supabaseAdmin
      .from("session_players")
      .select("is_confirmed, confirmed_at")
      .eq("session_id", sessionId)
      .eq("user_id", userId)
      .maybeSingle();

    const isCompleted = payment?.status === "completed" || payment?.status === "transferred";
    const isConfirmed = player?.is_confirmed === true;

    return new Response(JSON.stringify({
      success: isCompleted && isConfirmed,
      status: payment?.status || "not_found",
      isConfirmed,
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
