import { useState, useEffect, useMemo, useCallback } from "react";
import { ManagerLayout } from "@/components/layout/ManagerLayout";
import { RescheduleBookingDialog } from "@/components/manager/RescheduleBookingDialog";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Calendar,
  MapPin,
  Clock,
  DollarSign,
  Loader2,
  Filter,
  CheckCircle,
  XCircle,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  CalendarDays,
  Phone,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { DateRange } from "react-day-picker";

interface Booking {
  id: string;
  available_date: string;
  start_time: string;
  end_time: string;
  is_booked: boolean;
  payment_status: string;
  booked_by_user_id: string | null;
  booked_by_session_id: string | null;
  court_id: string;
  courtName: string;
  courtHourlyRate: number;
  venueId: string;
  venueName: string;
  venueCity: string;
  isSessionCancelled: boolean;
  bookerName: string;
  bookerPhone: string | null;
}

interface Venue {
  id: string;
  name: string;
}

interface Court {
  id: string;
  name: string;
  venue_id: string;
}

type BookingTab = "active" | "cancelled" | "completed";

const ITEMS_PER_PAGE = 15;

export default function ManagerBookings() {
  const { user } = useAuth();
  const [venues, setVenues] = useState<Venue[]>([]);
  const [courts, setCourts] = useState<Court[]>([]);
  const [courtIds, setCourtIds] = useState<string[]>([]);
  const [initLoading, setInitLoading] = useState(true);

  const [bookings, setBookings] = useState<Booking[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(false);

  const [selectedVenue, setSelectedVenue] = useState<string>("all");
  const [selectedCourt, setSelectedCourt] = useState<string>("all");
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);
  const [activeTab, setActiveTab] = useState<BookingTab>("active");
  const [currentPage, setCurrentPage] = useState(1);
  const [rescheduleBooking, setRescheduleBooking] = useState<Booking | null>(null);

  // Step 1: Fetch venues and courts once
  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data: venuesData } = await supabase
        .from("venues")
        .select("id, name")
        .eq("owner_id", user.id);

      if (!venuesData || venuesData.length === 0) {
        setVenues([]);
        setCourts([]);
        setCourtIds([]);
        setInitLoading(false);
        return;
      }

      setVenues(venuesData);
      const venueIds = venuesData.map((v) => v.id);

      const { data: courtsData } = await supabase
        .from("courts")
        .select("id, name, venue_id")
        .in("venue_id", venueIds);

      const allCourts = courtsData || [];
      setCourts(allCourts);
      setCourtIds(allCourts.map((c) => c.id));
      setInitLoading(false);
    })();
  }, [user]);

  // Filter courts based on selected venue
  const filteredCourts = useMemo(() => {
    if (selectedVenue === "all") return courts;
    return courts.filter((c) => c.venue_id === selectedVenue);
  }, [courts, selectedVenue]);

  // Compute active court IDs for query
  const activeCourtIds = useMemo(() => {
    if (selectedCourt !== "all") return [selectedCourt];
    if (selectedVenue !== "all") return filteredCourts.map((c) => c.id);
    return courtIds;
  }, [selectedCourt, selectedVenue, filteredCourts, courtIds]);

  // Reset filters
  useEffect(() => {
    setSelectedCourt("all");
    setCurrentPage(1);
  }, [selectedVenue]);

  useEffect(() => {
    setCurrentPage(1);
  }, [selectedCourt, dateRange, activeTab]);

  // Step 2: Fetch bookings with server-side pagination + filtering
  const fetchBookings = useCallback(async () => {
    if (activeCourtIds.length === 0) {
      setBookings([]);
      setTotalCount(0);
      return;
    }

    setLoading(true);

    try {
      const today = format(new Date(), "yyyy-MM-dd");
      const rangeStart = (currentPage - 1) * ITEMS_PER_PAGE;
      const rangeEnd = rangeStart + ITEMS_PER_PAGE - 1;

      // Build the base query for counting
      let countQuery = supabase
        .from("court_availability")
        .select("id", { count: "exact", head: true })
        .in("court_id", activeCourtIds)
        .eq("is_booked", true);

      // Build the data query
      let dataQuery = supabase
        .from("court_availability")
        .select(
          `id, available_date, start_time, end_time, is_booked, payment_status,
           booked_by_user_id, booked_by_session_id, court_id`
        )
        .in("court_id", activeCourtIds)
        .eq("is_booked", true);

      // Apply tab-specific date filters to push filtering to DB
      // For active: future dates only (today handled client-side by end_time check)
      // For completed: past dates only (today handled client-side by end_time check)
      // We include today in both queries and do the time-based split client-side
      if (activeTab === "active") {
        // Fetch today and future — we'll filter out already-ended today slots client-side
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayStr = format(yesterday, "yyyy-MM-dd");
        countQuery = countQuery.gt("available_date", yesterdayStr);
        dataQuery = dataQuery.gt("available_date", yesterdayStr);
      } else if (activeTab === "completed") {
        // Fetch today and past — we'll filter out not-yet-ended today slots client-side
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        const tomorrowStr = format(tomorrow, "yyyy-MM-dd");
        countQuery = countQuery.lt("available_date", tomorrowStr);
        dataQuery = dataQuery.lt("available_date", tomorrowStr);
      }
      // "cancelled" tab needs session join — we fetch all and filter after

      // Apply date range filter
      if (dateRange?.from) {
        const fromStr = format(dateRange.from, "yyyy-MM-dd");
        countQuery = countQuery.gte("available_date", fromStr);
        dataQuery = dataQuery.gte("available_date", fromStr);
      }
      if (dateRange?.to) {
        const toStr = format(dateRange.to, "yyyy-MM-dd");
        countQuery = countQuery.lte("available_date", toStr);
        dataQuery = dataQuery.lte("available_date", toStr);
      }

      // Sort: active = ascending (closest first), completed = descending (most recent first)
      const ascending = activeTab === "active";
      dataQuery = dataQuery
        .order("available_date", { ascending })
        .order("start_time", { ascending: true })
        .range(rangeStart, rangeEnd);

      // Execute count and data in parallel
      const [countResult, dataResult] = await Promise.all([countQuery, dataQuery]);

      const count = countResult.count || 0;
      const rows = dataResult.data || [];

      if (rows.length === 0) {
        setBookings([]);
        setTotalCount(count);
        setLoading(false);
        return;
      }

      // Batch-fetch related data in parallel
      const sessionIds = [
        ...new Set(rows.filter((r) => r.booked_by_session_id).map((r) => r.booked_by_session_id as string)),
      ];
      const userIds = [
        ...new Set(rows.filter((r) => r.booked_by_user_id).map((r) => r.booked_by_user_id as string)),
      ];

      const [sessionsResult, profilesResult] = await Promise.all([
        sessionIds.length > 0
          ? supabase
              .from("sessions")
              .select("id, is_cancelled, group:groups(name)")
              .in("id", sessionIds)
          : Promise.resolve({ data: [] }),
        userIds.length > 0
          ? supabase
              .from("profiles")
              .select("user_id, full_name, phone")
              .in("user_id", userIds)
          : Promise.resolve({ data: [] }),
      ]);

      const sessionsMap: Record<string, { is_cancelled: boolean; groupName: string }> = {};
      (sessionsResult.data || []).forEach((s: any) => {
        sessionsMap[s.id] = {
          is_cancelled: s.is_cancelled,
          groupName: s.group?.name || "",
        };
      });

      const profilesMap: Record<string, { full_name: string; phone: string | null }> = {};
      (profilesResult.data || []).forEach((p: any) => {
        profilesMap[p.user_id] = { full_name: p.full_name || "Unknown", phone: p.phone };
      });

      // Build court lookup from local state
      const courtMap: Record<string, Court> = {};
      courts.forEach((c) => (courtMap[c.id] = c));
      const venueMap: Record<string, Venue> = {};
      venues.forEach((v) => (venueMap[v.id] = v));

      // Map to enriched bookings
      const enriched: Booking[] = rows.map((r) => {
        const court = courtMap[r.court_id];
        const venue = court ? venueMap[court.venue_id] : undefined;
        const session = r.booked_by_session_id ? sessionsMap[r.booked_by_session_id] : null;
        const profile = r.booked_by_user_id ? profilesMap[r.booked_by_user_id] : null;

        return {
          id: r.id,
          available_date: r.available_date,
          start_time: r.start_time,
          end_time: r.end_time,
          is_booked: r.is_booked ?? true,
          payment_status: r.payment_status,
          booked_by_user_id: r.booked_by_user_id,
          booked_by_session_id: r.booked_by_session_id,
          court_id: r.court_id,
          courtName: court?.name || "Unknown Court",
          courtHourlyRate: 0,
          venueId: court?.venue_id || "",
          venueName: venue?.name || "Unknown Venue",
          venueCity: "",
          isSessionCancelled: session?.is_cancelled || false,
          bookerName: profile?.full_name || session?.groupName || "Unknown",
          bookerPhone: profile?.phone || null,
        };
      });

      // Client-side filtering for precise active/completed split on today's bookings
      const now = new Date();
      let finalBookings = enriched;
      let finalCount = count;

      if (activeTab === "cancelled") {
        finalBookings = enriched.filter((b) => b.isSessionCancelled);
        finalCount = finalBookings.length;
      } else if (activeTab === "active") {
        // Exclude cancelled sessions AND already-ended bookings
        finalBookings = enriched.filter((b) => {
          if (b.isSessionCancelled) return false;
          const endDt = new Date(`${b.available_date}T${b.end_time}`);
          return endDt > now;
        });
      } else if (activeTab === "completed") {
        // Only show bookings that have actually ended
        finalBookings = enriched.filter((b) => {
          if (b.isSessionCancelled) return false;
          const endDt = new Date(`${b.available_date}T${b.end_time}`);
          return endDt <= now;
        });
      }

      setBookings(finalBookings);
      setTotalCount(activeTab === "cancelled" || activeTab === "active" || activeTab === "completed" ? finalBookings.length : count);
    } catch (error) {
      console.error("Error fetching bookings:", error);
    } finally {
      setLoading(false);
    }
  }, [activeCourtIds, activeTab, dateRange, currentPage, courts, venues]);

  // Trigger fetch when dependencies change
  useEffect(() => {
    if (!initLoading) {
      fetchBookings();
    }
  }, [fetchBookings, initLoading]);

  const totalPages = Math.max(1, Math.ceil(totalCount / ITEMS_PER_PAGE));

  const formatTime = (time: string) => {
    const [hours, minutes] = time.split(":");
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? "PM" : "AM";
    const hour12 = hour % 12 || 12;
    return `${hour12}:${minutes} ${ampm}`;
  };

  const getStatusBadge = (booking: Booking) => {
    const isPast = new Date(`${booking.available_date}T${booking.end_time}`) < new Date();

    if (booking.isSessionCancelled) {
      return (
        <Badge variant="destructive" className="gap-1">
          <XCircle className="h-3 w-3" /> Cancelled
        </Badge>
      );
    }
    if (isPast) {
      return (
        <Badge variant="default" className="gap-1 bg-blue-600">
          <CheckCircle className="h-3 w-3" /> Completed
        </Badge>
      );
    }
    if (booking.payment_status === "completed") {
      return (
        <Badge variant="default" className="gap-1 bg-green-600">
          <CheckCircle className="h-3 w-3" /> Paid
        </Badge>
      );
    }
    return (
      <Badge variant="secondary" className="gap-1">
        <AlertCircle className="h-3 w-3" /> Pending
      </Badge>
    );
  };

  const BookingCard = ({ booking }: { booking: Booking }) => {
    const isPast = new Date(`${booking.available_date}T${booking.end_time}`) < new Date();
    const canReschedule = !isPast && !booking.isSessionCancelled;

    return (
      <Card className="overflow-hidden">
        <CardContent className="p-3 sm:p-4">
          <div className="space-y-2">
            {/* Row 1: Name + Badge + Reschedule */}
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="font-semibold text-sm sm:text-base truncate max-w-[120px] sm:max-w-none">{booking.bookerName}</h3>
              {getStatusBadge(booking)}
              {canReschedule && (
                <Button
                  variant="outline"
                  size="sm"
                  className="text-[11px] sm:text-xs h-6 sm:h-7 px-2 ml-auto"
                  onClick={() => setRescheduleBooking(booking)}
                >
                  <CalendarDays className="h-3 w-3 mr-1" />
                  Reschedule
                </Button>
              )}
            </div>

            {/* Row 2: Phone number */}
            {booking.bookerPhone && (
              <a
                href={`tel:${booking.bookerPhone}`}
                className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors border border-border/50 rounded-full px-2 py-0.5 w-fit"
                title={`Call ${booking.bookerPhone}`}
              >
                <Phone className="h-3 w-3" />
                {booking.bookerPhone}
              </a>
            )}

            {/* Row 2: Date + Time */}
            <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs sm:text-sm text-muted-foreground">
              <div className="flex items-center gap-1">
                <Calendar className="h-3 w-3 sm:h-3.5 sm:w-3.5 shrink-0" />
                {format(new Date(booking.available_date), "EEE, MMM d, yyyy")}
              </div>
              <div className="flex items-center gap-1">
                <Clock className="h-3 w-3 sm:h-3.5 sm:w-3.5 shrink-0" />
                {formatTime(booking.start_time)} - {formatTime(booking.end_time)}
              </div>
            </div>

            {/* Row 3: Venue */}
            <div className="text-xs sm:text-sm text-muted-foreground">
              <div className="flex items-center gap-1">
                <MapPin className="h-3 w-3 sm:h-3.5 sm:w-3.5 shrink-0" />
                <span className="truncate">{booking.venueName} - {booking.courtName}</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  const BookingsSkeleton = () => (
    <div className="space-y-3">
      {Array.from({ length: 5 }).map((_, i) => (
        <Card key={i}>
          <CardContent className="p-4 space-y-3">
            <div className="flex justify-between">
              <Skeleton className="h-5 w-40" />
              <Skeleton className="h-5 w-20" />
            </div>
            <div className="flex gap-4">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-4 w-28" />
            </div>
            <Skeleton className="h-4 w-48" />
          </CardContent>
        </Card>
      ))}
    </div>
  );

  const Pagination = () => {
    if (totalPages <= 1) return null;
    const start = (currentPage - 1) * ITEMS_PER_PAGE + 1;
    const end = Math.min(currentPage * ITEMS_PER_PAGE, totalCount);

    return (
      <div className="flex items-center justify-between pt-4">
        <p className="text-sm text-muted-foreground">
          Showing {start} to {end} of {totalCount} bookings
        </p>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            disabled={currentPage === 1}
          >
            <ChevronLeft className="h-4 w-4" />
            Previous
          </Button>
          <span className="text-sm">
            Page {currentPage} of {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages}
          >
            Next
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    );
  };

  const EmptyState = ({ icon: Icon, title, description }: { icon: any; title: string; description: string }) => (
    <Card>
      <CardContent className="py-12 text-center">
        <Icon className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
        <h3 className="font-semibold text-lg mb-2">{title}</h3>
        <p className="text-muted-foreground">{description}</p>
      </CardContent>
    </Card>
  );

  const TabContent = ({ emptyIcon, emptyTitle, emptyDescription }: { emptyIcon: any; emptyTitle: string; emptyDescription: string }) => {
    if (loading) return <BookingsSkeleton />;
    if (bookings.length === 0) return <EmptyState icon={emptyIcon} title={emptyTitle} description={emptyDescription} />;
    return (
      <>
        {bookings.map((booking) => (
          <BookingCard key={booking.id} booking={booking} />
        ))}
        <Pagination />
      </>
    );
  };

  if (initLoading) {
    return (
      <ManagerLayout>
        <div className="p-4 md:p-6 flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </ManagerLayout>
    );
  }

  return (
    <ManagerLayout>
      <div className="p-4 md:p-6 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="font-display text-2xl font-bold">Bookings</h1>
            <p className="text-muted-foreground">View and manage all your venue bookings</p>
          </div>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="p-4">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Filter className="h-4 w-4" />
                <span className="text-sm font-medium">Filters:</span>
              </div>

              <div className="flex flex-col sm:flex-row gap-3 flex-1">
                <Select value={selectedVenue} onValueChange={setSelectedVenue}>
                  <SelectTrigger className="w-full sm:w-[200px]">
                    <SelectValue placeholder="All Venues" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Venues</SelectItem>
                    {venues.map((venue) => (
                      <SelectItem key={venue.id} value={venue.id}>
                        {venue.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select value={selectedCourt} onValueChange={setSelectedCourt}>
                  <SelectTrigger className="w-full sm:w-[200px]">
                    <SelectValue placeholder="All Courts" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Courts</SelectItem>
                    {filteredCourts.map((court) => (
                      <SelectItem key={court.id} value={court.id}>
                        {court.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full sm:w-[240px] justify-start text-left font-normal",
                        !dateRange && "text-muted-foreground"
                      )}
                    >
                      <Calendar className="mr-2 h-4 w-4" />
                      {dateRange?.from ? (
                        dateRange.to ? (
                          <>
                            {format(dateRange.from, "MMM d")} - {format(dateRange.to, "MMM d, yyyy")}
                          </>
                        ) : (
                          format(dateRange.from, "MMM d, yyyy")
                        )
                      ) : (
                        "All Dates"
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <CalendarComponent
                      mode="range"
                      selected={dateRange}
                      onSelect={setDateRange}
                      numberOfMonths={2}
                      initialFocus
                    />
                    {dateRange && (
                      <div className="p-3 border-t">
                        <Button variant="outline" className="w-full" onClick={() => setDateRange(undefined)}>
                          Clear Date Range
                        </Button>
                      </div>
                    )}
                  </PopoverContent>
                </Popover>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as BookingTab)}>
          <TabsList className="w-full sm:w-auto grid grid-cols-3 sm:inline-flex">
            <TabsTrigger value="active" className="gap-2">
              <AlertCircle className="h-4 w-4 hidden sm:inline" />
              Active
            </TabsTrigger>
            <TabsTrigger value="cancelled" className="gap-2">
              <XCircle className="h-4 w-4 hidden sm:inline" />
              Cancelled
            </TabsTrigger>
            <TabsTrigger value="completed" className="gap-2">
              <CheckCircle className="h-4 w-4 hidden sm:inline" />
              Completed
            </TabsTrigger>
          </TabsList>

          <TabsContent value="active" className="mt-4 space-y-3">
            <TabContent
              emptyIcon={AlertCircle}
              emptyTitle="No active bookings"
              emptyDescription="Active bookings will appear here when customers book your venues."
            />
          </TabsContent>

          <TabsContent value="cancelled" className="mt-4 space-y-3">
            <TabContent
              emptyIcon={XCircle}
              emptyTitle="No cancelled bookings"
              emptyDescription="Cancelled bookings will appear here."
            />
          </TabsContent>

          <TabsContent value="completed" className="mt-4 space-y-3">
            <TabContent
              emptyIcon={CheckCircle}
              emptyTitle="No completed bookings"
              emptyDescription="Completed bookings will appear here."
            />
          </TabsContent>
        </Tabs>
      </div>

      {rescheduleBooking && (
        <RescheduleBookingDialog
          open={!!rescheduleBooking}
          onOpenChange={(open) => {
            if (!open) setRescheduleBooking(null);
          }}
          bookingId={rescheduleBooking.id}
          courtId={rescheduleBooking.court_id}
          venueId={rescheduleBooking.venueId}
          currentDate={rescheduleBooking.available_date}
          currentStartTime={rescheduleBooking.start_time}
          currentEndTime={rescheduleBooking.end_time}
          onSuccess={fetchBookings}
        />
      )}
    </ManagerLayout>
  );
}
