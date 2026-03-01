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
    const body = await req.json();

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

    // ─── Deferred at_booking flow (no session exists yet) ───
    if (body.deferred) {
      return await handleDeferredPayment(body, user, supabaseAdmin);
    }

    // ─── Existing session-based flow ───
    const { sessionId, returnUrl, origin, useCredits, creditsAmount, attempt } = body;

    if (!sessionId) {
      throw new Error("Session ID is required");
    }

    // Fetch session with group and court
    const { data: session, error: sessionError } = await supabaseAdmin
      .from("sessions")
      .select(`*, groups (*), courts (*, venues (*))`)
      .eq("id", sessionId)
      .single();

    if (sessionError || !session) {
      throw new Error("Session not found");
    }

    const court = session.courts;
    const venue = court?.venues;
    if (!court || !venue) {
      throw new Error("Court or venue not found");
    }

    // Read payment_type from session (authoritative, NOT from frontend)
    const sessionPaymentType = session.payment_type || "single";

    // Fetch platform settings for dynamic fees
    const { data: platformSettings } = await supabaseAdmin
      .from("platform_settings")
      .select("player_fee, manager_fee_percentage, stripe_percent, stripe_fixed")
      .eq("is_active", true)
      .limit(1)
      .single();

    const platformFeeDollars = Number(platformSettings?.player_fee ?? 0);
    const platformFeeCents = Math.round(platformFeeDollars * 100);
    const stripePercent = Number(platformSettings?.stripe_percent ?? 0.029);
    const stripeFixedCents = Math.round(Number(platformSettings?.stripe_fixed ?? 0.30) * 100);

    let fullCourtCostCents = Math.round(session.court_price * 100);

    const { data: bookingEquipment } = await supabaseAdmin
      .from("booking_equipment")
      .select("*, equipment_inventory(*)")
      .eq("booking_id", sessionId);

    if (bookingEquipment && bookingEquipment.length > 0) {
      const equipmentTotal = bookingEquipment.reduce(
        (sum: number, item: any) => sum + item.quantity * item.price_at_booking * 100,
        0
      );
      fullCourtCostCents += Math.round(equipmentTotal);
    }

    let courtAmountForThisPayerCents: number;

    if (sessionPaymentType === "split") {
      const minPlayers = session.min_players || 1;
      courtAmountForThisPayerCents = Math.ceil(fullCourtCostCents / minPlayers);
    } else {
      const { data: existingPayments } = await supabaseAdmin
        .from("payments")
        .select("amount, paid_with_credits, court_amount, status")
        .eq("session_id", sessionId)
        .in("status", ["completed", "transferred"]);

      let alreadyFundedCents = 0;
      if (existingPayments && existingPayments.length > 0) {
        alreadyFundedCents = existingPayments.reduce((sum: number, p: any) => {
          const paidCourtShare = p.court_amount
            ? Math.round(p.court_amount * 100)
            : Math.round((p.amount + (p.paid_with_credits || 0)) * 100);
          return sum + Math.max(0, paidCourtShare);
        }, 0);
      }

      courtAmountForThisPayerCents = Math.max(0, fullCourtCostCents - alreadyFundedCents);
    }

    // Handle credits
    let creditsToApply = 0;
    if (useCredits && creditsAmount && creditsAmount > 0) {
      creditsToApply = Math.min(creditsAmount, courtAmountForThisPayerCents / 100);

      const { data: creditResult, error: creditError } = await supabaseAdmin.rpc(
        "use_user_credits",
        {
          p_user_id: user.id,
          p_amount: creditsToApply,
          p_reason: `Payment for session ${sessionId}`,
          p_session_id: sessionId,
        }
      );

      if (creditError) throw new Error("Failed to apply credits");
      if (!creditResult) throw new Error("Insufficient credits");
    }

    const creditsInCents = Math.round(creditsToApply * 100);
    const remainingCourtAmountCents = courtAmountForThisPayerCents - creditsInCents;

    // Credits cover full amount
    if (remainingCourtAmountCents <= 0) {
      await supabaseAdmin
        .from("payments")
        .upsert({
          session_id: sessionId,
          user_id: user.id,
          amount: 0,
          paid_with_credits: creditsToApply,
          status: "completed",
          paid_at: new Date().toISOString(),
          platform_fee: 0,
          service_fee: 0,
          court_amount: courtAmountForThisPayerCents / 100,
        }, { onConflict: "session_id,user_id" });

      await supabaseAdmin
        .from("session_players")
        .update({ is_confirmed: true, confirmed_at: new Date().toISOString() })
        .eq("session_id", sessionId)
        .eq("user_id", user.id);

      await supabaseAdmin
        .from("court_availability")
        .update({ payment_status: "completed", is_booked: true })
        .eq("booked_by_session_id", sessionId);

      await applyHeldLiabilities(supabaseAdmin, user.id, sessionId, courtAmountForThisPayerCents, 0);

      // Process referral credit for credits-only payment
      try {
        await supabaseAdmin.rpc("process_referral_credit", { p_referred_user_id: user.id });
      } catch (e) { console.error("Referral credit error (non-fatal):", e); }

      try {
        const { data: rpcResult } = await supabaseAdmin.rpc("recalculate_and_maybe_confirm_session", {
          p_session_id: sessionId,
        });
        if ((rpcResult as any)?.session_confirmed) {
          await triggerPayout(sessionId);
        }
      } catch (rpcErr) {
        console.error("Session recalculation error (non-fatal):", rpcErr);
      }

      return new Response(JSON.stringify({
        success: true,
        message: `Payment completed using $${creditsToApply.toFixed(2)} in credits`,
        courtAmount: 0,
        serviceFee: 0,
        total: 0,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    // --- STRIPE CARD PAYMENT ---
    const { estimatedStripeFeeCents, serviceFeeCents, totalChargeCents } = calculateGrossUp({
      courtAmountCents: remainingCourtAmountCents,
      platformFeeCents,
      stripePercent,
      stripeFixedCents,
    });

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
      apiVersion: "2024-12-18.acacia",
    });

    const baseUrl = origin || "https://sportarenaxp.lovable.app";
    const successUrl = `${baseUrl}/payment-success?checkout_session_id={CHECKOUT_SESSION_ID}&session_id=${sessionId}`;
    const cancelBase = returnUrl ? `${baseUrl}${returnUrl}` : `${baseUrl}/courts`;
    const separator = cancelBase.includes("?") ? "&" : "?";
    const cancelUrl = `${cancelBase}${separator}cancelled_session=${sessionId}`;

    const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = [
      {
        price_data: {
          currency: "nzd",
          product_data: {
            name: `Court Booking: ${court.name}`,
            description: `${venue.name} - ${session.session_date} at ${session.start_time}`,
          },
          unit_amount: remainingCourtAmountCents,
        },
        quantity: 1,
      },
    ];

    if (serviceFeeCents > 0) {
      lineItems.push({
        price_data: {
          currency: "nzd",
          product_data: { name: "Service Fee", description: "Platform service fee" },
          unit_amount: serviceFeeCents,
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
        session_id: sessionId,
        user_id: user.id,
        court_amount: remainingCourtAmountCents.toString(),
        platform_fee_target: platformFeeCents.toString(),
        stripe_fee_estimated: estimatedStripeFeeCents.toString(),
        service_fee_total: serviceFeeCents.toString(),
        total_charge: totalChargeCents.toString(),
        stripe_percent: stripePercent.toString(),
        stripe_fixed_cents: stripeFixedCents.toString(),
        payment_type: sessionPaymentType,
        credits_applied: creditsToApply.toString(),
        venue_stripe_account_id: venue.stripe_account_id || "",
      },
    };

    const normalizedAttempt = Number.isFinite(Number(body.attempt)) && Number(body.attempt) > 0
      ? Math.trunc(Number(body.attempt))
      : 1;
    const checkoutIdempotencyKey = `checkout:session:${sessionId}:user:${user.id}:attempt:${normalizedAttempt}`;

    const checkoutSession = await stripe.checkout.sessions.create(
      sessionParams,
      { idempotencyKey: checkoutIdempotencyKey }
    );

    await supabaseAdmin
      .from("payments")
      .upsert({
        session_id: sessionId,
        user_id: user.id,
        amount: totalChargeCents / 100,
        paid_with_credits: creditsToApply,
        status: "pending",
        stripe_payment_intent_id: checkoutSession.payment_intent as string,
        platform_fee: platformFeeDollars,
        service_fee: serviceFeeCents / 100,
        court_amount: remainingCourtAmountCents / 100,
      }, { onConflict: "session_id,user_id" });

    return new Response(JSON.stringify({
      url: checkoutSession.url,
      checkoutSessionId: checkoutSession.id,
      courtAmount: remainingCourtAmountCents / 100,
      serviceFee: serviceFeeCents / 100,
      total: totalChargeCents / 100,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("Error creating payment:", errorMessage);
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});

// ─── Deferred at_booking payment handler ───────────────────────────────────
// deno-lint-ignore no-explicit-any
async function handleDeferredPayment(body: any, user: any, supabaseAdmin: any) {
  const {
    groupId, courtId, sessionDate, startTime, endTime,
    durationMinutes, paymentType, splitPlayers, sportCategoryId,
    equipment, courtCapacity, courtPrice, holdId,
    returnUrl, origin, useCredits, creditsAmount, attempt,
  } = body;

  if (!groupId || !courtId || !sessionDate || !startTime || !endTime || !durationMinutes) {
    throw new Error("Missing required booking details for deferred payment");
  }

  // Fetch court + venue (backend-authoritative pricing)
  const { data: court, error: courtErr } = await supabaseAdmin
    .from("courts")
    .select("id, name, venue_id, hourly_rate, capacity")
    .eq("id", courtId)
    .single();
  if (courtErr || !court) throw new Error("Court not found");

  const { data: venue, error: venueErr } = await supabaseAdmin
    .from("venues")
    .select("id, name, stripe_account_id")
    .eq("id", court.venue_id)
    .single();
  if (venueErr || !venue) throw new Error("Venue not found");

  // Platform settings
  const { data: platformSettings } = await supabaseAdmin
    .from("platform_settings")
    .select("player_fee, stripe_percent, stripe_fixed")
    .eq("is_active", true)
    .limit(1)
    .single();

  const platformFeeDollars = Number(platformSettings?.player_fee ?? 0);
  const platformFeeCents = Math.round(platformFeeDollars * 100);
  const stripePercent = Number(platformSettings?.stripe_percent ?? 0.029);
  const stripeFixedCents = Math.round(Number(platformSettings?.stripe_fixed ?? 0.30) * 100);

  // Recalculate pricing from court rate (backend is authoritative)
  const hours = durationMinutes / 60;
  const courtAmountFromRate = Number(court.hourly_rate) * hours;
  const equipmentItems = equipment || [];
  const equipmentTotal = equipmentItems.reduce(
    (sum: number, item: any) => sum + (item.quantity || 0) * (item.pricePerUnit || 0), 0
  );
  const fullCourtCostCents = Math.round((courtAmountFromRate + equipmentTotal) * 100);

  let courtAmountForThisPayerCents: number;
  if (paymentType === "split" && splitPlayers) {
    courtAmountForThisPayerCents = Math.ceil(fullCourtCostCents / splitPlayers);
  } else {
    courtAmountForThisPayerCents = fullCourtCostCents;
  }

  // Handle credits
  let creditsToApply = 0;
  if (useCredits && creditsAmount && creditsAmount > 0) {
    creditsToApply = Math.min(creditsAmount, courtAmountForThisPayerCents / 100);
    const { data: creditResult, error: creditError } = await supabaseAdmin.rpc(
      "use_user_credits",
      { p_user_id: user.id, p_amount: creditsToApply, p_reason: "Payment for deferred booking" }
    );
    if (creditError) throw new Error("Failed to apply credits");
    if (!creditResult) throw new Error("Insufficient credits");
  }

  const creditsInCents = Math.round(creditsToApply * 100);
  const remainingCourtAmountCents = courtAmountForThisPayerCents - creditsInCents;
  const fullCourtPriceDollars = courtAmountFromRate + equipmentTotal;

  // Credits cover full amount → create records immediately
  if (remainingCourtAmountCents <= 0) {
    const sessionId = await createDeferredRecords(supabaseAdmin, {
      userId: user.id,
      groupId, courtId, sessionDate, startTime, endTime,
      durationMinutes, paymentType, splitPlayers, sportCategoryId,
      equipment: equipmentItems, courtCapacity: courtCapacity || court.capacity,
      courtPrice: fullCourtPriceDollars, holdId,
    });

    await supabaseAdmin.from("payments").insert({
      session_id: sessionId,
      user_id: user.id,
      amount: 0,
      paid_with_credits: creditsToApply,
      status: "completed",
      paid_at: new Date().toISOString(),
      platform_fee: 0,
      service_fee: 0,
      court_amount: courtAmountForThisPayerCents / 100,
    });

    // Process referral credit
    try {
      await supabaseAdmin.rpc("process_referral_credit", { p_referred_user_id: user.id });
    } catch (e) { console.error("Referral credit error (non-fatal):", e); }

    // Recalculate session
    try {
      const { data: rpcResult } = await supabaseAdmin.rpc("recalculate_and_maybe_confirm_session", {
        p_session_id: sessionId,
      });
      if ((rpcResult as any)?.session_confirmed) {
        await triggerPayout(sessionId);
      }
    } catch (e) { console.error("Session recalculation error (non-fatal):", e); }

    console.log(`Deferred payment completed with credits only: $${creditsToApply}, sessionId: ${sessionId}`);

    return new Response(JSON.stringify({
      success: true,
      message: `Payment completed using $${creditsToApply.toFixed(2)} in credits`,
      sessionId,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  }

  // --- STRIPE CARD PAYMENT for deferred flow ---
  const { estimatedStripeFeeCents, serviceFeeCents, totalChargeCents } = calculateGrossUp({
    courtAmountCents: remainingCourtAmountCents,
    platformFeeCents,
    stripePercent,
    stripeFixedCents,
  });

  const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
    apiVersion: "2024-12-18.acacia",
  });

  const baseUrl = origin || "https://sportarenaxp.lovable.app";
  // For deferred: no session_id in URL (webhook creates it)
  const successUrl = `${baseUrl}/payment-success?checkout_session_id={CHECKOUT_SESSION_ID}&type=at_booking`;
  const cancelBase = returnUrl ? `${baseUrl}${returnUrl}` : `${baseUrl}/courts`;
  const separator = cancelBase.includes("?") ? "&" : "?";
  const cancelUrl = `${cancelBase}${separator}payment=cancelled`;

  const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = [
    {
      price_data: {
        currency: "nzd",
        product_data: {
          name: `Court Booking: ${court.name}`,
          description: `${venue.name} - ${sessionDate} at ${startTime}`,
        },
        unit_amount: remainingCourtAmountCents,
      },
      quantity: 1,
    },
  ];

  if (serviceFeeCents > 0) {
    lineItems.push({
      price_data: {
        currency: "nzd",
        product_data: { name: "Service Fee", description: "Platform service fee" },
        unit_amount: serviceFeeCents,
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
      deferred: "true",
      user_id: user.id,
      group_id: groupId,
      court_id: courtId,
      session_date: sessionDate,
      start_time: startTime,
      end_time: endTime,
      duration_minutes: durationMinutes.toString(),
      payment_type: paymentType || "single",
      split_players: (splitPlayers || "").toString(),
      sport_category_id: sportCategoryId,
      court_capacity: (courtCapacity || court.capacity).toString(),
      court_price_dollars: fullCourtPriceDollars.toString(),
      hold_id: holdId || "",
      equipment_json: JSON.stringify(equipmentItems),
      court_amount: remainingCourtAmountCents.toString(),
      platform_fee_target: platformFeeCents.toString(),
      stripe_fee_estimated: estimatedStripeFeeCents.toString(),
      service_fee_total: serviceFeeCents.toString(),
      total_charge: totalChargeCents.toString(),
      credits_applied: creditsToApply.toString(),
      venue_stripe_account_id: venue.stripe_account_id || "",
    },
  };

  const normalizedAttempt = Number.isFinite(Number(attempt)) && Number(attempt) > 0
    ? Math.trunc(Number(attempt))
    : 1;
  const checkoutIdempotencyKey = `checkout:deferred:${courtId}:${sessionDate}:${startTime}:user:${user.id}:attempt:${normalizedAttempt}`;

  const checkoutSession = await stripe.checkout.sessions.create(
    sessionParams,
    { idempotencyKey: checkoutIdempotencyKey }
  );

  // NO payments upsert for deferred flow — webhook creates it
  console.log(`Deferred checkout created: ${checkoutSession.id} | Court: ${remainingCourtAmountCents}c, Fee: ${serviceFeeCents}c, Total: ${totalChargeCents}c`);

  return new Response(JSON.stringify({
    url: checkoutSession.url,
    checkoutSessionId: checkoutSession.id,
    deferred: true,
  }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
    status: 200,
  });
}

// ─── Create deferred booking records (used by credits-only and webhook) ────
// deno-lint-ignore no-explicit-any
async function createDeferredRecords(supabaseAdmin: any, details: any): Promise<string> {
  // Convert hold if provided
  if (details.holdId) {
    const { data: holdResult } = await supabaseAdmin.rpc("convert_hold_to_booking", {
      p_hold_id: details.holdId,
    });
    if (holdResult && !holdResult.success) {
      console.error("Hold conversion failed:", holdResult.error);
      if (holdResult.error === "SLOT_TAKEN_DURING_PAYMENT") {
        throw new Error("SLOT_UNAVAILABLE: This slot was taken during checkout");
      }
      // Hold may have expired but slot might still be available — continue
    }
  }

  // Create session
  const { data: session, error: sessionError } = await supabaseAdmin
    .from("sessions")
    .insert({
      group_id: details.groupId,
      court_id: details.courtId,
      session_date: details.sessionDate,
      start_time: details.startTime,
      duration_minutes: details.durationMinutes,
      court_price: details.courtPrice,
      min_players: details.paymentType === "split" && details.splitPlayers ? details.splitPlayers : 6,
      max_players: details.courtCapacity,
      // Already paid — set deadline far in the future
      payment_deadline: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
      state: "protected",
      payment_type: details.paymentType || "single",
      sport_category_id: details.sportCategoryId,
    })
    .select("id")
    .single();

  if (sessionError || !session) throw sessionError ?? new Error("Failed to create session");

  // Create session_player (confirmed since payment is done)
  const { error: spError } = await supabaseAdmin.from("session_players").insert({
    session_id: session.id,
    user_id: details.userId,
    is_confirmed: true,
    confirmed_at: new Date().toISOString(),
  });
  if (spError) throw spError;

  // Create court_availability
  const { data: bookingRecord, error: caError } = await supabaseAdmin
    .from("court_availability")
    .insert({
      court_id: details.courtId,
      available_date: details.sessionDate,
      start_time: details.startTime,
      end_time: details.endTime,
      is_booked: true,
      booked_by_user_id: details.userId,
      booked_by_group_id: details.groupId,
      booked_by_session_id: session.id,
      payment_status: "completed",
    })
    .select("id")
    .single();
  if (caError) throw caError;

  // Handle equipment
  if (details.equipment && details.equipment.length > 0 && bookingRecord) {
    const { error: eqError } = await supabaseAdmin.from("booking_equipment").insert(
      details.equipment.map((item: any) => ({
        booking_id: bookingRecord.id,
        equipment_id: item.equipmentId,
        quantity: item.quantity,
        price_at_booking: item.pricePerUnit,
      }))
    );
    if (eqError) console.error("Equipment insert error (non-fatal):", eqError);
  }

  return session.id;
}

// ─── Helpers ───────────────────────────────────────────────────────────────

// deno-lint-ignore no-explicit-any
async function applyHeldLiabilities(supabaseAdmin: any, userId: string, newSessionId: string, totalAmountCents: number, serviceFeeCents: number) {
  const courtShareCents = Math.max(0, totalAmountCents - serviceFeeCents);
  if (courtShareCents <= 0) return;

  const { data: liabilities, error } = await supabaseAdmin
    .from("held_credit_liabilities")
    .select("*")
    .eq("user_id", userId)
    .eq("status", "HELD")
    .order("created_at", { ascending: true });

  if (error || !liabilities || liabilities.length === 0) return;

  let remainingToApply = courtShareCents;
  for (const liability of liabilities) {
    if (remainingToApply <= 0) break;
    if (liability.amount_cents <= remainingToApply) {
      await supabaseAdmin
        .from("held_credit_liabilities")
        .update({ status: "APPLIED", applied_session_id: newSessionId, applied_at: new Date().toISOString() })
        .eq("id", liability.id);
      remainingToApply -= liability.amount_cents;
    } else {
      const appliedAmount = remainingToApply;
      const remainderAmount = liability.amount_cents - appliedAmount;
      await supabaseAdmin
        .from("held_credit_liabilities")
        .update({ status: "APPLIED", amount_cents: appliedAmount, applied_session_id: newSessionId, applied_at: new Date().toISOString() })
        .eq("id", liability.id);
      await supabaseAdmin.from("held_credit_liabilities").insert({
        user_id: userId, amount_cents: remainderAmount,
        source_session_id: liability.source_session_id, source_payment_id: liability.source_payment_id, status: "HELD",
      });
      remainingToApply = 0;
    }
  }
}

async function triggerPayout(sessionId: string) {
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
  } catch (err) {
    console.error("Payout call error (non-fatal):", err);
  }
}
