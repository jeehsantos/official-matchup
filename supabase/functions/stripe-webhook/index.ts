import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
  apiVersion: "2024-12-18.acacia",
});

const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET") || "";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "*",
      },
    });
  }

  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const signature = req.headers.get("stripe-signature");
  if (!signature) {
    console.error("Missing Stripe-Signature header");
    return new Response("Missing signature", { status: 400 });
  }

  const body = await req.text();

  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(
      body,
      signature,
      webhookSecret,
      undefined,
      Stripe.createSubtleCryptoProvider()
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("Webhook signature verification failed:", msg);
    return new Response("Invalid signature", { status: 400 });
  }

  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );

  console.log("Webhook event received:", event.type, event.id);

  try {
    if (event.type === "checkout.session.completed") {
      await handleCheckoutCompleted(event, supabaseAdmin);
    }
    // Add more event types here as needed
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`Error processing ${event.type}:`, msg);
    // Return 200 to acknowledge receipt even on processing errors
    // Stripe will retry on 5xx but we don't want retries for logic errors
    return new Response(JSON.stringify({ received: true, error: msg }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify({ received: true }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
});

async function handleCheckoutCompleted(
  event: Stripe.Event,
  supabaseAdmin: ReturnType<typeof createClient>
) {
  const session = event.data.object as Stripe.Checkout.Session;
  const metadata = session.metadata || {};

  // Determine if this is a regular session or quick challenge
  const isQuickChallenge = metadata.type === "quick_challenge";

  if (isQuickChallenge) {
    await handleQuickChallengePayment(session, metadata, supabaseAdmin);
  } else {
    await handleSessionPayment(session, metadata, supabaseAdmin);
  }
}

async function handleSessionPayment(
  session: Stripe.Checkout.Session,
  metadata: Record<string, string>,
  supabaseAdmin: ReturnType<typeof createClient>
) {
  const sessionId = metadata.session_id;
  const userId = metadata.user_id;
  const creditsApplied = parseFloat(metadata.credits_applied || "0");
  const platformFee = parseFloat(metadata.platform_fee || "0");
  const paymentIntentId = session.payment_intent as string;

  if (!sessionId || !userId) {
    console.error("Missing session_id or user_id in metadata");
    return;
  }

  // Idempotency: check if already processed
  const { data: existing } = await supabaseAdmin
    .from("payments")
    .select("id, status")
    .eq("stripe_payment_intent_id", paymentIntentId)
    .maybeSingle();

  if (existing?.status === "completed" || existing?.status === "transferred") {
    console.log("Payment already processed, skipping:", paymentIntentId);
    return;
  }

  const amountPaid = (session.amount_total || 0) / 100;

  // Upsert payment record
  await supabaseAdmin
    .from("payments")
    .upsert(
      {
        session_id: sessionId,
        user_id: userId,
        amount: amountPaid,
        paid_with_credits: creditsApplied,
        platform_fee: platformFee / 100, // stored in dollars
        status: "completed",
        paid_at: new Date().toISOString(),
        stripe_payment_intent_id: paymentIntentId,
      },
      { onConflict: "session_id,user_id" }
    );

  // Confirm player participation
  await supabaseAdmin
    .from("session_players")
    .update({
      is_confirmed: true,
      confirmed_at: new Date().toISOString(),
    })
    .eq("session_id", sessionId)
    .eq("user_id", userId);

  // Update court availability payment status
  await supabaseAdmin
    .from("court_availability")
    .update({ payment_status: "completed" })
    .eq("booked_by_session_id", sessionId);

  // Process referral credit
  try {
    await supabaseAdmin.rpc("process_referral_credit", {
      p_referred_user_id: userId,
    });
  } catch (refErr) {
    console.error("Referral credit error (non-fatal):", refErr);
  }

  // Recalculate session confirmation and maybe trigger payout
  try {
    await supabaseAdmin.rpc("recalculate_and_maybe_confirm_session", {
      p_session_id: sessionId,
    });
  } catch (rpcErr) {
    console.error("Session recalculation error (non-fatal):", rpcErr);
  }

  console.log("Session payment processed:", {
    sessionId,
    userId,
    amount: amountPaid,
    paymentIntentId,
  });
}

async function handleQuickChallengePayment(
  session: Stripe.Checkout.Session,
  metadata: Record<string, string>,
  supabaseAdmin: ReturnType<typeof createClient>
) {
  const challengeId = metadata.challenge_id;
  const playerRecordId = metadata.player_record_id;
  const userId = metadata.user_id;

  if (!challengeId || !playerRecordId || !userId) {
    console.error("Missing quick challenge metadata");
    return;
  }

  // Idempotency: check if already paid
  const { data: player } = await supabaseAdmin
    .from("quick_challenge_players")
    .select("payment_status")
    .eq("id", playerRecordId)
    .single();

  if (player?.payment_status === "paid") {
    console.log("Quick challenge player already paid, skipping:", playerRecordId);
    return;
  }

  // Mark player as paid
  await supabaseAdmin
    .from("quick_challenge_players")
    .update({
      payment_status: "paid",
      paid_at: new Date().toISOString(),
      stripe_session_id: session.id,
    })
    .eq("id", playerRecordId);

  // Check and update challenge status
  const { data: challenge } = await supabaseAdmin
    .from("quick_challenges")
    .select("total_slots, quick_challenge_players(payment_status)")
    .eq("id", challengeId)
    .single();

  if (challenge) {
    const players = (challenge as any).quick_challenge_players || [];
    const paidCount = players.filter(
      (p: { payment_status: string }) => p.payment_status === "paid"
    ).length;

    if (paidCount >= (challenge as any).total_slots) {
      await supabaseAdmin
        .from("quick_challenges")
        .update({ status: "ready" })
        .eq("id", challengeId);
    } else if (players.length >= (challenge as any).total_slots) {
      await supabaseAdmin
        .from("quick_challenges")
        .update({ status: "full" })
        .eq("id", challengeId);
    }
  }

  // Process referral credit
  try {
    await supabaseAdmin.rpc("process_referral_credit", {
      p_referred_user_id: userId,
    });
  } catch (refErr) {
    console.error("Referral credit error (non-fatal):", refErr);
  }

  console.log("Quick challenge payment processed:", {
    challengeId,
    playerRecordId,
    userId,
  });
}
