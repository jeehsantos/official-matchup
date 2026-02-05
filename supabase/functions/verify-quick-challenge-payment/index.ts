import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
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

    // Check if all players are now paid and update challenge status
    await checkAndUpdateChallengeStatus(supabaseClient, actualChallengeId);

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
