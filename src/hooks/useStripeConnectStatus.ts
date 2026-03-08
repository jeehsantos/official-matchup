import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";

interface ConnectStatus {
  connected: boolean;
  details_submitted: boolean;
  payouts_enabled: boolean;
  charges_enabled: boolean;
  account_id?: string;
}

interface VenueStripeStatus {
  venueId: string;
  venueName: string;
  status: ConnectStatus;
}

/**
 * Check Stripe connect status for a specific venue.
 * If no venueId is provided, checks the first venue owned by the manager.
 */
export function useStripeConnectStatus(venueId?: string) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["stripe-connect-status", user?.id, venueId],
    queryFn: async (): Promise<VenueStripeStatus | null> => {
      if (!user) return null;

      // If no venueId, find the first venue owned by user
      let targetVenueId = venueId;
      let targetVenueName = "";

      if (!targetVenueId) {
        const { data: venues, error } = await supabase
          .from("venues")
          .select("id, name")
          .eq("owner_id", user.id)
          .limit(1);

        if (error || !venues || venues.length === 0) {
          // No venues yet — not connected
          return {
            venueId: "",
            venueName: "",
            status: {
              connected: false,
              details_submitted: false,
              payouts_enabled: false,
              charges_enabled: false,
            },
          };
        }
        targetVenueId = venues[0].id;
        targetVenueName = venues[0].name;
      }

      const { data, error } = await supabase.functions.invoke("stripe-connect-status", {
        body: { venueId: targetVenueId },
      });

      if (error) throw error;

      return {
        venueId: targetVenueId,
        venueName: targetVenueName,
        status: data as ConnectStatus,
      };
    },
    enabled: !!user,
    staleTime: 2 * 60 * 1000, // 2 min cache
  });
}

/**
 * Check if ANY venue owned by the manager has completed Stripe onboarding.
 * For venue_staff users, always returns isReady: true (staff don't manage Stripe).
 */
export function useManagerStripeReady() {
  const { user, userRole } = useAuth();
  const isStaff = userRole === "venue_staff";

  return useQuery({
    queryKey: ["manager-stripe-ready", user?.id, userRole],
    queryFn: async (): Promise<{
      isReady: boolean;
      hasVenues: boolean;
      venues: Array<{ id: string; name: string; stripe_account_id: string | null }>;
    }> => {
      if (!user) return { isReady: false, hasVenues: false, venues: [] };

      // Staff don't manage Stripe — always ready
      if (isStaff) {
        return { isReady: true, hasVenues: true, venues: [] };
      }

      const { data: venues, error } = await supabase
        .from("venues")
        .select("id, name, stripe_account_id")
        .eq("owner_id", user.id);

      if (error) throw error;

      const hasVenues = !!venues && venues.length > 0;

      // Check venues with stripe accounts first
      if (hasVenues) {
        const venuesWithStripe = venues.filter(v => v.stripe_account_id);
        
        for (const venue of venuesWithStripe) {
          try {
            const { data } = await supabase.functions.invoke("stripe-connect-status", {
              body: { venueId: venue.id },
            });
            if (data?.details_submitted) {
              return { isReady: true, hasVenues: true, venues };
            }
          } catch {
            // Continue checking other venues
          }
        }
      }

      // Fallback: check user-level Stripe account (no venue needed)
      try {
        const { data } = await supabase.functions.invoke("stripe-connect-status", {
          body: { venueId: null },
        });
        if (data?.details_submitted) {
          return { isReady: true, hasVenues, venues: venues || [] };
        }
      } catch {
        // ignore
      }

      return { isReady: false, hasVenues, venues: venues || [] };
    },
    enabled: !!user,
    staleTime: 2 * 60 * 1000,
  });
}
