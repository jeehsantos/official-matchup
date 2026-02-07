import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Platform fee: $1.50 fixed
const PLATFORM_FEE = 150; // in cents

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );

  try {
    const { challengeId, origin } = await req.json();

    if (!challengeId) {
      throw new Error("Challenge ID is required");
    }

    // Get authorization header for user context
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("Authorization required");
    }

    // Get user from auth header
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      {
        global: {
          headers: { Authorization: authHeader },
        },
      }
    );

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) {
      throw new Error("User not authenticated");
    }

    // Fetch challenge with venue info
    const { data: challenge, error: challengeError } = await supabaseAdmin
      .from("quick_challenges")
      .select(`
        *,
        venues (
          id,
          name,
          stripe_account_id
        ),
        courts (
          id,
          name
        ),
        sport_categories (
          name,
          display_name
        )
      `)
      .eq("id", challengeId)
      .single();

    if (challengeError || !challenge) {
      console.error("Challenge fetch error:", challengeError);
      throw new Error("Challenge not found");
    }

    // Verify user is a player in this challenge
    const { data: playerRecord, error: playerError } = await supabaseAdmin
      .from("quick_challenge_players")
      .select("id, payment_status")
      .eq("challenge_id", challengeId)
      .eq("user_id", user.id)
      .single();

    if (playerError || !playerRecord) {
      throw new Error("You must join the challenge before paying");
    }

    if (playerRecord.payment_status === "paid") {
      throw new Error("You have already paid for this challenge");
    }

    const venue = challenge.venues;
    const court = challenge.courts;
    const sport = challenge.sport_categories;

    // Calculate amount in cents
    const amountCents = Math.round((challenge.price_per_player || 0) * 100);

    if (amountCents <= 0) {
      // Free challenge - mark as paid immediately
      await supabaseAdmin
        .from("quick_challenge_players")
        .update({
          payment_status: "paid",
          paid_at: new Date().toISOString(),
        })
        .eq("id", playerRecord.id);

      // Check if all players are now paid and update challenge status
      await checkAndUpdateChallengeStatus(supabaseAdmin, challengeId);

      return new Response(JSON.stringify({
        success: true,
        message: "Free challenge - confirmed!",
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    // Create Stripe checkout session
    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
      apiVersion: "2024-12-18.acacia",
    });

    // Build success and cancel URLs - redirect back to lobby
    const baseUrl = origin || "https://sportarenaxp.lovable.app";
    const successUrl = `${baseUrl}/quick-games/${challengeId}?payment=success&checkout_session_id={CHECKOUT_SESSION_ID}`;
    const cancelUrl = `${baseUrl}/quick-games/${challengeId}?payment=cancelled`;

    // Build description
    const description = [
      sport?.display_name || "Quick Match",
      challenge.game_mode,
      venue?.name,
      challenge.scheduled_date ? `on ${challenge.scheduled_date}` : "",
    ].filter(Boolean).join(" - ");

    // Build line items
    const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = [
      {
        price_data: {
          currency: "nzd",
          product_data: {
            name: `Quick Match: ${challenge.game_mode}`,
            description,
          },
          unit_amount: amountCents,
        },
        quantity: 1,
      },
    ];

    // Check if venue has Stripe Connect account
    const stripeAccountId = venue?.stripe_account_id;
    
    const sessionParams: Stripe.Checkout.SessionCreateParams = {
      payment_method_types: ["card"],
      line_items: lineItems,
      mode: "payment",
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: {
        challenge_id: challengeId,
        player_record_id: playerRecord.id,
        user_id: user.id,
        type: "quick_challenge",
      },
    };

    // Enable Apple Pay and Google Pay by adding wallet support
    // Note: These are automatically enabled when using "card" payment method
    // Apple Pay requires domain verification in Stripe dashboard

    // If venue has Stripe Connect, set up destination charge
    if (stripeAccountId) {
      const applicationFee = Math.min(PLATFORM_FEE, amountCents);
      sessionParams.payment_intent_data = {
        application_fee_amount: applicationFee,
        transfer_data: {
          destination: stripeAccountId,
        },
      };
      console.log(`Stripe Connect destination charge - Account: ${stripeAccountId}, Fee: $${applicationFee / 100}`);
    } else {
      console.log("No Stripe Connect account - platform receives full payment");
    }

    const checkoutSession = await stripe.checkout.sessions.create(sessionParams);

    console.log(`Quick challenge checkout session created: ${checkoutSession.id}`);

    // Store the checkout session ID on the player record
    await supabaseAdmin
      .from("quick_challenge_players")
      .update({
        stripe_session_id: checkoutSession.id,
      })
      .eq("id", playerRecord.id);

    return new Response(JSON.stringify({
      url: checkoutSession.url,
      checkoutSessionId: checkoutSession.id,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("Error creating quick challenge payment:", errorMessage);
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
