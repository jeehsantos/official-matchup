import { useState } from "react";
import { Link } from "react-router-dom";
import { ManagerLayout } from "@/components/layout/ManagerLayout";
import { Button } from "@/components/ui/button";
import { Plus, Calendar as CalendarIcon } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { format } from "date-fns";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useManagerDashboard, type DashboardPeriod } from "@/hooks/useManagerDashboard";
import { StatsCards } from "@/components/manager/dashboard/StatsCards";
import { LiveCourtStatus } from "@/components/manager/dashboard/LiveCourtStatus";
import { WeeklyPerformance } from "@/components/manager/dashboard/WeeklyPerformance";
import { UpcomingBookings } from "@/components/manager/dashboard/UpcomingBookings";

const periodLabels: Record<DashboardPeriod, string> = {
  daily: "Today",
  weekly: "This Week",
  monthly: "This Month",
};

export default function ManagerDashboard() {
  const { user } = useAuth();
  const [period, setPeriod] = useState<DashboardPeriod>("monthly");
  const { stats, liveCourts, weeklyPerformance, upcomingBookings, loading } = useManagerDashboard(period);

  const today = format(new Date(), "EEEE, MMMM d");

  return (
    <ManagerLayout>
      <div className="p-4 md:p-6 space-y-6 max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="font-display text-xl sm:text-2xl font-bold">
              Welcome back! 👋
            </h1>
            <p className="text-sm text-muted-foreground">
              Here's an overview of your venue's performance.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="hidden sm:flex items-center gap-1.5 text-sm text-muted-foreground bg-muted/50 px-3 py-1.5 rounded-lg">
              <CalendarIcon className="h-3.5 w-3.5" />
              {today}
            </div>
            <Select value={period} onValueChange={(v) => setPeriod(v as DashboardPeriod)}>
              <SelectTrigger className="w-[130px] h-9 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="daily">Today</SelectItem>
                <SelectItem value="weekly">This Week</SelectItem>
                <SelectItem value="monthly">This Month</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Stats */}
        <StatsCards stats={stats} loading={loading} periodLabel={periodLabels[period]} />

        {/* Live Court Status */}
        <LiveCourtStatus courts={liveCourts} loading={loading} />

        {/* Charts + Upcoming */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <WeeklyPerformance data={weeklyPerformance} loading={loading} />
          <UpcomingBookings bookings={upcomingBookings} loading={loading} />
        </div>

        {/* Quick action FAB for mobile */}
        <div className="fixed bottom-20 right-4 lg:bottom-6 lg:right-6 z-50">
          <Link to="/manager/courts/new">
            <Button size="lg" className="rounded-full shadow-lg h-12 w-12 lg:h-auto lg:w-auto lg:px-4 lg:rounded-lg">
              <Plus className="h-5 w-5 lg:mr-2" />
              <span className="hidden lg:inline">New Venue</span>
            </Button>
          </Link>
        </div>
      </div>
    </ManagerLayout>
  );
}
