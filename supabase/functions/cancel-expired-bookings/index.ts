import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const STALE_QUICK_CHALLENGE_MINUTES = 15;

type SupabaseClient = ReturnType<typeof createClient>;

async function cancelStaleQuickChallenges(supabase: SupabaseClient) {
  const cutoffIso = new Date(Date.now() - STALE_QUICK_CHALLENGE_MINUTES * 60 * 1000).toISOString();

  const { data: staleChallenges, error: staleChallengesError } = await supabase
    .from("quick_challenges")
    .select(`
      id,
      created_by,
      court_id,
      scheduled_date,
      scheduled_time,
      status,
      created_at,
      courts (payment_timing),
      quick_challenge_players (payment_status)
    `)
    .in("status", ["open", "full", "pending_payment"])
    .lt("created_at", cutoffIso)
    .not("court_id", "is", null)
    .not("scheduled_date", "is", null)
    .not("scheduled_time", "is", null);

  if (staleChallengesError) {
    throw staleChallengesError;
  }

  let cancelledCount = 0;
  let releasedSlotsCount = 0;

  for (const challenge of staleChallenges ?? []) {
    const paymentTiming = (challenge as any)?.courts?.payment_timing;
    if (paymentTiming !== "at_booking") continue;

    const hasPaidPlayer = ((challenge as any)?.quick_challenge_players ?? []).some(
      (player: { payment_status: string }) => player.payment_status === "paid"
    );
    if (hasPaidPlayer) continue;

    const { data: completedPayment, error: completedPaymentError } = await supabase
      .from("quick_challenge_payments")
      .select("id")
      .eq("challenge_id", challenge.id)
      .eq("status", "completed")
      .limit(1)
      .maybeSingle();

    if (completedPaymentError) {
      throw completedPaymentError;
    }

    if (completedPayment) continue;

    const { count: releasedSlots, error: releaseError } = await supabase
      .from("court_availability")
      .delete({ count: "exact" })
      .eq("court_id", challenge.court_id)
      .eq("available_date", challenge.scheduled_date)
      .eq("start_time", challenge.scheduled_time)
      .eq("booked_by_user_id", challenge.created_by)
      .eq("payment_status", "pending");

    if (releaseError) {
      throw releaseError;
    }

    const { error: cancelError } = await supabase
      .from("quick_challenges")
      .update({ status: "cancelled" })
      .eq("id", challenge.id)
      .in("status", ["open", "full", "pending_payment"]);

    if (cancelError) {
      throw cancelError;
    }

    cancelledCount += 1;
    releasedSlotsCount += releasedSlots ?? 0;
  }

  return { cancelledCount, releasedSlotsCount };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Authenticate cron requests via shared secret (fail closed)
    const cronSecret = Deno.env.get("CRON_SECRET");
    const providedSecret = req.headers.get("x-cron-secret");
    if (!cronSecret || providedSecret !== cronSecret) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const [sessionCleanupResult, quickChallengeCleanupResult] = await Promise.all([
      supabase.rpc("cancel_expired_unpaid_sessions"),
      cancelStaleQuickChallenges(supabase),
    ]);

    if (sessionCleanupResult.error) {
      console.error("Error cancelling expired bookings:", sessionCleanupResult.error);
      throw sessionCleanupResult.error;
    }

    console.log(
      `Cancelled ${sessionCleanupResult.data ?? 0} expired unpaid bookings; ` +
      `cancelled ${quickChallengeCleanupResult.cancelledCount} stale quick challenges; ` +
      `released ${quickChallengeCleanupResult.releasedSlotsCount} stale court slots`
    );

    return new Response(
      JSON.stringify({
        success: true,
        cancelled_session_count: sessionCleanupResult.data ?? 0,
        cancelled_quick_challenge_count: quickChallengeCleanupResult.cancelledCount,
        released_quick_challenge_slot_count: quickChallengeCleanupResult.releasedSlotsCount,
        timestamp: new Date().toISOString(),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Error in cancel-expired-bookings:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
