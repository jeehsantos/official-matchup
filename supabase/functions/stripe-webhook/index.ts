import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
  apiVersion: "2024-12-18.acacia",
});

const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET") || "";

class WebhookProcessingError extends Error {
  details: Record<string, unknown>;

  constructor(message: string, details: Record<string, unknown> = {}) {
    super(message);
    this.name = "WebhookProcessingError";
    this.details = details;
  }
}

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

  let idempotentDuplicate = false;
  try {
    if (event.type === "checkout.session.completed") {
      idempotentDuplicate = await handleCheckoutCompleted(event, supabaseAdmin);
    } else if (event.type === "payment_intent.succeeded") {
      await handlePaymentIntentSucceeded(event, supabaseAdmin);
    }
  } catch (err) {
    const error = err instanceof Error ? err : new Error(String(err));
    const details = err instanceof WebhookProcessingError ? err.details : {};

    console.error("stripe_webhook_event_failed", {
      eventId: event.id,
      eventType: event.type,
      errorName: error.name,
      errorMessage: error.message,
      details,
    });

    return new Response(
      JSON.stringify({
        received: false,
        error: "Webhook event processing failed",
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }

  return new Response(JSON.stringify({ received: true, duplicate: idempotentDuplicate }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
});

// ── payment_intent.succeeded: store actual Stripe fee ──────────────────────
async function handlePaymentIntentSucceeded(
  event: Stripe.Event,
  // deno-lint-ignore no-explicit-any
  supabaseAdmin: any
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
      throw new WebhookProcessingError("Failed to persist payments.stripe_fee_actual", {
        operation: "payments.update",
        table: "payments",
        stripePaymentIntentId: piId,
        error,
      });
    } else {
      console.log("Stored stripe_fee_actual:", stripeFeeActual / 100, "for PI:", piId);
    }

    const { error: quickChallengeFeeUpdateError } = await supabaseAdmin
      .from("quick_challenge_payments")
      .update({ stripe_fee_actual: stripeFeeActual })
      .eq("stripe_payment_intent_id", piId)
      .is("stripe_fee_actual", null);

    if (quickChallengeFeeUpdateError) {
      throw new WebhookProcessingError("Failed to persist quick_challenge_payments.stripe_fee_actual", {
        operation: "quick_challenge_payments.update",
        table: "quick_challenge_payments",
        stripePaymentIntentId: piId,
        error: quickChallengeFeeUpdateError,
      });
    }
  }
}

// ── checkout.session.completed ─────────────────────────────────────────────
async function handleCheckoutCompleted(
  event: Stripe.Event,
  // deno-lint-ignore no-explicit-any
  supabaseAdmin: any
): Promise<boolean> {
  const session = event.data.object as Stripe.Checkout.Session;
  const metadata = session.metadata || {};

  const isQuickChallenge = metadata.type === "quick_challenge";

  if (isQuickChallenge) {
    return await handleQuickChallengePayment(session, metadata, supabaseAdmin);
  } else {
    return await handleSessionPayment(session, metadata, supabaseAdmin);
  }
}

async function handleSessionPayment(
  session: Stripe.Checkout.Session,
  metadata: Record<string, string>,
  // deno-lint-ignore no-explicit-any
  supabaseAdmin: any
): Promise<boolean> {
  // Check for deferred at_booking flow (no DB session exists yet)
  if (metadata.deferred === "true") {
    return await handleDeferredSessionPayment(session, metadata, supabaseAdmin);
  }

  const sessionId = metadata.session_id;
  const userId = metadata.payer_user_id || metadata.user_id;
  const paymentIntentId = session.payment_intent as string;

  if (!sessionId || !userId) {
    throw new WebhookProcessingError("Missing required checkout metadata", {
      operation: "payments.validate_metadata",
      sessionId: session.id,
      hasSessionId: Boolean(sessionId),
      hasUserId: Boolean(userId),
    });
  }

  // Idempotency: check if already processed
  const { data: existing } = await supabaseAdmin
    .from("payments")
    .select("id, status")
    .eq("stripe_payment_intent_id", paymentIntentId)
    .maybeSingle();

  if (existing?.status === "completed" || existing?.status === "transferred") {
    console.log("Payment already processed, skipping:", paymentIntentId);
    return true;
  }

  // Read snapshot values from metadata (accept new keys first, then legacy fallbacks)
  const serviceFeeCents = parseFloat(metadata.service_fee_total_cents ?? metadata.service_fee_total ?? metadata.service_fee ?? "0");
  const platformProfitCents = parseFloat(metadata.platform_fee_cents ?? metadata.platform_fee_target ?? metadata.platform_fee ?? "0");
  const courtAmountCents = parseFloat(metadata.recipient_cents ?? metadata.court_amount ?? metadata.court_share ?? "0");
  const totalChargeCents = parseFloat(metadata.gross_total_cents ?? metadata.total_charge ?? metadata.total ?? "0");

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
    payment_type_snapshot: paymentTypeSnapshot,
    stripe_fee_actual: stripeFeeActual,
    status: "completed",
    paid_at: new Date().toISOString(),
    stripe_payment_intent_id: paymentIntentId,
  };

  // Upsert payment record with snapshots — match on session_id + user_id
  // (the row created by create-payment has stripe_payment_intent_id = null)
  const { error: upsertError } = await supabaseAdmin
    .from("payments")
    .upsert(
      paymentPayload,
      { onConflict: "session_id,user_id" }
    );

  if (upsertError) {
    throw new WebhookProcessingError("Failed to upsert payments snapshot", {
      operation: "payments.upsert",
      table: "payments",
      stripePaymentIntentId: paymentIntentId,
      sessionId,
      userId,
      error: upsertError,
    });
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

  return false;
}

// ── Deferred at_booking: create all records on payment confirmation ────────
async function handleDeferredSessionPayment(
  stripeSession: Stripe.Checkout.Session,
  metadata: Record<string, string>,
  // deno-lint-ignore no-explicit-any
  supabaseAdmin: any
): Promise<boolean> {
  const userId = metadata.user_id;
  const paymentIntentId = stripeSession.payment_intent as string;

  if (!userId) {
    throw new WebhookProcessingError("Missing user_id in deferred metadata", {
      operation: "deferred.validate",
      sessionId: stripeSession.id,
    });
  }

  // Idempotency: check if payment already exists for this PI
  const { data: existing } = await supabaseAdmin
    .from("payments")
    .select("id, status, session_id")
    .eq("stripe_payment_intent_id", paymentIntentId)
    .maybeSingle();

  if (existing?.status === "completed" || existing?.status === "transferred") {
    console.log("Deferred payment already processed, skipping:", paymentIntentId);
    return true;
  }

  // Extract booking details from metadata
  const groupId = metadata.group_id;
  const courtId = metadata.court_id;
  const sessionDate = metadata.session_date;
  const startTime = metadata.start_time;
  const endTime = metadata.end_time;
  const durationMinutes = parseInt(metadata.duration_minutes || "60");
  const paymentType = metadata.payment_type || "single";
  const splitPlayers = metadata.split_players ? parseInt(metadata.split_players) : null;
  const sportCategoryId = metadata.sport_category_id;
  const courtCapacity = parseInt(metadata.court_capacity || "10");
  const courtPriceDollars = parseFloat(metadata.court_price_dollars || "0");
  const holdId = metadata.hold_id || null;
  const equipmentJson = metadata.equipment_json || "[]";

  let equipment: any[] = [];
  try { equipment = JSON.parse(equipmentJson); } catch { equipment = []; }

  if (!groupId || !courtId || !sessionDate || !startTime || !endTime) {
    throw new WebhookProcessingError("Missing booking details in deferred metadata", {
      operation: "deferred.validate",
      metadata,
    });
  }

  // Convert hold if provided
  if (holdId) {
    try {
      const { data: holdResult } = await supabaseAdmin.rpc("convert_hold_to_booking", {
        p_hold_id: holdId,
      });
      if (holdResult && !holdResult.success) {
        console.error("Hold conversion failed (continuing anyway):", holdResult.error);
        // If slot was taken during payment, we still need to process since Stripe charged the user
        // The admin will need to handle refunds manually for this edge case
        if (holdResult.error === "SLOT_TAKEN_DURING_PAYMENT") {
          console.error("CRITICAL: Slot was taken during payment, Stripe already charged. Manual refund may be needed.");
          // Still attempt to create records — the court_availability insert will fail with overlap
        }
      }
    } catch (holdErr) {
      console.error("Hold conversion error (non-fatal):", holdErr);
    }
  }

  // Create session
  const { data: session, error: sessionError } = await supabaseAdmin
    .from("sessions")
    .insert({
      group_id: groupId,
      court_id: courtId,
      session_date: sessionDate,
      start_time: startTime,
      duration_minutes: durationMinutes,
      court_price: courtPriceDollars,
      min_players: paymentType === "split" && splitPlayers ? splitPlayers : 6,
      max_players: courtCapacity,
      payment_deadline: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
      state: "protected",
      payment_type: paymentType,
      sport_category_id: sportCategoryId,
    })
    .select("id")
    .single();

  if (sessionError || !session) {
    throw new WebhookProcessingError("Failed to create deferred session", {
      operation: "sessions.insert",
      error: sessionError,
    });
  }

  const sessionId = session.id;
  console.log("Deferred session created:", sessionId);

  // Create session_player
  const { error: spError } = await supabaseAdmin.from("session_players").insert({
    session_id: sessionId,
    user_id: userId,
    is_confirmed: true,
    confirmed_at: new Date().toISOString(),
  });
  if (spError) {
    throw new WebhookProcessingError("Failed to create session player", {
      operation: "session_players.insert",
      error: spError,
    });
  }

  // Create court_availability
  const { data: bookingRecord, error: caError } = await supabaseAdmin
    .from("court_availability")
    .insert({
      court_id: courtId,
      available_date: sessionDate,
      start_time: startTime,
      end_time: endTime,
      is_booked: true,
      booked_by_user_id: userId,
      booked_by_group_id: groupId,
      booked_by_session_id: sessionId,
      payment_status: "completed",
    })
    .select("id")
    .single();

  if (caError) {
    throw new WebhookProcessingError("Failed to create court availability", {
      operation: "court_availability.insert",
      error: caError,
    });
  }

  // Handle equipment
  if (equipment.length > 0 && bookingRecord) {
    const { error: eqError } = await supabaseAdmin.from("booking_equipment").insert(
      equipment.map((item: any) => ({
        booking_id: bookingRecord.id,
        equipment_id: item.equipmentId,
        quantity: item.quantity,
        price_at_booking: item.pricePerUnit,
      }))
    );
    if (eqError) console.error("Equipment insert error (non-fatal):", eqError);
  }

  // Create payment record with Stripe snapshots (accept new keys first, then legacy)
  const serviceFeeCents = parseFloat(metadata.service_fee_total_cents || metadata.service_fee_total || "0");
  const platformProfitCents = parseFloat(metadata.platform_fee_cents || metadata.platform_fee_target || "0");
  const courtAmountCents = parseFloat(metadata.recipient_cents || metadata.court_amount || "0");
  const totalChargeCents = parseFloat(metadata.gross_total_cents || metadata.total_charge || "0");
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

  const totalChargeDollars = totalChargeCents > 0
    ? totalChargeCents / 100
    : (stripeSession.amount_total || 0) / 100;

  const { error: paymentError } = await supabaseAdmin.from("payments").insert({
    session_id: sessionId,
    user_id: userId,
    amount: totalChargeDollars,
    paid_with_credits: creditsApplied,
    platform_fee: platformProfitCents / 100,
    court_amount: courtAmountCents > 0 ? courtAmountCents / 100 : null,
    service_fee: serviceFeeCents > 0 ? serviceFeeCents / 100 : null,
    payment_type_snapshot: paymentType,
    stripe_fee_actual: stripeFeeActual,
    status: "completed",
    paid_at: new Date().toISOString(),
    stripe_payment_intent_id: paymentIntentId,
  });

  if (paymentError) {
    throw new WebhookProcessingError("Failed to create deferred payment", {
      operation: "payments.insert",
      error: paymentError,
    });
  }

  // Process referral credit
  try {
    await supabaseAdmin.rpc("process_referral_credit", { p_referred_user_id: userId });
  } catch (refErr) {
    console.error("Referral credit error (non-fatal):", refErr);
  }

  // Recalculate session confirmation
  try {
    const { data: rpcResult } = await supabaseAdmin.rpc("recalculate_and_maybe_confirm_session", {
      p_session_id: sessionId,
    });
    const result = rpcResult as any;
    if (result?.session_confirmed) {
      console.log("Deferred session confirmed — triggering payout:", sessionId);
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
        }
      } catch (payoutErr) {
        console.error("Payout call error (non-fatal):", payoutErr);
      }
    }
  } catch (rpcErr) {
    console.error("Session recalculation error (non-fatal):", rpcErr);
  }

  console.log("Deferred session payment processed:", {
    sessionId,
    userId,
    totalCharge: totalChargeDollars,
    paymentIntentId,
  });

  return false;
}

