import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
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

    // Calculate total amount (court price + equipment if any)
    let totalAmountCents = Math.round(session.court_price * 100);

    // Fetch booking equipment if any
    const { data: bookingEquipment } = await supabaseAdmin
      .from("booking_equipment")
      .select("*, equipment_inventory(*)")
      .eq("booking_id", sessionId);

    if (bookingEquipment && bookingEquipment.length > 0) {
      const equipmentTotal = bookingEquipment.reduce(
        (sum, item) => sum + item.quantity * item.price_at_booking * 100,
        0
      );
      totalAmountCents += Math.round(equipmentTotal);
    }

    // Handle credits if provided
    let creditsToApply = 0;
    if (useCredits && creditsAmount && creditsAmount > 0) {
      creditsToApply = Math.min(creditsAmount, totalAmountCents / 100);
      
      // Deduct credits from user balance
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

    // Calculate remaining amount after credits
    const creditsInCents = Math.round(creditsToApply * 100);
    const remainingAmountCents = totalAmountCents - creditsInCents;

    // If credits cover the full amount, complete payment without Stripe
    if (remainingAmountCents <= 0) {
      // Create payment record as completed
      await supabaseAdmin
        .from("payments")
        .upsert({
          session_id: sessionId,
          user_id: user.id,
          amount: totalAmountCents / 100,
          paid_with_credits: creditsToApply,
          status: "completed",
          paid_at: new Date().toISOString(),
          platform_fee: PLATFORM_FEE / 100,
        }, {
          onConflict: "session_id,user_id",
        });

      // Update session player to confirmed
      await supabaseAdmin
        .from("session_players")
        .update({
          is_confirmed: true,
          confirmed_at: new Date().toISOString(),
        })
        .eq("session_id", sessionId)
        .eq("user_id", user.id);

      // Update court availability payment status
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

    // Build success and cancel URLs
    const baseUrl = origin || "https://sportarenaxp.lovable.app";
    const successUrl = `${baseUrl}/payment-success?checkout_session_id={CHECKOUT_SESSION_ID}&session_id=${sessionId}`;
    const cancelUrl = returnUrl ? `${baseUrl}${returnUrl}` : `${baseUrl}/courts`;

    // Build line items
    const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = [
      {
        price_data: {
          currency: "nzd",
          product_data: {
            name: `Court Booking: ${court.name}`,
            description: `${venue.name} - ${session.session_date} at ${session.start_time}`,
          },
          unit_amount: remainingAmountCents,
        },
        quantity: 1,
      },
    ];

    // Check if venue has Stripe Connect account
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
      },
    };

    // If venue has Stripe Connect, set up destination charge
    if (stripeAccountId) {
      const applicationFee = Math.min(PLATFORM_FEE, remainingAmountCents);
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

    console.log(`Checkout session created: ${checkoutSession.id} Credits to apply: ${creditsToApply}`);

    // Create pending payment record
    await supabaseAdmin
      .from("payments")
      .upsert({
        session_id: sessionId,
        user_id: user.id,
        amount: remainingAmountCents / 100,
        paid_with_credits: creditsToApply,
        status: "pending",
        stripe_payment_intent_id: checkoutSession.payment_intent as string,
        platform_fee: PLATFORM_FEE / 100,
      }, {
        onConflict: "session_id,user_id",
      });

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
