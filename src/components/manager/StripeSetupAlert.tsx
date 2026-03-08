import { Link } from "react-router-dom";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { AlertCircle, CreditCard } from "lucide-react";
import { useTranslation } from "react-i18next";

interface StripeSetupAlertProps {
  hasVenues: boolean;
  className?: string;
}

export function StripeSetupAlert({ hasVenues, className }: StripeSetupAlertProps) {
  const { t } = useTranslation("manager");

  return (
    <Alert variant="destructive" className={className}>
      <AlertCircle className="h-4 w-4" />
      <AlertTitle className="flex items-center gap-2">
        <CreditCard className="h-4 w-4" />
        {t("stripe.setupRequired")}
      </AlertTitle>
      <AlertDescription className="mt-2 space-y-3">
        <p className="text-sm">
          {hasVenues ? t("stripe.setupDescWithVenues") : t("stripe.setupDescNoVenues")}
        </p>
        <Link to="/manager/settings">
          <Button variant="outline" size="sm" className="gap-2 border-destructive/50 hover:bg-destructive/10">
            <CreditCard className="h-3.5 w-3.5" />
            {t("stripe.goToSettings")}
          </Button>
        </Link>
      </AlertDescription>
    </Alert>
  );
}
