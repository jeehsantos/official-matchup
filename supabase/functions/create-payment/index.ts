import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Platform fee: $1.50 fixed
const PLATFORM_FEE_CENTS = 150;

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_ANON_KEY") ?? ""
  );

  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );

  try {
    // Get request body
    const { 
      sessionId, 
      paymentType, // 'at_booking' or 'before_session'
      returnUrl,
      origin: requestOrigin,
      useCredits = false, // Whether to apply available credits
    } = await req.json();

    if (!sessionId) {
      throw new Error("Session ID is required");
    }

    // Retrieve authenticated user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("No authorization header provided");
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError || !userData.user?.email) {
      throw new Error("User not authenticated or email not available");
    }
    const user = userData.user;

    // Fetch session details with court and group info using admin client (bypasses RLS)
    const { data: session, error: sessionError } = await supabaseAdmin
      .from("sessions")
      .select(`
        *,
        courts (
          *,
          venues (owner_id, stripe_account_id)
        ),
        groups (name, organizer_id)
      `)
      .eq("id", sessionId)
      .single();

    if (sessionError || !session) {
      console.error("Session fetch error:", sessionError);
      throw new Error("Session not found");
    }

    // Get connected account for Stripe Connect
    const connectedAccountId = (session.courts as any)?.venues?.stripe_account_id;

    // Calculate payment amount
    let amountCents: number;
    let description: string;

    if (paymentType === "at_booking" || session.payment_type === "single") {
      // Organizer pays full court price
      amountCents = Math.round(session.court_price * 100);
      description = `Court booking: ${session.groups?.name || "Session"} - Full Payment`;
    } else {
      // Split payment - player pays their share
      const pricePerPlayer = session.court_price / session.min_players;
      amountCents = Math.round(pricePerPlayer * 100);
      description = `Court booking: ${session.groups?.name || "Session"} - Player Share`;
    }

    const amountDollars = amountCents / 100;

    // Check user's credit balance if useCredits is requested
    let creditsToApply = 0;
    let remainingAmountCents = amountCents;

    if (useCredits) {
      const { data: creditBalance, error: creditError } = await supabaseAdmin.rpc(
        "get_user_credits",
        { p_user_id: user.id }
      );

      if (!creditError && creditBalance > 0) {
        const creditBalanceCents = Math.round(Number(creditBalance) * 100);
        creditsToApply = Math.min(creditBalanceCents, amountCents);
        remainingAmountCents = amountCents - creditsToApply;
      }
    }

    // If credits cover the full amount, process without Stripe
    if (remainingAmountCents === 0 && creditsToApply > 0) {
      // Deduct credits
      const creditsToDeduct = creditsToApply / 100;
      const { data: deductSuccess, error: deductError } = await supabaseAdmin.rpc(
        "use_user_credits",
        {
          p_user_id: user.id,
          p_amount: creditsToDeduct,
          p_reason: "session_payment",
          p_session_id: sessionId,
        }
      );

      if (deductError || !deductSuccess) {
        throw new Error("Failed to apply credits");
      }

      // Create payment record
      const { error: paymentInsertError } = await supabaseAdmin
        .from("payments")
        .insert({
          session_id: sessionId,
          user_id: user.id,
          amount: amountDollars,
          paid_with_credits: creditsToDeduct,
          platform_fee: PLATFORM_FEE_CENTS / 100,
          status: "completed",
          paid_at: new Date().toISOString(),
        });

      if (paymentInsertError) {
        console.error("Error creating payment record:", paymentInsertError);
      }

      // Update session player to confirmed
      await supabaseAdmin
        .from("session_players")
        .update({ is_confirmed: true, confirmed_at: new Date().toISOString() })
        .eq("session_id", sessionId)
        .eq("user_id", user.id);

      console.log(`Payment completed with credits only: $${creditsToDeduct.toFixed(2)}`);

      return new Response(JSON.stringify({ 
        success: true,
        paidWithCredits: creditsToDeduct,
        message: `Payment completed using $${creditsToDeduct.toFixed(2)} in credits.`,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    // Initialize Stripe for remaining amount
    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
      apiVersion: "2024-12-18.acacia",
    });

    // Check if a Stripe customer exists for this user
    const customers = await stripe.customers.list({ email: user.email, limit: 1 });
    let customerId: string | undefined;
    if (customers.data.length > 0) {
      customerId = customers.data[0].id;
    }

    // Create checkout session with application fee and Stripe Connect
    const origin = requestOrigin || req.headers.get("origin") || "https://sportarenaxp.lovable.app";
    const cancelUrl = returnUrl ? `${origin}${returnUrl}` : `${origin}/games/${sessionId}`;

    // Adjust description if partial credits applied
    const finalDescription = creditsToApply > 0 
      ? `${description} (After $${(creditsToApply / 100).toFixed(2)} credits)`
      : description;

    // Build checkout session config
    const checkoutConfig: Stripe.Checkout.SessionCreateParams = {
      customer: customerId,
      customer_email: customerId ? undefined : user.email,
      line_items: [
        {
          price_data: {
            currency: "nzd",
            product_data: {
              name: finalDescription,
              description: `Session Date: ${session.session_date} at ${session.start_time}`,
            },
            unit_amount: remainingAmountCents,
          },
          quantity: 1,
        },
      ],
      mode: "payment",
      cancel_url: cancelUrl,
      metadata: {
        session_id: sessionId,
        user_id: user.id,
        payment_type: paymentType || session.payment_type,
        platform_fee: PLATFORM_FEE_CENTS.toString(),
        credits_applied: (creditsToApply / 100).toString(),
        total_amount: amountDollars.toString(),
      },
    };

    // Add payment_intent_data with Stripe Connect destination if venue has connected account
    if (connectedAccountId) {
      checkoutConfig.payment_intent_data = {
        application_fee_amount: PLATFORM_FEE_CENTS,
        transfer_data: {
          destination: connectedAccountId,
        },
        metadata: {
          session_id: sessionId,
          user_id: user.id,
          credits_applied: (creditsToApply / 100).toString(),
        },
      };
      console.log("Using Stripe Connect destination:", connectedAccountId);
    } else {
      // No connected account - platform receives full payment
      checkoutConfig.payment_intent_data = {
        metadata: {
          session_id: sessionId,
          user_id: user.id,
          credits_applied: (creditsToApply / 100).toString(),
        },
      };
      console.log("No Stripe Connect account - platform receives full payment");
    }

    // Add success_url with checkout session ID placeholder
    checkoutConfig.success_url = `${origin}/payment-success?session_id=${sessionId}&type=${paymentType}&credits_applied=${creditsToApply / 100}&checkout_session_id={CHECKOUT_SESSION_ID}`;

    const checkoutSession = await stripe.checkout.sessions.create(checkoutConfig);

    console.log("Checkout session created:", checkoutSession.id, "Credits to apply:", creditsToApply / 100);

    return new Response(JSON.stringify({ 
      url: checkoutSession.url,
      checkoutSessionId: checkoutSession.id,
      creditsToApply: creditsToApply / 100,
      remainingAmount: remainingAmountCents / 100,
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
