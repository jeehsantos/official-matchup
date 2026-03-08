import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { MapPin, Clock } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { format, parseISO } from "date-fns";
import type { UpcomingBookingInfo } from "@/hooks/useManagerDashboard";

interface UpcomingBookingsProps {
  bookings: UpcomingBookingInfo[];
  loading: boolean;
}

function getPaymentBadge(status: string) {
  switch (status) {
    case "completed":
      return <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-200 dark:border-emerald-800 text-[10px]">CONFIRMED</Badge>;
    case "pending":
      return <Badge className="bg-amber-500/10 text-amber-600 border-amber-200 dark:border-amber-800 text-[10px]">PENDING</Badge>;
    case "failed":
    case "cancelled":
      return <Badge className="bg-destructive/10 text-destructive border-destructive/20 text-[10px]">CANCELLED</Badge>;
    default:
      return <Badge variant="outline" className="text-[10px]">{status.toUpperCase()}</Badge>;
  }
}

export function UpcomingBookings({ bookings, loading }: UpcomingBookingsProps) {
  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Upcoming Bookings</CardTitle>
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
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-lg">Upcoming Bookings</CardTitle>
      </CardHeader>
      <CardContent>
        {bookings.length === 0 ? (
          <div className="py-8 text-center text-sm text-muted-foreground">
            No upcoming bookings.
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
                        <p className="font-medium text-sm truncate">{booking.bookerName}</p>
                        <p className="text-[10px] text-muted-foreground">{booking.bookingRef}</p>
                      </div>
                      {getPaymentBadge(booking.paymentStatus)}
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
                        ? <span className="font-semibold text-primary">Today</span>
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
  );
}
