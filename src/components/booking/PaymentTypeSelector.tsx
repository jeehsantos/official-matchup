import { User, Users } from "lucide-react";

interface PaymentTypeSelectorProps {
  paymentType: "single" | "split";
  onPaymentTypeChange: (type: "single" | "split") => void;
  courtPrice: number;
  disabled?: boolean;
  paymentTiming?: "at_booking" | "before_session" | null;
}

export function PaymentTypeSelector({
  paymentType,
  onPaymentTypeChange,
  courtPrice,
  disabled = false,
  paymentTiming,
}: PaymentTypeSelectorProps) {
  // Only show split option if payment timing is before_session
  const showSplitOption = paymentTiming === "before_session";

  return (
    <div className="space-y-3">
      <p className="text-sm font-medium">Payment Mode</p>
      <div className={`grid grid-cols-1 ${showSplitOption ? 'sm:grid-cols-2' : ''} gap-3`}>
        {/* Organizer Pays Full Option */}
        <button
          type="button"
          onClick={() => onPaymentTypeChange("single")}
          disabled={disabled}
          className={`relative p-4 rounded-xl border-2 transition-all text-left disabled:opacity-50 disabled:cursor-not-allowed ${
            paymentType === "single"
              ? "border-primary bg-primary/5 ring-2 ring-primary/20"
              : "border-border hover:border-muted-foreground/50 hover:bg-muted/30"
          }`}
        >
          <div className="flex items-start gap-3">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
              paymentType === "single" 
                ? "bg-primary text-primary-foreground" 
                : "bg-muted text-muted-foreground"
            }`}>
              <User className="h-5 w-5" />
            </div>
            <div>
              <p className="font-semibold text-foreground">Organizer Pays Full</p>
              <p className="text-sm text-muted-foreground mt-0.5">
                You pay the full court amount for the booking
              </p>
            </div>
          </div>
          {paymentType === "single" && (
            <div className="absolute top-3 right-3 w-5 h-5 rounded-full bg-primary flex items-center justify-center">
              <svg className="w-3 h-3 text-primary-foreground" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
            </div>
          )}
        </button>

        {/* Split Between Players Option */}
        {showSplitOption && (
          <button
            type="button"
            onClick={() => onPaymentTypeChange("split")}
            disabled={disabled}
            className={`relative p-4 rounded-xl border-2 transition-all text-left disabled:opacity-50 disabled:cursor-not-allowed ${
              paymentType === "split"
                ? "border-primary bg-primary/5 ring-2 ring-primary/20"
                : "border-border hover:border-muted-foreground/50 hover:bg-muted/30"
            }`}
          >
            <div className="flex items-start gap-3">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
                paymentType === "split" 
                  ? "bg-primary text-primary-foreground" 
                  : "bg-muted text-muted-foreground"
              }`}>
                <Users className="h-5 w-5" />
              </div>
              <div>
                <p className="font-semibold text-foreground">Split Between Players</p>
                <p className="text-sm text-muted-foreground mt-0.5">
                  Each player pays their share to confirm their spot
                </p>
              </div>
            </div>
            {paymentType === "split" && (
              <div className="absolute top-3 right-3 w-5 h-5 rounded-full bg-primary flex items-center justify-center">
                <svg className="w-3 h-3 text-primary-foreground" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
              </div>
            )}
          </button>
        )}
      </div>
      
      {paymentType === "split" && showSplitOption && (
        <p className="text-xs text-muted-foreground bg-muted/50 p-3 rounded-lg">
          💡 Each player will need to pay their share (court cost ÷ max players + service fee) to confirm their spot. 
          The session will only be confirmed once minimum players have paid.
        </p>
      )}
    </div>
  );
}
