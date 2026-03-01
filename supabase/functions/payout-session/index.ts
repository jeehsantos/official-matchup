import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

class HttpError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

function decodeJwtPayload(token: string): Record<string, unknown> | null {
  const parts = token.split(".");
  if (parts.length !== 3) return null;

  try {
    const base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
    return JSON.parse(atob(padded));
  } catch {
    return null;
  }
}

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

  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_ANON_KEY") ?? ""
  );

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      throw new HttpError(401, "Missing or invalid Authorization header");
    }

    const token = authHeader.slice("Bearer ".length).trim();
    if (!token) {
      throw new HttpError(401, "Missing bearer token");
    }

    const payload = decodeJwtPayload(token);
    if (!payload) {
      throw new HttpError(401, "Invalid JWT format");
    }

    const jwtRole = String(payload.role ?? "");
    const serviceRoleToken = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const isServiceExecution = jwtRole === "service_role" && token === serviceRoleToken;

    if (!isServiceExecution) {
      const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
      if (userError || !userData.user) {
        throw new HttpError(401, "Invalid or expired JWT");
      }

      const { data: adminRole, error: adminRoleError } = await supabaseAdmin
        .from("user_roles")
        .select("id")
        .eq("user_id", userData.user.id)
        .eq("role", "admin")
        .maybeSingle();

      if (adminRoleError) {
        throw new Error("Failed to verify admin role");
      }

      if (!adminRole) {
        throw new HttpError(403, "Forbidden: admin role required");
      }
    }

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
          transferring_at: null,
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

    const claimTime = new Date().toISOString();
    const eligiblePaymentIds = eligiblePayments.map((payment) => payment.id);
    const { data: claimedPayments, error: claimError } = await supabaseAdmin
      .from("payments")
      .update({ transferring_at: claimTime })
      .in("id", eligiblePaymentIds)
      .eq("status", "completed")
      .is("transferred_at", null)
      .is("converted_to_credits_at", null)
      .is("transferring_at", null)
      .select("*");

    if (claimError) {
      throw new Error("Failed to claim payments for transfer");
    }

    if (!claimedPayments || claimedPayments.length === 0) {
      console.log("No payments claimed; transfer is already in progress or completed", sessionId);
      return new Response(
        JSON.stringify({ success: true, alreadyProcessing: true, message: "Transfer is already processing or completed" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const releaseClaims = async () => {
      await supabaseAdmin
        .from("payments")
        .update({ transferring_at: null })
        .in("id", claimedPayments.map((payment) => payment.id))
        .is("transferred_at", null);
    };

    // 4. Calculate venue payout: SUM of court_amount snapshots only
    // Platform retains service_fee by NOT including it in the transfer
    let totalTransferCents = 0;
    const paymentIds: string[] = [];

    for (const payment of claimedPayments) {
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
          transferring_at: null,
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

    const transferIdempotencyKey = `transfer:${sessionId}:${venue.id}`;

    let transfer;
    try {
      transfer = await stripe.transfers.create(
        {
          amount: totalTransferCents,
          currency: "nzd",
          destination: venue.stripe_account_id,
          description: `Session payout: ${sessionId}`,
          metadata: {
            session_id: sessionId,
            venue_id: venue.id,
            venue_name: venue.name,
            payment_count: claimedPayments.length.toString(),
          },
        },
        { idempotencyKey: transferIdempotencyKey }
      );
    } catch (stripeError) {
      await releaseClaims();
      throw stripeError;
    }

    // 6. Mark each payment as transferred with its individual court_amount
    try {
      for (const payment of claimedPayments) {
        const courtAmount = payment.court_amount != null
          ? Number(payment.court_amount)
          : Math.max(0, Number(payment.amount) - Number(payment.platform_fee || 0));

        const { error: paymentUpdateError } = await supabaseAdmin
          .from("payments")
          .update({
            status: "transferred",
            transferred_at: new Date().toISOString(),
            transferring_at: null,
            stripe_transfer_id: transfer.id,
            transfer_amount: courtAmount,
          })
          .eq("id", payment.id);

        if (paymentUpdateError) {
          throw new Error(`Failed to update payment ${payment.id} after transfer`);
        }
      }
    } catch (updateError) {
      await releaseClaims();
      throw updateError;
    }

    console.log("Session payout completed:", {
      sessionId,
      transferId: transfer.id,
      totalCents: totalTransferCents,
      destination: venue.stripe_account_id,
      paymentCount: claimedPayments.length,
    });

    return new Response(
      JSON.stringify({
        success: true,
        transferId: transfer.id,
        totalTransferred: totalTransferCents / 100,
        paymentCount: claimedPayments.length,
        message: `$${(totalTransferCents / 100).toFixed(2)} transferred to ${venue.name}`,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    const status = error instanceof HttpError ? error.status : 500;
    console.error("Payout session error:", msg);
    return new Response(
      JSON.stringify({ success: false, error: msg }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status,
      }
    );
  }
});
