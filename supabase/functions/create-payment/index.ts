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

  try {
    // Get request body
    const { 
      sessionId, 
      paymentType, // 'at_booking' or 'before_session'
      returnUrl,
      origin: requestOrigin
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

    // Fetch session details with court and group info
    const { data: session, error: sessionError } = await supabaseClient
      .from("sessions")
      .select(`
        *,
        courts (
          *,
          venues (owner_id)
        ),
        groups (name, organizer_id)
      `)
      .eq("id", sessionId)
      .single();

    if (sessionError || !session) {
      throw new Error("Session not found");
    }

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

    // Initialize Stripe
    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
      apiVersion: "2024-12-18.acacia",
    });

    // Check if a Stripe customer exists for this user
    const customers = await stripe.customers.list({ email: user.email, limit: 1 });
    let customerId: string | undefined;
    if (customers.data.length > 0) {
      customerId = customers.data[0].id;
    }

    // Create checkout session with application fee
    const origin = requestOrigin || req.headers.get("origin") || "https://trlsnfxhsoqapnhjauph.lovableproject.com";
    const successUrl = `${origin}/payment-success?session_id=${sessionId}&type=${paymentType}`;
    const cancelUrl = returnUrl ? `${origin}${returnUrl}` : `${origin}/games/${sessionId}`;

    const checkoutSession = await stripe.checkout.sessions.create({
      customer: customerId,
      customer_email: customerId ? undefined : user.email,
      line_items: [
        {
          price_data: {
            currency: "nzd",
            product_data: {
              name: description,
              description: `Session Date: ${session.session_date} at ${session.start_time}`,
            },
            unit_amount: amountCents,
          },
          quantity: 1,
        },
      ],
      mode: "payment",
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: {
        session_id: sessionId,
        user_id: user.id,
        payment_type: paymentType || session.payment_type,
        platform_fee: PLATFORM_FEE_CENTS.toString(),
      },
      payment_intent_data: {
        metadata: {
          session_id: sessionId,
          user_id: user.id,
        },
      },
    });

    console.log("Checkout session created:", checkoutSession.id);

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
