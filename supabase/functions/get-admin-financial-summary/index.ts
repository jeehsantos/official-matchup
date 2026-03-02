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
    // Authenticate and verify admin role
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Authorization required");

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) throw new Error("User not authenticated");

    const { data: adminRole } = await supabaseAdmin
      .from("user_roles")
      .select("id")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .maybeSingle();

    if (!adminRole) {
      return new Response(JSON.stringify({ error: "Forbidden: admin role required" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 403,
      });
    }

    const url = new URL(req.url);
    const startDate = url.searchParams.get("start_date") || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
    const endDate = url.searchParams.get("end_date") || new Date().toISOString().split("T")[0];

    // ─── Session payments aggregation ───
    const { data: sessionPayments, error: spError } = await supabaseAdmin
      .from("payments")
      .select("amount, court_amount, service_fee, platform_fee, stripe_fee_actual, paid_with_credits, status, transferred_at, paid_at, stripe_payment_intent_id")
      .in("status", ["completed", "transferred"])
      .gte("paid_at", `${startDate}T00:00:00Z`)
      .lte("paid_at", `${endDate}T23:59:59Z`);

    if (spError) throw new Error("Failed to fetch session payments: " + spError.message);

    // ─── Quick challenge payments aggregation ───
    const { data: qcPayments, error: qcError } = await supabaseAdmin
      .from("quick_challenge_payments")
      .select("amount, court_amount, service_fee_total, platform_profit_target, stripe_fee_actual, status, paid_at")
      .eq("status", "completed")
      .gte("paid_at", `${startDate}T00:00:00Z`)
      .lte("paid_at", `${endDate}T23:59:59Z`);

    if (qcError) throw new Error("Failed to fetch QC payments: " + qcError.message);

    // ─── Credits liability ───
    const { data: creditsData, error: creditsError } = await supabaseAdmin
      .from("user_credits")
      .select("balance");

    if (creditsError) throw new Error("Failed to fetch credits: " + creditsError.message);

    // ─── Aggregate session payments ───
    let grossCollectedCents = 0;
    let recipientTotalCents = 0;
    let serviceFeeTotalCents = 0;
    let platformFeeTotalCents = 0;
    let stripeFeeActualTotalCents = 0;
    let transferredToCourtsCents = 0;
    let pendingCourtPayablesCents = 0;
    let sessionPaymentCount = 0;

    for (const p of (sessionPayments || [])) {
      const amount = Math.round(Number(p.amount || 0) * 100);
      const courtAmount = Math.round(Number(p.court_amount || 0) * 100);
      const serviceFee = Math.round(Number(p.service_fee || 0) * 100);
      const platformFee = Math.round(Number(p.platform_fee || 0) * 100);
      const stripeFee = Math.round(Number(p.stripe_fee_actual || 0) * 100);

      grossCollectedCents += amount;
      recipientTotalCents += courtAmount;
      serviceFeeTotalCents += serviceFee;
      platformFeeTotalCents += platformFee;
      stripeFeeActualTotalCents += stripeFee;
      sessionPaymentCount++;

      if (p.transferred_at) {
        transferredToCourtsCents += courtAmount;
      } else {
        pendingCourtPayablesCents += courtAmount;
      }
    }

    // ─── Aggregate QC payments ───
    let qcGrossCollectedCents = 0;
    let qcRecipientTotalCents = 0;
    let qcServiceFeeTotalCents = 0;
    let qcPlatformFeeTotalCents = 0;
    let qcStripeFeeActualCents = 0;
    let qcPaymentCount = 0;

    for (const p of (qcPayments || [])) {
      const amount = Number(p.amount || 0); // already in cents for QC
      const courtAmount = Number(p.court_amount || 0);
      const serviceFee = Number(p.service_fee_total || 0);
      const platformFee = Number(p.platform_profit_target || 0);
      const stripeFee = Number(p.stripe_fee_actual || 0);

      qcGrossCollectedCents += amount;
      qcRecipientTotalCents += courtAmount;
      qcServiceFeeTotalCents += serviceFee;
      qcPlatformFeeTotalCents += platformFee;
      qcStripeFeeActualCents += stripeFee;
      qcPaymentCount++;
    }

    // ─── Credits liability ───
    let creditsLiabilityCents = 0;
    for (const c of (creditsData || [])) {
      creditsLiabilityCents += Math.round(Number(c.balance || 0) * 100);
    }

    // ─── Combined totals ───
    const totalGrossCollectedCents = grossCollectedCents + qcGrossCollectedCents;
    const totalRecipientCents = recipientTotalCents + qcRecipientTotalCents;
    const totalServiceFeeCents = serviceFeeTotalCents + qcServiceFeeTotalCents;
    const totalPlatformFeeCents = platformFeeTotalCents + qcPlatformFeeTotalCents;
    const totalStripeFeeActualCents = stripeFeeActualTotalCents + qcStripeFeeActualCents;
    const stripeFeeCoverageCents = totalServiceFeeCents - totalPlatformFeeCents;
    const netPlatformPositionCents = totalServiceFeeCents - stripeFeeCoverageCents;

    // ─── Top venues ───
    const { data: topVenuesData } = await supabaseAdmin
      .from("payments")
      .select("court_amount, sessions!inner(court_id, courts!inner(venue_id, venues!inner(name)))")
      .in("status", ["completed", "transferred"])
      .gte("paid_at", `${startDate}T00:00:00Z`)
      .lte("paid_at", `${endDate}T23:59:59Z`)
      .limit(500);

    const venueMap = new Map<string, { name: string; totalCents: number; count: number }>();
    for (const p of (topVenuesData || [])) {
      const venue = (p as any).sessions?.courts?.venues;
      if (!venue) continue;
      const venueId = venue.id || venue.name;
      const existing = venueMap.get(venueId) || { name: venue.name, totalCents: 0, count: 0 };
      existing.totalCents += Math.round(Number(p.court_amount || 0) * 100);
      existing.count++;
      venueMap.set(venueId, existing);
    }

    const topVenues = Array.from(venueMap.entries())
      .map(([id, v]) => ({ venue_id: id, venue_name: v.name, total_cents: v.totalCents, payment_count: v.count }))
      .sort((a, b) => b.total_cents - a.total_cents)
      .slice(0, 10);

    // ─── Daily time series ───
    const dailyMap = new Map<string, { gross: number; service_fee: number; recipient: number; count: number }>();
    for (const p of (sessionPayments || [])) {
      const day = p.paid_at ? p.paid_at.split("T")[0] : startDate;
      const existing = dailyMap.get(day) || { gross: 0, service_fee: 0, recipient: 0, count: 0 };
      existing.gross += Math.round(Number(p.amount || 0) * 100);
      existing.service_fee += Math.round(Number(p.service_fee || 0) * 100);
      existing.recipient += Math.round(Number(p.court_amount || 0) * 100);
      existing.count++;
      dailyMap.set(day, existing);
    }

    const dailyTimeSeries = Array.from(dailyMap.entries())
      .map(([date, d]) => ({
        date,
        gross_collected_cents: d.gross,
        service_fee_cents: d.service_fee,
        recipient_cents: d.recipient,
        payment_count: d.count,
      }))
      .sort((a, b) => a.date.localeCompare(b.date));

    const centsToNzd = (cents: number) => (cents / 100).toFixed(2);

    return new Response(JSON.stringify({
      summary: {
        gross_collected_total_cents: totalGrossCollectedCents,
        gross_collected_total_nzd: centsToNzd(totalGrossCollectedCents),
        recipient_total_cents: totalRecipientCents,
        recipient_total_nzd: centsToNzd(totalRecipientCents),
        service_fee_total_cents: totalServiceFeeCents,
        service_fee_total_nzd: centsToNzd(totalServiceFeeCents),
        platform_fee_total_cents: totalPlatformFeeCents,
        platform_fee_total_nzd: centsToNzd(totalPlatformFeeCents),
        stripe_fee_actual_total_cents: totalStripeFeeActualCents,
        stripe_fee_actual_total_nzd: centsToNzd(totalStripeFeeActualCents),
        stripe_fee_coverage_cents: stripeFeeCoverageCents,
        stripe_fee_coverage_nzd: centsToNzd(stripeFeeCoverageCents),
        transferred_to_courts_total_cents: transferredToCourtsCents,
        transferred_to_courts_total_nzd: centsToNzd(transferredToCourtsCents),
        pending_court_payables_total_cents: pendingCourtPayablesCents,
        pending_court_payables_total_nzd: centsToNzd(pendingCourtPayablesCents),
        credits_liability_total_cents: creditsLiabilityCents,
        credits_liability_total_nzd: centsToNzd(creditsLiabilityCents),
        net_platform_position_cents: netPlatformPositionCents,
        net_platform_position_nzd: centsToNzd(netPlatformPositionCents),
      },
      breakdown: {
        session_payments: {
          count: sessionPaymentCount,
          gross_cents: grossCollectedCents,
          recipient_cents: recipientTotalCents,
          service_fee_cents: serviceFeeTotalCents,
        },
        quick_challenge_payments: {
          count: qcPaymentCount,
          gross_cents: qcGrossCollectedCents,
          recipient_cents: qcRecipientTotalCents,
          service_fee_cents: qcServiceFeeTotalCents,
        },
      },
      top_venues: topVenues,
      daily_time_series: dailyTimeSeries,
      date_range: { start_date: startDate, end_date: endDate },
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("Admin financial summary error:", msg);
    return new Response(JSON.stringify({ error: msg }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
