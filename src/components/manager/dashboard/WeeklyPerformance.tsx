import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { useTranslation } from "react-i18next";
import type { DailyPerformance } from "@/hooks/useManagerDashboard";

interface WeeklyPerformanceProps {
  data: DailyPerformance[];
  loading: boolean;
  periodLabel?: string;
}

export function WeeklyPerformance({ data, loading, periodLabel = "Weekly" }: WeeklyPerformanceProps) {
  const { t } = useTranslation("manager");

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{periodLabel} {t("dashboard.performance")}</CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-64 w-full rounded-lg" />
        </CardContent>
      </Card>
    );
  }

  const hasData = data.some((d) => d.revenue > 0 || d.bookings > 0);

  return (
    <Card className="flex flex-col">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">{periodLabel} {t("dashboard.performance")}</CardTitle>
          <div className="flex items-center gap-4 text-xs">
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-sm bg-primary" />
              <span className="text-muted-foreground">{t("dashboard.revenueLabel")}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-sm bg-emerald-400" />
              <span className="text-muted-foreground">{t("dashboard.bookingsLabel")}</span>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex-1 min-h-0">
        {!hasData ? (
          <div className="h-full min-h-[13rem] flex items-center justify-center text-sm text-muted-foreground">
            {t("dashboard.noPerformanceData")}
          </div>
        ) : (
          <div className="w-full aspect-[16/9] min-h-[13rem] max-h-[20rem]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data} barCategoryGap="20%" margin={{ top: 5, right: 5, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                <XAxis dataKey="day" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" tickLine={false} axisLine={false} />
                <YAxis yAxisId="left" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" tickLine={false} axisLine={false} />
                <YAxis yAxisId="right" orientation="right" hide />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "8px",
                    fontSize: "12px",
                  }}
                  formatter={(value: number, name: string) => [
                    name === "revenue" ? `$${value.toFixed(2)}` : value,
                    name === "revenue" ? t("dashboard.revenueLabel") : t("dashboard.bookingsLabel"),
                  ]}
                />
                <Bar yAxisId="left" dataKey="revenue" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} maxBarSize={40} />
                <Bar yAxisId="right" dataKey="bookings" fill="#34d399" radius={[4, 4, 0, 0]} maxBarSize={40} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