async function handleQuickChallengePayment(
  session: Stripe.Checkout.Session,
  metadata: Record<string, string>,
  // deno-lint-ignore no-explicit-any
  supabaseAdmin: any
): Promise<boolean> {
  const challengeId = metadata.challenge_id;
  const playerRecordId = metadata.player_record_id;
  const userId = metadata.user_id;
  const paymentIntentId = session.payment_intent as string | null;

  if (!challengeId || !playerRecordId || !userId) {
    throw new WebhookProcessingError("Missing required quick challenge metadata", {
      operation: "quick_challenge_payments.validate_metadata",
      sessionId: session.id,
      hasChallengeId: Boolean(challengeId),
      hasPlayerRecordId: Boolean(playerRecordId),
      hasUserId: Boolean(userId),
    });
  }

  // Idempotency: check if already paid
  const { data: player } = await supabaseAdmin
    .from("quick_challenge_players")
    .select("payment_status")
    .eq("id", playerRecordId)
    .single();

  const paidAt = new Date().toISOString();
  const courtAmountCents = Number(metadata.recipient_cents || metadata.court_amount || 0);
  const platformProfitTargetCents = Number(metadata.platform_fee_cents || metadata.platform_fee_target || metadata.platform_fee || 0);
  const serviceFeeTotalCents = Number(metadata.service_fee_total_cents || metadata.service_fee_total || metadata.service_fee || 0);

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
      throw new WebhookProcessingError("Failed to upsert quick challenge payment snapshot", {
        operation: "quick_challenge_payments.upsert",
        table: "quick_challenge_payments",
        challengeId,
        userId,
        stripePaymentIntentId: paymentIntentId,
        error: quickPaymentUpsertError,
      });
    }
  }

  if (player?.payment_status === "paid") {
    console.log("Quick challenge player already paid, skipping:", playerRecordId);
    return true;
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

  // Mark court_availability slot as booked now that payment is confirmed
  const courtId = metadata.court_id;
  const scheduledDate = metadata.scheduled_date;
  const scheduledTime = metadata.scheduled_time;

  if (courtId && scheduledDate && scheduledTime) {
    const { error: courtUpdateError } = await supabaseAdmin
      .from("court_availability")
      .update({ is_booked: true, payment_status: "completed" })
      .eq("court_id", courtId)
      .eq("available_date", scheduledDate)
      .eq("start_time", scheduledTime)
      .eq("booked_by_user_id", userId);

    if (courtUpdateError) {
      console.error("Failed to mark court slot as booked (non-fatal):", courtUpdateError);
    } else {
      console.log("Court slot marked as booked for challenge:", challengeId);
    }
  }

  // Check and update challenge status
  const { data: challenge } = await supabaseAdmin
    .from("quick_challenges")
    .select("status, total_slots, quick_challenge_players(payment_status)")
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
    } else if ((challenge as any).status === "pending_payment" && paidCount > 0) {
      await supabaseAdmin
        .from("quick_challenges")
        .update({ status: "open" })
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

  return false;
}
