import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

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

    // Get authorization header for user context
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("Authorization required");
    }

    // Get user from auth header
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) {
      throw new Error("User not authenticated");
    }

    // Fetch platform settings from DB
    const { data: platformSettings } = await supabaseAdmin
      .from("platform_settings")
      .select("player_fee, manager_fee_percentage, is_active")
      .limit(1)
      .maybeSingle();

    const playerFee = platformSettings?.is_active ? (platformSettings?.player_fee ?? 1.50) : 0;
    const managerFeePercentage = platformSettings?.is_active ? (platformSettings?.manager_fee_percentage ?? 0) : 0;
    const playerFeeCents = Math.round(playerFee * 100);

    // Fetch session with group and court using admin client (bypasses RLS)
    const { data: session, error: sessionError } = await supabaseAdmin
      .from("sessions")
      .select(`
        *,
        groups (*),
        courts (
          *,
          venues (*)
        )
      `)
      .eq("id", sessionId)
      .single();

    if (sessionError || !session) {
      console.error("Session fetch error:", sessionError);
      throw new Error("Session not found");
    }

    const court = session.courts;
    const venue = court?.venues;

    if (!court || !venue) {
      throw new Error("Court or venue not found");
    }

    // Calculate base amount (court price + equipment)
    let baseAmountCents = Math.round(session.court_price * 100);

    const { data: bookingEquipment } = await supabaseAdmin
      .from("booking_equipment")
      .select("*, equipment_inventory(*)")
      .eq("booking_id", sessionId);

    if (bookingEquipment && bookingEquipment.length > 0) {
      const equipmentTotal = bookingEquipment.reduce(
        (sum, item) => sum + item.quantity * item.price_at_booking * 100,
        0
      );
      baseAmountCents += Math.round(equipmentTotal);
    }

    // Total for player = base + player service fee
    const totalAmountCents = baseAmountCents + playerFeeCents;

    // Handle credits
    let creditsToApply = 0;
    if (useCredits && creditsAmount && creditsAmount > 0) {
      creditsToApply = Math.min(creditsAmount, totalAmountCents / 100);

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

    const creditsInCents = Math.round(creditsToApply * 100);
    const remainingAmountCents = totalAmountCents - creditsInCents;

    // Platform fee = player service fee + manager commission percentage of court price
    const managerCommissionCents = Math.round((baseAmountCents * managerFeePercentage) / 100);
    const totalPlatformFeeCents = playerFeeCents + managerCommissionCents;

    // If credits cover everything
    if (remainingAmountCents <= 0) {
      await supabaseAdmin
        .from("payments")
        .upsert({
          session_id: sessionId,
          user_id: user.id,
          amount: totalAmountCents / 100,
          paid_with_credits: creditsToApply,
          status: "completed",
          paid_at: new Date().toISOString(),
          platform_fee: totalPlatformFeeCents / 100,
        }, { onConflict: "session_id,user_id" });

      await supabaseAdmin
        .from("session_players")
        .update({ is_confirmed: true, confirmed_at: new Date().toISOString() })
        .eq("session_id", sessionId)
        .eq("user_id", user.id);

      await supabaseAdmin
        .from("court_availability")
        .update({ payment_status: "completed" })
        .eq("booked_by_session_id", sessionId);

      console.log(`Payment completed with credits only: $${creditsToApply}`);

      return new Response(JSON.stringify({
        success: true,
        message: `Payment completed using $${creditsToApply.toFixed(2)} in credits`,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    // Create Stripe checkout session for remaining amount
    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
      apiVersion: "2024-12-18.acacia",
    });

    const baseUrl = origin || "https://sportarenaxp.lovable.app";
    const successUrl = `${baseUrl}/payment-success?checkout_session_id={CHECKOUT_SESSION_ID}&session_id=${sessionId}`;
    const cancelUrl = returnUrl ? `${baseUrl}${returnUrl}` : `${baseUrl}/courts`;

    const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = [
      {
        price_data: {
          currency: "nzd",
          product_data: {
            name: `Court Booking: ${court.name}`,
            description: `${venue.name} - ${session.session_date} at ${session.start_time}`,
          },
          unit_amount: remainingAmountCents - (playerFeeCents > 0 ? playerFeeCents : 0),
        },
        quantity: 1,
      },
    ];

    // Add platform service fee as separate line item for transparency
    if (playerFeeCents > 0) {
      lineItems.push({
        price_data: {
          currency: "nzd",
          product_data: {
            name: "Platform Service Fee",
          },
          unit_amount: playerFeeCents,
        },
        quantity: 1,
      });
    }

    const stripeAccountId = venue.stripe_account_id;
    let sessionParams: Stripe.Checkout.SessionCreateParams = {
      payment_method_types: ["card"],
      line_items: lineItems,
      mode: "payment",
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: {
        session_id: sessionId,
        user_id: user.id,
        credits_applied: creditsToApply.toString(),
        platform_fee: (totalPlatformFeeCents / 100).toString(),
      },
    };

    // If venue has Stripe Connect, set up destination charge with dynamic fee
    if (stripeAccountId) {
      // application_fee_amount = player fee + manager commission (capped to remaining)
      const applicationFee = Math.min(totalPlatformFeeCents, remainingAmountCents);
      sessionParams.payment_intent_data = {
        application_fee_amount: applicationFee,
        transfer_data: {
          destination: stripeAccountId,
        },
      };
      console.log(`Stripe Connect - Account: ${stripeAccountId}, Application fee: $${applicationFee / 100} (player: $${playerFeeCents / 100}, manager commission: $${managerCommissionCents / 100})`);
    } else {
      console.log("No Stripe Connect account - platform receives full payment");
    }

    const checkoutSession = await stripe.checkout.sessions.create(sessionParams);

    console.log(`Checkout session created: ${checkoutSession.id}, Total: $${remainingAmountCents / 100}, Platform fee: $${totalPlatformFeeCents / 100}`);

    await supabaseAdmin
      .from("payments")
      .upsert({
        session_id: sessionId,
        user_id: user.id,
        amount: remainingAmountCents / 100,
        paid_with_credits: creditsToApply,
        status: "pending",
        stripe_payment_intent_id: checkoutSession.payment_intent as string,
        platform_fee: totalPlatformFeeCents / 100,
      }, { onConflict: "session_id,user_id" });

    return new Response(JSON.stringify({
      url: checkoutSession.url,
      checkoutSessionId: checkoutSession.id,
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
