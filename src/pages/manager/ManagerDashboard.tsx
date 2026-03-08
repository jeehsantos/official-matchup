import { useState } from "react";
import { Link } from "react-router-dom";
import { ManagerLayout } from "@/components/layout/ManagerLayout";
import { Button } from "@/components/ui/button";
import { Plus, Calendar as CalendarIcon } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { useUserProfile } from "@/hooks/useUserProfile";
import { format } from "date-fns";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useManagerDashboard, type DashboardPeriod } from "@/hooks/useManagerDashboard";
import { StatsCards } from "@/components/manager/dashboard/StatsCards";
import { LiveCourtStatus } from "@/components/manager/dashboard/LiveCourtStatus";
import { WeeklyPerformance } from "@/components/manager/dashboard/WeeklyPerformance";
import { UpcomingBookings } from "@/components/manager/dashboard/UpcomingBookings";
import { useTranslation } from "react-i18next";

export default function ManagerDashboard() {
  const { t } = useTranslation("manager");
  const { user } = useAuth();
  const { profile } = useUserProfile();
  const rawFirstName = profile?.full_name?.split(" ")[0] || "";
  const firstName = rawFirstName.charAt(0).toUpperCase() + rawFirstName.slice(1).toLowerCase();
  const [period, setPeriod] = useState<DashboardPeriod>("monthly");
  const { stats, liveCourts, weeklyPerformance, upcomingBookings, loading, refreshAll } = useManagerDashboard(period);

  const periodLabels: Record<DashboardPeriod, string> = {
    daily: t("dashboard.today"),
    weekly: t("dashboard.thisWeek"),
    monthly: t("dashboard.thisMonth"),
  };

  const today = format(new Date(), "EEEE, MMMM d");

  return (
    <ManagerLayout>
      <div className="p-4 md:p-6 space-y-6 max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="font-display text-xl sm:text-2xl font-bold">
              {t("dashboard.welcomeBack")}{firstName ? `, ${firstName}` : ""}! 👋
            </h1>
            <p className="text-sm text-muted-foreground">
              {t("dashboard.overviewSubtitle")}
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
                <SelectItem value="daily">{t("dashboard.today")}</SelectItem>
                <SelectItem value="weekly">{t("dashboard.thisWeek")}</SelectItem>
                <SelectItem value="monthly">{t("dashboard.thisMonth")}</SelectItem>
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
          <WeeklyPerformance data={weeklyPerformance} loading={loading} periodLabel={periodLabels[period]} />
          <UpcomingBookings bookings={upcomingBookings} loading={loading} onRefresh={refreshAll} />
        </div>
      </div>
    </ManagerLayout>);
}
