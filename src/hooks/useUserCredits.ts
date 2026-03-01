import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { useState } from "react";

interface UseUserCreditsReturn {
  balance: number;
  loading: boolean;
  error: Error | null;
  addCredits: (
    amount: number,
    reason: string,
    sessionId?: string,
    paymentId?: string
  ) => Promise<number>;
  useCredits: (
    amount: number,
    reason: string,
    sessionId?: string
  ) => Promise<boolean>;
  refetch: () => Promise<void>;
}

export function useUserCredits(): UseUserCreditsReturn {
  const { user } = useAuth();
  const [error, setError] = useState<Error | null>(null);

  const { data: credits = 0, isLoading, refetch: refetchQuery } = useQuery({
    queryKey: ["user-credits", user?.id],
    queryFn: async () => {
      if (!user) return 0;

      const { data, error } = await supabase.rpc("get_user_credits", {
        p_user_id: user.id,
      });

      if (error) {
        console.error("Error fetching credits:", error);
        setError(new Error(error.message));
        return 0;
      }

      setError(null);
      return Number(data) || 0;
    },
    enabled: !!user,
    staleTime: 1000 * 30, // 30 seconds for faster credit updates
    refetchOnWindowFocus: true,
    refetchInterval: 1000 * 30, // Refetch every 30 seconds
  });

  const addCredits = async (
    amount: number,
    reason: string,
    sessionId?: string,
    paymentId?: string
  ): Promise<number> => {
    if (!user) {
      throw new Error("User not authenticated");
    }

    const { data, error } = await supabase.rpc("add_user_credits", {
      p_user_id: user.id,
      p_amount: amount,
      p_reason: reason,
      p_session_id: sessionId || null,
      p_payment_id: paymentId || null,
    });

    if (error) {
      console.error("Error adding credits:", error);
      setError(new Error(error.message));
      throw new Error(error.message);
    }

    // Refetch to update the balance
    await refetchQuery();
    
    return Number(data) || 0;
  };

  const useCredits = async (
    amount: number,
    reason: string,
    sessionId?: string
  ): Promise<boolean> => {
    if (!user) {
      throw new Error("User not authenticated");
    }

    const { data, error } = await supabase.rpc("use_user_credits", {
      p_user_id: user.id,
      p_amount: amount,
      p_reason: reason,
      p_session_id: sessionId || null,
    });

    if (error) {
      console.error("Error using credits:", error);
      setError(new Error(error.message));
      throw new Error(error.message);
    }

    // Refetch to update the balance
    await refetchQuery();
    
    return data === true;
  };

  const refetch = async (): Promise<void> => {
    await refetchQuery();
  };

  return {
    balance: credits,
    loading: isLoading,
    error,
    addCredits,
    useCredits,
    refetch,
  };
}
