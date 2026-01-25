import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, CreditCard, Coins, Info } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface PaymentMethodDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userCredits: number;
  sessionCost: number;
  onSelectPaymentMethod: (
    method: "credits" | "payment",
    creditsToUse?: number
  ) => Promise<void>;
  isLoading?: boolean;
}

export function PaymentMethodDialog({
  open,
  onOpenChange,
  userCredits,
  sessionCost,
  onSelectPaymentMethod,
  isLoading = false,
}: PaymentMethodDialogProps) {
  const [selectedOption, setSelectedOption] = useState<"credits" | "payment" | null>(null);

  const canCoverFully = userCredits >= sessionCost;
  const remainingAfterCredits = Math.max(0, sessionCost - userCredits);
  const creditsToUse = Math.min(userCredits, sessionCost);

  const handleAction = async () => {
    if (selectedOption === "credits") {
      await onSelectPaymentMethod("credits", creditsToUse);
    } else if (selectedOption === "payment") {
      await onSelectPaymentMethod("payment");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Coins className="h-5 w-5 text-primary" />
            Payment Options
          </DialogTitle>
          <DialogDescription>
            Choose how you'd like to pay for this session
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Current credits display */}
          <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Your Credits</span>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent side="top" className="max-w-[250px]">
                    <p className="text-xs">
                      Credits are earned when you cancel a paid session. Use them for future bookings instead of paying again.
                    </p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            <Badge variant="secondary" className="font-mono text-base">
              ${userCredits.toFixed(2)}
            </Badge>
          </div>

          {/* Payment amount */}
          <div className="flex items-center justify-between p-3 rounded-lg bg-primary/5 border border-primary/20">
            <span className="text-sm font-medium">Session Cost</span>
            <span className="font-semibold text-lg">${sessionCost.toFixed(2)}</span>
          </div>

          {/* Options */}
          <div className="space-y-3">
            {/* Use Credits Option */}
            <button
              onClick={() => setSelectedOption("credits")}
              disabled={userCredits <= 0 || isLoading}
              className={`w-full p-4 rounded-lg border-2 text-left transition-all ${
                selectedOption === "credits"
                  ? "border-primary bg-primary/5"
                  : userCredits > 0
                  ? "border-border hover:border-primary/50"
                  : "border-border opacity-50 cursor-not-allowed"
              }`}
            >
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                  selectedOption === "credits" ? "bg-primary/10" : "bg-muted"
                }`}>
                  <Coins className={`h-5 w-5 ${
                    selectedOption === "credits" ? "text-primary" : "text-muted-foreground"
                  }`} />
                </div>
                <div className="flex-1">
                  <p className="font-medium">
                    {canCoverFully ? "Pay with Credits" : "Use Available Credits"}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {canCoverFully
                      ? `Use $${creditsToUse.toFixed(2)} from your balance`
                      : userCredits > 0
                      ? `Use $${creditsToUse.toFixed(2)} credits + pay $${remainingAfterCredits.toFixed(2)}`
                      : "No credits available"}
                  </p>
                </div>
                {selectedOption === "credits" && (
                  <div className="w-5 h-5 rounded-full bg-primary flex items-center justify-center">
                    <span className="text-white text-xs">✓</span>
                  </div>
                )}
              </div>
            </button>

            {/* Pay with Card Option */}
            <button
              onClick={() => setSelectedOption("payment")}
              disabled={isLoading}
              className={`w-full p-4 rounded-lg border-2 text-left transition-all ${
                selectedOption === "payment"
                  ? "border-primary bg-primary/5"
                  : "border-border hover:border-primary/50"
              }`}
            >
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                  selectedOption === "payment" ? "bg-primary/10" : "bg-muted"
                }`}>
                  <CreditCard className={`h-5 w-5 ${
                    selectedOption === "payment" ? "text-primary" : "text-muted-foreground"
                  }`} />
                </div>
                <div className="flex-1">
                  <p className="font-medium">Pay with Card</p>
                  <p className="text-sm text-muted-foreground">
                    Pay the full ${sessionCost.toFixed(2)} with your card
                  </p>
                </div>
                {selectedOption === "payment" && (
                  <div className="w-5 h-5 rounded-full bg-primary flex items-center justify-center">
                    <span className="text-white text-xs">✓</span>
                  </div>
                )}
              </div>
            </button>
          </div>
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
            onClick={handleAction}
            disabled={!selectedOption || isLoading}
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Processing...
              </>
            ) : selectedOption === "credits" && canCoverFully ? (
              "Confirm Payment"
            ) : selectedOption === "credits" ? (
              "Continue to Payment"
            ) : selectedOption === "payment" ? (
              "Pay with Card"
            ) : (
              "Select an Option"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
