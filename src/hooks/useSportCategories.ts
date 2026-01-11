import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface SportCategory {
  id: string;
  name: string;
  display_name: string;
  icon: string | null;
  sort_order: number | null;
  is_active: boolean | null;
}

export function useSportCategories() {
  return useQuery({
    queryKey: ["sport-categories"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sport_categories")
        .select("*")
        .eq("is_active", true)
        .order("sort_order", { ascending: true });

      if (error) throw error;
      return data as SportCategory[];
    },
    staleTime: 1000 * 60 * 30, // Cache for 30 minutes
  });
}
