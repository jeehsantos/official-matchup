import { useEffect, useState, useMemo } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "@/lib/auth-context";
import { MobileLayout } from "@/components/layout/MobileLayout";
import { GameCard } from "@/components/cards/GameCard";
import { QuickChallengeSummaryCard } from "@/components/quick-challenge/QuickChallengeSummaryCard";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, Calendar, Search, ChevronDown, ChevronUp } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { isBefore, parseISO } from "date-fns";
import type { Database } from "@/integrations/supabase/types";
import { getSportCategoriesMap } from "@/lib/sport-category-utils";

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
}

interface QuickChallengePlayer {
  user_id: string;
  payment_status: "pending" | "paid" | "refunded";
}

interface QuickGameData {
  id: string;
  sportName?: string;
  sportIcon?: string;
  gameMode: string;
  status: string;
  venueName?: string;
  venueAddress?: string;
  scheduledDate?: string;
  scheduledTime?: string;
  courtImage?: string | null;
  pricePerPlayer: number;
  totalSlots: number;
  playersCount: number;
}

const ITEMS_PER_PAGE = 12;

const isSessionPast = (sessionDate: string, startTime: string): boolean => {
  const now = new Date();
  const sessionDateTime = parseISO(`${sessionDate}T${startTime}`);
  return isBefore(sessionDateTime, now);
};

const isUserConfirmedInQuickChallenge = (
  challenge: { created_by: string; quick_challenge_players?: QuickChallengePlayer[] },
  userId: string
): boolean => {
  if (challenge.created_by === userId) return true;

  const participant = (challenge.quick_challenge_players || []).find(
    (player) => player.user_id === userId
  );

  return participant?.payment_status === "paid";
};

