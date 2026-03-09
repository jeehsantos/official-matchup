import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Verify user from their JWT
    const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Use service role to fetch all user data
    const admin = createClient(supabaseUrl, supabaseServiceKey);
    const userId = user.id;

    const [
      profileRes,
      creditsRes,
      creditTxRes,
      groupMembersRes,
      sessionPlayersRes,
      paymentsRes,
      notificationsRes,
      referralsRes,
    ] = await Promise.all([
      admin.from("profiles").select("full_name, phone, city, nationality_code, gender, preferred_sports, created_at").eq("user_id", userId).maybeSingle(),
      admin.from("user_credits").select("balance").eq("user_id", userId).maybeSingle(),
      admin.from("credit_transactions").select("amount, transaction_type, reason, created_at").eq("user_id", userId).order("created_at", { ascending: false }).limit(100),
      admin.from("group_members").select("group_id, is_admin, joined_at, groups(name, city, sport_type)").eq("user_id", userId),
      admin.from("session_players").select("session_id, is_confirmed, joined_at, sessions(session_date, start_time, court_price)").eq("user_id", userId).order("joined_at", { ascending: false }).limit(100),
      admin.from("payments").select("amount, court_amount, service_fee, status, paid_at, paid_with_credits, payment_type_snapshot, created_at").eq("user_id", userId).order("created_at", { ascending: false }).limit(100),
      admin.from("notifications").select("type, title, message, is_read, created_at").eq("user_id", userId).order("created_at", { ascending: false }).limit(50),
      admin.from("referrals").select("referral_code, status, credited_amount, created_at").eq("referrer_id", userId),
    ]);

    const exportData = {
      exported_at: new Date().toISOString(),
      account: {
        email: user.email,
        created_at: user.created_at,
      },
      profile: profileRes.data,
      credits: {
        balance: creditsRes.data?.balance ?? 0,
        transactions: creditTxRes.data ?? [],
      },
      groups: groupMembersRes.data ?? [],
      sessions: sessionPlayersRes.data ?? [],
      payments: paymentsRes.data ?? [],
      notifications: notificationsRes.data ?? [],
      referrals: referralsRes.data ?? [],
    };

    return new Response(JSON.stringify(exportData, null, 2), {
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="sport-arena-data-export-${new Date().toISOString().slice(0, 10)}.json"`,
      },
    });
  } catch (err) {
    console.error("Export error:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
