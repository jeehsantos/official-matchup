import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { checkProfileComplete } from "@/lib/profile-utils";
import type { Database } from "@/integrations/supabase/types";

type Profile = Database["public"]["Tables"]["profiles"]["Row"];

export function useUserProfile() {
  const { user } = useAuth();

  const query = useQuery({
    queryKey: ["user-profile", user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();

      if (error) throw error;
      return data as Profile | null;
    },
    enabled: !!user,
    staleTime: 1000 * 30, // Cache for 30 seconds
  });

  const profile = query.data ?? null;
  const completeness = checkProfileComplete(profile);
  const preferredSports = (profile?.preferred_sports as string[]) || [];

  return {
    profile,
    isLoading: query.isLoading,
    isComplete: completeness.isComplete,
    missingFields: completeness.missingFields,
    preferredSports,
    refetch: query.refetch,
  };
}
