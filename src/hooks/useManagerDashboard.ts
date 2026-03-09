import { useState, useEffect, useMemo, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, format, eachDayOfInterval, eachWeekOfInterval, getDay } from "date-fns";

export type DashboardPeriod = "daily" | "weekly" | "monthly";

interface CourtWithVenue {
  id: string;
  name: string;
  venue_id: string;
  venue_name: string;
  allowed_sports: string[] | null;
  is_multi_court: boolean | null;
  parent_court_id: string | null;
}

export interface LiveCourtInfo {
  court: CourtWithVenue;
  status: "in_use" | "available" | "upcoming";
  currentBooking?: {
    bookerName: string;
    remainingMinutes: number;
    endTime: string;
    progressPercent: number;
  };
  nextBooking?: {
    bookerName: string;
    startsInMinutes: number;
    startTime: string;
  };
}

export interface UpcomingBookingInfo {
  id: string;
  courtName: string;
  venueName: string;
  date: string;
  startTime: string;
  endTime: string;
  durationMinutes: number;
  bookerName: string;
  bookerInitials: string;
  bookerPhone: string | null;
  paymentStatus: string;
  bookingRef: string;
  courtId: string;
  venueId: string;
  rawStartTime: string;
  rawEndTime: string;
}

export interface DailyPerformance {
  day: string;
  dayShort: string;
  revenue: number;
  bookings: number;
}

export interface DashboardStats {
  totalBookings: number;
  revenue: number;
  utilizationRate: number;
}

