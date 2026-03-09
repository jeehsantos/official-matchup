import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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

    // Call the expire_stale_holds function
    const { data, error } = await supabase.rpc("expire_stale_holds");

    if (error) {
      console.error("Error expiring holds:", error);
      throw error;
    }

    console.log(`Expired ${data} stale holds`);

    // Purge old terminal holds (EXPIRED, CONVERTED, FAILED) older than 7 days
    const { data: purgedCount, error: purgeError } = await supabase.rpc("purge_old_booking_holds");

    if (purgeError) {
      console.error("Error purging old holds:", purgeError);
      // Non-fatal: log but don't throw - expiration already succeeded
    } else {
      console.log(`Purged ${purgedCount} old terminal holds`);
    }

    // Purge old cancelled quick challenges and orphaned court availability (>14 days)
    const { data: cancelledPurge, error: cancelledError } = await supabase.rpc("purge_old_cancelled_records");

    if (cancelledError) {
      console.error("Error purging cancelled records:", cancelledError);
    } else {
      console.log(`Purged cancelled records:`, cancelledPurge);
    }

    return new Response(
      JSON.stringify({
        success: true,
        expired_count: data,
        purged_count: purgedCount ?? 0,
        purged_challenges: cancelledPurge?.purged_challenges ?? 0,
        purged_slots: cancelledPurge?.purged_slots ?? 0,
        timestamp: new Date().toISOString(),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Error in expire-holds:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
