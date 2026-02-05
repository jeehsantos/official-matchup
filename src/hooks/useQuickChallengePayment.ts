import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

export function useQuickChallengePayment() {
  const [isPaying, setIsPaying] = useState(false);

  const initiatePayment = async (challengeId: string): Promise<boolean> => {
    setIsPaying(true);
    
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        toast({
          title: "Authentication required",
          description: "Please log in to make a payment.",
          variant: "destructive",
        });
        return false;
      }

      const response = await supabase.functions.invoke("create-quick-challenge-payment", {
        body: {
          challengeId,
          origin: window.location.origin,
        },
      });

      if (response.error) {
        throw new Error(response.error.message || "Failed to create payment");
      }

      const { url, success, message } = response.data;

      // If it's a free challenge that was auto-confirmed
      if (success && !url) {
        toast({
          title: "Confirmed!",
          description: message || "Your spot has been confirmed.",
        });
        return true;
      }

      // Redirect to Stripe checkout
      if (url) {
        window.location.href = url;
        return true;
      }

      throw new Error("No checkout URL returned");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Payment failed";
      toast({
        title: "Payment Error",
        description: message,
        variant: "destructive",
      });
      return false;
    } finally {
      setIsPaying(false);
    }
  };

  const verifyPayment = async (checkoutSessionId: string, challengeId: string): Promise<boolean> => {
    try {
      const response = await supabase.functions.invoke("verify-quick-challenge-payment", {
        body: {
          checkoutSessionId,
          challengeId,
        },
      });

      if (response.error) {
        throw new Error(response.error.message || "Failed to verify payment");
      }

      if (response.data.success) {
        toast({
          title: "Payment Confirmed!",
          description: "Your spot has been secured.",
        });
        return true;
      }

      return false;
    } catch (error) {
      console.error("Payment verification error:", error);
      return false;
    }
  };

  return {
    isPaying,
    initiatePayment,
    verifyPayment,
  };
}
