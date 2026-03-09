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

    const admin = createClient(supabaseUrl, supabaseServiceKey);
    const userId = user.id;

    // 1. Anonymise profile (keep row, clear PII)
    await admin.from("profiles").update({
      full_name: "[deleted]",
      phone: null,
      city: null,
      nationality_code: null,
      gender: null,
      preferred_sports: null,
      avatar_url: null,
    }).eq("user_id", userId);

    // 2. Remove from all groups
    await admin.from("group_members").delete().eq("user_id", userId);

    // 3. Remove from all quick challenge players
    await admin.from("quick_challenge_players").delete().eq("user_id", userId);

    // 4. Remove session player entries (non-financial)
    await admin.from("session_players").delete().eq("user_id", userId);

    // 5. Clear notifications
    await admin.from("notifications").delete().eq("user_id", userId);

    // 6. Clear push subscriptions
    await admin.from("push_subscriptions").delete().eq("user_id", userId);

    // 7. Remove user credits (balance)
    await admin.from("user_credits").delete().eq("user_id", userId);

    // 8. Clear referral codes from profile
    await admin.from("profiles").update({ referral_code: null }).eq("user_id", userId);

    // NOTE: We preserve payments, credit_transactions, and held_credit_liabilities 
    // in anonymised form for financial/tax compliance (7 year retention).
    // The user_id reference remains but profile is anonymised.

    // 9. Delete the auth user (this cascades user_roles via FK)
    const { error: deleteError } = await admin.auth.admin.deleteUser(userId);
    if (deleteError) {
      console.error("Failed to delete auth user:", deleteError);
      return new Response(JSON.stringify({ error: "Failed to delete account. Please contact support." }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ success: true, message: "Account deleted successfully" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Delete account error:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
