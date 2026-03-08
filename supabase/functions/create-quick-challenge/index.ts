import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

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
      sportCategoryId,
      gameMode,
      venueId,
      courtId,
      scheduledDate,
      scheduledTime,
      durationMinutes,
      totalPlayers,
      paymentType,
      equipment = [],
      genderPreference = "mixed",
    } = await req.json();

    if (!sportCategoryId || !gameMode || !venueId || !courtId || !scheduledDate || !scheduledTime || !durationMinutes || !totalPlayers || !paymentType) {
      throw new Error("Missing required fields");
    }

    const [courtResult, platformResult] = await Promise.all([
      supabaseAdmin
        .from("courts")
        .select("id, hourly_rate, payment_timing, payment_hours_before")
        .eq("id", courtId)
        .single(),
      supabaseAdmin
        .from("platform_settings")
        .select("player_fee")
        .eq("is_active", true)
        .limit(1)
        .maybeSingle(),
    ]);

    if (courtResult.error || !courtResult.data) throw new Error("Court not found");

    const bookingStartMin = timeToMinutes(scheduledTime);
    const endTime = minutesToTime(bookingStartMin + durationMinutes);

    // Check for overlapping BOOKED rows to prevent double-booking.
    // Rows with is_booked=false from the SAME user (orphaned pending_payment) are excluded —
    // they will be replaced by the new booking attempt.
    const { data: overlaps, error: overlapError } = await supabaseAdmin
      .from("court_availability")
      .select("id, start_time, end_time, is_booked, booked_by_user_id")
      .eq("court_id", courtId)
      .eq("available_date", scheduledDate);
    if (overlapError) throw overlapError;

    const hasOverlap = (overlaps || []).some((row) => {
      const existingStart = timeToMinutes(row.start_time);
      const existingEnd = timeToMinutes(row.end_time);
      const timesOverlap = bookingStartMin < existingEnd && bookingStartMin + durationMinutes > existingStart;
      if (!timesOverlap) return false;
      // If the slot is booked, it's a real conflict
      if (row.is_booked) return true;
      // If unbooked but belongs to a DIFFERENT user, it's their pending checkout — conflict
      if (row.booked_by_user_id && row.booked_by_user_id !== user.id) return true;
      // Unbooked row from same user = orphaned pending_payment, not a conflict
      return false;
    });

    // Clean up same-user orphaned rows for this slot before inserting
    if (!hasOverlap) {
      const orphanedIds = (overlaps || [])
        .filter((row) => {
          const existingStart = timeToMinutes(row.start_time);
          const existingEnd = timeToMinutes(row.end_time);
          const timesOverlap = bookingStartMin < existingEnd && bookingStartMin + durationMinutes > existingStart;
          return timesOverlap && !row.is_booked && row.booked_by_user_id === user.id;
        })
        .map((row) => row.id);

      if (orphanedIds.length > 0) {
        await supabaseAdmin
          .from("court_availability")
          .delete()
          .in("id", orphanedIds);
      }
    }

    if (hasOverlap) throw new Error("SLOT_UNAVAILABLE");

    const selectedEquipment = equipment as EquipmentSelection[];
    const hours = durationMinutes / 60;
    const courtAmount = Number(courtResult.data.hourly_rate) * hours;
    const equipmentTotal = selectedEquipment.reduce((sum, item) => sum + item.quantity * item.pricePerUnit, 0);
    const courtAmountWithEquipment = courtAmount + equipmentTotal;
    const serviceFee = Number(platformResult.data?.player_fee ?? 0);

    // Quick Challenges ALWAYS require upfront payment — ignore court's before_session setting.
    // The webhook will mark the slot as booked once payment is confirmed.
    const splitPricePerPlayer = Math.ceil((courtAmountWithEquipment / totalPlayers) * 100) / 100;
    const effectivePaymentType = "single"; // organizer always pays upfront for quick challenges
    // For "single" (organizer pays full), price_per_player = full court amount (what the organizer is charged).
    // The per-player share is still tracked for display/redistribution if format changes later.
    const pricePerPlayer = courtAmountWithEquipment;
    const initialStatus = courtAmountWithEquipment > 0 ? "pending_payment" : "open";

    const { data: challenge, error: challengeError } = await supabaseAdmin
      .from("quick_challenges")
      .insert({
        sport_category_id: sportCategoryId,
        game_mode: gameMode,
        venue_id: venueId,
        court_id: courtId,
        scheduled_date: scheduledDate,
        scheduled_time: scheduledTime,
        total_slots: totalPlayers,
        price_per_player: pricePerPlayer,
        status: initialStatus,
        payment_type: effectivePaymentType,
        created_by: user.id,
        gender_preference: genderPreference,
      })
      .select("id")
      .single();
    if (challengeError || !challenge) throw challengeError ?? new Error("Failed to create challenge");

    const { data: bookingRecord, error: bookingError } = await supabaseAdmin
      .from("court_availability")
      .insert({
        court_id: courtId,
        available_date: scheduledDate,
        start_time: scheduledTime,
        end_time: endTime,
        is_booked: false,
        booked_by_user_id: user.id,
        payment_status: "pending",
      })
      .select("id")
      .single();
    if (bookingError || !bookingRecord) throw bookingError ?? new Error("Failed to reserve slot");

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

    const { error: playerError } = await supabaseAdmin.from("quick_challenge_players").insert({
      challenge_id: challenge.id,
      user_id: user.id,
      team: "left",
      slot_position: 0,
      payment_status: "pending",
    });
    if (playerError) throw playerError;

    const totalAmount = courtAmountWithEquipment + serviceFee;

    return new Response(
      JSON.stringify({
        challenge_id: challenge.id,
        booking_id: bookingRecord.id,
        court_amount: courtAmountWithEquipment,
        service_fee_total: serviceFee,
        total_charge: totalAmount,
        funding_required: courtAmountWithEquipment,
        funding_current: 0,
        price_per_player: pricePerPlayer,
        effective_payment_timing: "at_booking",
        requires_payment_at_booking: true,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
  } catch (error: unknown) {
    console.error("Error in create-quick-challenge:", error);
    const message = error instanceof Error ? error.message : "Failed to create quick challenge";
    return new Response(JSON.stringify({ error: message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
});
