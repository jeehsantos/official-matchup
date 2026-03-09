import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { calculateGrossUp } from "../_shared/feeCalc.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );

  try {
    const { challengeId, origin, useCredits, attempt, cancelToCourt } = await req.json();

    if (!challengeId) {
      throw new Error("Challenge ID is required");
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("Authorization required");
    }

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) {
      throw new Error("User not authenticated");
    }

    // Fetch admin-configured platform fee — NEVER hardcode
    const { data: platformSettings } = await supabaseAdmin
      .from("platform_settings")
      .select("player_fee, manager_fee_percentage, stripe_percent, stripe_fixed")
      .eq("is_active", true)
      .limit(1)
      .single();

    const playerFeeDollars = Number(platformSettings?.player_fee ?? 0);
    const playerFeeCents = Math.round(playerFeeDollars * 100);
    const stripePercent = Number(platformSettings?.stripe_percent ?? 0.029);
    const stripeFixedCents = Math.round(Number(platformSettings?.stripe_fixed ?? 0.30) * 100);

    // Fetch challenge with venue info
    const { data: challenge, error: challengeError } = await supabaseAdmin
      .from("quick_challenges")
      .select(`
        *,
        venues (
          id,
          name
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

    // Fetch stripe_account_id from venue_payment_settings (security fix)
    let venueStripeAccountId: string | null = null;
    if (challenge.venue_id) {
      const { data: paymentSettings } = await supabaseAdmin
        .from("venue_payment_settings")
        .select("stripe_account_id")
        .eq("venue_id", challenge.venue_id)
        .maybeSingle();
      venueStripeAccountId = paymentSettings?.stripe_account_id || null;
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
    const pricePerPlayer = challenge.price_per_player || 0;
    // For "single" payment type, organizer pays the full court amount
    const courtShareDollars = challenge.payment_type === "single"
      ? pricePerPlayer * challenge.total_slots
      : pricePerPlayer;
    const courtShareCents = Math.round(courtShareDollars * 100);

    if (courtShareCents <= 0) {
      // Free challenge - mark as paid immediately (no platform fee)
      await supabaseAdmin
        .from("quick_challenge_players")
        .update({
          payment_status: "paid",
          paid_at: new Date().toISOString(),
        })
        .eq("id", playerRecord.id);

      await checkAndUpdateChallengeStatus(supabaseAdmin, challengeId);

      return new Response(JSON.stringify({
        success: true,
        message: "Free challenge - confirmed!",
        platformFee: 0,
        courtShare: 0,
        total: 0,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    // --- CREDITS PAYMENT FLOW ---
    if (useCredits) {
      const { data: creditBalance, error: creditError } = await supabaseAdmin
        .rpc("get_user_credits", { p_user_id: user.id });

      if (creditError) {
        console.error("Error fetching credits:", creditError);
        throw new Error("Failed to check credit balance");
      }

      const balance = Number(creditBalance) || 0;

      if (balance < courtShareDollars) {
        throw new Error("Insufficient credits");
      }

      // Deduct credits (no platform fee for credits-only)
      const { data: useResult, error: useError } = await supabaseAdmin
        .rpc("use_user_credits", {
          p_user_id: user.id,
          p_amount: courtShareDollars,
          p_reason: `Quick Match payment: ${challenge.game_mode}`,
          p_session_id: null,
        });

      if (useError || useResult !== true) {
        console.error("Error using credits:", useError);
        throw new Error("Failed to deduct credits");
      }

      const paidAt = new Date().toISOString();

      await supabaseAdmin
        .from("quick_challenge_players")
        .update({
          payment_status: "paid",
          paid_at: paidAt,
        })
        .eq("id", playerRecord.id);

      const snapshotPayload = {
        challenge_id: challengeId,
        user_id: user.id,
        amount: courtShareCents,
        court_amount: courtShareCents,
        platform_profit_target: 0,
        service_fee_total: 0,
        payment_method_type: "credits",
        status: "completed",
        paid_at: paidAt,
      };

      const { data: existingCreditSnapshot } = await supabaseAdmin
        .from("quick_challenge_payments")
        .select("id")
        .eq("challenge_id", challengeId)
        .eq("user_id", user.id)
        .is("stripe_payment_intent_id", null)
        .maybeSingle();

      if (existingCreditSnapshot?.id) {
        const { error: updateSnapshotError } = await supabaseAdmin
          .from("quick_challenge_payments")
          .update(snapshotPayload)
          .eq("id", existingCreditSnapshot.id);

        if (updateSnapshotError) {
          console.error("Error updating credits snapshot:", updateSnapshotError);
          throw new Error("Failed to store payment snapshot");
        }
      } else {
        const { error: insertSnapshotError } = await supabaseAdmin
          .from("quick_challenge_payments")
          .insert(snapshotPayload);

        if (insertSnapshotError) {
          console.error("Error inserting credits snapshot:", insertSnapshotError);
          throw new Error("Failed to store payment snapshot");
        }
      }

      await checkAndUpdateChallengeStatus(supabaseAdmin, challengeId);

      // Mark court slot as booked for credits payment (no webhook will fire)
      if (challenge.court_id && challenge.scheduled_date && challenge.scheduled_time) {
        const { error: courtUpdateError } = await supabaseAdmin
          .from("court_availability")
          .update({ is_booked: true, payment_status: "completed" })
          .eq("court_id", challenge.court_id)
          .eq("available_date", challenge.scheduled_date)
          .eq("start_time", challenge.scheduled_time)
          .eq("booked_by_user_id", user.id);

        if (courtUpdateError) {
          console.error("Failed to mark court slot as booked after credits payment:", courtUpdateError);
        }
      }

      // Process referral credit for credits-only payment
      try {
        await supabaseAdmin.rpc("process_referral_credit", { p_referred_user_id: user.id });
      } catch (e) { console.error("Referral credit error (non-fatal):", e); }

      console.log(`Quick challenge paid with credits - User: ${user.id}, Amount: $${pricePerPlayer}`);

      return new Response(JSON.stringify({
        success: true,
        message: `Payment of $${pricePerPlayer.toFixed(2)} completed using your credits.`,
        platformFee: 0,
        courtShare: pricePerPlayer,
        total: pricePerPlayer,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    // --- STRIPE PAYMENT FLOW ---
    // Use shared gross-up calculator with dynamic Stripe config
    const grossUp = calculateGrossUp({
      courtAmountCents: courtShareCents,
      platformFeeCents: playerFeeCents,
      stripePercent,
      stripeFixedCents,
    });
    const { serviceFeeTotalCents, stripeFeeCoverageCents, totalChargeCents, grossTotalCents } = grossUp;

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
      apiVersion: "2024-12-18.acacia",
    });

    const court = challenge.courts;
    const sport = challenge.sport_categories;

    const baseUrl = origin || "https://sportarenaxp.lovable.app";
    const successUrl = `${baseUrl}/quick-games/${challengeId}?payment=success&checkout_session_id={CHECKOUT_SESSION_ID}`;
    const cancelUrl = cancelToCourt && challenge.court_id
      ? `${baseUrl}/courts/${challenge.court_id}?quickGame=true&payment=cancelled&challengeId=${challengeId}`
      : `${baseUrl}/quick-games/${challengeId}?payment=cancelled`;

    const description = [
      sport?.display_name || "Quick Match",
      challenge.game_mode,
      venue?.name,
      challenge.scheduled_date ? `on ${challenge.scheduled_date}` : "",
    ].filter(Boolean).join(" - ");

    // Two line items: court price + service fee
    const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = [
      {
        price_data: {
          currency: "nzd",
          product_data: {
            name: `Quick Match: ${challenge.game_mode}`,
            description,
          },
          unit_amount: courtShareCents,
        },
        quantity: 1,
      },
    ];

    // Add service fee as separate line item (only if > 0)
    if (serviceFeeTotalCents > 0) {
      lineItems.push({
        price_data: {
          currency: "nzd",
          product_data: {
            name: "Service Fee",
            description: "Service fee",
          },
          unit_amount: serviceFeeTotalCents,
        },
        quantity: 1,
      });
    }

    const sessionParams: Stripe.Checkout.SessionCreateParams = {
      payment_method_types: ["card"],
      line_items: lineItems,
      mode: "payment",
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: {
        challenge_id: challengeId,
        user_id: user.id,
        recipient_cents: courtShareCents.toString(),
        platform_fee_cents: playerFeeCents.toString(),
        stripe_percent: stripePercent.toString(),
        stripe_fixed_cents: stripeFixedCents.toString(),
        gross_total_cents: grossTotalCents.toString(),
        service_fee_total_cents: serviceFeeTotalCents.toString(),
        stripe_fee_coverage_cents: stripeFeeCoverageCents.toString(),
        type: "quick_challenge",
        player_record_id: playerRecord.id,
        venue_stripe_account_id: venueStripeAccountId || "",
        destination_charge: venueStripeAccountId ? "true" : "false",
        court_id: challenge.court_id || "",
        scheduled_date: challenge.scheduled_date || "",
        scheduled_time: challenge.scheduled_time || "",
      },
    };

    // Destination-charge split for quick challenges
    if (venueStripeAccountId) {
      sessionParams.payment_intent_data = {
        application_fee_amount: serviceFeeTotalCents,
        transfer_data: {
          destination: venueStripeAccountId,
        },
      };
    }

    console.log(`Quick challenge checkout: court=${courtShareCents}c, serviceFee=${serviceFeeTotalCents}c, total=${totalChargeCents}c`);

    const normalizedAttempt = Number.isFinite(Number(attempt)) && Number(attempt) > 0
      ? Math.trunc(Number(attempt))
      : 1;
    const checkoutIdempotencyKey = `checkout:challenge:${challengeId}:user:${user.id}:attempt:${normalizedAttempt}`;

    const checkoutSession = await stripe.checkout.sessions.create(
      sessionParams,
      { idempotencyKey: checkoutIdempotencyKey }
    );

    console.log(`Quick challenge checkout session created: ${checkoutSession.id}`);

    await supabaseAdmin
      .from("quick_challenge_players")
      .update({
        stripe_session_id: checkoutSession.id,
      })
      .eq("id", playerRecord.id);

    return new Response(JSON.stringify({
      url: checkoutSession.url,
      checkoutSessionId: checkoutSession.id,
      court_amount: courtShareCents / 100,
      service_fee_total: serviceFeeTotalCents / 100,
      total_charge: totalChargeCents / 100,
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
  const { data: challenge } = await supabaseAdmin
    .from("quick_challenges")
    .select("status, total_slots, quick_challenge_players(payment_status)")
    .eq("id", challengeId)
    .single();

  if (!challenge) return;

  const players = (challenge as any).quick_challenge_players || [];
  const paidCount = players.filter((p: { payment_status: string }) => p.payment_status === "paid").length;

  if (paidCount >= (challenge as any).total_slots) {
    await supabaseAdmin
      .from("quick_challenges")
      .update({ status: "ready" })
      .eq("id", challengeId);
  } else if (players.length >= (challenge as any).total_slots) {
    await supabaseAdmin
      .from("quick_challenges")
      .update({ status: "full" })
      .eq("id", challengeId);
  } else if ((challenge as any).status === "pending_payment" && paidCount > 0) {
    await supabaseAdmin
      .from("quick_challenges")
      .update({ status: "open" })
      .eq("id", challengeId);
  }
}
