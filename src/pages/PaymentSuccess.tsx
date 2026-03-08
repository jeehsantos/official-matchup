import { useEffect, useState, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { MobileLayout } from "@/components/layout/MobileLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Loader2, XCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { useTranslation } from "react-i18next";

export default function PaymentSuccess() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [countdown, setCountdown] = useState(5);
  const pollCount = useRef(0);
  const { t } = useTranslation("payment");

  const urlSessionId = searchParams.get("session_id");
  const checkoutSessionId = searchParams.get("checkout_session_id");

  const [resolvedSessionId, setResolvedSessionId] = useState<string | null>(urlSessionId);

  useEffect(() => {
    if (!user || (!urlSessionId && !checkoutSessionId)) return;

    const pollInterval = setInterval(async () => {
      pollCount.current += 1;

      try {
        const { data, error } = await supabase.functions.invoke("verify-payment", {
          body: {
            sessionId: urlSessionId || null,
            userId: user.id,
            checkoutSessionId,
          },
        });

        if (error) throw error;

        if (data?.success && (data?.status === "completed" || data?.status === "transferred")) {
          clearInterval(pollInterval);
          if (data.sessionId) {
            setResolvedSessionId(data.sessionId);
          }
          setStatus("success");
        } else if (pollCount.current >= 30) {
          clearInterval(pollInterval);
          setStatus("error");
        }
      } catch (err) {
        console.error("Poll error:", err);
        if (pollCount.current >= 30) {
          clearInterval(pollInterval);
          setStatus("error");
        }
      }
    }, 2000);

    return () => clearInterval(pollInterval);
  }, [urlSessionId, checkoutSessionId, user]);

  useEffect(() => {
    if (status === "success") {
      const timer = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            clearInterval(timer);
            if (resolvedSessionId) {
              navigate(`/games/${resolvedSessionId}`);
            } else {
              navigate("/home");
            }
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [status, navigate, resolvedSessionId]);

  const handleContinue = () => {
    if (resolvedSessionId) {
      navigate(`/games/${resolvedSessionId}`);
    } else {
      navigate("/home");
    }
  };

  return (
    <MobileLayout showBottomNav={false}>
      <div className="min-h-[80vh] flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-8 pb-8 text-center space-y-6">
            {status === "loading" && (
              <>
                <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
                  <Loader2 className="h-10 w-10 text-primary animate-spin" />
                </div>
                <div>
                  <h2 className="text-xl font-semibold mb-2">{t("processing")}</h2>
                  <p className="text-muted-foreground">{t("processingDesc")}</p>
                </div>
              </>
            )}

            {status === "success" && (
              <>
                <div className="w-20 h-20 rounded-full bg-success/10 flex items-center justify-center mx-auto animate-in zoom-in duration-300">
                  <CheckCircle2 className="h-10 w-10 text-success" />
                </div>
                <div>
                  <h2 className="text-xl font-semibold text-success mb-2">{t("success")}</h2>
                  <p className="text-muted-foreground">{t("successDesc")}</p>
                </div>
                <div className="pt-4 space-y-3">
                  <p className="text-sm text-muted-foreground">{t("redirecting", { count: countdown })}</p>
                  <Button onClick={handleContinue} className="w-full">{t("continueNow")}</Button>
                </div>
              </>
            )}

            {status === "error" && (
              <>
                <div className="w-20 h-20 rounded-full bg-destructive/10 flex items-center justify-center mx-auto">
                  <XCircle className="h-10 w-10 text-destructive" />
                </div>
                <div>
                  <h2 className="text-xl font-semibold text-destructive mb-2">{t("failed")}</h2>
                  <p className="text-muted-foreground">{t("failedDesc")}</p>
                </div>
                <div className="pt-4 space-y-3">
                  <Button onClick={handleContinue} variant="outline" className="w-full">{t("backToGame")}</Button>
                  <Button onClick={() => navigate("/home")} className="w-full">{t("goHome")}</Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </MobileLayout>
  );
}
