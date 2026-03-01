import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getSportCategoriesMap } from "@/lib/sport-category-utils";
import type { Database } from "@/integrations/supabase/types";

type SportCategory = Database["public"]["Tables"]["sport_categories"]["Row"];

export interface GameData {
  id: string;
  groupName: string;
  sport: Database["public"]["Enums"]["sport_type"];
  sportCategory?: SportCategory;
  courtName: string;
  venueName: string;
  date: Date;
  time: string;
  endTime: string;
  price: number;
  currentPlayers: number;
  minPlayers: number;
  maxPlayers: number;
  state: Database["public"]["Enums"]["session_state"];
  isPaid: boolean;
  durationMinutes: number;
  linkTo?: string;
}

async function fetchGames(userId: string): Promise<GameData[]> {
  // Parallel: fetch player sessions, organizer groups, sport categories, and quick challenge data
  const [playerSessionsRes, organizerGroupsRes, sportCategoriesMap] = await Promise.all([
    supabase
      .from("session_players")
      .select("session_id")
      .eq("user_id", userId),
    supabase
      .from("groups")
      .select("id")
      .eq("organizer_id", userId),
    getSportCategoriesMap(),
  ]);

  const playerSessionIds = playerSessionsRes.data?.map((p) => p.session_id) || [];
  const organizerGroupIds = organizerGroupsRes.data?.map((g) => g.id) || [];

  // Build session + quick challenge queries in parallel
  const sessionPromise = fetchSessions(userId, playerSessionIds, organizerGroupIds, sportCategoriesMap);
  const qcPromise = fetchQuickChallenges(userId);

  const [sessionGames, qcGames] = await Promise.all([sessionPromise, qcPromise]);

  return [...sessionGames, ...qcGames];
}

async function fetchSessions(
  userId: string,
  playerSessionIds: string[],
  organizerGroupIds: string[],
  sportCategoriesMap: Map<string, SportCategory>
): Promise<GameData[]> {
  if (organizerGroupIds.length === 0 && playerSessionIds.length === 0) {
    return [];
  }

  let query = supabase
    .from("sessions")
    .select(`
      id,
      session_date,
      start_time,
      duration_minutes,
      court_price,
      min_players,
      max_players,
      state,
      payment_type,
      is_cancelled,
      sport_category_id,
      group_id,
      sport_categories ( id, name, display_name, icon, sort_order, is_active, created_at, updated_at ),
      groups!inner ( name, sport_type ),
      courts ( name, venues ( name ) )
    `)
    .eq("is_cancelled", false);

  if (organizerGroupIds.length > 0 && playerSessionIds.length > 0) {
    query = query.or(
      `group_id.in.(${organizerGroupIds.join(",")}),id.in.(${playerSessionIds.join(",")})`
    );
  } else if (organizerGroupIds.length > 0) {
    query = query.in("group_id", organizerGroupIds);
  } else {
    query = query.in("id", playerSessionIds);
  }

  const { data: sessions, error } = await query.order("session_date", { ascending: true });
  if (error) throw error;
  if (!sessions || sessions.length === 0) return [];

  const sessionIds = sessions.map((s: any) => s.id);

  // Batch: fetch ALL player counts and user payments in 2 queries instead of N*2
  const [playerCountsRes, paymentsRes] = await Promise.all([
    supabase
      .from("session_players")
      .select("session_id")
      .in("session_id", sessionIds),
    supabase
      .from("payments")
      .select("session_id, status")
      .eq("user_id", userId)
      .in("session_id", sessionIds),
  ]);

  // Build lookup maps
  const playerCountMap = new Map<string, number>();
  for (const row of playerCountsRes.data || []) {
    playerCountMap.set(row.session_id, (playerCountMap.get(row.session_id) || 0) + 1);
  }

  const paymentStatusMap = new Map<string, string>();
  for (const row of paymentsRes.data || []) {
    paymentStatusMap.set(row.session_id, row.status);
  }

  return sessions.map((session: any) => {
    const group = session.groups;
    const court = session.courts;

    let sportCategory = session.sport_categories;
    if (!sportCategory && group?.sport_type) {
      sportCategory = sportCategoriesMap.get(group.sport_type);
    }

    const [hours, minutes] = session.start_time.split(":").map(Number);
    const endMinutes = hours * 60 + minutes + session.duration_minutes;
    const endHours = Math.floor(endMinutes / 60) % 24;
    const endMins = endMinutes % 60;
    const endTime = `${String(endHours).padStart(2, "0")}:${String(endMins).padStart(2, "0")}`;

    return {
      id: session.id,
      groupName: group?.name || "Unknown Group",
      sport: group?.sport_type || "other",
      sportCategory,
      courtName: court?.name || "TBD",
      venueName: court?.venues?.name || "TBD",
      date: new Date(session.session_date),
      time: session.start_time.slice(0, 5),
      endTime,
      price:
        session.payment_type === "single"
          ? session.court_price
          : session.court_price / (session.min_players || 1),
      currentPlayers: playerCountMap.get(session.id) || 0,
      minPlayers: session.min_players,
      maxPlayers: session.max_players,
      state: session.state,
      isPaid: paymentStatusMap.get(session.id) === "completed",
      durationMinutes: session.duration_minutes,
    };
  });
}

async function fetchQuickChallenges(userId: string): Promise<GameData[]> {
  const { data: userQcPlayers } = await supabase
    .from("quick_challenge_players")
    .select("challenge_id, payment_status")
    .eq("user_id", userId);

  if (!userQcPlayers || userQcPlayers.length === 0) return [];

  const qcIds = [...new Set(userQcPlayers.map((p) => p.challenge_id))];
  const qcPaymentMap = new Map(userQcPlayers.map((p) => [p.challenge_id, p.payment_status]));

  const { data: qcData } = await supabase
    .from("quick_challenges")
    .select(`
      id, price_per_player, total_slots, scheduled_date, scheduled_time, status, created_at,
      sport_categories ( id, name, display_name, icon ),
      venues ( name ),
      courts ( name ),
      quick_challenge_players ( id )
    `)
    .in("id", qcIds)
    .in("status", ["open", "full"]);

  if (!qcData) return [];

  return qcData.map((qc: any) => {
    const scRow = qc.sport_categories;
    return {
      id: qc.id,
      groupName: `Quick ${scRow?.display_name || "Match"}`,
      sport: "other" as Database["public"]["Enums"]["sport_type"],
      sportCategory: scRow || undefined,
      courtName: qc.courts?.name || "TBD",
      venueName: qc.venues?.name || "TBD",
      date: qc.scheduled_date ? new Date(qc.scheduled_date) : new Date(qc.created_at),
      time: qc.scheduled_time?.slice(0, 5) || "00:00",
      endTime: "",
      price: qc.price_per_player,
      currentPlayers: qc.quick_challenge_players?.length || 0,
      minPlayers: qc.total_slots,
      maxPlayers: qc.total_slots,
      state: "protected" as Database["public"]["Enums"]["session_state"],
      isPaid: qcPaymentMap.get(qc.id) === "paid",
      durationMinutes: 60,
      linkTo: `/quick-games/${qc.id}`,
    };
  });
}

export function useMyGames(userId: string | undefined) {
  return useQuery({
    queryKey: ["my-games", userId],
    queryFn: () => fetchGames(userId!),
    enabled: !!userId,
    staleTime: 1000 * 60 * 2, // 2 min cache
  });
}