export function useManagerDashboard(period: DashboardPeriod) {
  const { user } = useAuth();
  const [stats, setStats] = useState<DashboardStats>({ totalBookings: 0, revenue: 0, utilizationRate: 0 });
  const [liveCourts, setLiveCourts] = useState<LiveCourtInfo[]>([]);
  const [weeklyPerformance, setWeeklyPerformance] = useState<DailyPerformance[]>([]);
  const [upcomingBookings, setUpcomingBookings] = useState<UpcomingBookingInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [venueIds, setVenueIds] = useState<string[]>([]);
  const [allCourtIds, setAllCourtIds] = useState<string[]>([]);
  const [courts, setCourts] = useState<CourtWithVenue[]>([]);

  const dateRange = useMemo(() => {
    const now = new Date();
    switch (period) {
      case "daily":
        return { start: startOfDay(now), end: endOfDay(now) };
      case "weekly":
        return { start: startOfWeek(now, { weekStartsOn: 1 }), end: endOfWeek(now, { weekStartsOn: 1 }) };
      case "monthly":
      default:
        return { start: startOfMonth(now), end: endOfMonth(now) };
    }
  }, [period]);

  // Step 1: Fetch venues and courts owned by user
  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data: venues } = await supabase
        .from("venues")
        .select("id, name")
        .eq("owner_id", user.id);

      const ids = (venues || []).map((v) => v.id);
      setVenueIds(ids);

      if (ids.length === 0) {
        setLoading(false);
        return;
      }

      const { data: courtsData } = await supabase
        .from("courts")
        .select("id, name, venue_id, allowed_sports, is_multi_court, parent_court_id")
        .in("venue_id", ids)
        .eq("is_active", true);

      const venueMap = Object.fromEntries((venues || []).map((v) => [v.id, v.name]));
      const mapped: CourtWithVenue[] = (courtsData || []).map((c) => ({
        ...c,
        venue_name: venueMap[c.venue_id] || "",
      }));
      setCourts(mapped);
      setAllCourtIds(mapped.map((c) => c.id));
    })();
  }, [user]);

  // Step 2: Fetch stats for the period
  const fetchStats = useCallback(async () => {
    if (allCourtIds.length === 0) {
      setStats({ totalBookings: 0, revenue: 0, utilizationRate: 0 });
      return;
    }

    const startStr = format(dateRange.start, "yyyy-MM-dd");
    const endStr = format(dateRange.end, "yyyy-MM-dd");

    // Bookings count
    const { count: bookedCount } = await supabase
      .from("court_availability")
      .select("id", { count: "exact", head: true })
      .in("court_id", allCourtIds)
      .eq("is_booked", true)
      .gte("available_date", startStr)
      .lte("available_date", endStr);

    // Total availability count for utilization
    const { count: totalCount } = await supabase
      .from("court_availability")
      .select("id", { count: "exact", head: true })
      .in("court_id", allCourtIds)
      .gte("available_date", startStr)
      .lte("available_date", endStr);

    const utilization = totalCount && totalCount > 0
      ? Math.round(((bookedCount || 0) / totalCount) * 100)
      : 0;

    // Revenue from completed payments
    const { data: bookedSlots } = await supabase
      .from("court_availability")
      .select("booked_by_session_id")
      .in("court_id", allCourtIds)
      .eq("is_booked", true)
      .eq("payment_status", "completed")
      .gte("available_date", startStr)
      .lte("available_date", endStr);

    const sessionIds = [...new Set(
      (bookedSlots || [])
        .filter((b) => b.booked_by_session_id)
        .map((b) => b.booked_by_session_id as string)
    )];

    let revenue = 0;
    if (sessionIds.length > 0) {
      const { data: payments } = await supabase
        .from("payments")
        .select("amount, platform_fee")
        .in("session_id", sessionIds)
        .eq("status", "completed");

      revenue = (payments || []).reduce((sum, p) => {
        return sum + Number(p.amount) - Number(p.platform_fee || 0);
      }, 0);
    }

    setStats({ totalBookings: bookedCount || 0, revenue, utilizationRate: utilization });
  }, [allCourtIds, dateRange]);

  // Step 3: Fetch live court status
  const fetchLiveCourts = useCallback(async () => {
    if (courts.length === 0) return;

    const parentCourts = courts.filter((c) => !c.parent_court_id);
    const today = format(new Date(), "yyyy-MM-dd");
    const nowTime = format(new Date(), "HH:mm:ss");

    // Get today's bookings for all courts
    const { data: todayBookings } = await supabase
      .from("court_availability")
      .select("id, court_id, start_time, end_time, booked_by_user_id, is_booked, available_date")
      .in("court_id", allCourtIds)
      .eq("available_date", today)
      .eq("is_booked", true)
      .order("start_time", { ascending: true });

    // Get booker profiles
    const bookerIds = [...new Set((todayBookings || []).filter((b) => b.booked_by_user_id).map((b) => b.booked_by_user_id as string))];
    let profileMap: Record<string, string> = {};
    if (bookerIds.length > 0) {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, full_name")
        .in("user_id", bookerIds);
      profileMap = Object.fromEntries((profiles || []).map((p) => [p.user_id, p.full_name || "Unknown"]));
    }

    const liveData: LiveCourtInfo[] = parentCourts.map((court) => {
      const courtBookings = (todayBookings || []).filter((b) => b.court_id === court.id);

      // Find current booking
      const current = courtBookings.find((b) => b.start_time <= nowTime && b.end_time > nowTime);

      // Find next upcoming booking
      const upcoming = courtBookings.find((b) => b.start_time > nowTime);

      if (current) {
        const [eh, em] = current.end_time.split(":").map(Number);
        const [sh, sm] = current.start_time.split(":").map(Number);
        const now = new Date();
        const endMin = eh * 60 + em;
        const startMin = sh * 60 + sm;
        const currentMin = now.getHours() * 60 + now.getMinutes();
        const remaining = Math.max(0, endMin - currentMin);
        const total = endMin - startMin;
        const elapsed = total - remaining;
        const progress = total > 0 ? Math.round((elapsed / total) * 100) : 0;

        return {
          court,
          status: "in_use" as const,
          currentBooking: {
            bookerName: profileMap[current.booked_by_user_id!] || "Unknown",
            remainingMinutes: remaining,
            endTime: current.end_time,
            progressPercent: progress,
          },
        };
      }

      if (upcoming) {
        const [uh, um] = upcoming.start_time.split(":").map(Number);
        const now = new Date();
        const upcomingMin = uh * 60 + um;
        const currentMin = now.getHours() * 60 + now.getMinutes();
        const startsIn = Math.max(0, upcomingMin - currentMin);

        return {
          court,
          status: "upcoming" as const,
          nextBooking: {
            bookerName: profileMap[upcoming.booked_by_user_id!] || "Unknown",
            startsInMinutes: startsIn,
            startTime: upcoming.start_time,
          },
        };
      }

      return { court, status: "available" as const };
    });

    setLiveCourts(liveData);
  }, [courts, allCourtIds]);

  // Step 4: Fetch weekly performance
  const fetchPerformanceChart = useCallback(async () => {
    if (allCourtIds.length === 0) return;

    const startStr = format(dateRange.start, "yyyy-MM-dd");
    const endStr = format(dateRange.end, "yyyy-MM-dd");

    // For "daily" we show hourly buckets, for "weekly" daily buckets, for "monthly" weekly buckets
    const { data: bookingsData } = await supabase
      .from("court_availability")
      .select("available_date, start_time, booked_by_session_id, payment_status")
      .in("court_id", allCourtIds)
      .eq("is_booked", true)
      .gte("available_date", startStr)
      .lte("available_date", endStr);

    // Get revenue per session
    const sessionIds = [...new Set(
      (bookingsData || [])
        .filter((b) => b.booked_by_session_id && b.payment_status === "completed")
        .map((b) => b.booked_by_session_id as string)
    )];

    let sessionRevenue: Record<string, number> = {};
    if (sessionIds.length > 0) {
      const { data: payments } = await supabase
        .from("payments")
        .select("session_id, amount, platform_fee")
        .in("session_id", sessionIds)
        .eq("status", "completed");

      (payments || []).forEach((p) => {
        const net = Number(p.amount) - Number(p.platform_fee || 0);
        sessionRevenue[p.session_id] = (sessionRevenue[p.session_id] || 0) + net;
      });
    }

    if (period === "daily") {
      // Hourly buckets for today
      const hourBuckets: Record<number, { count: number; sessionIds: Set<string> }> = {};
      (bookingsData || []).forEach((b) => {
        const hour = parseInt(b.start_time.split(":")[0]);
        if (!hourBuckets[hour]) hourBuckets[hour] = { count: 0, sessionIds: new Set() };
        hourBuckets[hour].count++;
        if (b.booked_by_session_id) hourBuckets[hour].sessionIds.add(b.booked_by_session_id);
      });

      const perf: DailyPerformance[] = Array.from({ length: 24 }, (_, h) => {
        const bucket = hourBuckets[h];
        const rev = bucket ? [...bucket.sessionIds].reduce((s, sid) => s + (sessionRevenue[sid] || 0), 0) : 0;
        const ampm = h >= 12 ? "PM" : "AM";
        const displayH = h === 0 ? 12 : h > 12 ? h - 12 : h;
        return { day: `${displayH}${ampm}`, dayShort: `${displayH}${ampm}`, revenue: rev, bookings: bucket?.count || 0 };
      }).filter((_, h) => h >= 6 && h <= 23); // Only show 6AM-11PM

      setWeeklyPerformance(perf);
    } else if (period === "weekly") {
      // Daily buckets for this week
      const days = eachDayOfInterval({ start: dateRange.start, end: dateRange.end });
      const bookingsByDate: Record<string, { count: number; sessionIds: Set<string> }> = {};
      (bookingsData || []).forEach((b) => {
        if (!bookingsByDate[b.available_date]) bookingsByDate[b.available_date] = { count: 0, sessionIds: new Set() };
        bookingsByDate[b.available_date].count++;
        if (b.booked_by_session_id) bookingsByDate[b.available_date].sessionIds.add(b.booked_by_session_id);
      });

      const perf: DailyPerformance[] = days.map((d) => {
        const dateStr = format(d, "yyyy-MM-dd");
        const dayData = bookingsByDate[dateStr];
        const rev = dayData ? [...dayData.sessionIds].reduce((s, sid) => s + (sessionRevenue[sid] || 0), 0) : 0;
        return { day: format(d, "EEE"), dayShort: format(d, "EEE"), revenue: rev, bookings: dayData?.count || 0 };
      });

      setWeeklyPerformance(perf);
    } else {
      // Weekly buckets for this month
      const weeks = eachWeekOfInterval({ start: dateRange.start, end: dateRange.end }, { weekStartsOn: 1 });
      const perf: DailyPerformance[] = weeks.map((weekStart, i) => {
        const wEnd = endOfWeek(weekStart, { weekStartsOn: 1 });
        const clampedEnd = wEnd > dateRange.end ? dateRange.end : wEnd;
        const wStartStr = format(weekStart < dateRange.start ? dateRange.start : weekStart, "yyyy-MM-dd");
        const wEndStr = format(clampedEnd, "yyyy-MM-dd");

        let count = 0;
        const sids = new Set<string>();
        (bookingsData || []).forEach((b) => {
          if (b.available_date >= wStartStr && b.available_date <= wEndStr) {
            count++;
            if (b.booked_by_session_id) sids.add(b.booked_by_session_id);
          }
        });
        const rev = [...sids].reduce((s, sid) => s + (sessionRevenue[sid] || 0), 0);
        return { day: `Week ${i + 1}`, dayShort: `W${i + 1}`, revenue: rev, bookings: count };
      });

      setWeeklyPerformance(perf);
    }
  }, [allCourtIds, dateRange, period]);

  // Step 5: Fetch upcoming bookings
  const fetchUpcomingBookings = useCallback(async () => {
    if (allCourtIds.length === 0) return;

    const today = format(new Date(), "yyyy-MM-dd");

    const { data: upcomingSlots } = await supabase
      .from("court_availability")
      .select("id, court_id, available_date, start_time, end_time, booked_by_user_id, payment_status")
      .in("court_id", allCourtIds)
      .eq("is_booked", true)
      .gte("available_date", today)
      .order("available_date", { ascending: true })
      .order("start_time", { ascending: true })
      .limit(10);

    if (!upcomingSlots || upcomingSlots.length === 0) {
      setUpcomingBookings([]);
      return;
    }

    // Filter out bookings that have already ended today
    const nowTime = format(new Date(), "HH:mm:ss");
    const filteredSlots = upcomingSlots.filter((slot) => {
      if (slot.available_date === today && slot.end_time <= nowTime) return false;
      return true;
    });

    if (filteredSlots.length === 0) {
      setUpcomingBookings([]);
      return;
    }

    const bookerIds = [...new Set(filteredSlots.filter((s) => s.booked_by_user_id).map((s) => s.booked_by_user_id as string))];
    let profileMap: Record<string, { name: string; phone: string | null }> = {};
    if (bookerIds.length > 0) {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, full_name, phone")
        .in("user_id", bookerIds);
      profileMap = Object.fromEntries((profiles || []).map((p) => [p.user_id, { name: p.full_name || "Unknown", phone: p.phone || null }]));
    }

    const courtMap = Object.fromEntries(courts.map((c) => [c.id, c]));

    const mapped: UpcomingBookingInfo[] = filteredSlots.map((slot) => {
      const court = courtMap[slot.court_id];
      const profile = profileMap[slot.booked_by_user_id!] || { name: "Unknown", phone: null };
      const name = profile.name;
      const initials = name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2);

      const [sh, sm] = slot.start_time.split(":");
      const [eh, em] = slot.end_time.split(":");
      const durationMin = (parseInt(eh) * 60 + parseInt(em)) - (parseInt(sh) * 60 + parseInt(sm));

      const startHour = parseInt(sh);
      const ampm = startHour >= 12 ? "PM" : "AM";
      const displayHour = startHour > 12 ? startHour - 12 : startHour === 0 ? 12 : startHour;

      return {
        id: slot.id,
        courtName: court?.name || "Unknown Court",
        venueName: court?.venue_name || "",
        date: slot.available_date,
        startTime: `${displayHour}:${sm} ${ampm}`,
        endTime: slot.end_time,
        rawStartTime: slot.start_time,
        rawEndTime: slot.end_time,
        durationMinutes: durationMin,
        bookerName: name,
        bookerInitials: initials,
        bookerPhone: profile.phone,
        paymentStatus: slot.payment_status,
        bookingRef: `BK-${slot.id.slice(0, 4).toUpperCase()}`,
        courtId: slot.court_id,
        venueId: court?.venue_id || "",
      };
    });

    setUpcomingBookings(mapped);
  }, [allCourtIds, courts]);

  const refreshAll = useCallback(() => {
    if (allCourtIds.length === 0 && courts.length === 0) return;
    setLoading(true);
    Promise.all([fetchStats(), fetchLiveCourts(), fetchPerformanceChart(), fetchUpcomingBookings()])
      .finally(() => setLoading(false));
  }, [fetchStats, fetchLiveCourts, fetchPerformanceChart, fetchUpcomingBookings, allCourtIds, courts]);

  // Run all fetches when courts are loaded
  useEffect(() => {
    refreshAll();
  }, [refreshAll]);

  return { stats, liveCourts, weeklyPerformance, upcomingBookings, loading, courts, refreshAll };
}
