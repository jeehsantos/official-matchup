import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

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
    const { sessionId } = await req.json();

    if (!sessionId) {
      throw new Error("sessionId is required");
    }

    // 1. Fetch session with court + venue
    const { data: session, error: sessionError } = await supabaseAdmin
      .from("sessions")
      .select(`
        *,
        courts (
          *,
          venues (
            id, name, owner_id, stripe_account_id
          )
        )
      `)
      .eq("id", sessionId)
      .single();

    if (sessionError || !session) {
      throw new Error("Session not found");
    }

    const venue = (session.courts as any)?.venues;

    if (!venue?.stripe_account_id) {
      console.log("No Stripe Connect account for venue — platform retains funds");
      await supabaseAdmin
        .from("payments")
        .update({
          status: "transferred",
          transferred_at: new Date().toISOString(),
          transfer_amount: 0,
        })
        .eq("session_id", sessionId)
        .eq("status", "completed")
        .is("transferred_at", null)
        .is("converted_to_credits_at", null);

      return new Response(
        JSON.stringify({
          success: true,
          noConnectedAccount: true,
          message: "No connected account. Payment retained by platform.",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 2. Fetch eligible payments: completed, not yet transferred
    const { data: payments, error: paymentsError } = await supabaseAdmin
      .from("payments")
      .select("*")
      .eq("session_id", sessionId)
      .eq("status", "completed")
      .is("transferred_at", null)
      .is("converted_to_credits_at", null);

    if (paymentsError) {
      throw new Error("Failed to fetch payments");
    }

    if (!payments || payments.length === 0) {
      console.log("No eligible payments to transfer for session:", sessionId);
      return new Response(
        JSON.stringify({ success: true, message: "No payments to transfer" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 3. Verify each payment's player is still confirmed in session
    const { data: confirmedPlayers } = await supabaseAdmin
      .from("session_players")
      .select("user_id")
      .eq("session_id", sessionId)
      .eq("is_confirmed", true);

    const confirmedUserIds = new Set(
      (confirmedPlayers || []).map((p) => p.user_id)
    );

    const eligiblePayments = payments.filter((p) =>
      confirmedUserIds.has(p.user_id)
    );

    if (eligiblePayments.length === 0) {
      console.log("No eligible payments after player filter");
      return new Response(
        JSON.stringify({ success: true, message: "No eligible payments" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 4. Calculate venue payout: SUM of court_amount snapshots only
    // Platform retains service_fee by NOT including it in the transfer
    let totalTransferCents = 0;
    const paymentIds: string[] = [];

    for (const payment of eligiblePayments) {
      // Use court_amount snapshot; fall back to (amount - platform_fee) for legacy rows
      const courtAmount = payment.court_amount != null
        ? Number(payment.court_amount)
        : Math.max(0, Number(payment.amount) - Number(payment.platform_fee || 0));

      totalTransferCents += Math.round(courtAmount * 100);
      paymentIds.push(payment.id);
    }

    if (totalTransferCents <= 0) {
      console.log("No amount to transfer after calculations");
      await supabaseAdmin
        .from("payments")
        .update({
          status: "transferred",
          transferred_at: new Date().toISOString(),
          transfer_amount: 0,
        })
        .in("id", paymentIds);

      return new Response(
        JSON.stringify({ success: true, message: "No amount to transfer" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 5. Create ONE Stripe transfer for the entire session payout
    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
      apiVersion: "2024-12-18.acacia",
    });

    const transfer = await stripe.transfers.create({
      amount: totalTransferCents,
      currency: "nzd",
      destination: venue.stripe_account_id,
      description: `Session payout: ${sessionId}`,
      metadata: {
        session_id: sessionId,
        venue_id: venue.id,
        venue_name: venue.name,
        payment_count: eligiblePayments.length.toString(),
      },
    });

    // 6. Mark each payment as transferred with its individual court_amount
    for (const payment of eligiblePayments) {
      const courtAmount = payment.court_amount != null
        ? Number(payment.court_amount)
        : Math.max(0, Number(payment.amount) - Number(payment.platform_fee || 0));

      await supabaseAdmin
        .from("payments")
        .update({
          status: "transferred",
          transferred_at: new Date().toISOString(),
          stripe_transfer_id: transfer.id,
          transfer_amount: courtAmount,
        })
        .eq("id", payment.id);
    }

    console.log("Session payout completed:", {
      sessionId,
      transferId: transfer.id,
      totalCents: totalTransferCents,
      destination: venue.stripe_account_id,
      paymentCount: eligiblePayments.length,
    });

    return new Response(
      JSON.stringify({
        success: true,
        transferId: transfer.id,
        totalTransferred: totalTransferCents / 100,
        paymentCount: eligiblePayments.length,
        message: `$${(totalTransferCents / 100).toFixed(2)} transferred to ${venue.name}`,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("Payout session error:", msg);
    return new Response(
      JSON.stringify({ success: false, error: msg }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});
