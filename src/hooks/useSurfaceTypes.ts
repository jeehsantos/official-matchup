import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface SurfaceType {
  id: string;
  name: string;
  display_name: string;
  sort_order: number | null;
  is_active: boolean | null;
}

export function useSurfaceTypes() {
  return useQuery({
    queryKey: ["surface-types"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("surface_types")
        .select("*")
        .eq("is_active", true)
        .order("sort_order", { ascending: true });

      if (error) throw error;
      return data as SurfaceType[];
    },
    staleTime: 1000 * 60 * 30, // Cache for 30 minutes
  });
}
