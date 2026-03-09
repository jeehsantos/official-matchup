import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { MapPin, Clock, CalendarDays, Phone } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { format, parseISO } from "date-fns";
import { useTranslation } from "react-i18next";
import type { UpcomingBookingInfo } from "@/hooks/useManagerDashboard";
import { RescheduleBookingDialog } from "@/components/manager/RescheduleBookingDialog";

interface UpcomingBookingsProps {
  bookings: UpcomingBookingInfo[];
  loading: boolean;
  onRefresh?: () => void;
}

function getPaymentBadge(status: string, t: (key: string) => string) {
  switch (status) {
    case "completed":
      return <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-200 dark:border-emerald-800 text-[10px]">{t("dashboard.confirmed")}</Badge>;
    case "pending":
      return <Badge className="bg-amber-500/10 text-amber-600 border-amber-200 dark:border-amber-800 text-[10px]">{t("dashboard.pending")}</Badge>;
    case "failed":
    case "cancelled":
      return <Badge className="bg-destructive/10 text-destructive border-destructive/20 text-[10px]">{t("dashboard.cancelled")}</Badge>;
    default:
      return <Badge variant="outline" className="text-[10px]">{status.toUpperCase()}</Badge>;
  }
}

export function UpcomingBookings({ bookings, loading, onRefresh }: UpcomingBookingsProps) {
  const { t } = useTranslation("manager");
  const [rescheduleBooking, setRescheduleBooking] = useState<UpcomingBookingInfo | null>(null);

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{t("dashboard.upcomingBookings")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-20 rounded-lg" />
          ))}
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">{t("dashboard.upcomingBookings")}</CardTitle>
        </CardHeader>
        <CardContent>
          {bookings.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              {t("dashboard.noUpcomingBookings")}
            </div>
          ) : (
            <div className="space-y-3 max-h-[400px] overflow-y-auto scrollbar-hide">
              {bookings.map((booking) => {
                const durationHours = Math.floor(booking.durationMinutes / 60);
                const durationMins = booking.durationMinutes % 60;
                const durationStr = durationHours > 0
                  ? `${durationHours}h${durationMins > 0 ? ` ${durationMins}m` : ""}`
                  : `${durationMins}m`;

                return (
                  <div key={booking.id} className="flex items-start gap-3 p-3 rounded-lg border border-border/50 hover:bg-muted/30 transition-colors">
                    <Avatar className="h-9 w-9 shrink-0">
                      <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
                        {booking.bookerInitials}
                      </AvatarFallback>
                    </Avatar>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <p className="font-medium text-sm truncate">{booking.bookerName}</p>
                            {booking.bookerPhone && (
                              <a
                                href={`tel:${booking.bookerPhone}`}
                                className="inline-flex items-center gap-0.5 text-[10px] text-muted-foreground hover:text-primary transition-colors shrink-0"
                                title={booking.bookerPhone}
                              >
                                <Phone className="h-2.5 w-2.5" />
                                <span className="hidden sm:inline">{booking.bookerPhone}</span>
                              </a>
                            )}
                          </div>
                          <p className="text-[10px] text-muted-foreground">{booking.bookingRef}</p>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          {getPaymentBadge(booking.paymentStatus, t)}
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 px-1.5 text-[10px]"
                            onClick={() => setRescheduleBooking(booking)}
                          >
                            <CalendarDays className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>

                      <div className="mt-2 grid grid-cols-2 gap-x-4 text-xs text-muted-foreground">
                        <div className="flex items-center gap-1.5">
                          <MapPin className="h-3 w-3" />
                          <span className="truncate">{booking.courtName}</span>
                        </div>
                        <div className="flex items-center gap-1.5 justify-end">
                          <Clock className="h-3 w-3" />
                          <span>
                            {booking.startTime} ({durationStr})
                          </span>
                        </div>
                      </div>

                      <p className="text-[10px] text-muted-foreground mt-1">
                        {booking.date === format(new Date(), "yyyy-MM-dd")
                          ? <span className="font-semibold text-primary">{t("dashboard.todayLabel")}</span>
                          : format(parseISO(booking.date), "EEE, MMM d")}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {rescheduleBooking && (
        <RescheduleBookingDialog
          open={!!rescheduleBooking}
          onOpenChange={(open) => { if (!open) setRescheduleBooking(null); }}
          bookingId={rescheduleBooking.id}
          courtId={rescheduleBooking.courtId}
          venueId={rescheduleBooking.venueId}
          currentDate={rescheduleBooking.date}
          currentStartTime={rescheduleBooking.rawStartTime}
          currentEndTime={rescheduleBooking.rawEndTime}
          onSuccess={() => onRefresh?.()}
        />
      )}
    </>
  );
}
