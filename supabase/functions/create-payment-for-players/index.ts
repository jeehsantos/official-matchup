import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { calculateGrossUp } from "../_shared/feeCalc.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("Authorization required");
    }

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } =
      await supabaseClient.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      throw new Error("Unauthorized");
    }
    const userId = claimsData.claims.sub as string;

    const { sessionId, playerUserIds, origin, returnUrl } = await req.json();

    if (!sessionId || !Array.isArray(playerUserIds) || playerUserIds.length === 0) {
      throw new Error("sessionId and non-empty playerUserIds array required");
    }

    // Fetch session with group, court, venue
    const { data: session, error: sessionError } = await supabaseAdmin
      .from("sessions")
      .select("*, groups(*), courts(*, venues(id, name, owner_id))")
      .eq("id", sessionId)
      .single();

    if (sessionError || !session) throw new Error("Session not found");

    // Verify caller is the organizer
    const group = (session as any).groups;
    if (!group || group.organizer_id !== userId) {
      throw new Error("Only the organizer can pay for players");
    }

    // Validate session state
    if (session.is_cancelled) throw new Error("Session is cancelled");
    if (session.payment_type !== "split") {
      throw new Error("Pay-for-players is only available for split payment sessions");
    }

    const court = (session as any).courts;
    const venue = court?.venues;
    if (!court || !venue) throw new Error("Court or venue not found");

    // Fetch venue Stripe account
    const { data: paymentSettings } = await supabaseAdmin
      .from("venue_payment_settings")
      .select("stripe_account_id")
      .eq("venue_id", venue.id)
      .maybeSingle();
    const venueStripeAccountId = paymentSettings?.stripe_account_id || null;

    // Platform settings
    const { data: platformSettings } = await supabaseAdmin
      .from("platform_settings")
      .select("player_fee, stripe_percent, stripe_fixed")
      .eq("is_active", true)
      .limit(1)
      .single();

    const platformFeeDollars = Number(platformSettings?.player_fee ?? 0);
    const platformFeeCentsPerPlayer = Math.round(platformFeeDollars * 100);
    const stripePercent = Number(platformSettings?.stripe_percent ?? 0.029);
    const stripeFixedCents = Math.round(
      Number(platformSettings?.stripe_fixed ?? 0.30) * 100
    );

    // Calculate per-player court share
    let fullCourtCostCents = Math.round(session.court_price * 100);

    // Include equipment costs
    const { data: bookingEquipment } = await supabaseAdmin
      .from("booking_equipment")
      .select("*, equipment_inventory(*)")
      .eq("booking_id", sessionId);

    if (bookingEquipment && bookingEquipment.length > 0) {
      const equipmentTotal = bookingEquipment.reduce(
        (sum: number, item: any) =>
          sum + item.quantity * item.price_at_booking * 100,
        0
      );
      fullCourtCostCents += Math.round(equipmentTotal);
    }

    const minPlayers = session.min_players || 1;
    const perPlayerCourtCents = Math.ceil(fullCourtCostCents / minPlayers);

    // Verify each player is in the session and unpaid
    const { data: sessionPlayers } = await supabaseAdmin
      .from("session_players")
      .select("user_id")
      .eq("session_id", sessionId)
      .in("user_id", playerUserIds);

    const validPlayerIds = (sessionPlayers || []).map((sp: any) => sp.user_id);

    // Check which players already have completed payments
    const { data: existingPayments } = await supabaseAdmin
      .from("payments")
      .select("user_id, status")
      .eq("session_id", sessionId)
      .in("user_id", playerUserIds)
      .in("status", ["completed", "transferred"]);

    const alreadyPaidIds = new Set(
      (existingPayments || []).map((p: any) => p.user_id)
    );

    const unpaidPlayerIds = validPlayerIds.filter(
      (id: string) => !alreadyPaidIds.has(id)
    );

    if (unpaidPlayerIds.length === 0) {
      throw new Error("All selected players have already paid");
    }

    // Calculate totals for all unpaid players combined
    const totalCourtCents = perPlayerCourtCents * unpaidPlayerIds.length;
    const totalPlatformFeeCents =
      platformFeeCentsPerPlayer * unpaidPlayerIds.length;

    // Gross-up for the combined amount
    const grossUp = calculateGrossUp({
      courtAmountCents: totalCourtCents,
      platformFeeCents: totalPlatformFeeCents,
      stripePercent,
      stripeFixedCents,
    });

    const {
      serviceFeeTotalCents,
      stripeFeeCoverageCents,
      grossTotalCents,
    } = grossUp;

    // Create Stripe checkout
    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
      apiVersion: "2024-12-18.acacia",
    });

    const baseUrl = origin || "https://sportarenaxp.lovable.app";
    const successUrl = `${baseUrl}/payment-success?checkout_session_id={CHECKOUT_SESSION_ID}&session_id=${sessionId}`;
    const cancelBase = returnUrl
      ? `${baseUrl}${returnUrl}`
      : `${baseUrl}/games/${sessionId}`;
    const cancelUrl = cancelBase;

    const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = [
      {
        price_data: {
          currency: "nzd",
          product_data: {
            name: `Payment for ${unpaidPlayerIds.length} player(s)`,
            description: `${venue.name} – ${court.name} – ${session.session_date} at ${session.start_time}`,
          },
          unit_amount: totalCourtCents,
        },
        quantity: 1,
      },
    ];

    if (serviceFeeTotalCents > 0) {
      lineItems.push({
        price_data: {
          currency: "nzd",
          product_data: {
            name: "Service Fee",
            description: "Platform service fee",
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
        type: "pay_for_players",
        session_id: sessionId,
        payer_user_id: userId,
        player_user_ids: JSON.stringify(unpaidPlayerIds),
        per_player_court_cents: perPlayerCourtCents.toString(),
        recipient_cents: totalCourtCents.toString(),
        platform_fee_cents: totalPlatformFeeCents.toString(),
        stripe_percent: stripePercent.toString(),
        stripe_fixed_cents: stripeFixedCents.toString(),
        gross_total_cents: grossTotalCents.toString(),
        service_fee_total_cents: serviceFeeTotalCents.toString(),
        stripe_fee_coverage_cents: stripeFeeCoverageCents.toString(),
        payment_type: "split",
        venue_stripe_account_id: venueStripeAccountId || "",
        destination_charge: venueStripeAccountId ? "true" : "false",
      },
    };

    // Destination charge
    if (venueStripeAccountId) {
      sessionParams.payment_intent_data = {
        application_fee_amount: serviceFeeTotalCents,
        transfer_data: {
          destination: venueStripeAccountId,
        },
      };
    }

    const checkoutSession = await stripe.checkout.sessions.create(sessionParams);

    // Create pending payment records for each player
    for (const playerId of unpaidPlayerIds) {
      await supabaseAdmin.from("payments").upsert(
        {
          session_id: sessionId,
          user_id: playerId,
          amount: grossTotalCents / unpaidPlayerIds.length / 100,
          status: "pending",
          platform_fee: platformFeeDollars,
          service_fee: serviceFeeTotalCents / unpaidPlayerIds.length / 100,
          court_amount: perPlayerCourtCents / 100,
          payment_type_snapshot: "split",
        },
        { onConflict: "session_id,user_id" }
      );
    }

    console.log("Pay-for-players checkout created:", {
      sessionId,
      payerUserId: userId,
      playerCount: unpaidPlayerIds.length,
      totalCharge: grossTotalCents / 100,
    });

    return new Response(
      JSON.stringify({
        url: checkoutSession.url,
        checkoutSessionId: checkoutSession.id,
        playerCount: unpaidPlayerIds.length,
        totalCourtAmount: totalCourtCents / 100,
        serviceFee: serviceFeeTotalCents / 100,
        totalCharge: grossTotalCents / 100,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error: unknown) {
    const errorMessage =
      error instanceof Error ? error.message : String(error);
    console.error("Error in create-payment-for-players:", errorMessage);
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
