import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface PlatformSettings {
  player_fee: number;
  manager_fee_percentage: number;
  is_active: boolean;
}

const DEFAULT_SETTINGS: PlatformSettings = {
  player_fee: 1.50,
  manager_fee_percentage: 0,
  is_active: true,
};

export function usePlatformSettings() {
  return useQuery({
    queryKey: ["platform-settings"],
    queryFn: async (): Promise<PlatformSettings> => {
      const { data, error } = await supabase
        .from("platform_settings")
        .select("player_fee, manager_fee_percentage, is_active")
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data ?? DEFAULT_SETTINGS;
    },
    staleTime: 5 * 60 * 1000, // 5 min cache
  });
}
