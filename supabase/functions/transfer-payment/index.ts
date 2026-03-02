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
    const { paymentId, sessionId, userId } = await req.json();

    if (!paymentId && (!sessionId || !userId)) {
      throw new Error("Payment ID or (Session ID and User ID) is required");
    }

    // Fetch payment record
    let payment;
    if (paymentId) {
      const { data, error } = await supabaseAdmin
        .from("payments")
        .select("*")
        .eq("id", paymentId)
        .single();
      if (error || !data) throw new Error("Payment not found");
      payment = data;
    } else {
      const { data, error } = await supabaseAdmin
        .from("payments")
        .select("*")
        .eq("session_id", sessionId)
        .eq("user_id", userId)
        .single();
      if (error || !data) throw new Error("Payment not found");
      payment = data;
    }

    // Check if payment is in correct status
    if (payment.status !== "completed") {
      if (payment.status === "refunded" || payment.status === "cancelled") {
        throw new Error(`Cannot transfer payment - it has been ${payment.status}`);
      }
      throw new Error(`Payment status is ${payment.status}, expected 'completed'`);
    }

    // Check if already transferred
    if (payment.transferred_at) {
      console.log("Payment already transferred:", payment.id);
      return new Response(JSON.stringify({ 
        success: true,
        alreadyTransferred: true,
        message: "Payment was already transferred",
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    // ─── DESTINATION-CHARGE GUARD ───
    // If payment was made with destination-charge, Stripe already handled the transfer.
    // Check if the PaymentIntent has an automatic transfer attached.
    if (payment.stripe_payment_intent_id) {
      const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
        apiVersion: "2024-12-18.acacia",
      });

      try {
        const pi = await stripe.paymentIntents.retrieve(payment.stripe_payment_intent_id, {
          expand: ["latest_charge"],
        });
        const charge = pi.latest_charge as Stripe.Charge | null;
        const autoTransferId = charge?.transfer as string | null;

        if (autoTransferId) {
          // Destination-charge payment: Stripe already transferred funds.
          // Just update our records to reflect this.
          const courtAmount = payment.court_amount != null
            ? Number(payment.court_amount)
            : Math.max(0, Number(payment.amount) - Number(payment.platform_fee || 0));

          await supabaseAdmin
            .from("payments")
            .update({
              status: "transferred",
              transferred_at: new Date().toISOString(),
              stripe_transfer_id: autoTransferId,
              transfer_amount: courtAmount,
            })
            .eq("id", payment.id);

          console.log(`Destination-charge payment ${payment.id} marked transferred (auto: ${autoTransferId})`);

          return new Response(JSON.stringify({
            success: true,
            destinationCharge: true,
            transferId: autoTransferId,
            message: "Destination-charge transfer already handled by Stripe.",
          }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 200,
          });
        }
      } catch (err) {
        console.error("Error checking destination-charge status (continuing with manual transfer):", err);
      }
    }

    // ─── LEGACY MANUAL TRANSFER ───
    // Claim this payment for transfer processing
    const claimTime = new Date().toISOString();
    const { data: claimedPayment, error: claimError } = await supabaseAdmin
      .from("payments")
      .update({ transferring_at: claimTime })
      .eq("id", payment.id)
      .eq("status", "completed")
      .is("transferred_at", null)
      .is("transferring_at", null)
      .select("*")
      .maybeSingle();

    if (claimError) {
      throw new Error("Failed to claim payment for transfer");
    }

    if (!claimedPayment) {
      console.log("Payment already claimed or transferred by another request:", payment.id);
      return new Response(JSON.stringify({
        success: true,
        alreadyProcessing: true,
        message: "Payment transfer is already processing or completed",
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    payment = claimedPayment;

    const releaseClaim = async () => {
      await supabaseAdmin
        .from("payments")
        .update({ transferring_at: null })
        .eq("id", payment.id)
        .is("transferred_at", null);
    };

    // Check player confirmation status
    const { data: sessionPlayer, error: playerError } = await supabaseAdmin
      .from("session_players")
      .select("is_confirmed, confirmed_at")
      .eq("session_id", payment.session_id)
      .eq("user_id", payment.user_id)
      .single();

    if (playerError || !sessionPlayer) {
      await releaseClaim();
      throw new Error("Session player record not found");
    }

    if (!sessionPlayer.is_confirmed) {
      await releaseClaim();
      throw new Error("Player has not confirmed participation. Transfer blocked.");
    }

    // Fetch session and venue details
    const { data: session, error: sessionError } = await supabaseAdmin
      .from("sessions")
      .select(`
        *,
        courts (
          *,
          venues (
            id,
            owner_id,
            stripe_account_id,
            name
          )
        )
      `)
      .eq("id", payment.session_id)
      .single();

    if (sessionError || !session) {
      await releaseClaim();
      throw new Error("Session not found");
    }

    const venue = (session.courts as any)?.venues;
    const connectedAccountId = venue?.stripe_account_id;

    if (!connectedAccountId) {
      console.log("No Stripe Connect account for venue:", venue?.id);
      await supabaseAdmin
        .from("payments")
        .update({
          status: "transferred",
          transferred_at: new Date().toISOString(),
          transferring_at: null,
          transfer_amount: 0,
        })
        .eq("id", payment.id);

      return new Response(JSON.stringify({ 
        success: true,
        noConnectedAccount: true,
        message: "No connected account. Payment retained by platform.",
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    // Calculate transfer amount: court_amount only (service fee retained by platform)
    const courtAmount = payment.court_amount != null
      ? Number(payment.court_amount)
      : Math.max(0, Number(payment.amount) - Number(payment.platform_fee || 0));
    const transferAmountCents = Math.round(courtAmount * 100);

    if (transferAmountCents <= 0) {
      console.log("No amount to transfer after fees");
      await supabaseAdmin
        .from("payments")
        .update({
          status: "transferred",
          transferred_at: new Date().toISOString(),
          transferring_at: null,
          transfer_amount: 0,
        })
        .eq("id", payment.id);

      return new Response(JSON.stringify({ 
        success: true,
        noTransferNeeded: true,
        message: "No amount to transfer after platform fees.",
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
      apiVersion: "2024-12-18.acacia",
    });

    const transferIdempotencyKey = `transfer:${payment.id}`;

    let transfer;
    try {
      transfer = await stripe.transfers.create(
        {
          amount: transferAmountCents,
          currency: "nzd",
          destination: connectedAccountId,
          description: `Payment for session ${payment.session_id}`,
          metadata: {
            payment_id: payment.id,
            session_id: payment.session_id,
            user_id: payment.user_id,
            venue_id: venue.id,
            venue_name: venue.name,
            legacy_transfer: "true",
          },
        },
        { idempotencyKey: transferIdempotencyKey }
      );
    } catch (stripeError) {
      await releaseClaim();
      throw stripeError;
    }

    const { error: updateError } = await supabaseAdmin
      .from("payments")
      .update({
        status: "transferred",
        transferred_at: new Date().toISOString(),
        transferring_at: null,
        stripe_transfer_id: transfer.id,
        transfer_amount: courtAmount,
      })
      .eq("id", payment.id);

    if (updateError) {
      console.error("Error updating payment record:", updateError);
      await releaseClaim();
      throw new Error("Failed to update payment record after transfer");
    }

    console.log("Payment transferred successfully:", {
      paymentId: payment.id,
      transferId: transfer.id,
      amount: courtAmount,
      destination: connectedAccountId,
      venueName: venue.name,
    });

    return new Response(JSON.stringify({ 
      success: true,
      transferId: transfer.id,
      transferAmount: courtAmount,
      message: `Payment of $${courtAmount.toFixed(2)} transferred to venue owner.`,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("Error transferring payment:", errorMessage);
    return new Response(JSON.stringify({ 
      error: errorMessage,
      success: false,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
