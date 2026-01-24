import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Platform fee: $1.50 fixed
const PLATFORM_FEE = 1.50;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );

  try {
    const { checkoutSessionId, sessionId, userId } = await req.json();

    if (!checkoutSessionId && !sessionId) {
      throw new Error("Checkout session ID or session ID is required");
    }

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
      apiVersion: "2024-12-18.acacia",
    });

    let paymentSuccessful = false;
    let paymentIntentId: string | null = null;
    let amountPaid = 0;
    let actualUserId = userId;
    let actualSessionId = sessionId;

    if (checkoutSessionId) {
      // Verify the checkout session
      const checkoutSession = await stripe.checkout.sessions.retrieve(checkoutSessionId);
      
      if (checkoutSession.payment_status === "paid") {
        paymentSuccessful = true;
        paymentIntentId = checkoutSession.payment_intent as string;
        amountPaid = (checkoutSession.amount_total || 0) / 100;
        actualUserId = checkoutSession.metadata?.user_id || userId;
        actualSessionId = checkoutSession.metadata?.session_id || sessionId;
      }
    }

    if (!paymentSuccessful) {
      return new Response(JSON.stringify({ 
        success: false, 
        message: "Payment not completed" 
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    // Update payment record in database
    const { data: existingPayment } = await supabaseClient
      .from("payments")
      .select("id")
      .eq("session_id", actualSessionId)
      .eq("user_id", actualUserId)
      .maybeSingle();

    if (existingPayment) {
      // Update existing payment
      await supabaseClient
        .from("payments")
        .update({
          status: "completed",
          paid_at: new Date().toISOString(),
          stripe_payment_intent_id: paymentIntentId,
          platform_fee: PLATFORM_FEE,
        })
        .eq("id", existingPayment.id);
    } else {
      // Create new payment record
      await supabaseClient
        .from("payments")
        .insert({
          session_id: actualSessionId,
          user_id: actualUserId,
          amount: amountPaid,
          status: "completed",
          paid_at: new Date().toISOString(),
          stripe_payment_intent_id: paymentIntentId,
          platform_fee: PLATFORM_FEE,
        });
    }

    // Update court_availability payment status
    const { data: session } = await supabaseClient
      .from("sessions")
      .select("id")
      .eq("id", actualSessionId)
      .single();

    if (session) {
      await supabaseClient
        .from("court_availability")
        .update({ payment_status: "completed" })
        .eq("booked_by_session_id", actualSessionId);
    }

    // Update session_players to confirmed after successful payment
    const { error: playerUpdateError } = await supabaseClient
      .from("session_players")
      .update({ 
        is_confirmed: true, 
        confirmed_at: new Date().toISOString() 
      })
      .eq("session_id", actualSessionId)
      .eq("user_id", actualUserId);

    if (playerUpdateError) {
      console.error("Error updating session player:", playerUpdateError);
    }

    console.log("Payment verified and recorded:", {
      sessionId: actualSessionId,
      userId: actualUserId,
      amount: amountPaid,
      playerConfirmed: !playerUpdateError,
    });

    return new Response(JSON.stringify({ 
      success: true,
      message: "Payment verified and recorded",
      sessionId: actualSessionId,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("Error verifying payment:", errorMessage);
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
