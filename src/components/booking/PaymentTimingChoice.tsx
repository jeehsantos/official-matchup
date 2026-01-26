import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { CreditCard, Clock, CheckCircle2, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface PaymentTimingChoiceProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onChoice: (choice: "now" | "later") => void;
  isLoading?: boolean;
  totalAmount: number;
}

export function PaymentTimingChoice({
  open,
  onOpenChange,
  onChoice,
  isLoading = false,
  totalAmount,
}: PaymentTimingChoiceProps) {
  const [selected, setSelected] = useState<"now" | "later" | null>(null);

  const handleConfirm = () => {
    if (selected) {
      onChoice(selected);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100vw-32px)] sm:max-w-md">
        <DialogHeader>
          <DialogTitle>When would you like to pay?</DialogTitle>
          <DialogDescription>
            Choose to pay now or before the game starts
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-4">
          {/* Pay Now Option */}
          <button
            onClick={() => setSelected("now")}
            disabled={isLoading}
            className={cn(
              "w-full p-4 rounded-xl border-2 text-left transition-all",
              "hover:border-primary/50 focus:outline-none focus:ring-2 focus:ring-primary/20",
              selected === "now"
                ? "border-primary bg-primary/5"
                : "border-border bg-card"
            )}
          >
            <div className="flex items-start gap-3">
              <div className={cn(
                "w-10 h-10 rounded-full flex items-center justify-center shrink-0",
                selected === "now" ? "bg-primary text-primary-foreground" : "bg-muted"
              )}>
                <CreditCard className="h-5 w-5" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold">Pay Now</span>
                  {selected === "now" && (
                    <CheckCircle2 className="h-5 w-5 text-primary shrink-0" />
                  )}
                </div>
                <p className="text-sm text-muted-foreground mt-1">
                  Complete payment immediately to confirm your booking
                </p>
                <p className="text-sm font-medium text-primary mt-2">
                  ${totalAmount.toFixed(2)} via Stripe
                </p>
              </div>
            </div>
          </button>

          {/* Pay Later Option */}
          <button
            onClick={() => setSelected("later")}
            disabled={isLoading}
            className={cn(
              "w-full p-4 rounded-xl border-2 text-left transition-all",
              "hover:border-primary/50 focus:outline-none focus:ring-2 focus:ring-primary/20",
              selected === "later"
                ? "border-primary bg-primary/5"
                : "border-border bg-card"
            )}
          >
            <div className="flex items-start gap-3">
              <div className={cn(
                "w-10 h-10 rounded-full flex items-center justify-center shrink-0",
                selected === "later" ? "bg-primary text-primary-foreground" : "bg-muted"
              )}>
                <Clock className="h-5 w-5" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold">Pay Later</span>
                  {selected === "later" && (
                    <CheckCircle2 className="h-5 w-5 text-primary shrink-0" />
                  )}
                </div>
                <p className="text-sm text-muted-foreground mt-1">
                  Reserve your spot and pay before the game starts
                </p>
                <p className="text-xs text-amber-600 dark:text-amber-500 mt-2">
                  ⚠️ Booking will be pending until payment is received
                </p>
              </div>
            </div>
          </button>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isLoading}
          >
            Cancel
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={!selected || isLoading}
            className="min-w-[100px]"
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Processing...
              </>
            ) : (
              "Confirm"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
