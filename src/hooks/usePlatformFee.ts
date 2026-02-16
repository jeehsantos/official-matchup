import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function usePlatformFee() {
  const { data, isLoading } = useQuery({
    queryKey: ["platform-settings-fee"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("platform_settings")
        .select("player_fee, manager_fee_percentage")
        .eq("is_active", true)
        .limit(1)
        .single();

      if (error) {
        console.error("Error fetching platform fee:", error);
        return { playerFee: 0, managerFeePercentage: 0 };
      }

      return {
        playerFee: Number(data?.player_fee ?? 0),
        managerFeePercentage: Number(data?.manager_fee_percentage ?? 0),
      };
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  return {
    playerFee: data?.playerFee ?? 0,
    managerFeePercentage: data?.managerFeePercentage ?? 0,
    isLoading,
  };
}
