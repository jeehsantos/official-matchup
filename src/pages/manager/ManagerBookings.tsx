import { useState, useEffect, useMemo, useCallback } from "react";
import { ManagerLayout } from "@/components/layout/ManagerLayout";
import { RescheduleBookingDialog } from "@/components/manager/RescheduleBookingDialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { 
  Calendar, 
  MapPin, 
  Clock, 
  Users, 
  DollarSign,
  Loader2,
  Filter,
  CheckCircle,
  XCircle,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  CalendarDays
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { format, isWithinInterval } from "date-fns";
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
  court?: {
    id: string;
    name: string;
    hourly_rate: number;
    venue_id: string;
    venue?: {
      id: string;
      name: string;
      city: string;
    };
  };
  session?: {
    id: string;
    is_cancelled: boolean;
    group?: {
      name: string;
      organizer_id: string;
    };
    players?: Array<{
      user_id: string;
      profile?: {
        full_name: string;
      };
    }>;
  } | null;
  profile?: {
    full_name: string;
  } | null;
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

type BookingStatus = "active" | "cancelled" | "completed";

export default function ManagerBookings() {
  const { user } = useAuth();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [venues, setVenues] = useState<Venue[]>([]);
  const [courts, setCourts] = useState<Court[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedVenue, setSelectedVenue] = useState<string>("all");
  const [selectedCourt, setSelectedCourt] = useState<string>("all");
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);
  const [activeTab, setActiveTab] = useState<BookingStatus>("active");
  const [currentPage, setCurrentPage] = useState(1);
  const [rescheduleBooking, setRescheduleBooking] = useState<Booking | null>(null);
  const itemsPerPage = 20;

  useEffect(() => {
    if (user) {
      fetchData();
    }
  }, [user]);

  const fetchData = async () => {
    try {
      // Get venues owned by user
      const { data: venuesData } = await supabase
        .from("venues")
        .select("id, name")
        .eq("owner_id", user?.id);

      if (!venuesData || venuesData.length === 0) {
        setVenues([]);
        setCourts([]);
        setBookings([]);
        setLoading(false);
        return;
      }

      setVenues(venuesData);
      const venueIds = venuesData.map(v => v.id);

      // Get courts for those venues
      const { data: courtsData } = await supabase
        .from("courts")
        .select("id, name, venue_id")
        .in("venue_id", venueIds);

      setCourts(courtsData || []);
      const courtIds = (courtsData || []).map(c => c.id);

      if (courtIds.length === 0) {
        setBookings([]);
        setLoading(false);
        return;
      }

      // Get all bookings for those courts
      const { data: bookingsData, error } = await supabase
        .from("court_availability")
        .select(`
          id,
          available_date,
          start_time,
          end_time,
          is_booked,
          payment_status,
          booked_by_user_id,
          booked_by_session_id,
          court_id,
          court:courts(
            id,
            name,
            hourly_rate,
            venue_id,
            venue:venues(id, name, city)
          )
        `)
        .in("court_id", courtIds)
        .eq("is_booked", true)
        .order("available_date", { ascending: false })
        .order("start_time", { ascending: true });

      if (error) throw error;

      // Get session details for bookings with sessions
      const sessionIds = (bookingsData || [])
        .filter(b => b.booked_by_session_id)
        .map(b => b.booked_by_session_id)
        .filter((id): id is string => id !== null);

      let sessionsMap: Record<string, any> = {};
      if (sessionIds.length > 0) {
        const { data: sessionsData } = await supabase
          .from("sessions")
          .select(`
            id,
            is_cancelled,
            group:groups(name, organizer_id)
          `)
          .in("id", sessionIds);

        sessionsData?.forEach(s => {
          sessionsMap[s.id] = s;
        });

        // Get session players with their profiles
        const { data: sessionPlayersData } = await supabase
          .from("session_players")
          .select(`
            session_id,
            user_id,
            profile:profiles!session_players_user_id_fkey(full_name)
          `)
          .in("session_id", sessionIds);

        // Group players by session
        sessionPlayersData?.forEach(sp => {
          if (!sessionsMap[sp.session_id].players) {
            sessionsMap[sp.session_id].players = [];
          }
          sessionsMap[sp.session_id].players.push({
            user_id: sp.user_id,
            profile: sp.profile
          });
        });
      }

      // Get profiles for all bookings (direct and session-based)
      const userIds = [...new Set(
        (bookingsData || [])
          .filter(b => b.booked_by_user_id)
          .map(b => b.booked_by_user_id)
          .filter((id): id is string => id !== null)
      )];

      let profilesMap: Record<string, any> = {};
      if (userIds.length > 0) {
        const { data: profilesData } = await supabase
          .from("profiles")
          .select("id, user_id, full_name")
          .in("user_id", userIds);

        profilesData?.forEach(p => {
          profilesMap[p.user_id] = { full_name: p.full_name };
        });
      }

      // Combine data
      const enrichedBookings = (bookingsData || []).map(b => ({
        ...b,
        session: b.booked_by_session_id ? sessionsMap[b.booked_by_session_id] : null,
        profile: b.booked_by_user_id ? profilesMap[b.booked_by_user_id] : null,
      }));

      setBookings(enrichedBookings);
    } catch (error) {
      console.error("Error fetching bookings:", error);
    } finally {
      setLoading(false);
    }
  };

  // Filter courts based on selected venue
  const filteredCourts = useMemo(() => {
    if (selectedVenue === "all") return courts;
    return courts.filter(c => c.venue_id === selectedVenue);
  }, [courts, selectedVenue]);

  // Reset court selection and page when venue changes
  useEffect(() => {
    setSelectedCourt("all");
    setCurrentPage(1);
  }, [selectedVenue]);

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [selectedCourt, dateRange, activeTab]);

  // Filter bookings based on status, venue, court, and date range
  const filteredBookings = useMemo(() => {
    const filtered = bookings.filter(booking => {
      // Status filter
      const isSessionCancelled = booking.session?.is_cancelled;
      const isPast = new Date(`${booking.available_date}T${booking.end_time}`) < new Date();

      let matchesStatus = false;
      switch (activeTab) {
        case "active":
          matchesStatus = !isSessionCancelled && !isPast;
          break;
        case "cancelled":
          matchesStatus = !!isSessionCancelled;
          break;
        case "completed":
          matchesStatus = !isSessionCancelled && isPast;
          break;
      }

      // Venue filter
      const courtData = booking.court;
      const matchesVenue = selectedVenue === "all" || courtData?.venue_id === selectedVenue;

      // Court filter
      const matchesCourt = selectedCourt === "all" || booking.court_id === selectedCourt;

      // Date range filter
      let matchesDateRange = true;
      if (dateRange?.from) {
        const bookingDate = new Date(booking.available_date);
        bookingDate.setHours(0, 0, 0, 0);
        
        if (dateRange.to) {
          const startDate = new Date(dateRange.from);
          startDate.setHours(0, 0, 0, 0);
          const endDate = new Date(dateRange.to);
          endDate.setHours(23, 59, 59, 999);
          matchesDateRange = isWithinInterval(bookingDate, { start: startDate, end: endDate });
        } else {
          matchesDateRange = format(bookingDate, "yyyy-MM-dd") === format(dateRange.from, "yyyy-MM-dd");
        }
      }

      return matchesStatus && matchesVenue && matchesCourt && matchesDateRange;
    });

    // Sort by closest date first (ascending), then by start_time
    return filtered.sort((a, b) => {
      const dateCompare = a.available_date.localeCompare(b.available_date);
      if (dateCompare !== 0) return dateCompare;
      return a.start_time.localeCompare(b.start_time);
    });
  }, [bookings, activeTab, selectedVenue, selectedCourt, dateRange]);

  // Paginate filtered bookings
  const paginatedBookings = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return filteredBookings.slice(startIndex, endIndex);
  }, [filteredBookings, currentPage]);

  const totalPages = Math.ceil(filteredBookings.length / itemsPerPage);

  const formatTime = (time: string) => {
    const [hours, minutes] = time.split(":");
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? "PM" : "AM";
    const hour12 = hour % 12 || 12;
    return `${hour12}:${minutes} ${ampm}`;
  };

  const getStatusBadge = (booking: Booking) => {
    const isPast = new Date(`${booking.available_date}T${booking.end_time}`) < new Date();
    
    if (booking.session?.is_cancelled) {
      return <Badge variant="destructive" className="gap-1"><XCircle className="h-3 w-3" /> Cancelled</Badge>;
    }
    if (isPast) {
      return <Badge variant="default" className="gap-1 bg-blue-600"><CheckCircle className="h-3 w-3" /> Completed</Badge>;
    }
    if (booking.payment_status === "completed") {
      return <Badge variant="default" className="gap-1 bg-green-600"><CheckCircle className="h-3 w-3" /> Paid</Badge>;
    }
    return <Badge variant="secondary" className="gap-1"><AlertCircle className="h-3 w-3" /> Pending</Badge>;
  };

  const getBookerName = (booking: Booking) => {
    // For session bookings, show player names or group name
    if (booking.session) {
      const players = booking.session.players || [];
      if (players.length > 0) {
        const playerNames = players
          .map(p => p.profile?.full_name)
          .filter(Boolean);
        
        if (playerNames.length > 0) {
          if (playerNames.length === 1) {
            return playerNames[0];
          } else if (playerNames.length === 2) {
            return playerNames.join(" & ");
          } else {
            return `${playerNames[0]} +${playerNames.length - 1} others`;
          }
        }
      }
      
      // Fallback to group name if no players found
      if (booking.session.group?.name) {
        return booking.session.group.name;
      }
    }
    
    // Fallback to booker profile (works for both direct and session bookings)
    if (booking.profile?.full_name) {
      return booking.profile.full_name;
    }
    
    return "Unknown";
  };


  const BookingCard = ({ booking }: { booking: Booking }) => {
    const courtData = booking.court;
    const venueData = courtData?.venue;
    const isPast = new Date(`${booking.available_date}T${booking.end_time}`) < new Date();
    const isCancelled = booking.session?.is_cancelled;
    const canReschedule = !isPast && !isCancelled;

    return (
      <Card className="overflow-hidden">
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
            <div className="flex-1 min-w-0 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <h3 className="font-semibold truncate">{getBookerName(booking)}</h3>
                <div className="flex items-center gap-2 shrink-0">
                  {getStatusBadge(booking)}
                  {canReschedule && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-xs h-7"
                      onClick={() => setRescheduleBooking(booking)}
                    >
                      <CalendarDays className="h-3 w-3 mr-1" />
                      Reschedule
                    </Button>
                  )}
                </div>
              </div>
              
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                <div className="flex items-center gap-1">
                  <Calendar className="h-3.5 w-3.5" />
                  {format(new Date(booking.available_date), "EEE, MMM d, yyyy")}
                </div>
                <div className="flex items-center gap-1">
                  <Clock className="h-3.5 w-3.5" />
                  {formatTime(booking.start_time)} - {formatTime(booking.end_time)}
                </div>
              </div>
              
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                <div className="flex items-center gap-1">
                  <MapPin className="h-3.5 w-3.5" />
                  {venueData?.name || "Unknown Venue"} - {courtData?.name || "Unknown Court"}
                </div>
                {courtData?.hourly_rate && (
                  <div className="flex items-center gap-1 text-primary font-medium">
                    <DollarSign className="h-3.5 w-3.5" />
                    {courtData.hourly_rate}/hr
                  </div>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <ManagerLayout>
      <div className="p-4 md:p-6 space-y-6">
        {/* Header */}
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
                    {venues.map(venue => (
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
                    {filteredCourts.map(court => (
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
                        <Button
                          variant="outline"
                          className="w-full"
                          onClick={() => setDateRange(undefined)}
                        >
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
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as BookingStatus)}>
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

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : (
            <>
              <TabsContent value="active" className="mt-4 space-y-3">
                {filteredBookings.length === 0 ? (
                  <Card>
                    <CardContent className="py-12 text-center">
                      <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                      <h3 className="font-semibold text-lg mb-2">No active bookings</h3>
                      <p className="text-muted-foreground">
                        Active bookings will appear here when customers book your venues.
                      </p>
                    </CardContent>
                  </Card>
                ) : (
                  <>
                    {paginatedBookings.map(booking => (
                      <BookingCard key={booking.id} booking={booking} />
                    ))}
                    {totalPages > 1 && (
                      <div className="flex items-center justify-between pt-4">
                        <p className="text-sm text-muted-foreground">
                          Showing {((currentPage - 1) * itemsPerPage) + 1} to {Math.min(currentPage * itemsPerPage, filteredBookings.length)} of {filteredBookings.length} bookings
                        </p>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
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
                            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                            disabled={currentPage === totalPages}
                          >
                            Next
                            <ChevronRight className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </TabsContent>

              <TabsContent value="cancelled" className="mt-4 space-y-3">
                {filteredBookings.length === 0 ? (
                  <Card>
                    <CardContent className="py-12 text-center">
                      <XCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                      <h3 className="font-semibold text-lg mb-2">No cancelled bookings</h3>
                      <p className="text-muted-foreground">
                        Cancelled bookings will appear here.
                      </p>
                    </CardContent>
                  </Card>
                ) : (
                  <>
                    {paginatedBookings.map(booking => (
                      <BookingCard key={booking.id} booking={booking} />
                    ))}
                    {totalPages > 1 && (
                      <div className="flex items-center justify-between pt-4">
                        <p className="text-sm text-muted-foreground">
                          Showing {((currentPage - 1) * itemsPerPage) + 1} to {Math.min(currentPage * itemsPerPage, filteredBookings.length)} of {filteredBookings.length} bookings
                        </p>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
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
                            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                            disabled={currentPage === totalPages}
                          >
                            Next
                            <ChevronRight className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </TabsContent>

              <TabsContent value="completed" className="mt-4 space-y-3">
                {filteredBookings.length === 0 ? (
                  <Card>
                    <CardContent className="py-12 text-center">
                      <CheckCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                      <h3 className="font-semibold text-lg mb-2">No completed bookings</h3>
                      <p className="text-muted-foreground">
                        Completed bookings will appear here.
                      </p>
                    </CardContent>
                  </Card>
                ) : (
                  <>
                    {paginatedBookings.map(booking => (
                      <BookingCard key={booking.id} booking={booking} />
                    ))}
                    {totalPages > 1 && (
                      <div className="flex items-center justify-between pt-4">
                        <p className="text-sm text-muted-foreground">
                          Showing {((currentPage - 1) * itemsPerPage) + 1} to {Math.min(currentPage * itemsPerPage, filteredBookings.length)} of {filteredBookings.length} bookings
                        </p>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
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
                            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                            disabled={currentPage === totalPages}
                          >
                            Next
                            <ChevronRight className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </TabsContent>
            </>
          )}
        </Tabs>
      </div>

      {rescheduleBooking && (
        <RescheduleBookingDialog
          open={!!rescheduleBooking}
          onOpenChange={(open) => { if (!open) setRescheduleBooking(null); }}
          bookingId={rescheduleBooking.id}
          courtId={rescheduleBooking.court_id}
          venueId={rescheduleBooking.court?.venue_id || ""}
          currentDate={rescheduleBooking.available_date}
          currentStartTime={rescheduleBooking.start_time}
          currentEndTime={rescheduleBooking.end_time}
          onSuccess={fetchData}
        />
      )}
    </ManagerLayout>
  );
}
