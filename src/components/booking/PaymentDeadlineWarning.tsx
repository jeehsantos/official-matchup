import { AlertTriangle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { CountdownTimer } from "@/components/ui/countdown-timer";
import { format, isPast } from "date-fns";

interface PaymentDeadlineWarningProps {
  paymentDeadline: string;
  compact?: boolean;
}

export function PaymentDeadlineWarning({ paymentDeadline, compact = false }: PaymentDeadlineWarningProps) {
  const deadline = new Date(paymentDeadline);
  const isOverdue = isPast(deadline);

  if (compact) {
    return (
      <div className={`flex items-start gap-2 rounded-lg border p-3 text-sm ${
        isOverdue 
          ? "border-destructive/50 bg-destructive/10 text-destructive" 
          : "border-warning/50 bg-warning/10 text-warning"
      }`}>
        <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
        <div className="flex-1 space-y-1">
          {isOverdue ? (
            <p className="font-semibold">Payment deadline has passed. Your booking will be cancelled shortly.</p>
          ) : (
            <>
              <p className="font-semibold">
                Payment must be completed by {format(deadline, "MMM d, h:mm a")} or your booking will be automatically cancelled.
              </p>
              <CountdownTimer deadline={deadline} />
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <Card className={`border ${isOverdue ? "border-destructive/50 bg-destructive/5" : "border-warning/50 bg-warning/5"}`}>
      <CardContent className="p-4 lg:p-6">
        <div className="flex items-start gap-3">
          <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${
            isOverdue ? "bg-destructive/10" : "bg-warning/10"
          }`}>
            <AlertTriangle className={`h-5 w-5 ${isOverdue ? "text-destructive" : "text-warning"}`} />
          </div>
          <div className="flex-1">
            {isOverdue ? (
              <>
                <p className="font-semibold text-destructive">Payment Deadline Passed</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Your booking will be automatically cancelled shortly because payment was not received before the deadline ({format(deadline, "MMM d, h:mm a")}).
                </p>
              </>
            ) : (
              <>
                <p className={`font-semibold text-warning`}>Payment Deadline Approaching</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Payment must be completed by <span className="font-semibold">{format(deadline, "MMM d, h:mm a")}</span> or your booking will be automatically cancelled.
                </p>
                <div className="mt-2">
                  <CountdownTimer deadline={deadline} />
                </div>
              </>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
