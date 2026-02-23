import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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

interface Booking {
  court_id: string;
  start_time: string;
  end_time: string;
}

interface BookingHold {
  court_id: string;
  user_id: string;
  start_datetime: string;
  end_datetime: string;
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

type SlotStatus = "AVAILABLE" | "HELD" | "CONFIRMED";

interface AvailableCourt {
  id: string;
  name: string;
  hourly_rate: number;
  ground_type: string | null;
  rules: string | null;
  photo_urls: string[];
  allowed_sports: string[];
  available_durations: number[];
}

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
      return { startTime: override.custom_start_time, endTime: override.custom_end_time };
    }
  }

  const weeklyRule = weeklyRules.find((r) => r.day_of_week === dayOfWeek);
  if (!weeklyRule || weeklyRule.is_closed) return null;

  return { startTime: weeklyRule.start_time, endTime: weeklyRule.end_time };
}

function courtToDropdownEntry(c: Court) {
  return {
    id: c.id,
    name: c.name,
    hourly_rate: c.hourly_rate,
    ground_type: c.ground_type,
    rules: c.rules,
    photo_urls: c.photo_urls || (c.photo_url ? [c.photo_url] : []),
    allowed_sports: c.allowed_sports || [],
  };
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

    // ── PHASE 1: Run ALL independent queries + auth in parallel ──
    const authHeader = req.headers.get("Authorization");
    const userPromise = authHeader
      ? createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY") || "", {
          global: { headers: { Authorization: authHeader } },
        }).auth.getUser().then(r => r.data?.user?.id ?? null)
      : Promise.resolve(null);

    const venuePromise = supabase
      .from("venues")
      .select("id, slot_interval_minutes, max_booking_minutes")
      .eq("id", venueId)
      .single();

    const courtsPromise = supabase
      .from("courts")
      .select("id, name, hourly_rate, is_active, is_multi_court, parent_court_id, ground_type, rules, photo_urls, photo_url, allowed_sports")
      .eq("venue_id", venueId)
      .eq("is_active", true)
      .order("name", { ascending: true });

    const rulesPromise = supabase
      .from("venue_weekly_rules")
      .select("day_of_week, start_time, end_time, is_closed")
      .eq("venue_id", venueId);

    const overridesPromise = supabase
      .from("venue_date_overrides")
      .select("start_date, end_date, is_closed, custom_start_time, custom_end_time")
      .eq("venue_id", venueId)
      .lte("start_date", date)
      .or(`end_date.gte.${date},end_date.is.null`);

    // Await all phase-1 queries simultaneously
    const [currentUserId, venueResult, courtsResult, rulesResult, overridesResult] =
      await Promise.all([userPromise, venuePromise, courtsPromise, rulesPromise, overridesPromise]);

    if (venueResult.error || !venueResult.data) {
      return new Response(
        JSON.stringify({ error: "Venue not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const venue = venueResult.data;
    const allCourts: Court[] = courtsResult.data || [];
    const weeklyRules: WeeklyRule[] = rulesResult.data || [];
    const dateOverrides: DateOverride[] = overridesResult.data || [];

    // Determine which courts to process
    let courtsToProcess: Court[] = [];
    let courtsForDropdown: Court[] = [];

    if (courtId) {
      const requestedCourt = allCourts.find(c => c.id === courtId);
      if (requestedCourt) {
        if (requestedCourt.is_multi_court) {
          courtsForDropdown = [requestedCourt, ...allCourts.filter(c => c.parent_court_id === courtId)];
        } else if (requestedCourt.parent_court_id) {
          const parentCourt = allCourts.find(c => c.id === requestedCourt.parent_court_id);
          courtsForDropdown = parentCourt
            ? [parentCourt, ...allCourts.filter(c => c.parent_court_id === parentCourt.id)]
            : [requestedCourt];
        } else {
          courtsForDropdown = [requestedCourt];
        }
        courtsToProcess = courtsForDropdown;
      }
    } else {
      courtsForDropdown = allCourts;
      courtsToProcess = allCourts;
    }

    const venueCourtEntries = courtsForDropdown.map(courtToDropdownEntry);

    if (courtsToProcess.length === 0) {
      return new Response(
        JSON.stringify({ available: false, reason: "no_courts", slots: [], venue_courts: venueCourtEntries }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get the availability window
    const window = getAvailableWindow(date, weeklyRules, dateOverrides);

    if (!window) {
      return new Response(
        JSON.stringify({ available: false, reason: "closed", slots: [], venue_courts: venueCourtEntries }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── PHASE 2: Fetch bookings + holds in parallel (need courtIds from phase 1) ──
    const courtIds = courtsToProcess.map(c => c.id);
    const startOfDay = `${date}T00:00:00Z`;
    const endOfDay = `${date}T23:59:59Z`;

    const [bookingsResult, holdsResult] = await Promise.all([
      supabase
        .from("court_availability")
        .select("court_id, start_time, end_time")
        .eq("available_date", date)
        .eq("is_booked", true)
        .in("court_id", courtIds),
      supabase
        .from("booking_holds")
        .select("court_id, user_id, start_datetime, end_datetime, expires_at")
        .eq("status", "HELD")
        .gt("expires_at", new Date().toISOString())
        .gte("start_datetime", startOfDay)
        .lte("start_datetime", endOfDay)
        .in("court_id", courtIds),
    ]);

    if (bookingsResult.error) throw bookingsResult.error;
    if (holdsResult.error) throw holdsResult.error;

    const bookings: Booking[] = bookingsResult.data || [];
    const holds: BookingHold[] = holdsResult.data || [];

    // ── PHASE 3: Compute slots (pure CPU, no I/O) ──
    const intervalMin = venue.slot_interval_minutes;
    const maxBookingMin = venue.max_booking_minutes;
    const windowStartMin = timeToMinutes(window.startTime);
    const windowEndMin = timeToMinutes(window.endTime);

    // Generate all time blocks as minutes for fast comparison
    const allBlockMinutes: number[] = [];
    for (let m = windowStartMin; m < windowEndMin; m += intervalMin) {
      allBlockMinutes.push(m);
    }

    // Pre-index bookings by courtId → Set of booked minute ranges
    const bookedRanges = new Map<string, Array<[number, number]>>();
    for (const b of bookings) {
      if (!bookedRanges.has(b.court_id)) bookedRanges.set(b.court_id, []);
      bookedRanges.get(b.court_id)!.push([timeToMinutes(b.start_time), timeToMinutes(b.end_time)]);
    }

    // Pre-index holds by courtId
    const holdsByCourtId = new Map<string, Array<{ startMin: number; endMin: number; userId: string; expiresAt: string }>>();
    for (const h of holds) {
      if (!holdsByCourtId.has(h.court_id)) holdsByCourtId.set(h.court_id, []);
      const hStart = new Date(h.start_datetime);
      const hEnd = new Date(h.end_datetime);
      holdsByCourtId.get(h.court_id)!.push({
        startMin: hStart.getHours() * 60 + hStart.getMinutes(),
        endMin: hEnd.getHours() * 60 + hEnd.getMinutes(),
        userId: h.user_id,
        expiresAt: h.expires_at,
      });
    }

    // Pre-compute available block Sets per court
    const courtAvailableSets = new Map<string, Set<number>>();
    for (const court of courtsToProcess) {
      const ranges = bookedRanges.get(court.id) || [];
      const available = new Set<number>();
      for (const blockMin of allBlockMinutes) {
        const blockEnd = blockMin + intervalMin;
        const isBooked = ranges.some(([s, e]) => blockMin < e && blockEnd > s);
        if (!isBooked) available.add(blockMin);
      }
      courtAvailableSets.set(court.id, available);
    }

    // Build slots
    const slots: AvailableSlot[] = [];

    for (const blockMin of allBlockMinutes) {
      const blockEnd = blockMin + intervalMin;
      const blockTime = minutesToTime(blockMin);
      const availableCourts: AvailableCourt[] = [];
      let slotStatus: SlotStatus = "AVAILABLE";
      let heldByCurrentUser = false;
      let holdExpiresAt: string | undefined;

      for (const court of courtsToProcess) {
        const availSet = courtAvailableSets.get(court.id)!;

        if (!availSet.has(blockMin)) {
          // Block is booked on this court
          slotStatus = "CONFIRMED";
          continue;
        }

        // Check holds for this court
        const courtHolds = holdsByCourtId.get(court.id);
        if (courtHolds) {
          for (const h of courtHolds) {
            if (blockMin < h.endMin && blockEnd > h.startMin) {
              if (slotStatus !== "CONFIRMED") {
                slotStatus = "HELD";
                heldByCurrentUser = currentUserId === h.userId;
                holdExpiresAt = h.expiresAt;
              }
              break;
            }
          }
        }

        // Calculate available durations for this court at this block
        const durations: number[] = [];
        for (let dur = intervalMin; dur <= maxBookingMin; dur += intervalMin) {
          const requiredEnd = blockMin + dur;
          if (requiredEnd > windowEndMin) break;

          let allAvail = true;
          for (let m = blockMin; m < requiredEnd; m += intervalMin) {
            if (!availSet.has(m)) { allAvail = false; break; }
          }

          if (allAvail) {
            durations.push(dur);
          } else {
            break;
          }
        }

        if (durations.length > 0) {
          availableCourts.push({
            id: court.id,
            name: court.name,
            hourly_rate: court.hourly_rate,
            ground_type: court.ground_type,
            rules: court.rules,
            photo_urls: court.photo_urls || (court.photo_url ? [court.photo_url] : []),
            allowed_sports: court.allowed_sports || [],
            available_durations: durations,
          });
        }
      }

      // Merge all durations across courts
      const allDurations = new Set<number>();
      for (const c of availableCourts) {
        for (const d of c.available_durations) allDurations.add(d);
      }
      const sortedDurations = Array.from(allDurations).sort((a, b) => a - b);

      const slot: AvailableSlot = {
        start_time: blockTime,
        status: availableCourts.length > 0 ? slotStatus : "CONFIRMED",
        available_durations: sortedDurations,
        available_courts: availableCourts,
      };

      if (heldByCurrentUser) slot.held_by_current_user = true;
      if (holdExpiresAt && slotStatus === "HELD") slot.hold_expires_at = holdExpiresAt;

      slots.push(slot);
    }

    return new Response(
      JSON.stringify({
        available: true,
        window: { start_time: window.startTime, end_time: window.endTime },
        slot_interval_minutes: intervalMin,
        max_booking_minutes: maxBookingMin,
        slots,
        venue_courts: venueCourtEntries,
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
