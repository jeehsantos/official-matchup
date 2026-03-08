import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";

interface ManagerVenue {
  id: string;
  name: string;
  stripe_account_id: string | null;
}

/**
 * Shared hook that fetches venues accessible to the current user.
 * - court_manager: venues they own
 * - venue_staff: venues they're assigned to
 */
export function useManagerVenues() {
  const { user, userRole } = useAuth();
  const isStaff = userRole === "venue_staff";

  return useQuery({
    queryKey: ["manager-venues", user?.id, userRole],
    queryFn: async (): Promise<ManagerVenue[]> => {
      if (!user) return [];

      if (isStaff) {
        // Get venue IDs from venue_staff table
        const { data: staffRows, error: staffError } = await supabase
          .from("venue_staff")
          .select("venue_id")
          .eq("user_id", user.id);

        if (staffError) throw staffError;
        if (!staffRows || staffRows.length === 0) return [];

        const venueIds = staffRows.map((r) => r.venue_id);

        const { data: venues, error } = await supabase
          .from("venues")
          .select("id, name, stripe_account_id")
          .in("id", venueIds);

        if (error) throw error;
        return (venues as ManagerVenue[]) || [];
      }

      // court_manager path
      const { data: venues, error } = await supabase
        .from("venues")
        .select("id, name, stripe_account_id")
        .eq("owner_id", user.id);

      if (error) throw error;
      return (venues as ManagerVenue[]) || [];
    },
    enabled: !!user,
    staleTime: 2 * 60 * 1000,
  });
}
