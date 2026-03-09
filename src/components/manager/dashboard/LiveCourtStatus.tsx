import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Clock, CheckCircle2, Timer } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { useTranslation } from "react-i18next";
import type { LiveCourtInfo } from "@/hooks/useManagerDashboard";

interface LiveCourtStatusProps {
  courts: LiveCourtInfo[];
  loading: boolean;
}

function getStatusConfig(status: LiveCourtInfo["status"], t: (key: string) => string) {
  switch (status) {
    case "in_use":
      return {
        label: t("dashboard.inUse"),
        className: "bg-blue-500/10 text-blue-600 border-blue-200 dark:border-blue-800",
        cardBorder: "border-l-4 border-l-blue-500",
      };
    case "upcoming":
      return {
        label: t("dashboard.upcoming"),
        className: "bg-amber-500/10 text-amber-600 border-amber-200 dark:border-amber-800",
        cardBorder: "border-l-4 border-l-amber-500",
      };
    case "available":
    default:
      return {
        label: t("dashboard.available"),
        className: "bg-emerald-500/10 text-emerald-600 border-emerald-200 dark:border-emerald-800",
        cardBorder: "border-l-4 border-l-emerald-500",
      };
  }
}

function getSportLabel(sports: string[] | null): string {
  if (!sports || sports.length === 0) return "Multi-sport";
  return sports[0].charAt(0).toUpperCase() + sports[0].slice(1).replace(/_/g, " ");
}

export function LiveCourtStatus({ courts, loading }: LiveCourtStatusProps) {
  const { t } = useTranslation("manager");

  if (loading) {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
          <h2 className="text-lg font-semibold">{t("dashboard.liveCourtStatus")}</h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-28 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  if (courts.length === 0) {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
          <h2 className="text-lg font-semibold">{t("dashboard.liveCourtStatus")}</h2>
        </div>
        <Card>
          <CardContent className="p-6 text-center text-muted-foreground">
            {t("dashboard.noCourtsFound")}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
        <h2 className="text-lg font-semibold">{t("dashboard.liveCourtStatus")}</h2>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {courts.map((item) => {
          const config = getStatusConfig(item.status, t);
          return (
            <Card key={item.court.id} className={`${config.cardBorder} overflow-hidden`}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between mb-3">
                  <div className="min-w-0">
                    <p className="font-semibold truncate">{item.court.name}</p>
                    <p className="text-xs text-muted-foreground">{getSportLabel(item.court.allowed_sports)}</p>
                  </div>
                  <Badge className={`${config.className} text-[10px] shrink-0`}>
                    {config.label}
                  </Badge>
                </div>

                {item.status === "in_use" && item.currentBooking && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm">
                      <Timer className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="font-medium">{item.currentBooking.bookerName}</span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {item.currentBooking.remainingMinutes}m {t("dashboard.remaining")}
                    </p>
                    <Progress value={item.currentBooking.progressPercent} className="h-1.5" />
                  </div>
                )}

                {item.status === "upcoming" && item.nextBooking && (
                  <div className="flex items-center gap-2 text-sm">
                    <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                    <div>
                      <span className="font-medium">{item.nextBooking.bookerName}</span>
                      <p className="text-xs text-muted-foreground">
                        {t("dashboard.startsIn")} {item.nextBooking.startsInMinutes}m
                      </p>
                    </div>
                  </div>
                )}

                {item.status === "available" && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                    <span>{t("dashboard.noActiveBooking")}</span>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
