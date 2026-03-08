import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { CreditCard, Clock, CalendarCheck } from "lucide-react";
import { useTranslation } from "react-i18next";

interface PaymentSettingsCardProps {
  paymentTiming: "at_booking" | "before_session";
  paymentHoursBefore: number;
  onPaymentTimingChange: (timing: "at_booking" | "before_session") => void;
  onPaymentHoursChange: (hours: number) => void;
}

export function PaymentSettingsCard({ paymentTiming, paymentHoursBefore, onPaymentTimingChange, onPaymentHoursChange }: PaymentSettingsCardProps) {
  const { t } = useTranslation("manager");

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><CreditCard className="h-5 w-5" />{t("payment.title")}</CardTitle>
        <CardDescription>{t("payment.subtitle")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <button type="button" onClick={() => onPaymentTimingChange("at_booking")} className={`relative p-4 rounded-xl border-2 transition-all text-left ${paymentTiming === "at_booking" ? "border-primary bg-primary/5 ring-2 ring-primary/20" : "border-border hover:border-muted-foreground/50 hover:bg-muted/30"}`}>
            <div className="flex items-start gap-3">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${paymentTiming === "at_booking" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}><CalendarCheck className="h-5 w-5" /></div>
              <div><p className="font-semibold text-foreground">{t("payment.atBooking")}</p><p className="text-sm text-muted-foreground mt-0.5">{t("payment.atBookingDesc")}</p></div>
            </div>
            {paymentTiming === "at_booking" && (<div className="absolute top-3 right-3 w-5 h-5 rounded-full bg-primary flex items-center justify-center"><svg className="w-3 h-3 text-primary-foreground" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg></div>)}
          </button>
          <button type="button" onClick={() => onPaymentTimingChange("before_session")} className={`relative p-4 rounded-xl border-2 transition-all text-left ${paymentTiming === "before_session" ? "border-primary bg-primary/5 ring-2 ring-primary/20" : "border-border hover:border-muted-foreground/50 hover:bg-muted/30"}`}>
            <div className="flex items-start gap-3">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${paymentTiming === "before_session" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}><Clock className="h-5 w-5" /></div>
              <div><p className="font-semibold text-foreground">{t("payment.beforeSession")}</p><p className="text-sm text-muted-foreground mt-0.5">{t("payment.beforeSessionDesc")}</p></div>
            </div>
            {paymentTiming === "before_session" && (<div className="absolute top-3 right-3 w-5 h-5 rounded-full bg-primary flex items-center justify-center"><svg className="w-3 h-3 text-primary-foreground" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg></div>)}
          </button>
        </div>
        {paymentTiming === "before_session" && (
          <div className="animate-in slide-in-from-top-2 duration-200 p-4 rounded-xl bg-muted/50 border border-border">
            <Label htmlFor="payment_hours_before" className="text-sm font-medium">{t("payment.hoursBefore")}</Label>
            <p className="text-sm text-muted-foreground mb-3">{t("payment.hoursBeforeDesc")}</p>
            <div className="flex items-center gap-3">
              <Input id="payment_hours_before" type="number" min={1} max={168} value={paymentHoursBefore} onChange={(e) => onPaymentHoursChange(parseInt(e.target.value) || 24)} className="w-24" />
              <span className="text-sm text-muted-foreground">{t("payment.hoursBeforeLabel")}</span>
            </div>
            <p className="text-xs text-muted-foreground mt-2">{t("payment.hoursBeforeExample")}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
