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

interface BookingHold {
  id: string;
  court_id: string;
  user_id: string;
  start_datetime: string;
  end_datetime: string;
  status: string;
  expires_at: string;
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
  allowed_sports: string[] | null;
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
  allowed_sports: string[] | null;
}

// Slot status: AVAILABLE | HELD | CONFIRMED
type SlotStatus = "AVAILABLE" | "HELD" | "CONFIRMED";

interface AvailableSlot {
  start_time: string;
  status: SlotStatus;
  held_by_current_user?: boolean;
  hold_expires_at?: string;
  available_durations: number[];
  available_courts: AvailableCourt[];
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

// Check if a time block overlaps with bookings
function isBlockBooked(
  blockTime: string,
  intervalMinutes: number,
  bookings: Booking[],
  courtId: string,
  date: string
): boolean {
  const blockStart = timeToMinutes(blockTime);
  const blockEnd = blockStart + intervalMinutes;

  return bookings.some((booking) => {
    if (booking.court_id !== courtId || booking.available_date !== date) return false;
    const bookingStart = timeToMinutes(booking.start_time);
    const bookingEnd = timeToMinutes(booking.end_time);
    return blockStart < bookingEnd && blockEnd > bookingStart;
  });
}

// Check if a time block overlaps with active holds
function getBlockHoldStatus(
  blockTime: string,
  intervalMinutes: number,
  holds: BookingHold[],
  courtId: string,
  date: string,
  currentUserId: string | null
): { status: SlotStatus; heldByCurrentUser: boolean; expiresAt?: string } {
  const blockStart = timeToMinutes(blockTime);
  const blockEnd = blockStart + intervalMinutes;

  for (const hold of holds) {
    if (hold.court_id !== courtId || hold.status !== "HELD") continue;
    
    const holdDate = new Date(hold.start_datetime).toISOString().split("T")[0];
    if (holdDate !== date) continue;

    const holdStartTime = new Date(hold.start_datetime).toTimeString().slice(0, 5);
    const holdEndTime = new Date(hold.end_datetime).toTimeString().slice(0, 5);
    const holdStart = timeToMinutes(holdStartTime);
    const holdEnd = timeToMinutes(holdEndTime);

    if (blockStart < holdEnd && blockEnd > holdStart) {
      const heldByCurrentUser = currentUserId === hold.user_id;
      return {
        status: "HELD",
        heldByCurrentUser,
        expiresAt: hold.expires_at,
      };
    }
  }

  return { status: "AVAILABLE", heldByCurrentUser: false };
}

function getAvailableBlocksForCourt(
  allBlocks: string[],
  bookings: Booking[],
  courtId: string,
  date: string,
  intervalMinutes: number
): string[] {
  return allBlocks.filter((blockTime) => {
    return !isBlockBooked(blockTime, intervalMinutes, bookings, courtId, date);
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

    // Try to get current user from auth header
    let currentUserId: string | null = null;
    const authHeader = req.headers.get("Authorization");
    if (authHeader) {
      const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || "";
      const userClient = createClient(supabaseUrl, anonKey, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data: { user } } = await userClient.auth.getUser();
      currentUserId = user?.id || null;
    }

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
      .select("id, name, hourly_rate, is_active, is_multi_court, parent_court_id, ground_type, rules, photo_urls, photo_url, allowed_sports")
      .eq("venue_id", venueId)
      .eq("is_active", true)
      .order("name", { ascending: true });

    if (courtsError) throw courtsError;

    const allCourts: Court[] = venueCourts || [];
    
    let courtsToProcess: Court[] = [];
    let courtsForDropdown: Court[] = [];
    
    if (courtId) {
      const requestedCourt = allCourts.find(c => c.id === courtId);
      
      if (requestedCourt) {
        if (requestedCourt.is_multi_court) {
          courtsForDropdown = [requestedCourt, ...allCourts.filter(c => c.parent_court_id === courtId)];
        } else if (requestedCourt.parent_court_id) {
          const parentCourt = allCourts.find(c => c.id === requestedCourt.parent_court_id);
          if (parentCourt) {
            courtsForDropdown = [parentCourt, ...allCourts.filter(c => c.parent_court_id === parentCourt.id)];
          } else {
            courtsForDropdown = [requestedCourt];
          }
        } else {
          courtsForDropdown = [requestedCourt];
        }
        
        courtsToProcess = courtsForDropdown;
      }
    } else {
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
            allowed_sports: c.allowed_sports || [],
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

    // Fetch date overrides
    const { data: dateOverrides, error: overridesError } = await supabase
      .from("venue_date_overrides")
      .select("*")
      .eq("venue_id", venueId)
      .lte("start_date", date)
      .or(`end_date.gte.${date},end_date.is.null`);

    if (overridesError) throw overridesError;

    // Get the availability window
    const window = getAvailableWindow(date, weeklyRules || [], dateOverrides || []);

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
            allowed_sports: c.allowed_sports || [],
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

    // Fetch existing bookings for this date
    const { data: bookings, error: bookingsError } = await supabase
      .from("court_availability")
      .select("id, court_id, available_date, start_time, end_time")
      .eq("available_date", date)
      .eq("is_booked", true)
      .in("court_id", courtsToProcess.map(c => c.id));

    if (bookingsError) throw bookingsError;

    // Fetch active holds for this date
    const startOfDay = `${date}T00:00:00Z`;
    const endOfDay = `${date}T23:59:59Z`;
    
    const { data: holds, error: holdsError } = await supabase
      .from("booking_holds")
      .select("id, court_id, user_id, start_datetime, end_datetime, status, expires_at")
      .eq("status", "HELD")
      .gt("expires_at", new Date().toISOString())
      .gte("start_datetime", startOfDay)
      .lte("start_datetime", endOfDay)
      .in("court_id", courtsToProcess.map(c => c.id));

    if (holdsError) throw holdsError;

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

    // Build slots with status
    const slotMap: Map<string, AvailableSlot> = new Map();

    for (const blockTime of allBlocks) {
      const availableCourts: AvailableCourt[] = [];
      let slotStatus: SlotStatus = "AVAILABLE";
      let heldByCurrentUser = false;
      let holdExpiresAt: string | undefined;

      for (const court of courtsToProcess) {
        const courtBlocks = courtAvailability.get(court.id) || [];
        
        // Check if this block is booked
        if (isBlockBooked(blockTime, venue.slot_interval_minutes, bookings || [], court.id, date)) {
          slotStatus = "CONFIRMED";
          continue;
        }

        // Check if this block has an active hold
        const holdStatus = getBlockHoldStatus(
          blockTime,
          venue.slot_interval_minutes,
          holds || [],
          court.id,
          date,
          currentUserId
        );

        if (holdStatus.status === "HELD") {
          if (slotStatus !== "CONFIRMED") {
            slotStatus = "HELD";
            heldByCurrentUser = holdStatus.heldByCurrentUser;
            holdExpiresAt = holdStatus.expiresAt;
          }
        }

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
              allowed_sports: court.allowed_sports || [],
            });
          }
        }
      }

      // Build slot entry
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

      const slot: AvailableSlot = {
        start_time: blockTime,
        status: availableCourts.length > 0 ? slotStatus : "CONFIRMED",
        available_durations: maxDurations,
        available_courts: availableCourts,
      };

      if (heldByCurrentUser) {
        slot.held_by_current_user = true;
      }
      if (holdExpiresAt && slotStatus === "HELD") {
        slot.hold_expires_at = holdExpiresAt;
      }

      slotMap.set(blockTime, slot);
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
          allowed_sports: c.allowed_sports || [],
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
