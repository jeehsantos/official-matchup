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
    const { sessionId, paymentType, returnUrl, origin, useCredits, creditsAmount } = await req.json();

    if (!sessionId) {
      throw new Error("Session ID is required");
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
    // DB stores 'single' (organizer pays full) or 'split' (split between players)
    const sessionPaymentType = session.payment_type || "single";

    // Fetch platform settings for dynamic fees — NEVER hardcode
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

    // Calculate full court cost (court price + equipment if any)
    let fullCourtCostCents = Math.round(session.court_price * 100);

    const { data: bookingEquipment } = await supabaseAdmin
      .from("booking_equipment")
      .select("*, equipment_inventory(*)")
      .eq("booking_id", sessionId);

    if (bookingEquipment && bookingEquipment.length > 0) {
      const equipmentTotal = bookingEquipment.reduce(
        (sum, item) => sum + item.quantity * item.price_at_booking * 100,
        0
      );
      fullCourtCostCents += Math.round(equipmentTotal);
    }

    // --- Compute court_amount for THIS payer based on payment mode ---
    let courtAmountForThisPayerCents: number;

    if (sessionPaymentType === "split") {
      // Split: each player pays their share based on min_players
      const minPlayers = session.min_players || 1;
      courtAmountForThisPayerCents = Math.ceil(fullCourtCostCents / minPlayers);
      console.log(`Split payment: ${fullCourtCostCents}c / ${minPlayers} players = ${courtAmountForThisPayerCents}c per player`);
    } else {
      // Single / Organizer pays full: payer covers remaining unfunded court amount
      // Check how much has already been paid by others
      const { data: existingPayments } = await supabaseAdmin
        .from("payments")
        .select("amount, paid_with_credits, court_amount, status")
        .eq("session_id", sessionId)
        .in("status", ["completed", "transferred"]);

      let alreadyFundedCents = 0;
      if (existingPayments && existingPayments.length > 0) {
        alreadyFundedCents = existingPayments.reduce((sum, p) => {
          // Use court_amount if available, otherwise estimate from total minus service_fee
          const paidCourtShare = p.court_amount
            ? Math.round(p.court_amount * 100)
            : Math.round((p.amount + (p.paid_with_credits || 0)) * 100);
          return sum + Math.max(0, paidCourtShare);
        }, 0);
      }

      courtAmountForThisPayerCents = Math.max(0, fullCourtCostCents - alreadyFundedCents);
      console.log(`Organizer pays full: total=${fullCourtCostCents}c, already funded=${alreadyFundedCents}c, remaining=${courtAmountForThisPayerCents}c`);
    }

    // Handle credits if provided (credits only cover court amount, no Stripe fee needed)
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

      if (creditError) {
        console.error("Error using credits:", creditError);
        throw new Error("Failed to apply credits");
      }

      if (!creditResult) {
        throw new Error("Insufficient credits");
      }
    }

    // Calculate remaining court amount after credits
    const creditsInCents = Math.round(creditsToApply * 100);
    const remainingCourtAmountCents = courtAmountForThisPayerCents - creditsInCents;

    // If credits cover the full court amount, complete payment without Stripe
    // NO service fee for credits-only payments (no Stripe processing involved)
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
        }, {
          onConflict: "session_id,user_id",
        });

      // Confirm player participation
      await supabaseAdmin
        .from("session_players")
        .update({ is_confirmed: true, confirmed_at: new Date().toISOString() })
        .eq("session_id", sessionId)
        .eq("user_id", user.id);

      await supabaseAdmin
        .from("court_availability")
        .update({ payment_status: "completed", is_booked: true })
        .eq("booked_by_session_id", sessionId);

      // Apply held credit liabilities for this user
      await applyHeldLiabilities(supabaseAdmin, user.id, sessionId, courtAmountForThisPayerCents, 0);

      // Recalculate session confirmation
      try {
        const { data: rpcResult } = await supabaseAdmin.rpc("recalculate_and_maybe_confirm_session", {
          p_session_id: sessionId,
        });
        const result = rpcResult as any;
        if (result?.session_confirmed) {
          console.log("Session confirmed after credits payment — triggering payout");
          await triggerPayout(sessionId);
        }
      } catch (rpcErr) {
        console.error("Session recalculation error (non-fatal):", rpcErr);
      }

      console.log(`Payment completed with credits only: $${creditsToApply}`);

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
    // Use shared gross-up calculator with dynamic Stripe config
    const {
      estimatedStripeFeeCents,
      serviceFeeCents,
      totalChargeCents,
    } = calculateGrossUp({
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
    const cancelUrl = returnUrl ? `${baseUrl}${returnUrl}` : `${baseUrl}/courts`;

    // Separate line items for transparency
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

    // Add service fee as separate line item (only if > 0)
    if (serviceFeeCents > 0) {
      lineItems.push({
        price_data: {
          currency: "nzd",
          product_data: {
            name: "Service Fee",
            description: "Platform service fee",
          },
          unit_amount: serviceFeeCents,
        },
        quantity: 1,
      });
    }

    // Metadata with standardized field names
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

    console.log("Platform holds all funds — deferred payout model");

    const checkoutSession = await stripe.checkout.sessions.create(sessionParams);

    console.log(`Checkout created: ${checkoutSession.id} | Court: ${remainingCourtAmountCents}c, Fee: ${serviceFeeCents}c, Total: ${totalChargeCents}c, Credits: ${creditsToApply}, Mode: ${sessionPaymentType}`);

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
      }, {
        onConflict: "session_id,user_id",
      });

    // Return breakdown to frontend
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

