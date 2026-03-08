import { Card, CardContent } from "@/components/ui/card";
import { Calendar, DollarSign, TrendingUp } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useTranslation } from "react-i18next";
import type { DashboardStats } from "@/hooks/useManagerDashboard";

interface StatsCardsProps {
  stats: DashboardStats;
  loading: boolean;
  periodLabel: string;
}

export function StatsCards({ stats, loading, periodLabel }: StatsCardsProps) {
  const { t } = useTranslation("manager");

  const cards = [
    {
      label: `${periodLabel} ${t("dashboard.bookings")}`,
      value: stats.totalBookings.toLocaleString(),
      icon: Calendar,
      iconBg: "bg-primary/10",
      iconColor: "text-primary",
    },
    {
      label: `${t("dashboard.revenue")} (${periodLabel})`,
      value: `$${stats.revenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      icon: DollarSign,
      iconBg: "bg-accent/20",
      iconColor: "text-accent-foreground",
    },
    {
      label: t("dashboard.utilizationRate"),
      value: `${stats.utilizationRate}%`,
      icon: TrendingUp,
      iconBg: "bg-secondary/50",
      iconColor: "text-secondary-foreground",
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
      {cards.map((card) => (
        <Card key={card.label}>
          <CardContent className="p-4 sm:p-5">
            <div className="flex items-start gap-3">
              <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-xl ${card.iconBg} flex items-center justify-center shrink-0`}>
                <card.icon className={`h-5 w-5 sm:h-6 sm:w-6 ${card.iconColor}`} />
              </div>
              <div className="min-w-0">
                <p className="text-xs sm:text-sm text-muted-foreground truncate">{card.label}</p>
                {loading ? (
                  <Skeleton className="h-7 w-24 mt-1" />
                ) : (
                  <p className="text-xl sm:text-2xl font-bold truncate">{card.value}</p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
