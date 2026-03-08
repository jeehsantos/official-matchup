import { Link } from "react-router-dom";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { AlertCircle, CreditCard } from "lucide-react";

interface StripeSetupAlertProps {
  hasVenues: boolean;
  className?: string;
}

export function StripeSetupAlert({ hasVenues, className }: StripeSetupAlertProps) {
  return (
    <Alert variant="destructive" className={className}>
      <AlertCircle className="h-4 w-4" />
      <AlertTitle className="flex items-center gap-2">
        <CreditCard className="h-4 w-4" />
        Stripe Account Setup Required
      </AlertTitle>
      <AlertDescription className="mt-2 space-y-3">
        <p className="text-sm">
          {hasVenues
            ? "You must complete your Stripe account setup before you can add courts or configure availability. Go to Settings → Payment Payouts and complete the onboarding process."
            : "You must set up your Stripe account first before you can create venues, add courts, or configure availability. Go to Settings → Payment Payouts to get started."}
        </p>
        <Link to="/manager/settings">
          <Button variant="outline" size="sm" className="gap-2 border-destructive/50 hover:bg-destructive/10">
            <CreditCard className="h-3.5 w-3.5" />
            Go to Payment Settings
          </Button>
        </Link>
      </AlertDescription>
    </Alert>
  );
}
