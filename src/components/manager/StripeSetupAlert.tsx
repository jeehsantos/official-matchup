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
            ? "You must complete your Stripe account setup before you can add courts or configure availability. Go to Settings → Payment Setup and complete the onboarding process."
            : "You need to create a venue and complete Stripe account setup before you can manage courts and availability."}
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
