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
    } = await req.json();

    if (!sportCategoryId || !gameMode || !venueId || !courtId || !scheduledDate || !scheduledTime || !durationMinutes || !totalPlayers || !paymentType) {
      throw new Error("Missing required fields");
    }

    const [courtResult, platformResult] = await Promise.all([
      supabaseAdmin
        .from("courts")
        .select("id, hourly_rate, payment_timing")
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

    // Check for ANY overlapping rows (booked or not) to avoid unique constraint violations
    const { data: overlaps, error: overlapError } = await supabaseAdmin
      .from("court_availability")
      .select("id, start_time, end_time, is_booked")
      .eq("court_id", courtId)
      .eq("available_date", scheduledDate);
    if (overlapError) throw overlapError;

    const hasOverlap = (overlaps || []).some((booking) => {
      const existingStart = timeToMinutes(booking.start_time);
      const existingEnd = timeToMinutes(booking.end_time);
      return bookingStartMin < existingEnd && bookingStartMin + durationMinutes > existingStart;
    });
    if (hasOverlap) throw new Error("SLOT_UNAVAILABLE");

    const selectedEquipment = equipment as EquipmentSelection[];
    const hours = durationMinutes / 60;
    const courtAmount = Number(courtResult.data.hourly_rate) * hours;
    const equipmentTotal = selectedEquipment.reduce((sum, item) => sum + item.quantity * item.pricePerUnit, 0);
    const courtAmountWithEquipment = courtAmount + equipmentTotal;
    const serviceFee = Number(platformResult.data?.player_fee ?? 0);

    const splitPricePerPlayer = Math.ceil((courtAmountWithEquipment / totalPlayers) * 100) / 100;
    const effectivePaymentType = courtResult.data.payment_timing === "at_booking" ? "single" : paymentType;
    const pricePerPlayer = effectivePaymentType === "split"
      ? splitPricePerPlayer + serviceFee
      : courtAmountWithEquipment;
    const initialStatus = courtResult.data.payment_timing === "at_booking" ? "pending_payment" : "open";

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
        is_booked: courtResult.data.payment_timing !== "at_booking",
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