/**
 * Apply held credit liabilities when a user pays with credits.
 */
async function applyHeldLiabilities(
  supabaseAdmin: ReturnType<typeof createClient>,
  userId: string,
  newSessionId: string,
  totalAmountCents: number,
  serviceFeeCents: number
) {
  const courtShareCents = Math.max(0, totalAmountCents - serviceFeeCents);
  if (courtShareCents <= 0) return;

  const { data: liabilities, error } = await supabaseAdmin
    .from("held_credit_liabilities")
    .select("*")
    .eq("user_id", userId)
    .eq("status", "HELD")
    .order("created_at", { ascending: true });

  if (error || !liabilities || liabilities.length === 0) {
    console.log("No held liabilities to apply for user:", userId);
    return;
  }

  let remainingToApply = courtShareCents;

  for (const liability of liabilities) {
    if (remainingToApply <= 0) break;

    if (liability.amount_cents <= remainingToApply) {
      await supabaseAdmin
        .from("held_credit_liabilities")
        .update({
          status: "APPLIED",
          applied_session_id: newSessionId,
          applied_at: new Date().toISOString(),
        })
        .eq("id", liability.id);

      remainingToApply -= liability.amount_cents;
      console.log(`Applied full liability ${liability.id}: ${liability.amount_cents} cents`);
    } else {
      const appliedAmount = remainingToApply;
      const remainderAmount = liability.amount_cents - appliedAmount;

      await supabaseAdmin
        .from("held_credit_liabilities")
        .update({
          status: "APPLIED",
          amount_cents: appliedAmount,
          applied_session_id: newSessionId,
          applied_at: new Date().toISOString(),
        })
        .eq("id", liability.id);

      await supabaseAdmin
        .from("held_credit_liabilities")
        .insert({
          user_id: userId,
          amount_cents: remainderAmount,
          source_session_id: liability.source_session_id,
          source_payment_id: liability.source_payment_id,
          status: "HELD",
        });

      console.log(`Split liability ${liability.id}: applied ${appliedAmount}, remainder ${remainderAmount}`);
      remainingToApply = 0;
    }
  }
}

/**
 * Trigger the payout-session edge function
 */
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
    } else {
      console.log("Payout completed:", payoutResult);
    }
  } catch (err) {
    console.error("Payout call error (non-fatal):", err);
  }
}
