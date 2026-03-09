import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface WeeklyRule {
  day_of_week: number;
  start_time: string;
  end_time: string;
  is_closed: boolean;
}

interface DateOverride {
  start_date: string;
  end_date: string | null;
  is_closed: boolean;
  custom_start_time: string | null;
  custom_end_time: string | null;
}

interface EquipmentSelection {
  equipmentId: string;
  quantity: number;
  pricePerUnit: number;
}

function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

function minutesToTime(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours.toString().padStart(2, "0")}:${mins.toString().padStart(2, "0")}`;
}

function getAvailableWindow(date: string, weeklyRules: WeeklyRule[], dateOverrides: DateOverride[]) {
  const targetDate = new Date(date);
  const dayOfWeek = targetDate.getDay();

  const override = dateOverrides.find((o) => {
    const startDate = new Date(o.start_date);
    const endDate = o.end_date ? new Date(o.end_date) : startDate;
    return targetDate >= startDate && targetDate <= endDate;
  });

  if (override) {
    if (override.is_closed) return null;
    if (override.custom_start_time && override.custom_end_time) {
      return { startTime: override.custom_start_time, endTime: override.custom_end_time };
    }
  }

  const weeklyRule = weeklyRules.find((r) => r.day_of_week === dayOfWeek);
  if (!weeklyRule || weeklyRule.is_closed) return null;

  return { startTime: weeklyRule.start_time, endTime: weeklyRule.end_time };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Authorization required");

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } }
    );

    const {
      data: { user },
      error: userError,
    } = await supabaseClient.auth.getUser();
    if (userError || !user) throw new Error("User not authenticated");

    const {
      groupId,
      courtId,
      sessionDate,
      startTime,
      durationMinutes,
      paymentType,
      splitPlayers,
      sportCategoryId,
      equipment = [],
      holdId,
    } = await req.json();

    if (!groupId || !courtId || !sessionDate || !startTime || !durationMinutes || !paymentType || !sportCategoryId) {
      throw new Error("Missing required fields");
    }

    const { data: court, error: courtError } = await supabaseAdmin
      .from("courts")
      .select("id, venue_id, hourly_rate, capacity, payment_hours_before, payment_timing")
      .eq("id", courtId)
      .single();
    if (courtError || !court) throw new Error("Court not found");

    const [weeklyRulesResult, dateOverridesResult, platformResult] = await Promise.all([
      supabaseAdmin
        .from("venue_weekly_rules")
        .select("day_of_week, start_time, end_time, is_closed")
        .eq("venue_id", court.venue_id),
      supabaseAdmin
        .from("venue_date_overrides")
        .select("start_date, end_date, is_closed, custom_start_time, custom_end_time")
        .eq("venue_id", court.venue_id)
        .lte("start_date", sessionDate)
        .or(`end_date.gte.${sessionDate},end_date.is.null`),
      supabaseAdmin
        .from("platform_settings")
        .select("player_fee")
        .eq("is_active", true)
        .limit(1)
        .maybeSingle(),
    ]);

    const availableWindow = getAvailableWindow(
      sessionDate,
      (weeklyRulesResult.data as WeeklyRule[]) || [],
      (dateOverridesResult.data as DateOverride[]) || []
    );
    if (!availableWindow) throw new Error("Venue is closed on this date");

    const bookingStartMin = timeToMinutes(startTime);
    const bookingEndMin = bookingStartMin + durationMinutes;
    const windowStartMin = timeToMinutes(availableWindow.startTime);
    const windowEndMin = timeToMinutes(availableWindow.endTime);

    if (bookingStartMin < windowStartMin || bookingEndMin > windowEndMin) {
      throw new Error("Booking must be within venue operating hours");
    }

    const endTime = minutesToTime(bookingEndMin);

    const { data: overlaps, error: overlapError } = await supabaseAdmin
      .from("court_availability")
      .select("id, start_time, end_time")
      .eq("court_id", courtId)
      .eq("available_date", sessionDate)
      .eq("is_booked", true);

    if (overlapError) throw overlapError;

    const hasOverlap = (overlaps || []).some((booking) => {
      const existingStart = timeToMinutes(booking.start_time);
      const existingEnd = timeToMinutes(booking.end_time);
      return bookingStartMin < existingEnd && bookingEndMin > existingStart;
    });
    if (hasOverlap) throw new Error("This time slot is no longer available");

    const hours = durationMinutes / 60;
    const courtAmount = Number(court.hourly_rate) * hours;
    const selectedEquipment = equipment as EquipmentSelection[];
    const equipmentTotal = selectedEquipment.reduce((sum, item) => sum + item.quantity * item.pricePerUnit, 0);
    const courtAmountWithEquipment = courtAmount + equipmentTotal;
    const serviceFee = Number(platformResult.data?.player_fee ?? 0);
    const totalAmount = courtAmountWithEquipment + serviceFee;

    // Determine effective payment timing: if court is 'before_session' but the session
    // falls within the payment_hours_before window, force 'at_booking' to prevent
    // creating unpaid sessions that would be immediately eligible for auto-cancellation.
    let effectivePaymentTiming = court.payment_timing ?? "at_booking";
    if (effectivePaymentTiming === "before_session") {
      const sessionStart = new Date(`${sessionDate}T${startTime}`);
      const hoursBeforeSession = court.payment_hours_before ?? 24;
      const deadline = new Date(sessionStart.getTime() - hoursBeforeSession * 60 * 60 * 1000);
      if (new Date() >= deadline) {
        effectivePaymentTiming = "at_booking";
      }
    }

    // For at_booking courts: defer session creation to webhook (no DB records until payment confirmed)
    if (effectivePaymentTiming === "at_booking") {
      const splitPricePerPlayer = paymentType === "split" && splitPlayers
        ? Math.ceil((courtAmountWithEquipment / splitPlayers) * 100) / 100
        : courtAmountWithEquipment;

      return new Response(
        JSON.stringify({
          deferred: true,
          court_amount: courtAmountWithEquipment,
          service_fee_total: serviceFee,
          total_charge: totalAmount,
          price_per_player: splitPricePerPlayer + serviceFee,
          booking_details: {
            groupId,
            courtId,
            sessionDate,
            startTime,
            endTime,
            durationMinutes,
            paymentType,
            splitPlayers: paymentType === "split" && splitPlayers ? splitPlayers : null,
            sportCategoryId,
            equipment: selectedEquipment,
            courtCapacity: court.capacity,
            courtPrice: courtAmountWithEquipment,
            holdId: holdId || null,
          },
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );
    }

    // --- Non-at_booking (before_session) flow: create records immediately ---
    const sessionStart = new Date(`${sessionDate}T${startTime}`);
    const paymentDeadline = new Date(
      sessionStart.getTime() - (court.payment_hours_before ?? 24) * 60 * 60 * 1000
    ).toISOString();

    const { data: session, error: sessionError } = await supabaseAdmin
      .from("sessions")
      .insert({
        group_id: groupId,
        court_id: courtId,
        session_date: sessionDate,
        start_time: startTime,
        duration_minutes: durationMinutes,
        court_price: courtAmountWithEquipment,
        min_players: paymentType === "split" && splitPlayers ? splitPlayers : 6,
        max_players: court.capacity,
        payment_deadline: paymentDeadline,
        state: "protected",
        payment_type: paymentType,
        sport_category_id: sportCategoryId,
      })
      .select("id")
      .single();
    if (sessionError || !session) throw sessionError ?? new Error("Failed to create session");

    const { error: sessionPlayerError } = await supabaseAdmin.from("session_players").insert({
      session_id: session.id,
      user_id: user.id,
      is_confirmed: true,
      confirmed_at: new Date().toISOString(),
    });
    if (sessionPlayerError) throw sessionPlayerError;

    const { data: bookingRecord, error: bookingError } = await supabaseAdmin
      .from("court_availability")
      .insert({
        court_id: courtId,
        available_date: sessionDate,
        start_time: startTime,
        end_time: endTime,
        is_booked: true,
        booked_by_user_id: user.id,
        booked_by_group_id: groupId,
        booked_by_session_id: session.id,
        payment_status: "pending",
      })
      .select("id")
      .single();
    if (bookingError || !bookingRecord) throw bookingError ?? new Error("Failed to create booking record");

    if (selectedEquipment.length > 0) {
      const { error: equipmentError } = await supabaseAdmin.from("booking_equipment").insert(
        selectedEquipment.map((item) => ({
          booking_id: bookingRecord.id,
          equipment_id: item.equipmentId,
          quantity: item.quantity,
          price_at_booking: item.pricePerUnit,
        }))
      );
      if (equipmentError) throw equipmentError;
    }

    const splitPricePerPlayer = paymentType === "split" && splitPlayers
      ? Math.ceil((courtAmountWithEquipment / splitPlayers) * 100) / 100
      : courtAmountWithEquipment;
    const fundingRequired = courtAmountWithEquipment;
    const fundingCurrent = 0;

    // Notify group members about new session
    try {
      const { data: groupData } = await supabaseAdmin
        .from("groups")
        .select("name")
        .eq("id", groupId)
        .single();

      const { data: members } = await supabaseAdmin
        .from("group_members")
        .select("user_id")
        .eq("group_id", groupId);

      const otherMembers = (members || []).filter((m) => m.user_id !== user.id);

      if (otherMembers.length > 0) {
        // Insert in-app notifications for all group members
        const notifications = otherMembers.map((m) => ({
          user_id: m.user_id,
          type: "game_reminder" as const,
          title: "New Session Booked",
          message: `A new session has been booked for ${groupData?.name || "your group"} on ${sessionDate} at ${startTime.slice(0, 5)}.`,
          data: { session_id: session.id, group_id: groupId },
        }));

        await supabaseAdmin.from("notifications").insert(notifications);

        // Send push notifications (fire-and-forget)
        const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
        const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
        for (const member of otherMembers) {
          fetch(`${supabaseUrl}/functions/v1/send-push-notification`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${serviceRoleKey}`,
            },
            body: JSON.stringify({
              user_id: member.user_id,
              title: "New Session Booked",
              body: `A new session for ${groupData?.name || "your group"} on ${sessionDate} at ${startTime.slice(0, 5)}.`,
              type: "game_reminder",
              url: `/games`,
            }),
          }).catch(() => {}); // fire-and-forget
        }
      }
    } catch (notifErr) {
      console.warn("Non-critical: failed to send session notifications:", notifErr);
    }

    return new Response(
      JSON.stringify({
        session_id: session.id,
        booking_id: bookingRecord.id,
        court_amount: courtAmountWithEquipment,
        service_fee_total: serviceFee,
        total_charge: totalAmount,
        funding_required: fundingRequired,
        funding_current: fundingCurrent,
        price_per_player: splitPricePerPlayer + serviceFee,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
  } catch (error: unknown) {
    console.error("Error in create-booking:", error);
    const message = error instanceof Error ? error.message : "Failed to create booking";
    return new Response(JSON.stringify({ error: message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
});
