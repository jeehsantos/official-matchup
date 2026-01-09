import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { ManagerLayout } from "@/components/layout/ManagerLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Building2,
  Calendar,
  DollarSign,
  TrendingUp,
  Plus,
  ArrowRight,
  XCircle,
  MessageCircle,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { format } from "date-fns";

type RecentBooking = {
  id: string;
  available_date: string;
  start_time: string;
  end_time: string;
  payment_status?: string;
  courts?: { name: string } | null;
  organizer_name?: string;
  booked_by_user_id?: string;
  booked_by_session_id?: string;
  is_cancelled?: boolean;
};

export default function ManagerDashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState({
    courts: 0,
    upcomingBookings: 0,
    revenue: 0,
  });
  const [recentBookings, setRecentBookings] = useState<RecentBooking[]>([]);
  const [cancelledBookings, setCancelledBookings] = useState<RecentBooking[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("active");

  useEffect(() => {
    if (user) {
      fetchStats();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const fetchStats = async () => {
    try {
      // Fetch venues owned by user
      const { data: venues, error: venuesError } = await supabase
        .from("venues")
        .select("id")
        .eq("owner_id", user?.id);

      if (venuesError) throw venuesError;

      const venueIds = (venues || []).map((v) => v.id);

      // Fetch courts under those venues
      const { data: courtsData, error: courtsError } = await supabase
        .from("courts")
        .select("id")
        .in("venue_id", venueIds)
        .eq("is_active", true);

      if (courtsError) throw courtsError;

      const courtIds = (courtsData || []).map((c) => c.id);
      const courtsCount = courtIds.length;

      let upcomingBookings = 0;
      let recent: RecentBooking[] = [];
      let cancelled: RecentBooking[] = [];

      if (courtIds.length > 0) {
        const today = format(new Date(), "yyyy-MM-dd");

        // Fetch all bookings with session info to check cancellation status
        const { data: allBookings, error: allError } = await supabase
          .from("court_availability")
          .select(`
            id, 
            available_date, 
            start_time, 
            end_time, 
            payment_status, 
            booked_by_user_id,
            booked_by_session_id,
            courts(name)
          `)
          .in("court_id", courtIds)
          .eq("is_booked", true)
          .order("available_date", { ascending: true })
          .order("start_time", { ascending: true });

        if (allError) throw allError;

        // Get session cancellation status and organizer names
        const bookingsWithDetails = await Promise.all(
          (allBookings || []).map(async (booking) => {
            let isCancelled = false;
            let organizerName = "Unknown";

            // Check if session is cancelled
            if (booking.booked_by_session_id) {
              const { data: session } = await supabase
                .from("sessions")
                .select("is_cancelled")
                .eq("id", booking.booked_by_session_id)
                .maybeSingle();
              
              isCancelled = session?.is_cancelled || false;
            }

            // Get organizer name
            if (booking.booked_by_user_id) {
              const { data: profile } = await supabase
                .from("profiles")
                .select("full_name")
                .eq("user_id", booking.booked_by_user_id)
                .maybeSingle();
              
              organizerName = profile?.full_name || "Unknown";
            }

            return {
              ...booking,
              is_cancelled: isCancelled,
              organizer_name: organizerName,
            } as RecentBooking;
          })
        );

        // Separate active and cancelled bookings
        const activeBookings = bookingsWithDetails.filter(b => !b.is_cancelled);
        cancelled = bookingsWithDetails.filter(b => b.is_cancelled);

        // Count upcoming active bookings
        upcomingBookings = activeBookings.filter(
          b => b.available_date >= today
        ).length;

        // Get recent active bookings (limit 5)
        recent = activeBookings.slice(0, 5);
      }

      setRecentBookings(recent);
      setCancelledBookings(cancelled);
      setStats({
        courts: courtsCount,
        upcomingBookings,
        revenue: 0,
      });
    } catch (error) {
      console.error("Error fetching stats:", error);
    } finally {
      setLoading(false);
    }
  };

  const statCards = [
    { label: "My Courts", value: stats.courts, icon: Building2, color: "text-blue-500" },
    {
      label: "Upcoming Bookings",
      value: stats.upcomingBookings,
      icon: TrendingUp,
      color: "text-orange-500",
    },
    { label: "This Month", value: `$${stats.revenue}`, icon: DollarSign, color: "text-primary" },
  ];

  const BookingItem = ({ booking, showCancelled = false }: { booking: RecentBooking; showCancelled?: boolean }) => (
    <div className="flex items-center justify-between gap-3 py-2">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="font-medium truncate">{booking.courts?.name || "Court"}</span>
          {showCancelled && (
            <Badge variant="destructive" className="text-xs">Cancelled</Badge>
          )}
        </div>
        <div className="text-sm text-muted-foreground">
          {format(new Date(booking.available_date), "MMM d")} • {booking.start_time.slice(0, 5)} - {booking.end_time.slice(0, 5)}
        </div>
        <div className="text-sm text-muted-foreground flex items-center gap-1 mt-0.5">
          <span>Booked by:</span>
          <span className="font-medium text-foreground">{booking.organizer_name}</span>
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        {!showCancelled && (
          <>
            <Badge>{booking.payment_status === "completed" ? "Paid" : "Booked"}</Badge>
            {booking.payment_status !== "completed" && (
              <Badge variant="secondary">Pending</Badge>
            )}
          </>
        )}
      </div>
    </div>
  );

  return (
    <ManagerLayout>
      <div className="p-4 md:p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-display text-2xl font-bold">Dashboard</h1>
            <p className="text-muted-foreground">Manage your courts and bookings</p>
          </div>
          <Link to="/manager/courts/new">
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              Add Court
            </Button>
          </Link>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {statCards.map((stat) => (
            <Card key={stat.label}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <stat.icon className={`h-5 w-5 ${stat.color}`} />
                </div>
                <div className="text-2xl font-bold">{loading ? "—" : stat.value}</div>
                <div className="text-sm text-muted-foreground">{stat.label}</div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Quick Actions */}
        <div className="grid md:grid-cols-2 gap-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Your Courts</CardTitle>
            </CardHeader>
            <CardContent>
              {stats.courts === 0 ? (
                <div className="text-center py-8">
                  <Building2 className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground mb-4">No courts yet</p>
                  <Link to="/manager/courts/new">
                    <Button>Add Your First Court</Button>
                  </Link>
                </div>
              ) : (
                <Link to="/manager/courts">
                  <Button variant="outline" className="w-full justify-between">
                    Manage Courts
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </Link>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Availability</CardTitle>
            </CardHeader>
            <CardContent>
              {stats.courts === 0 ? (
                <div className="text-center py-8">
                  <Calendar className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground mb-4">Add courts first</p>
                  <Link to="/manager/courts/new">
                    <Button variant="outline">Add Court</Button>
                  </Link>
                </div>
              ) : (
                <Link to="/manager/availability">
                  <Button variant="outline" className="w-full justify-between">
                    Manage Availability
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </Link>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Bookings with Tabs */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              Bookings
              {cancelledBookings.length > 0 && (
                <Badge variant="outline" className="text-xs">
                  {cancelledBookings.length} cancelled
                </Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="mb-4">
                <TabsTrigger value="active" className="gap-2">
                  <Calendar className="h-4 w-4" />
                  Active ({recentBookings.length})
                </TabsTrigger>
                <TabsTrigger value="cancelled" className="gap-2">
                  <XCircle className="h-4 w-4" />
                  Cancelled ({cancelledBookings.length})
                </TabsTrigger>
              </TabsList>

              <TabsContent value="active">
                {recentBookings.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <p>No active bookings. Publish availability to start receiving bookings.</p>
                  </div>
                ) : (
                  <div className="divide-y">
                    {recentBookings.map((b) => (
                      <BookingItem key={b.id} booking={b} />
                    ))}
                  </div>
                )}
              </TabsContent>

              <TabsContent value="cancelled">
                {cancelledBookings.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <p>No cancelled bookings.</p>
                  </div>
                ) : (
                  <div className="divide-y">
                    {cancelledBookings.map((b) => (
                      <BookingItem key={b.id} booking={b} showCancelled />
                    ))}
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        {/* Messages Info */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <MessageCircle className="h-5 w-5 text-primary" />
              </div>
              <div className="flex-1">
                <p className="font-medium">Chat with Organizers</p>
                <p className="text-sm text-muted-foreground">
                  Use the chat widget in the bottom right to communicate with organizers who have booked your courts.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </ManagerLayout>
  );
}