import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
  apiVersion: "2024-12-18.acacia",
});

const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET") || "";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "*",
      },
    });
  }

  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const signature = req.headers.get("stripe-signature");
  if (!signature) {
    console.error("Missing Stripe-Signature header");
    return new Response("Missing signature", { status: 400 });
  }

  const body = await req.text();

  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(
      body,
      signature,
      webhookSecret,
      undefined,
      Stripe.createSubtleCryptoProvider()
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("Webhook signature verification failed:", msg);
    return new Response("Invalid signature", { status: 400 });
  }

  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );

  console.log("Webhook event received:", event.type, event.id);

  try {
    if (event.type === "checkout.session.completed") {
      await handleCheckoutCompleted(event, supabaseAdmin);
    } else if (event.type === "payment_intent.succeeded") {
      await handlePaymentIntentSucceeded(event, supabaseAdmin);
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`Error processing ${event.type}:`, msg);
    return new Response(JSON.stringify({ received: true, error: msg }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify({ received: true }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
});

// ── payment_intent.succeeded: store actual Stripe fee ──────────────────────
async function handlePaymentIntentSucceeded(
  event: Stripe.Event,
  supabaseAdmin: ReturnType<typeof createClient>
) {
  const paymentIntent = event.data.object as Stripe.PaymentIntent;
  const piId = paymentIntent.id;

  // Retrieve the PI with the latest charge expanded to get balance_transaction
  let stripeFeeActual: number | null = null;
  let stripeNetAmount: number | null = null;

  try {
    const pi = await stripe.paymentIntents.retrieve(piId, {
      expand: ["latest_charge.balance_transaction"],
    });

    const charge = pi.latest_charge as Stripe.Charge | null;
    if (charge) {
      const bt = charge.balance_transaction as Stripe.BalanceTransaction | null;
      if (bt) {
        stripeFeeActual = bt.fee; // in cents
        stripeNetAmount = bt.net; // in cents
      }
    }
  } catch (err) {
    console.error("Failed to retrieve balance_transaction (non-fatal):", err);
  }

  if (stripeFeeActual !== null) {
    // Store fee in dollars on the payment row (convert from cents)
    // Idempotent guard: do not clobber an already recorded value.
    const { error } = await supabaseAdmin
      .from("payments")
      .update({ stripe_fee_actual: stripeFeeActual / 100 })
      .eq("stripe_payment_intent_id", piId)
      .is("stripe_fee_actual", null);

    if (error) {
      console.error("Failed to store stripe_fee_actual:", error);
    } else {
      console.log("Stored stripe_fee_actual:", stripeFeeActual / 100, "for PI:", piId);
    }

    const { error: quickChallengeFeeUpdateError } = await supabaseAdmin
      .from("quick_challenge_payments")
      .update({ stripe_fee_actual: stripeFeeActual })
      .eq("stripe_payment_intent_id", piId)
      .is("stripe_fee_actual", null);

    if (quickChallengeFeeUpdateError) {
      console.error("Failed to store quick challenge stripe_fee_actual:", quickChallengeFeeUpdateError);
    }
  }
}

// ── checkout.session.completed ─────────────────────────────────────────────
async function handleCheckoutCompleted(
  event: Stripe.Event,
  supabaseAdmin: ReturnType<typeof createClient>
) {
  const session = event.data.object as Stripe.Checkout.Session;
  const metadata = session.metadata || {};

  const isQuickChallenge = metadata.type === "quick_challenge";

  if (isQuickChallenge) {
    await handleQuickChallengePayment(session, metadata, supabaseAdmin);
  } else {
    await handleSessionPayment(session, metadata, supabaseAdmin);
  }
}

async function handleSessionPayment(
  session: Stripe.Checkout.Session,
  metadata: Record<string, string>,
  supabaseAdmin: ReturnType<typeof createClient>
) {
  const sessionId = metadata.session_id;
  const userId = metadata.payer_user_id || metadata.user_id;
  const paymentIntentId = session.payment_intent as string;

  if (!sessionId || !userId) {
    console.error("Missing session_id or user_id in metadata");
    return;
  }

  // Idempotency: check if already processed
  const { data: existing } = await supabaseAdmin
    .from("payments")
    .select("id, status")
    .eq("stripe_payment_intent_id", paymentIntentId)
    .maybeSingle();

  if (existing?.status === "completed" || existing?.status === "transferred") {
    console.log("Payment already processed, skipping:", paymentIntentId);
    return;
  }

  // Read snapshot values from metadata (accept both legacy + new keys)
  const serviceFeeCents = parseFloat(metadata.service_fee_total ?? metadata.service_fee ?? "0");
  const platformProfitCents = parseFloat(metadata.platform_fee_target ?? metadata.platform_fee ?? "0");
  const courtAmountCents = parseFloat(metadata.court_amount ?? metadata.court_share ?? "0");
  const totalChargeCents = parseFloat(metadata.total_charge ?? metadata.total ?? "0");

  const courtAmountSnapshot = courtAmountCents / 100;
  const serviceFeeSnapshot = serviceFeeCents / 100;
  const platformProfitSnapshot = platformProfitCents / 100;
  const totalChargeSnapshot = totalChargeCents / 100;
  const paymentTypeSnapshot = metadata.payment_type || null;

  // Fallback: use amount_total if total_charge not in metadata
  const totalChargeDollars = totalChargeSnapshot > 0
    ? totalChargeSnapshot
    : (session.amount_total || 0) / 100;

  // Legacy fields for backward compat
  const creditsApplied = parseFloat(metadata.credits_applied || "0");

  let stripeFeeActual: number | null = null;
  if (paymentIntentId) {
    try {
      const pi = await stripe.paymentIntents.retrieve(paymentIntentId, {
        expand: ["latest_charge.balance_transaction"],
      });
      const latestCharge = pi.latest_charge as Stripe.Charge | null;
      const balanceTx = latestCharge?.balance_transaction as Stripe.BalanceTransaction | null;
      if (balanceTx?.fee != null) {
        stripeFeeActual = balanceTx.fee / 100;
      }
    } catch (feeErr) {
      console.error("Unable to retrieve Stripe fee (non-fatal):", feeErr);
    }
  }

  const paymentPayload = {
    session_id: sessionId,
    user_id: userId,
    amount: totalChargeDollars,
    paid_with_credits: creditsApplied,
    platform_fee: platformProfitSnapshot,
    court_amount: courtAmountSnapshot > 0 ? courtAmountSnapshot : null,
    service_fee: serviceFeeSnapshot > 0 ? serviceFeeSnapshot : null,
    platform_profit_target: platformProfitSnapshot > 0 ? platformProfitSnapshot : null,
    service_fee_total: serviceFeeSnapshot > 0 ? serviceFeeSnapshot : null,
    payment_type_snapshot: paymentTypeSnapshot,
    payment_method_type: "card",
    stripe_fee_actual: stripeFeeActual,
    status: "completed",
    paid_at: new Date().toISOString(),
    stripe_payment_intent_id: paymentIntentId,
  };

  // Upsert payment record with snapshots
  const { error: upsertError } = await supabaseAdmin
    .from("payments")
    .upsert(
      paymentPayload,
      { onConflict: "stripe_payment_intent_id" }
    );

  if (upsertError) {
    console.error("Payment upsert failed:", upsertError);
    return;
  }

  // Determine payment mode for confirmation logic
  const isSplit = paymentTypeSnapshot === "split";
  const isOrganizerPaysFull = paymentTypeSnapshot === "single";

  if (isSplit) {
    // Split: confirm this payer's participation
    await supabaseAdmin
      .from("session_players")
      .update({
        is_confirmed: true,
        confirmed_at: new Date().toISOString(),
      })
      .eq("session_id", sessionId)
      .eq("user_id", userId);
  } else {
    // Organizer pays full: confirm organizer's participation only
    // (other players are not auto-confirmed)
    await supabaseAdmin
      .from("session_players")
      .update({
        is_confirmed: true,
        confirmed_at: new Date().toISOString(),
      })
      .eq("session_id", sessionId)
      .eq("user_id", userId);
  }

  // Update court availability payment status
  await supabaseAdmin
    .from("court_availability")
    .update({ payment_status: "completed", is_booked: true })
    .eq("booked_by_session_id", sessionId);

  // Process referral credit
  try {
    await supabaseAdmin.rpc("process_referral_credit", {
      p_referred_user_id: userId,
    });
  } catch (refErr) {
    console.error("Referral credit error (non-fatal):", refErr);
  }

  // Recalculate session confirmation and maybe trigger payout
  try {
    const { data: rpcResult } = await supabaseAdmin.rpc("recalculate_and_maybe_confirm_session", {
      p_session_id: sessionId,
    });

    const result = rpcResult as any;
    if (result?.session_confirmed) {
      console.log("Session confirmed — triggering payout:", sessionId);
      try {
        const payoutResponse = await fetch(
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
        const payoutResult = await payoutResponse.json();
        if (!payoutResult.success) {
          console.error("Payout failed (non-fatal):", payoutResult.error);
        } else {
          console.log("Payout completed:", payoutResult);
        }
      } catch (payoutErr) {
        console.error("Payout call error (non-fatal):", payoutErr);
      }
    } else {
      console.log("Session not yet confirmed:", result);
    }
  } catch (rpcErr) {
    console.error("Session recalculation error (non-fatal):", rpcErr);
  }

  console.log("Session payment processed:", {
    sessionId,
    userId,
    totalCharge: totalChargeDollars,
    courtAmount: courtAmountSnapshot,
    serviceFee: serviceFeeSnapshot,
    paymentType: paymentTypeSnapshot,
    paymentIntentId,
  });
}

async function handleQuickChallengePayment(
  session: Stripe.Checkout.Session,
  metadata: Record<string, string>,
  supabaseAdmin: ReturnType<typeof createClient>
) {
  const challengeId = metadata.challenge_id;
  const playerRecordId = metadata.player_record_id;
  const userId = metadata.user_id;
  const paymentIntentId = session.payment_intent as string | null;

  if (!challengeId || !playerRecordId || !userId) {
    console.error("Missing quick challenge metadata");
    return;
  }

  // Idempotency: check if already paid
  const { data: player } = await supabaseAdmin
    .from("quick_challenge_players")
    .select("payment_status")
    .eq("id", playerRecordId)
    .single();

  const paidAt = new Date().toISOString();
  const courtAmountCents = Number(metadata.court_amount || 0);
  const platformProfitTargetCents = Number(metadata.platform_fee_target || metadata.platform_fee || 0);
  const serviceFeeTotalCents = Number(metadata.service_fee_total || metadata.service_fee || 0);

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
      console.error("Unable to retrieve Stripe fee for quick challenge webhook (non-fatal):", feeErr);
    }
  }

  if (paymentIntentId) {
    const quickPaymentPayload = {
      challenge_id: challengeId,
      user_id: userId,
      amount: session.amount_total || 0,
      court_amount: courtAmountCents,
      platform_profit_target: platformProfitTargetCents,
      service_fee_total: serviceFeeTotalCents,
      payment_method_type: "card",
      stripe_payment_intent_id: paymentIntentId,
      stripe_fee_actual: stripeFeeActualCents,
      status: "completed",
      paid_at: paidAt,
    };

    const { error: quickPaymentUpsertError } = await supabaseAdmin
      .from("quick_challenge_payments")
      .upsert(quickPaymentPayload, {
        onConflict: "challenge_id,user_id,stripe_payment_intent_id",
      });

    if (quickPaymentUpsertError) {
      console.error("Failed to upsert quick challenge payment snapshot:", quickPaymentUpsertError);
      return;
    }
  }

  if (player?.payment_status === "paid") {
    console.log("Quick challenge player already paid, skipping:", playerRecordId);
    return;
  }

  // Mark player as paid
  await supabaseAdmin
    .from("quick_challenge_players")
    .update({
      payment_status: "paid",
      paid_at: paidAt,
      stripe_session_id: session.id,
    })
    .eq("id", playerRecordId);

  // Check and update challenge status
  const { data: challenge } = await supabaseAdmin
    .from("quick_challenges")
    .select("total_slots, quick_challenge_players(payment_status)")
    .eq("id", challengeId)
    .single();

  if (challenge) {
    const players = (challenge as any).quick_challenge_players || [];
    const paidCount = players.filter(
      (p: { payment_status: string }) => p.payment_status === "paid"
    ).length;

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
    }
  }

  // Process referral credit
  try {
    await supabaseAdmin.rpc("process_referral_credit", {
      p_referred_user_id: userId,
    });
  } catch (refErr) {
    console.error("Referral credit error (non-fatal):", refErr);
  }

  console.log("Quick challenge payment processed:", {
    challengeId,
    playerRecordId,
    userId,
    totalCharged: (session.amount_total || 0) / 100,
    platformFee: parseFloat(metadata.platform_fee || "0") / 100,
  });
}
