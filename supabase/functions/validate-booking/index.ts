import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface WeeklyRule {
  id: string;
  venue_id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  is_closed: boolean;
}

interface DateOverride {
  id: string;
  venue_id: string;
  start_date: string;
  end_date: string | null;
  is_closed: boolean;
  custom_start_time: string | null;
  custom_end_time: string | null;
}

function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

function getAvailableWindow(
  date: string,
  weeklyRules: WeeklyRule[],
  dateOverrides: DateOverride[]
): { startTime: string; endTime: string } | null {
  const targetDate = new Date(date);
  const dayOfWeek = targetDate.getDay();

  // Check for date override first
  const override = dateOverrides.find((o) => {
    const startDate = new Date(o.start_date);
    const endDate = o.end_date ? new Date(o.end_date) : startDate;
    return targetDate >= startDate && targetDate <= endDate;
  });

  if (override) {
    if (override.is_closed) return null;
    if (override.custom_start_time && override.custom_end_time) {
      return {
        startTime: override.custom_start_time,
        endTime: override.custom_end_time,
      };
    }
  }

  const weeklyRule = weeklyRules.find((r) => r.day_of_week === dayOfWeek);
  if (!weeklyRule || weeklyRule.is_closed) return null;

  return {
    startTime: weeklyRule.start_time,
    endTime: weeklyRule.end_time,
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { venueId, courtId, date, startTime, durationMinutes } = await req.json();

    if (!venueId || !courtId || !date || !startTime || !durationMinutes) {
      return new Response(
        JSON.stringify({
          valid: false,
          error: "Missing required fields: venueId, courtId, date, startTime, durationMinutes",
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch venue configuration
    const { data: venue, error: venueError } = await supabase
      .from("venues")
      .select("id, slot_interval_minutes, max_booking_minutes")
      .eq("id", venueId)
      .single();

    if (venueError || !venue) {
      return new Response(
        JSON.stringify({ valid: false, error: "Venue not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate duration constraints
    if (durationMinutes > venue.max_booking_minutes) {
      return new Response(
        JSON.stringify({
          valid: false,
          error: `Duration exceeds maximum allowed (${venue.max_booking_minutes} minutes)`,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (durationMinutes % venue.slot_interval_minutes !== 0) {
      return new Response(
        JSON.stringify({
          valid: false,
          error: `Duration must be a multiple of ${venue.slot_interval_minutes} minutes`,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch weekly rules
    const { data: weeklyRules } = await supabase
      .from("venue_weekly_rules")
      .select("*")
      .eq("venue_id", venueId);

    // Fetch date overrides
    const { data: dateOverrides } = await supabase
      .from("venue_date_overrides")
      .select("*")
      .eq("venue_id", venueId)
      .lte("start_date", date)
      .or(`end_date.gte.${date},end_date.is.null`);

    // Get availability window
    const window = getAvailableWindow(date, weeklyRules || [], dateOverrides || []);

    if (!window) {
      return new Response(
        JSON.stringify({ valid: false, error: "Venue is closed on this date" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate booking fits within window
    const bookingStartMinutes = timeToMinutes(startTime);
    const bookingEndMinutes = bookingStartMinutes + durationMinutes;
    const windowStartMinutes = timeToMinutes(window.startTime);
    const windowEndMinutes = timeToMinutes(window.endTime);

    if (bookingStartMinutes < windowStartMinutes) {
      return new Response(
        JSON.stringify({
          valid: false,
          error: `Booking starts before venue opens (${window.startTime})`,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (bookingEndMinutes > windowEndMinutes) {
      return new Response(
        JSON.stringify({
          valid: false,
          error: `Booking ends after venue closes (${window.endTime})`,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check for overlapping bookings
    const { data: existingBookings, error: bookingsError } = await supabase
      .from("court_availability")
      .select("id, start_time, end_time")
      .eq("court_id", courtId)
      .eq("available_date", date)
      .eq("is_booked", true);

    if (bookingsError) throw bookingsError;

    const hasOverlap = (existingBookings || []).some((booking) => {
      const existingStart = timeToMinutes(booking.start_time);
      const existingEnd = timeToMinutes(booking.end_time);
      return bookingStartMinutes < existingEnd && bookingEndMinutes > existingStart;
    });

    if (hasOverlap) {
      return new Response(
        JSON.stringify({
          valid: false,
          error: "This time slot overlaps with an existing booking",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // All validations passed
    return new Response(
      JSON.stringify({
        valid: true,
        booking: {
          court_id: courtId,
          date,
          start_time: startTime,
          end_time: `${Math.floor(bookingEndMinutes / 60)
            .toString()
            .padStart(2, "0")}:${(bookingEndMinutes % 60).toString().padStart(2, "0")}`,
          duration_minutes: durationMinutes,
        },
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Error in validate-booking:", error);
    return new Response(
      JSON.stringify({ valid: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
