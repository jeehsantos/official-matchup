import { useEffect, useState, useMemo } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "@/lib/auth-context";
import { MobileLayout } from "@/components/layout/MobileLayout";
import { GameCard } from "@/components/cards/GameCard";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, Calendar, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { isBefore, parseISO } from "date-fns";
import type { Database } from "@/integrations/supabase/types";
import { getSportCategoriesMap } from "@/lib/sport-category-utils";
import { usePlatformFee } from "@/hooks/usePlatformFee";
import { estimateServiceFee } from "@/lib/utils";

type SportCategory = Database["public"]["Tables"]["sport_categories"]["Row"];

interface GameData {
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
  linkTo?: string;
}

// Helper to check if a session is in the past (date + time has passed)
const isSessionPast = (sessionDate: string, startTime: string): boolean => {
  const now = new Date();
  const sessionDateTime = parseISO(`${sessionDate}T${startTime}`);
  return isBefore(sessionDateTime, now);
};



export default function Games() {
  const { user, isLoading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { playerFee } = usePlatformFee();
  const [loading, setLoading] = useState(true);
  const [allGames, setAllGames] = useState<(GameData & { durationMinutes: number })[]>([]);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/auth", { replace: true });
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (user) {
      fetchGames();
    }
  }, [user]);

  const fetchGames = async () => {
    if (!user) return;

    setLoading(true);
    try {
      // Fetch sport categories map for enrichment
      const sportCategoriesMap = await getSportCategoriesMap();

      // Fetch sessions where user is a player or organizer
      const { data: playerSessions } = await supabase
        .from("session_players")
        .select("session_id")
        .eq("user_id", user.id);

      const playerSessionIds = playerSessions?.map((p) => p.session_id) || [];

      // Fetch groups where user is organizer
      const { data: organizerGroups } = await supabase
        .from("groups")
        .select("id")
        .eq("organizer_id", user.id);

      const organizerGroupIds = organizerGroups?.map((g) => g.id) || [];

      // Fetch all sessions for these groups or where user is a player
      let query = supabase
        .from("sessions")
        .select(`
          *,
          groups (*),
          courts (
            *,
            venues (*)
          ),
          sport_categories (*)
        `)
        .eq("is_cancelled", false);

      // Build OR condition
      if (organizerGroupIds.length > 0 && playerSessionIds.length > 0) {
        query = query.or(`group_id.in.(${organizerGroupIds.join(",")}),id.in.(${playerSessionIds.join(",")})`);
      } else if (organizerGroupIds.length > 0) {
        query = query.in("group_id", organizerGroupIds);
      } else if (playerSessionIds.length > 0) {
        query = query.in("id", playerSessionIds);
      } else {
        // No sessions
        setAllGames([]);
        setLoading(false);
        return;
      }

      const { data: sessions, error } = await query.order("session_date", { ascending: true });

      if (error) throw error;

      // Fetch player counts for each session
      const sessionsWithCounts = await Promise.all(
        (sessions || []).map(async (session: any) => {
          const { count } = await supabase
            .from("session_players")
            .select("*", { count: "exact", head: true })
            .eq("session_id", session.id);

          // Check if user has paid
          const { data: payment } = await supabase
            .from("payments")
            .select("status")
            .eq("session_id", session.id)
            .eq("user_id", user.id)
            .maybeSingle();

          const group = session.groups;
          const court = session.courts;
          
          // Use sport category directly from session (preferred) or fallback to group's sport_type
          let sportCategory = (session as any).sport_categories;
          if (!sportCategory && group?.sport_type) {
            sportCategory = sportCategoriesMap.get(group.sport_type);
          }

          // Calculate end time
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
            price: session.payment_type === "single"
              ? session.court_price
              : session.court_price / (session.min_players || 1),
            currentPlayers: count || 0,
            minPlayers: session.min_players,
            maxPlayers: session.max_players,
            state: session.state,
            isPaid: payment?.status === "completed",
            durationMinutes: session.duration_minutes,
          };
        })
      );

      // --- Fetch Quick Challenges the user has joined ---
      const { data: userQcPlayers } = await supabase
        .from("quick_challenge_players")
        .select("challenge_id, payment_status")
        .eq("user_id", user.id);

      let quickChallengeGames: (GameData & { durationMinutes: number })[] = [];

      if (userQcPlayers && userQcPlayers.length > 0) {
        const qcIds = [...new Set(userQcPlayers.map((p) => p.challenge_id))];
        const qcPaymentMap = new Map(userQcPlayers.map((p) => [p.challenge_id, p.payment_status]));

        const { data: qcData } = await supabase
          .from("quick_challenges")
          .select(`
            *,
            sport_categories (id, name, display_name, icon),
            venues (id, name, city),
            courts (id, name),
            quick_challenge_players (id)
          `)
          .in("id", qcIds)
          .in("status", ["open", "full"]);

        if (qcData) {
          quickChallengeGames = qcData.map((qc: any) => {
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
      }

      setAllGames([...sessionsWithCounts, ...quickChallengeGames]);
    } catch (error) {
      console.error("Error fetching games:", error);
    } finally {
      setLoading(false);
    }
  };

  // Memoized filtering: Upcoming = not yet started, Past = already started/completed
  const { upcomingGames, pastGames } = useMemo(() => {
    const upcoming: GameData[] = [];
    const past: GameData[] = [];

    allGames.forEach((game) => {
      const sessionDateStr = game.date.toISOString().split("T")[0];
      
      // Check if the session start time has passed
      if (isSessionPast(sessionDateStr, game.time)) {
        past.push(game);
      } else {
        upcoming.push(game);
      }
    });

    // Sort upcoming by date ascending, past by date descending
    upcoming.sort((a, b) => a.date.getTime() - b.date.getTime());
    past.sort((a, b) => b.date.getTime() - a.date.getTime());

    return { upcomingGames: upcoming, pastGames: past };
  }, [allGames]);

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) return null;

  return (
    <MobileLayout>
      <div className="px-4 py-4 space-y-4 max-w-6xl mx-auto lg:px-6 lg:py-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="font-display text-2xl lg:text-3xl font-bold">My Games</h1>
            <p className="text-muted-foreground text-sm">
              Track your upcoming and past games
            </p>
          </div>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="upcoming">
          <TabsList className="grid w-full grid-cols-2 max-w-md">
            <TabsTrigger value="upcoming">Upcoming</TabsTrigger>
            <TabsTrigger value="past">Past</TabsTrigger>
          </TabsList>

          <TabsContent value="upcoming" className="mt-4">
            {loading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : upcomingGames.length > 0 ? (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {upcomingGames.map((game) => (
                  <GameCard key={game.id} {...game} serviceFee={estimateServiceFee(game.price, playerFee)} />
                ))}
              </div>
            ) : (
              <Card className="max-w-md mx-auto">
                <CardContent className="p-6 text-center">
                  <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                    <Calendar className="h-8 w-8 text-primary" />
                  </div>
                  <h3 className="font-display font-semibold text-lg mb-2">
                    No upcoming games
                  </h3>
                  <p className="text-muted-foreground text-sm mb-4">
                    Book a court to start playing with your group
                  </p>
                  <Link to="/courts">
                    <Button className="btn-athletic gap-2">
                      <Search className="h-4 w-4" />
                      Browse Courts
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="past" className="mt-4">
            {loading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : pastGames.length > 0 ? (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {pastGames.map((game) => (
                  <GameCard key={game.id} {...game} serviceFee={estimateServiceFee(game.price, playerFee)} />
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <p>No past games yet</p>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </MobileLayout>
  );
}
