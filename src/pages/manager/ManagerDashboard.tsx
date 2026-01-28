import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { ManagerLayout } from "@/components/layout/ManagerLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Building2,
  Calendar,
  DollarSign,
  TrendingUp,
  Plus,
  ArrowRight,
  MessageCircle,
  CreditCard,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { format } from "date-fns";

export default function ManagerDashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState({
    venues: 0,
    upcomingBookings: 0,
    revenue: 0,
  });
  const [loading, setLoading] = useState(true);

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

      // Fetch parent courts (venues) only
      const { data: courtsData, error: courtsError } = await supabase
        .from("courts")
        .select("id")
        .in("venue_id", venueIds)
        .eq("is_active", true)
        .is("parent_court_id", null);

      if (courtsError) throw courtsError;

      // Get all courts including sub-courts for booking counting
      const { data: allCourts } = await supabase
        .from("courts")
        .select("id")
        .in("venue_id", venueIds)
        .eq("is_active", true);

      const courtIds = (allCourts || []).map((c) => c.id);
      const venuesCount = courtsData?.length || 0;

      let upcomingBookings = 0;
      let monthlyRevenue = 0;

      if (courtIds.length > 0) {
        const today = format(new Date(), "yyyy-MM-dd");

        // Count upcoming active bookings
        const { count: bookingCount } = await supabase
          .from("court_availability")
          .select("id", { count: "exact", head: true })
          .in("court_id", courtIds)
          .eq("is_booked", true)
          .gte("available_date", today);

        upcomingBookings = bookingCount || 0;

        // Calculate monthly revenue from completed payments
        const { data: allBookings } = await supabase
          .from("court_availability")
          .select("booked_by_session_id, payment_status")
          .in("court_id", courtIds)
          .eq("is_booked", true)
          .eq("payment_status", "completed");

        const sessionIds = allBookings
          ?.filter(b => b.booked_by_session_id)
          .map(b => b.booked_by_session_id) || [];

        if (sessionIds.length > 0) {
          const { data: payments } = await supabase
            .from("payments")
            .select("amount, platform_fee, paid_at")
            .in("session_id", sessionIds)
            .eq("status", "completed")
            .gte("paid_at", new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString());

          if (payments) {
            monthlyRevenue = payments.reduce((sum, p) => {
              const netAmount = Number(p.amount) - Number(p.platform_fee || 0);
              return sum + netAmount;
            }, 0);
          }
        }
      }

      setStats({
        venues: venuesCount,
        upcomingBookings,
        revenue: monthlyRevenue,
      });
    } catch (error) {
      console.error("Error fetching stats:", error);
    } finally {
      setLoading(false);
    }
  };

  const statCards = [
    { label: "My Venues", value: stats.venues, icon: Building2, color: "text-blue-500" },
    {
      label: "Upcoming Bookings",
      value: stats.upcomingBookings,
      icon: TrendingUp,
      color: "text-orange-500",
    },
    { label: "This Month", value: `$${stats.revenue.toFixed(2)}`, icon: DollarSign, color: "text-primary" },
  ];

  return (
    <ManagerLayout>
      <div className="p-4 md:p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-display text-2xl font-bold">Dashboard</h1>
            <p className="text-muted-foreground">Manage your venues and bookings</p>
          </div>
          <Link to="/manager/courts/new">
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              Add Venue
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
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Your Venues</CardTitle>
            </CardHeader>
            <CardContent>
              {stats.venues === 0 ? (
                <div className="text-center py-8">
                  <Building2 className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground mb-4">No venues yet</p>
                  <Link to="/manager/courts/new">
                    <Button>Add Your First Venue</Button>
                  </Link>
                </div>
              ) : (
                <Link to="/manager/courts">
                  <Button variant="outline" className="w-full justify-between">
                    Manage Venues
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
              {stats.venues === 0 ? (
                <div className="text-center py-8">
                  <Calendar className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground mb-4">Add venues first</p>
                  <Link to="/manager/courts/new">
                    <Button variant="outline">Add Venue</Button>
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

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Bookings</CardTitle>
            </CardHeader>
            <CardContent>
              {stats.upcomingBookings === 0 ? (
                <div className="text-center py-8">
                  <CreditCard className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground mb-4">No bookings yet</p>
                  <Link to="/manager/bookings">
                    <Button variant="outline">View Bookings</Button>
                  </Link>
                </div>
              ) : (
                <Link to="/manager/bookings">
                  <Button variant="outline" className="w-full justify-between">
                    View All Bookings
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </Link>
              )}
            </CardContent>
          </Card>
        </div>

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
                  Use the chat widget in the bottom right to communicate with organizers who have booked your venues.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </ManagerLayout>
  );
}
