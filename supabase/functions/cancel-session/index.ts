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
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Verify user
    const supabaseUser = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabaseUser.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = claimsData.claims.sub;

    const { sessionId } = await req.json();
    if (!sessionId) {
      return new Response(JSON.stringify({ error: "sessionId is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Use service role for all DB operations
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

    // Verify user is the group organizer
    const { data: session, error: sessionError } = await supabaseAdmin
      .from("sessions")
      .select("id, group_id, court_id, is_cancelled, groups!inner(organizer_id)")
      .eq("id", sessionId)
      .single();

    if (sessionError || !session) {
      return new Response(JSON.stringify({ error: "Session not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if ((session.groups as any).organizer_id !== userId) {
      return new Response(JSON.stringify({ error: "Only the organizer can cancel this session" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (session.is_cancelled) {
      return new Response(JSON.stringify({ error: "Session is already cancelled" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Load all completed payments for this session
    const { data: payments, error: paymentsError } = await supabaseAdmin
      .from("payments")
      .select("id, user_id, court_amount, amount, platform_fee, status")
      .eq("session_id", sessionId)
      .eq("status", "completed");

    if (paymentsError) {
      console.error("Error loading payments:", paymentsError);
      return new Response(JSON.stringify({ error: "Failed to load payments" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let totalCreditsConverted = 0;
    const creditResults: { userId: string; amount: number }[] = [];

    // Convert each payment's court_amount to credits
    for (const payment of payments || []) {
      // court_amount is stored in DOLLARS in the payments table (numeric type)
      const courtAmountDollars = payment.court_amount ?? Math.max((payment.amount || 0) - (payment.platform_fee || 0), 0);
      const creditAmount = Number(courtAmountDollars);

      if (creditAmount > 0) {
        // Add credits via RPC (service role bypasses auth.uid() check)
        const { error: creditError } = await supabaseAdmin.rpc("add_user_credits", {
          p_user_id: payment.user_id,
          p_amount: creditAmount,
          p_reason: `Refund for cancelled session`,
          p_session_id: sessionId,
          p_payment_id: payment.id,
        });

        if (creditError) {
          console.error(`Error adding credits for user ${payment.user_id}:`, creditError);
          continue;
        }

        // Record held credit liability (amount_cents column expects cents)
        const liabilityCents = Math.round(creditAmount * 100);
        const { error: liabilityError } = await supabaseAdmin
          .from("held_credit_liabilities")
          .insert({
            user_id: payment.user_id,
            amount_cents: liabilityCents,
            source_session_id: sessionId,
            source_payment_id: payment.id,
            status: "HELD",
          });

        if (liabilityError) {
          console.error(`Error creating liability for user ${payment.user_id}:`, liabilityError);
        }

        // Update payment status
        await supabaseAdmin
          .from("payments")
          .update({ status: "refunded" as any, updated_at: new Date().toISOString() })
          .eq("id", payment.id);

        totalCreditsConverted += creditAmount;
        creditResults.push({ userId: payment.user_id, amount: creditAmount });
      }
    }

    // Release court availability
    await supabaseAdmin
      .from("court_availability")
      .update({
        is_booked: false,
        booked_by_session_id: null,
        booked_by_group_id: null,
        booked_by_user_id: null,
        payment_status: "pending",
      })
      .eq("booked_by_session_id", sessionId);

    // Remove all session players
    await supabaseAdmin
      .from("session_players")
      .delete()
      .eq("session_id", sessionId);

    // Mark session as cancelled
    await supabaseAdmin
      .from("sessions")
      .update({ is_cancelled: true })
      .eq("id", sessionId);

    return new Response(
      JSON.stringify({
        success: true,
        creditsConverted: totalCreditsConverted,
        playersRefunded: creditResults.length,
        message:
          creditResults.length > 0
            ? `Session cancelled. ${creditResults.length} player(s) received platform credits totalling $${totalCreditsConverted.toFixed(2)}.`
            : "Session cancelled. No payments to refund.",
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (err) {
    console.error("cancel-session error:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
