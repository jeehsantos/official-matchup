import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { toast } from "@/hooks/use-toast";

interface QuickChallengePlayer {
  id: string;
  challenge_id: string;
  user_id: string;
  team: "left" | "right";
  slot_position: number;
  payment_status: "pending" | "paid" | "refunded";
  stripe_session_id: string | null;
  joined_at: string;
  paid_at: string | null;
  profiles?: {
    full_name: string | null;
    avatar_url: string | null;
    city: string | null;
    nationality_code?: string | null;
  } | null;
}

interface QuickChallenge {
  id: string;
  sport_category_id: string;
  game_mode: string;
  status: string;
  venue_id: string | null;
  court_id: string | null;
  scheduled_date: string | null;
  scheduled_time: string | null;
  price_per_player: number;
  total_slots: number;
  created_by: string;
  created_at: string;
  sport_categories?: {
    id: string;
    name: string;
    display_name: string;
    icon: string | null;
  } | null;
  venues?: {
    id: string;
    name: string;
    address: string;
    city: string;
    photo_url?: string | null;
  } | null;
  courts?: {
    id: string;
    name: string;
    photo_url?: string | null;
    ground_type?: string | null;
    payment_timing?: string | null;
    payment_hours_before?: number | null;
  } | null;
  quick_challenge_players?: QuickChallengePlayer[];
}

export function useQuickChallenges(filters?: {
  sportCategoryId?: string;
  status?: string;
}) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["quick-challenges", filters],
    queryFn: async () => {
      let queryBuilder = supabase
        .from("quick_challenges")
        .select(`
          *,
          sport_categories (id, name, display_name, icon),
          venues (id, name, address, city, photo_url),
          courts (id, name, photo_url, ground_type, payment_timing, payment_hours_before),
          quick_challenge_players (
            id,
            challenge_id,
            user_id,
            team,
            slot_position,
            payment_status,
            stripe_session_id,
            joined_at,
            paid_at
          )
        `)
        .order("created_at", { ascending: false });

      if (filters?.sportCategoryId) {
        queryBuilder = queryBuilder.eq("sport_category_id", filters.sportCategoryId);
      }

      if (filters?.status) {
        queryBuilder = queryBuilder.eq("status", filters.status);
      } else {
        queryBuilder = queryBuilder.in("status", ["open", "full"]);
      }

      const { data, error } = await queryBuilder;
      if (error) throw error;

      // Fetch player profiles
      const challenges = data as QuickChallenge[];
      const allPlayerUserIds = challenges.flatMap(c => 
        (c.quick_challenge_players || []).map(p => p.user_id)
      );
      
      const uniqueUserIds = [...new Set(allPlayerUserIds)];
      
      if (uniqueUserIds.length > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("user_id, full_name, avatar_url, city, nationality_code")
          .in("user_id", uniqueUserIds);

        const profileMap = new Map(profiles?.map(p => [p.user_id, p]) || []);

        // Attach profiles to players
        for (const challenge of challenges) {
          if (challenge.quick_challenge_players) {
            for (const player of challenge.quick_challenge_players) {
              (player as QuickChallengePlayer).profiles = profileMap.get(player.user_id) || null;
            }
          }
        }
      }

      return challenges;
    },
  });

  // Real-time subscription for live updates
  useEffect(() => {
    const channel = supabase
      .channel("quick-challenges-realtime")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "quick_challenges",
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ["quick-challenges"] });
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "quick_challenge_players",
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ["quick-challenges"] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  return query;
}

export function useJoinChallenge() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      challengeId,
      team,
      slotPosition,
    }: {
      challengeId: string;
      team: "left" | "right";
      slotPosition: number;
    }) => {
      if (!user) throw new Error("Must be logged in to join");

      // First check if user is already in this challenge (any slot)
      const { data: existingPlayer } = await supabase
        .from("quick_challenge_players")
        .select("id")
        .eq("challenge_id", challengeId)
        .eq("user_id", user.id)
        .maybeSingle();

      if (existingPlayer) {
        throw new Error("You have already joined this challenge");
      }

      const { data, error } = await supabase
        .from("quick_challenge_players")
        .insert({
          challenge_id: challengeId,
          user_id: user.id,
          team,
          slot_position: slotPosition,
          payment_status: "pending",
        })
        .select()
        .single();

      if (error) {
        if (error.code === "23505") {
          throw new Error("This slot is already taken or you've already joined");
        }
        throw error;
      }

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["quick-challenges"] });
      toast({
        title: "You've joined the challenge!",
        description: "Complete your payment to confirm your spot.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to join",
        description: error.message,
        variant: "destructive",
      });
    },
  });
}