export default function Games() {
  const { user, isLoading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [allGames, setAllGames] = useState<(GameData & { durationMinutes: number })[]>([]);
  const [myQuickGames, setMyQuickGames] = useState<QuickGameData[]>([]);
  const [isPastGamesExpanded, setIsPastGamesExpanded] = useState(true);
  const [isPastQuickGamesExpanded, setIsPastQuickGamesExpanded] = useState(true);
  const [pastGamesPage, setPastGamesPage] = useState(1);
  const [pastQuickGamesPage, setPastQuickGamesPage] = useState(1);

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
      const sportCategoriesMap = await getSportCategoriesMap();

      // Sessions the user has joined (covers pre-payment joins and organizer-paid/free scenarios)
      const { data: joinedSessions } = await supabase
        .from("session_players")
        .select("session_id")
        .eq("user_id", user.id);

      // Sessions with completed payment records for this user (kept for completeness)
      const { data: paidSessions } = await supabase
        .from("payments")
        .select("session_id")
        .eq("user_id", user.id)
        .eq("status", "completed")
        .not("session_id", "is", null);

      const participantSessionIds = [
        ...(joinedSessions || []).map((p) => p.session_id),
        ...(paidSessions || []).map((p) => p.session_id),
      ].filter(Boolean);

      const uniqueParticipantSessionIds = [...new Set(participantSessionIds)] as string[];

      const { data: organizerGroups } = await supabase
        .from("groups")
        .select("id")
        .eq("organizer_id", user.id);

      const organizerGroupIds = organizerGroups?.map((g) => g.id) || [];

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

      if (organizerGroupIds.length > 0 && uniqueParticipantSessionIds.length > 0) {
        query = query.or(`group_id.in.(${organizerGroupIds.join(",")}),id.in.(${uniqueParticipantSessionIds.join(",")})`);
      } else if (organizerGroupIds.length > 0) {
        query = query.in("group_id", organizerGroupIds);
      } else if (uniqueParticipantSessionIds.length > 0) {
        query = query.in("id", uniqueParticipantSessionIds);
      } else {
        setAllGames([]);
        setMyQuickGames([]);
        setLoading(false);
        return;
      }

      const { data: sessions, error } = await query.order("session_date", { ascending: true });
      if (error) throw error;

      const sessionsWithCounts = await Promise.all(
        (sessions || []).map(async (session: any) => {
          const { count } = await supabase
            .from("session_players")
            .select("*", { count: "exact", head: true })
            .eq("session_id", session.id);

          const { data: payment } = await supabase
            .from("payments")
            .select("status")
            .eq("session_id", session.id)
            .eq("user_id", user.id)
            .maybeSingle();

          const group = session.groups;
          const court = session.courts;

          let sportCategory = (session as any).sport_categories;
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
            price: session.court_price / (session.min_players || 1),
            currentPlayers: count || 0,
            minPlayers: session.min_players,
            maxPlayers: session.max_players,
            state: session.state,
            isPaid: payment?.status === "completed",
            durationMinutes: session.duration_minutes,
          };
        })
      );

      const { data: quickChallenges, error: quickChallengesError } = await supabase
        .from("quick_challenges")
        .select(`
          id,
          created_by,
          game_mode,
          status,
          scheduled_date,
          scheduled_time,
          price_per_player,
          total_slots,
          sport_categories(display_name, icon),
          venues(name, address, photo_url),
          courts(photo_url),
          quick_challenge_players(user_id, payment_status)
        `)
        .in("status", ["open", "full", "in_progress", "completed"])
        .order("scheduled_date", { ascending: true });

      if (quickChallengesError) throw quickChallengesError;

      const confirmedQuickGames: QuickGameData[] = (quickChallenges || [])
        .filter((challenge: any) => isUserConfirmedInQuickChallenge(challenge, user.id))
        .map((challenge: any) => ({
          id: challenge.id,
          sportName: challenge.sport_categories?.display_name,
          sportIcon: challenge.sport_categories?.icon || "🎯",
          gameMode: challenge.game_mode,
          status: challenge.status,
          venueName: challenge.venues?.name,
          venueAddress: challenge.venues?.address,
          scheduledDate: challenge.scheduled_date || undefined,
          scheduledTime: challenge.scheduled_time || undefined,
          courtImage: challenge.courts?.photo_url || challenge.venues?.photo_url || "/placeholder.svg",
          pricePerPlayer: challenge.price_per_player,
          totalSlots: challenge.total_slots,
          playersCount: challenge.quick_challenge_players?.length || 0,
        }));

      setAllGames(sessionsWithCounts);
      setMyQuickGames(confirmedQuickGames);
    } catch (error) {
      console.error("Error fetching games:", error);
    } finally {
      setLoading(false);
    }
  };

  const { upcomingGames, pastGames, upcomingQuickGames, pastQuickGames } = useMemo(() => {
    const upcoming: GameData[] = [];
    const past: GameData[] = [];

    allGames.forEach((game) => {
      const sessionDateStr = game.date.toISOString().split("T")[0];
      if (isSessionPast(sessionDateStr, game.time)) {
        past.push(game);
      } else {
        upcoming.push(game);
      }
    });

    const upcomingQuick = myQuickGames.filter((challenge) => {
      if (!challenge.scheduledDate || !challenge.scheduledTime) return true;
      return !isSessionPast(challenge.scheduledDate, challenge.scheduledTime);
    });

    const pastQuick = myQuickGames.filter((challenge) => {
      if (!challenge.scheduledDate || !challenge.scheduledTime) return false;
      return isSessionPast(challenge.scheduledDate, challenge.scheduledTime);
    });

    upcoming.sort((a, b) => a.date.getTime() - b.date.getTime());
    past.sort((a, b) => b.date.getTime() - a.date.getTime());

    return {
      upcomingGames: upcoming,
      pastGames: past,
      upcomingQuickGames: upcomingQuick,
      pastQuickGames: pastQuick,
    };
  }, [allGames, myQuickGames]);

  const totalPastGamesPages = Math.max(1, Math.ceil(pastGames.length / ITEMS_PER_PAGE));
  const totalPastQuickGamesPages = Math.max(1, Math.ceil(pastQuickGames.length / ITEMS_PER_PAGE));

  const paginatedPastGames = pastGames.slice(
    (pastGamesPage - 1) * ITEMS_PER_PAGE,
    pastGamesPage * ITEMS_PER_PAGE
  );

  const paginatedPastQuickGames = pastQuickGames.slice(
    (pastQuickGamesPage - 1) * ITEMS_PER_PAGE,
    pastQuickGamesPage * ITEMS_PER_PAGE
  );

  useEffect(() => {
    setPastGamesPage((prev) => Math.min(prev, totalPastGamesPages));
  }, [totalPastGamesPages]);

  useEffect(() => {
    setPastQuickGamesPage((prev) => Math.min(prev, totalPastQuickGamesPages));
  }, [totalPastQuickGamesPages]);

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
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="font-display text-2xl lg:text-3xl font-bold">My Games</h1>
            <p className="text-muted-foreground text-sm">Track your upcoming and past games</p>
          </div>
        </div>

        <Tabs defaultValue="upcoming">
          <TabsList className="grid w-full grid-cols-2 max-w-md">
            <TabsTrigger value="upcoming">Upcoming</TabsTrigger>
            <TabsTrigger value="past">Past</TabsTrigger>
          </TabsList>

          <TabsContent value="upcoming" className="mt-4 space-y-6">
            {loading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : upcomingGames.length > 0 || upcomingQuickGames.length > 0 ? (
              <>
                {upcomingGames.length > 0 && (
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {upcomingGames.map((game) => (
                      <GameCard key={game.id} {...game} />
                    ))}
                  </div>
                )}

                {upcomingQuickGames.length > 0 && (
                  <div className="space-y-3">
                    <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Quick Games</h2>
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                      {upcomingQuickGames.map((challenge) => (
                        <QuickChallengeSummaryCard
                          key={challenge.id}
                          challenge={challenge}
                          onSelect={() => navigate(`/quick-games/${challenge.id}`)}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </>
            ) : (
              <Card className="max-w-md mx-auto">
                <CardContent className="p-6 text-center">
                  <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                    <Calendar className="h-8 w-8 text-primary" />
                  </div>
                  <h3 className="font-display font-semibold text-lg mb-2">No upcoming games</h3>
                  <p className="text-muted-foreground text-sm mb-4">Book a court to start playing with your group</p>
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

          <TabsContent value="past" className="mt-4 space-y-6">
            {loading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : pastGames.length > 0 || pastQuickGames.length > 0 ? (
              <>
                <div className="space-y-3">
                  <button
                    type="button"
                    className="flex w-full items-center justify-between rounded-md border border-border bg-background px-3 py-2 text-left"
                    onClick={() => setIsPastGamesExpanded((prev) => !prev)}
                  >
                    <span className="text-sm font-semibold uppercase tracking-wide">Games ({pastGames.length})</span>
                    {isPastGamesExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </button>

                  {isPastGamesExpanded && (
                    <>
                      {paginatedPastGames.length > 0 ? (
                        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                          {paginatedPastGames.map((game) => (
                            <GameCard key={game.id} {...game} />
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground">No past regular games.</p>
                      )}

                      {pastGames.length > ITEMS_PER_PAGE && (
                        <div className="flex items-center justify-between">
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={pastGamesPage === 1}
                            onClick={() => setPastGamesPage((prev) => Math.max(1, prev - 1))}
                          >
                            Previous
                          </Button>
                          <span className="text-sm text-muted-foreground">
                            Page {pastGamesPage} of {totalPastGamesPages}
                          </span>
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={pastGamesPage === totalPastGamesPages}
                            onClick={() => setPastGamesPage((prev) => Math.min(totalPastGamesPages, prev + 1))}
                          >
                            Next
                          </Button>
                        </div>
                      )}
                    </>
                  )}
                </div>

                <div className="space-y-3">
                  <button
                    type="button"
                    className="flex w-full items-center justify-between rounded-md border border-border bg-background px-3 py-2 text-left"
                    onClick={() => setIsPastQuickGamesExpanded((prev) => !prev)}
                  >
                    <span className="text-sm font-semibold uppercase tracking-wide">Quick Games ({pastQuickGames.length})</span>
                    {isPastQuickGamesExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </button>

                  {isPastQuickGamesExpanded && (
                    <>
                      {paginatedPastQuickGames.length > 0 ? (
                        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                          {paginatedPastQuickGames.map((challenge) => (
                            <QuickChallengeSummaryCard
                              key={challenge.id}
                              challenge={challenge}
                              onSelect={() => navigate(`/quick-games/${challenge.id}`)}
                            />
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground">No past quick games.</p>
                      )}

                      {pastQuickGames.length > ITEMS_PER_PAGE && (
                        <div className="flex items-center justify-between">
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={pastQuickGamesPage === 1}
                            onClick={() => setPastQuickGamesPage((prev) => Math.max(1, prev - 1))}
                          >
                            Previous
                          </Button>
                          <span className="text-sm text-muted-foreground">
                            Page {pastQuickGamesPage} of {totalPastQuickGamesPages}
                          </span>
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={pastQuickGamesPage === totalPastQuickGamesPages}
                            onClick={() => setPastQuickGamesPage((prev) => Math.min(totalPastQuickGamesPages, prev + 1))}
                          >
                            Next
                          </Button>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </>
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
