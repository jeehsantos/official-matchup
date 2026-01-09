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
  note: string | null;
}

interface Booking {
  id: string;
  court_id: string;
  available_date: string;
  start_time: string;
  end_time: string;
}

interface Venue {
  id: string;
  slot_interval_minutes: number;
  max_booking_minutes: number;
}

interface AvailableSlot {
  start_time: string;
  available_durations: number[]; // in minutes
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

function generateTimeBlocks(
  startTime: string,
  endTime: string,
  intervalMinutes: number
): string[] {
  const blocks: string[] = [];
  const startMinutes = timeToMinutes(startTime);
  const endMinutes = timeToMinutes(endTime);

  for (let m = startMinutes; m < endMinutes; m += intervalMinutes) {
    blocks.push(minutesToTime(m));
  }

  return blocks;
}

function getAvailableWindow(
  date: string,
  weeklyRules: WeeklyRule[],
  dateOverrides: DateOverride[]
): { startTime: string; endTime: string } | null {
  const targetDate = new Date(date);
  const dayOfWeek = targetDate.getDay();

  // Check for date override first (priority)
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
    // Override exists but no custom times, fall through to weekly rule
  }

  // Use weekly rule
  const weeklyRule = weeklyRules.find((r) => r.day_of_week === dayOfWeek);
  if (!weeklyRule || weeklyRule.is_closed) return null;

  return {
    startTime: weeklyRule.start_time,
    endTime: weeklyRule.end_time,
  };
}

function removeBookedBlocks(
  blocks: string[],
  bookings: Booking[],
  date: string,
  intervalMinutes: number
): string[] {
  const dateBookings = bookings.filter((b) => b.available_date === date);

  return blocks.filter((blockTime) => {
    const blockStart = timeToMinutes(blockTime);
    const blockEnd = blockStart + intervalMinutes;

    // Check if this block overlaps with any booking
    return !dateBookings.some((booking) => {
      const bookingStart = timeToMinutes(booking.start_time);
      const bookingEnd = timeToMinutes(booking.end_time);
      // Overlap: block starts before booking ends AND block ends after booking starts
      return blockStart < bookingEnd && blockEnd > bookingStart;
    });
  });
}

function calculateAvailableDurations(
  startTime: string,
  availableBlocks: string[],
  windowEnd: string,
  intervalMinutes: number,
  maxBookingMinutes: number
): number[] {
  const durations: number[] = [];
  const startMinutes = timeToMinutes(startTime);
  const endMinutes = timeToMinutes(windowEnd);

  // Check each possible duration
  for (
    let duration = intervalMinutes;
    duration <= maxBookingMinutes;
    duration += intervalMinutes
  ) {
    const requiredEndMinutes = startMinutes + duration;

    // Can't exceed window end
    if (requiredEndMinutes > endMinutes) break;

    // Check if all required blocks are available
    let allBlocksAvailable = true;
    for (let m = startMinutes; m < requiredEndMinutes; m += intervalMinutes) {
      const blockTime = minutesToTime(m);
      if (!availableBlocks.includes(blockTime)) {
        allBlocksAvailable = false;
        break;
      }
    }

    if (allBlocksAvailable) {
      durations.push(duration);
    } else {
      // If a shorter duration isn't available, longer ones won't be either
      break;
    }
  }

  return durations;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { venueId, courtId, date } = await req.json();

    if (!venueId || !date) {
      return new Response(
        JSON.stringify({ error: "venueId and date are required" }),
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
        JSON.stringify({ error: "Venue not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch weekly rules for venue
    const { data: weeklyRules, error: rulesError } = await supabase
      .from("venue_weekly_rules")
      .select("*")
      .eq("venue_id", venueId);

    if (rulesError) throw rulesError;

    // Fetch date overrides that might apply
    const { data: dateOverrides, error: overridesError } = await supabase
      .from("venue_date_overrides")
      .select("*")
      .eq("venue_id", venueId)
      .lte("start_date", date)
      .or(`end_date.gte.${date},end_date.is.null`);

    if (overridesError) throw overridesError;

    // Get the availability window for the requested date
    const window = getAvailableWindow(
      date,
      weeklyRules || [],
      dateOverrides || []
    );

    if (!window) {
      return new Response(
        JSON.stringify({
          available: false,
          reason: "closed",
          slots: [],
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Generate all time blocks
    const allBlocks = generateTimeBlocks(
      window.startTime,
      window.endTime,
      venue.slot_interval_minutes
    );

    // Fetch existing bookings for this date
    let bookingsQuery = supabase
      .from("court_availability")
      .select("id, court_id, available_date, start_time, end_time")
      .eq("available_date", date)
      .eq("is_booked", true);

    if (courtId) {
      bookingsQuery = bookingsQuery.eq("court_id", courtId);
    } else {
      // Get all courts for this venue
      const { data: courts } = await supabase
        .from("courts")
        .select("id")
        .eq("venue_id", venueId)
        .eq("is_active", true);

      if (courts && courts.length > 0) {
        bookingsQuery = bookingsQuery.in(
          "court_id",
          courts.map((c) => c.id)
        );
      }
    }

    const { data: bookings, error: bookingsError } = await bookingsQuery;
    if (bookingsError) throw bookingsError;

    // Remove booked blocks
    const availableBlocks = removeBookedBlocks(
      allBlocks,
      bookings || [],
      date,
      venue.slot_interval_minutes
    );

    // Build available slots with durations
    const slots: AvailableSlot[] = availableBlocks.map((blockTime) => ({
      start_time: blockTime,
      available_durations: calculateAvailableDurations(
        blockTime,
        availableBlocks,
        window.endTime,
        venue.slot_interval_minutes,
        venue.max_booking_minutes
      ),
    })).filter((slot) => slot.available_durations.length > 0);

    return new Response(
      JSON.stringify({
        available: true,
        window: {
          start_time: window.startTime,
          end_time: window.endTime,
        },
        slot_interval_minutes: venue.slot_interval_minutes,
        max_booking_minutes: venue.max_booking_minutes,
        slots,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Error in get-availability:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
