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
  ArrowRight
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";

export default function ManagerDashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState({
    venues: 0,
    courts: 0,
    upcomingBookings: 0,
    revenue: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchStats();
    }
  }, [user]);

  const fetchStats = async () => {
    try {
      // Fetch venues count
      const { count: venuesCount } = await supabase
        .from("venues")
        .select("*", { count: "exact", head: true })
        .eq("owner_id", user?.id);

      // Fetch courts count through venues
      const { data: venues } = await supabase
        .from("venues")
        .select("id")
        .eq("owner_id", user?.id);

      let courtsCount = 0;
      if (venues && venues.length > 0) {
        const venueIds = venues.map(v => v.id);
        const { count } = await supabase
          .from("courts")
          .select("*", { count: "exact", head: true })
          .in("venue_id", venueIds);
        courtsCount = count || 0;
      }

      setStats({
        venues: venuesCount || 0,
        courts: courtsCount,
        upcomingBookings: 0, // Will implement with availability
        revenue: 0, // Will implement with payments
      });
    } catch (error) {
      console.error("Error fetching stats:", error);
    } finally {
      setLoading(false);
    }
  };

  const statCards = [
    { label: "Venues", value: stats.venues, icon: Building2, color: "text-blue-500" },
    { label: "Courts", value: stats.courts, icon: Calendar, color: "text-green-500" },
    { label: "Upcoming Bookings", value: stats.upcomingBookings, icon: TrendingUp, color: "text-orange-500" },
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
          <Link to="/manager/venues/new">
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              Add Venue
            </Button>
          </Link>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {statCards.map((stat) => (
            <Card key={stat.label}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <stat.icon className={`h-5 w-5 ${stat.color}`} />
                </div>
                <div className="text-2xl font-bold">{stat.value}</div>
                <div className="text-sm text-muted-foreground">{stat.label}</div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Quick Actions */}
        <div className="grid md:grid-cols-2 gap-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Your Venues</CardTitle>
            </CardHeader>
            <CardContent>
              {stats.venues === 0 ? (
                <div className="text-center py-8">
                  <Building2 className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground mb-4">No venues yet</p>
                  <Link to="/manager/venues/new">
                    <Button>Add Your First Venue</Button>
                  </Link>
                </div>
              ) : (
                <Link to="/manager/venues">
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
              {stats.courts === 0 ? (
                <div className="text-center py-8">
                  <Calendar className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground mb-4">Add courts first</p>
                  <Link to="/manager/venues">
                    <Button variant="outline">Go to Venues</Button>
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
            <div className="text-center py-8 text-muted-foreground">
              <p>No bookings yet. Publish availability to start receiving bookings.</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </ManagerLayout>
  );
}
