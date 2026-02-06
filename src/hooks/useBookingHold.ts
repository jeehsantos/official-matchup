import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface HoldResult {
  success: boolean;
  hold_id?: string;
  expires_at?: string;
  duration_minutes?: number;
  error?: string;
  message?: string;
}

interface UseBookingHoldReturn {
  holdId: string | null;
  expiresAt: Date | null;
  remainingSeconds: number;
  isCreatingHold: boolean;
  createHold: (courtId: string, startDatetime: Date, endDatetime: Date) => Promise<HoldResult>;
  releaseHold: () => Promise<void>;
  isHoldValid: boolean;
}

export function useBookingHold(): UseBookingHoldReturn {
  const [holdId, setHoldId] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<Date | null>(null);
  const [remainingSeconds, setRemainingSeconds] = useState<number>(0);
  const [isCreatingHold, setIsCreatingHold] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Calculate remaining seconds
  useEffect(() => {
    if (!expiresAt) {
      setRemainingSeconds(0);
      return;
    }

    const updateRemaining = () => {
      const now = new Date();
      const remaining = Math.max(0, Math.floor((expiresAt.getTime() - now.getTime()) / 1000));
      setRemainingSeconds(remaining);

      if (remaining <= 0) {
        setHoldId(null);
        setExpiresAt(null);
        toast.warning("Your hold has expired. Please select a slot again.");
      }
    };

    updateRemaining();
    timerRef.current = setInterval(updateRemaining, 1000);

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [expiresAt]);

  const createHold = useCallback(async (
    courtId: string,
    startDatetime: Date,
    endDatetime: Date
  ): Promise<HoldResult> => {
    setIsCreatingHold(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        return { success: false, error: "NOT_AUTHENTICATED", message: "Please sign in first" };
      }

      const { data, error } = await supabase.rpc("create_booking_hold", {
        p_court_id: courtId,
        p_start_datetime: startDatetime.toISOString(),
        p_end_datetime: endDatetime.toISOString(),
        p_user_id: user.id,
      });

      if (error) {
        console.error("Error creating hold:", error);
        return { success: false, error: "RPC_ERROR", message: error.message };
      }

      const result = data as unknown as HoldResult;

      if (result.success && result.hold_id && result.expires_at) {
        setHoldId(result.hold_id);
        setExpiresAt(new Date(result.expires_at));
        return result;
      }

      // Handle specific error cases
      if (result.error === "SLOT_UNAVAILABLE") {
        toast.error(result.message || "This slot is no longer available");
      }

      return result;
    } catch (error: any) {
      console.error("Error creating hold:", error);
      return { success: false, error: "UNKNOWN", message: error.message };
    } finally {
      setIsCreatingHold(false);
    }
  }, []);

  const releaseHold = useCallback(async () => {
    if (!holdId) return;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      await supabase.rpc("release_booking_hold", {
        p_hold_id: holdId,
        p_user_id: user.id,
      });

      setHoldId(null);
      setExpiresAt(null);
    } catch (error) {
      console.error("Error releasing hold:", error);
    }
  }, [holdId]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, []);

  return {
    holdId,
    expiresAt,
    remainingSeconds,
    isCreatingHold,
    createHold,
    releaseHold,
    isHoldValid: holdId !== null && remainingSeconds > 0,
  };
}