export function useCreateChallenge() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      sportCategoryId,
      gameMode,
      venueId,
      courtId,
      scheduledDate,
      scheduledTime,
      pricePerPlayer,
    }: {
      sportCategoryId: string;
      gameMode: string;
      venueId?: string;
      courtId?: string;
      scheduledDate?: string;
      scheduledTime?: string;
      pricePerPlayer?: number;
    }) => {
      if (!user) throw new Error("Must be logged in to create a challenge");

      // Calculate total slots from game mode
      const match = gameMode.match(/(\d+)vs(\d+)/);
      const playersPerTeam = match ? parseInt(match[1]) : 1;
      const totalSlots = playersPerTeam * 2;

      const { data, error } = await supabase
        .from("quick_challenges")
        .insert({
          sport_category_id: sportCategoryId,
          game_mode: gameMode,
          status: "open",
          venue_id: venueId || null,
          court_id: courtId || null,
          scheduled_date: scheduledDate || null,
          scheduled_time: scheduledTime || null,
          price_per_player: pricePerPlayer || 0,
          total_slots: totalSlots,
          created_by: user.id,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["quick-challenges"] });
      toast({
        title: "Challenge created!",
        description: "Waiting for players to join.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to create challenge",
        description: error.message,
        variant: "destructive",
      });
    },
  });
}

export function useLeaveChallenge() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (challengeId: string) => {
      if (!user) throw new Error("Must be logged in");

      const { data, error } = await supabase.functions.invoke(
        "leave-quick-challenge",
        { body: { challengeId } }
      );

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      return data as { success: boolean; creditsAdded: number; message: string };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["quick-challenges"] });
      toast({
        title: "Left challenge",
        description: data?.message || "You've left the challenge.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to leave",
        description: error.message,
        variant: "destructive",
      });
    },
  });
}

export function useCancelChallenge() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (challengeId: string) => {
      if (!user) throw new Error("Must be logged in");

      // Verify user is the organizer and check for paid players
      const { data: challenge } = await supabase
        .from("quick_challenges")
        .select("created_by, quick_challenge_players(id, payment_status)")
        .eq("id", challengeId)
        .single();

      if (!challenge || challenge.created_by !== user.id) {
        throw new Error("Only the organizer can cancel this challenge");
      }

      // Check if any player has already paid
      const hasPaidPlayers = challenge.quick_challenge_players?.some(
        (player) => player.payment_status === "paid"
      );

      if (hasPaidPlayers) {
        throw new Error("Cannot cancel - some players have already paid. Please refund them first.");
      }

      // Delete all players first (due to FK constraint)
      await supabase
        .from("quick_challenge_players")
        .delete()
        .eq("challenge_id", challengeId);

      // Delete the challenge entirely instead of just updating status
      const { error } = await supabase
        .from("quick_challenges")
        .delete()
        .eq("id", challengeId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["quick-challenges"] });
      toast({
        title: "Lobby cancelled",
        description: "The challenge has been cancelled.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to cancel",
        description: error.message,
        variant: "destructive",
      });
    },
  });
}

export function useUpdateChallengeFormat() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      challengeId,
      gameMode,
    }: {
      challengeId: string;
      gameMode: string;
    }) => {
      if (!user) throw new Error("Must be logged in");

      // Verify user is the organizer and get current challenge data
      const { data: challenge } = await supabase
        .from("quick_challenges")
        .select("created_by, price_per_player, total_slots, quick_challenge_players(id)")
        .eq("id", challengeId)
        .single();

      if (!challenge || challenge.created_by !== user.id) {
        throw new Error("Only the organizer can change the format");
      }

      // Calculate new total slots
      const match = gameMode.match(/(\d+)vs(\d+)/);
      const playersPerTeam = match ? parseInt(match[1]) : 1;
      const newTotalSlots = playersPerTeam * 2;

      // Check if current players exceed new format
      const currentPlayers = challenge.quick_challenge_players?.length || 0;
      if (currentPlayers > newTotalSlots) {
        throw new Error(`Cannot reduce format - ${currentPlayers} players are already in the lobby`);
      }

      // Calculate new price per player (keep total court price the same)
      // Total court price = current price_per_player * current total_slots
      const totalCourtPrice = (challenge.price_per_player || 0) * (challenge.total_slots || 1);
      const newPricePerPlayer = totalCourtPrice / newTotalSlots;

      const { error } = await supabase
        .from("quick_challenges")
        .update({ 
          game_mode: gameMode,
          total_slots: newTotalSlots,
          price_per_player: newPricePerPlayer
        })
        .eq("id", challengeId);

      if (error) throw error;
    },
    onSuccess: async () => {
      await queryClient.refetchQueries({ queryKey: ["quick-challenges"] });
      toast({
        title: "Format updated",
        description: "The match format has been changed.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to update format",
        description: error.message,
        variant: "destructive",
      });
    },
  });
}
