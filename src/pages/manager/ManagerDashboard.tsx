import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { ManagerLayout } from "@/components/layout/ManagerLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Building2,
  Calendar,
  DollarSign,
  TrendingUp,
  Plus,
  ArrowRight,
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
};

export default function ManagerDashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState({
    courts: 0,
    upcomingBookings: 0,
    revenue: 0,
  });
  const [recentBookings, setRecentBookings] = useState<RecentBooking[]>([]);
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

      if (courtIds.length > 0) {
        const today = format(new Date(), "yyyy-MM-dd");

        const { count: upcomingCount, error: countError } = await supabase
          .from("court_availability")
          .select("*", { count: "exact", head: true })
          .in("court_id", courtIds)
          .eq("is_booked", true)
          .gte("available_date", today);

        if (countError) throw countError;
        upcomingBookings = upcomingCount || 0;

        const { data: recentData, error: recentError } = await supabase
          .from("court_availability")
          .select("id, available_date, start_time, end_time, payment_status, courts(name)")
          .in("court_id", courtIds)
          .eq("is_booked", true)
          .order("available_date", { ascending: true })
          .order("start_time", { ascending: true })
          .limit(5);

        if (recentError) throw recentError;
        recent = (recentData as any) || [];
      }

      setRecentBookings(recent);
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

        {/* Recent Bookings */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Recent Bookings</CardTitle>
          </CardHeader>
          <CardContent>
            {recentBookings.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <p>No bookings yet. Publish availability to start receiving bookings.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {recentBookings.map((b) => (
                  <div key={b.id} className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="font-medium truncate">{b.courts?.name || "Court"}</div>
                      <div className="text-sm text-muted-foreground">
                        {format(new Date(b.available_date), "MMM d")} • {b.start_time.slice(0, 5)} -
                        {" "}
                        {b.end_time.slice(0, 5)}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <Badge>{b.payment_status === "completed" ? "Paid" : "Booked"}</Badge>
                      {b.payment_status !== "completed" && (
                        <Badge variant="secondary">Pending payment</Badge>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </ManagerLayout>
  );
}

