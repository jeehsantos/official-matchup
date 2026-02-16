import { useEffect, useState, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { MobileLayout } from "@/components/layout/MobileLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Loader2, XCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";

export default function PaymentSuccess() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [countdown, setCountdown] = useState(5);
  const pollCount = useRef(0);

  const sessionId = searchParams.get("session_id");
  const checkoutSessionId = searchParams.get("checkout_session_id");
  const paymentType = searchParams.get("type");

  // Poll DB for payment confirmation (webhook is source of truth)
  useEffect(() => {
    if (!sessionId || !user) return;

    const pollInterval = setInterval(async () => {
      pollCount.current += 1;

      try {
        const { data, error } = await supabase.functions.invoke("verify-payment", {
          body: { sessionId, userId: user.id, checkoutSessionId },
        });

        if (error) throw error;

        if (data?.success) {
          clearInterval(pollInterval);
          setStatus("success");
        } else if (pollCount.current >= 30) {
          // After ~60 seconds of polling, give up
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
  }, [sessionId, user]);

  // Countdown + redirect on success
  useEffect(() => {
    if (status === "success") {
      const timer = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            clearInterval(timer);
            if (paymentType === "at_booking") {
              navigate("/home");
            } else {
              navigate(`/games/${sessionId}`);
            }
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [status, navigate, sessionId, paymentType]);

  const handleContinue = () => {
    if (paymentType === "at_booking") {
      navigate("/home");
    } else {
      navigate(`/games/${sessionId}`);
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
                  <h2 className="text-xl font-semibold mb-2">Processing Payment…</h2>
                  <p className="text-muted-foreground">
                    Confirming your payment. This may take a few moments.
                  </p>
                </div>
              </>
            )}

            {status === "success" && (
              <>
                <div className="w-20 h-20 rounded-full bg-success/10 flex items-center justify-center mx-auto animate-in zoom-in duration-300">
                  <CheckCircle2 className="h-10 w-10 text-success" />
                </div>
                <div>
                  <h2 className="text-xl font-semibold text-success mb-2">
                    Payment Successful!
                  </h2>
                  <p className="text-muted-foreground">
                    Your payment has been confirmed and your booking is secure.
                  </p>
                </div>
                <div className="pt-4 space-y-3">
                  <p className="text-sm text-muted-foreground">
                    Redirecting in {countdown} seconds...
                  </p>
                  <Button onClick={handleContinue} className="w-full">
                    Continue Now
                  </Button>
                </div>
              </>
            )}

            {status === "error" && (
              <>
                <div className="w-20 h-20 rounded-full bg-destructive/10 flex items-center justify-center mx-auto">
                  <XCircle className="h-10 w-10 text-destructive" />
                </div>
                <div>
                  <h2 className="text-xl font-semibold text-destructive mb-2">
                    Payment Verification Failed
                  </h2>
                  <p className="text-muted-foreground">
                    There was an issue verifying your payment. Please contact support if the issue persists.
                  </p>
                </div>
                <div className="pt-4 space-y-3">
                  <Button onClick={handleContinue} variant="outline" className="w-full">
                    Back to Game
                  </Button>
                  <Button onClick={() => navigate("/home")} className="w-full">
                    Go to Home
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </MobileLayout>
  );
}
