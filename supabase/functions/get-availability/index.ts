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

interface Court {
  id: string;
  name: string;
  hourly_rate: number;
  is_active: boolean;
  is_multi_court: boolean;
  parent_court_id: string | null;
  ground_type: string | null;
  rules: string | null;
  photo_urls: string[] | null;
  photo_url: string | null;
}

interface Venue {
  id: string;
  slot_interval_minutes: number;
  max_booking_minutes: number;
}

interface AvailableCourt {
  id: string;
  name: string;
  hourly_rate: number;
  ground_type: string | null;
  rules: string | null;
  photo_urls: string[] | null;
}

interface AvailableSlot {
  start_time: string;
  available_durations: number[]; // in minutes
  available_courts: AvailableCourt[]; // courts available at this slot
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

function getAvailableBlocksForCourt(
  allBlocks: string[],
  bookings: Booking[],
  courtId: string,
  date: string,
  intervalMinutes: number
): string[] {
  const courtBookings = bookings.filter(
    (b) => b.court_id === courtId && b.available_date === date
  );

  return allBlocks.filter((blockTime) => {
    const blockStart = timeToMinutes(blockTime);
    const blockEnd = blockStart + intervalMinutes;

    // Check if this block overlaps with any booking
    return !courtBookings.some((booking) => {
      const bookingStart = timeToMinutes(booking.start_time);
      const bookingEnd = timeToMinutes(booking.end_time);
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

  for (
    let duration = intervalMinutes;
    duration <= maxBookingMinutes;
    duration += intervalMinutes
  ) {
    const requiredEndMinutes = startMinutes + duration;
    if (requiredEndMinutes > endMinutes) break;

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

    // Fetch ALL active courts for this venue with full details
    const { data: venueCourts, error: courtsError } = await supabase
      .from("courts")
      .select("id, name, hourly_rate, is_active, is_multi_court, parent_court_id, ground_type, rules, photo_urls, photo_url")
      .eq("venue_id", venueId)
      .eq("is_active", true)
      .order("name", { ascending: true });

    if (courtsError) throw courtsError;

    const allCourts: Court[] = venueCourts || [];
    
    // Determine which courts to show in the dropdown and process
    let courtsToProcess: Court[] = [];
    let courtsForDropdown: Court[] = [];
    
    if (courtId) {
      // Find the requested court
      const requestedCourt = allCourts.find(c => c.id === courtId);
      
      if (requestedCourt) {
        if (requestedCourt.is_multi_court) {
          // This is a parent court - show the parent plus all children linked to it
          courtsForDropdown = [requestedCourt, ...allCourts.filter(c => c.parent_court_id === courtId)];
        } else if (requestedCourt.parent_court_id) {
          // This is a child court - show the parent plus all siblings
          const parentCourt = allCourts.find(c => c.id === requestedCourt.parent_court_id);
          if (parentCourt) {
            courtsForDropdown = [parentCourt, ...allCourts.filter(c => c.parent_court_id === parentCourt.id)];
          } else {
            courtsForDropdown = [requestedCourt];
          }
        } else {
          // Standalone court - just show this one
          courtsForDropdown = [requestedCourt];
        }
        
        // Process all courts in the dropdown for availability
        courtsToProcess = courtsForDropdown;
      }
    } else {
      // No specific court requested - show all courts
      courtsForDropdown = allCourts;
      courtsToProcess = allCourts;
    }

    if (courtsToProcess.length === 0) {
      return new Response(
        JSON.stringify({
          available: false,
          reason: "no_courts",
          slots: [],
          venue_courts: courtsForDropdown.map(c => ({ 
            id: c.id, 
            name: c.name, 
            hourly_rate: c.hourly_rate,
            ground_type: c.ground_type,
            rules: c.rules,
            photo_urls: c.photo_urls || (c.photo_url ? [c.photo_url] : []),
          })),
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
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
          venue_courts: courtsForDropdown.map(c => ({ 
            id: c.id, 
            name: c.name, 
            hourly_rate: c.hourly_rate,
            ground_type: c.ground_type,
            rules: c.rules,
            photo_urls: c.photo_urls || (c.photo_url ? [c.photo_url] : []),
          })),
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

    // Fetch existing bookings for this date for ALL courts at venue
    const { data: bookings, error: bookingsError } = await supabase
      .from("court_availability")
      .select("id, court_id, available_date, start_time, end_time")
      .eq("available_date", date)
      .eq("is_booked", true)
      .in("court_id", courtsToProcess.map(c => c.id));

    if (bookingsError) throw bookingsError;

    // Calculate available blocks per court
    const courtAvailability: Map<string, string[]> = new Map();
    for (const court of courtsToProcess) {
      const availableBlocks = getAvailableBlocksForCourt(
        allBlocks,
        bookings || [],
        court.id,
        date,
        venue.slot_interval_minutes
      );
      courtAvailability.set(court.id, availableBlocks);
    }

    // Build slots with multi-court availability
    const slotMap: Map<string, AvailableSlot> = new Map();

    for (const blockTime of allBlocks) {
      const availableCourts: AvailableCourt[] = [];

      for (const court of courtsToProcess) {
        const courtBlocks = courtAvailability.get(court.id) || [];
        if (courtBlocks.includes(blockTime)) {
          const durations = calculateAvailableDurations(
            blockTime,
            courtBlocks,
            window.endTime,
            venue.slot_interval_minutes,
            venue.max_booking_minutes
          );

          if (durations.length > 0) {
            availableCourts.push({
              id: court.id,
              name: court.name,
              hourly_rate: court.hourly_rate,
              ground_type: court.ground_type,
              rules: court.rules,
              photo_urls: court.photo_urls || (court.photo_url ? [court.photo_url] : []),
            });
          }
        }
      }

      if (availableCourts.length > 0) {
        // For the slot's available_durations, use the max durations from any court
        // (since different courts might have different availability)
        const maxDurations: number[] = [];
        for (const court of availableCourts) {
          const courtBlocks = courtAvailability.get(court.id) || [];
          const durations = calculateAvailableDurations(
            blockTime,
            courtBlocks,
            window.endTime,
            venue.slot_interval_minutes,
            venue.max_booking_minutes
          );
          durations.forEach(d => {
            if (!maxDurations.includes(d)) maxDurations.push(d);
          });
        }
        maxDurations.sort((a, b) => a - b);

        slotMap.set(blockTime, {
          start_time: blockTime,
          available_durations: maxDurations,
          available_courts: availableCourts,
        });
      }
    }

    const slots = Array.from(slotMap.values());

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
        venue_courts: courtsForDropdown.map(c => ({ 
          id: c.id, 
          name: c.name, 
          hourly_rate: c.hourly_rate,
          ground_type: c.ground_type,
          rules: c.rules,
          photo_urls: c.photo_urls || (c.photo_url ? [c.photo_url] : []),
        })),
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
