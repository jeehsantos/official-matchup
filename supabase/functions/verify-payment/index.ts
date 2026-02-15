import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Platform fee is now read from metadata (set during create-payment)
// Fallback to $1.50 if not present for backward compatibility
const DEFAULT_PLATFORM_FEE = 1.50;

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
    let platformFee = DEFAULT_PLATFORM_FEE;
    let actualUserId = userId;
    let actualSessionId = sessionId;

    if (checkoutSessionId) {
      const checkoutSession = await stripe.checkout.sessions.retrieve(checkoutSessionId);
      
      if (checkoutSession.payment_status === "paid") {
        paymentSuccessful = true;
        paymentIntentId = checkoutSession.payment_intent as string;
        amountPaid = (checkoutSession.amount_total || 0) / 100;
        actualUserId = checkoutSession.metadata?.user_id || userId;
        actualSessionId = checkoutSession.metadata?.session_id || sessionId;
        // Read platform fee from metadata (set during create-payment)
        const metadataFee = checkoutSession.metadata?.platform_fee;
        platformFee = metadataFee ? parseFloat(metadataFee) : DEFAULT_PLATFORM_FEE;
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
          platform_fee: platformFee,
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
          platform_fee: platformFee,
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

    // Trigger payment transfer to venue owner after confirmation
    if (!playerUpdateError) {
      try {
        const transferResponse = await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/transfer-payment`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
          },
          body: JSON.stringify({
            sessionId: actualSessionId,
            userId: actualUserId,
          }),
        });

        const transferResult = await transferResponse.json();
        if (!transferResult.success) {
          console.error("Payment transfer failed:", transferResult.error);
          // Don't fail the payment verification - transfer can be retried
        } else {
          console.log("Payment transferred to venue owner:", transferResult);
        }
      } catch (transferError) {
        console.error("Error calling transfer-payment function:", transferError);
        // Don't fail the payment verification - transfer can be retried
      }
    }

    // Process referral credit for the paying user (if they were referred)
    try {
      const { data: referralResult } = await supabaseClient.rpc("process_referral_credit", {
        p_referred_user_id: actualUserId,
      });
      if (referralResult) {
        console.log("Referral credit awarded for user:", actualUserId);
      }
    } catch (refError) {
      console.error("Error processing referral credit:", refError);
      // Don't fail payment verification for referral errors
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
