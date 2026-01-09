import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "@/lib/auth-context";
import { MobileLayout } from "@/components/layout/MobileLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { SessionBadge } from "@/components/ui/session-badge";
import { PlayerCount } from "@/components/ui/player-count";
import { SportIcon, getSportLabel } from "@/components/ui/sport-icon";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { 
  Loader2, 
  ArrowLeft, 
  MapPin, 
  Calendar, 
  Clock, 
  DollarSign,
  Users,
  CheckCircle2,
  XCircle,
  Share2,
  MessageCircle
} from "lucide-react";
import { format, isPast } from "date-fns";

type Session = Database["public"]["Tables"]["sessions"]["Row"];
type Group = Database["public"]["Tables"]["groups"]["Row"];
type Court = Database["public"]["Tables"]["courts"]["Row"];
type Venue = Database["public"]["Tables"]["venues"]["Row"];
type Profile = Database["public"]["Tables"]["profiles"]["Row"];
type SessionPlayer = Database["public"]["Tables"]["session_players"]["Row"];
type SessionState = "protected" | "rescue" | "released";
type SportType = "futsal" | "tennis" | "volleyball" | "basketball" | "turf_hockey" | "badminton" | "other";

interface PlayerWithProfile extends SessionPlayer {
  profile?: Profile;
  isPaid?: boolean;
}

interface GameData {
  session: Session;
  group: Group;
  court?: Court & { venues?: Venue };
  players: PlayerWithProfile[];
}

export default function GameDetail() {
  const { id } = useParams<{ id: string }>();
  const { user, isLoading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [gameData, setGameData] = useState<GameData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/auth", { replace: true });
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (id && user) {
      fetchGameData();
    }
  }, [id, user]);

  const fetchGameData = async () => {
    if (!id || !user) return;

    setLoading(true);
    try {
      // Fetch session with court and venue
      const { data: sessionData, error: sessionError } = await supabase
        .from("sessions")
        .select(`
          *,
          courts (
            *,
            venues (*)
          )
        `)
        .eq("id", id)
        .maybeSingle();

      if (sessionError) throw sessionError;
      if (!sessionData) {
        setGameData(null);
        setLoading(false);
        return;
      }

      // Fetch group
      const { data: groupData, error: groupError } = await supabase
        .from("groups")
        .select("*")
        .eq("id", sessionData.group_id)
        .single();

      if (groupError) throw groupError;

      // Fetch players with profiles
      const { data: playersData } = await supabase
        .from("session_players")
        .select("*")
        .eq("session_id", id);

      const playersWithProfiles = await Promise.all(
        (playersData || []).map(async (player) => {
          const { data: profile } = await supabase
            .from("profiles")
            .select("*")
            .eq("user_id", player.user_id)
            .maybeSingle();
          
          // Check payment status
          const { data: payment } = await supabase
            .from("payments")
            .select("status")
            .eq("session_id", id)
            .eq("user_id", player.user_id)
            .maybeSingle();

          return { 
            ...player, 
            profile: profile || undefined, 
            isPaid: payment?.status === "completed" 
          };
        })
      );

      setGameData({
        session: sessionData,
        group: groupData,
        court: sessionData.courts as (Court & { venues?: Venue }) | undefined,
        players: playersWithProfiles,
      });
    } catch (error) {
      console.error("Error fetching game data:", error);
      setGameData(null);
    } finally {
      setLoading(false);
    }
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) return null;

  if (!gameData) {
    return (
      <MobileLayout>
        <div className="flex flex-col items-center justify-center py-16 px-4">
          <h2 className="text-xl font-semibold mb-2">Game not found</h2>
          <p className="text-muted-foreground mb-4">This game doesn't exist or has been removed.</p>
          <Button onClick={() => navigate("/games")}>Back to Games</Button>
        </div>
      </MobileLayout>
    );
  }

  const { session, group, court, players } = gameData;
  const sessionDate = new Date(session.session_date);
  const isGamePast = isPast(sessionDate);
  const paidCount = players.filter(p => p.isPaid).length;
  const pricePerPlayer = session.court_price / session.min_players;
  const isOrganizer = group.organizer_id === user.id;
  const isPlayerInGame = players.some(p => p.user_id === user.id);
  const currentPlayerPayment = players.find(p => p.user_id === user.id);

  return (
    <MobileLayout showHeader={false} showBottomNav={false}>
      <div className="min-h-screen bg-background">
        {/* Header */}
        <div className="sticky top-0 z-10 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b">
          <div className="flex items-center justify-between p-4 max-w-4xl mx-auto">
            <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <h1 className="font-display font-semibold">Game Details</h1>
            <Button variant="ghost" size="icon">
              <Share2 className="h-5 w-5" />
            </Button>
          </div>
        </div>

        <div className="p-4 space-y-4 max-w-4xl mx-auto lg:p-6 lg:space-y-6">
          {/* Game Header Card */}
          <Card>
            <CardContent className="p-4 lg:p-6">
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                <div className="flex items-center gap-4">
                  <SportIcon sport={group.sport_type as SportType} size="lg" />
                  <div>
                    <h2 className="font-display text-xl lg:text-2xl font-bold">{group.name}</h2>
                    <p className="text-muted-foreground">{getSportLabel(group.sport_type as SportType)}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <SessionBadge state={session.state as SessionState} />
                  {isGamePast && (
                    <Badge variant="secondary">Completed</Badge>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Details Grid */}
          <div className="grid gap-4 sm:grid-cols-2">
            {/* Date & Time */}
            <Card>
              <CardContent className="p-4 lg:p-6 space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Calendar className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Date</p>
                    <p className="font-semibold">{format(sessionDate, "EEEE, MMMM d, yyyy")}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Clock className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Time</p>
                    <p className="font-semibold">{session.start_time.slice(0, 5)} ({session.duration_minutes} min)</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Venue */}
            <Card>
              <CardContent className="p-4 lg:p-6 space-y-3">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <MapPin className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Venue</p>
                    <p className="font-semibold">{court?.venues?.name || "TBA"}</p>
                    <p className="text-sm text-muted-foreground">{court?.name || ""}</p>
                    <p className="text-sm text-muted-foreground mt-1">{court?.venues?.address || ""}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Price & Payment Status */}
          <Card>
            <CardContent className="p-4 lg:p-6">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <DollarSign className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Price per player</p>
                    <p className="text-2xl font-bold">${pricePerPlayer.toFixed(2)}</p>
                  </div>
                </div>
                {!isGamePast && isPlayerInGame && (
                  currentPlayerPayment?.isPaid ? (
                    <div className="flex items-center gap-2 px-4 py-2 bg-success/10 text-success rounded-lg">
                      <CheckCircle2 className="h-5 w-5" />
                      <span className="font-semibold">Paid & Confirmed</span>
                    </div>
                  ) : (
                    <Button className="btn-athletic">
                      Pay Now - ${pricePerPlayer.toFixed(2)}
                    </Button>
                  )
                )}
              </div>
            </CardContent>
          </Card>

          {/* Player Count */}
          <Card>
            <CardContent className="p-4 lg:p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Users className="h-5 w-5 text-muted-foreground" />
                  <span className="font-semibold">Players</span>
                </div>
                <Badge variant="outline">
                  {paidCount}/{players.length} paid
                </Badge>
              </div>
              <PlayerCount
                current={players.length}
                min={session.min_players}
                max={session.max_players}
              />
            </CardContent>
          </Card>

          {/* Players List */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center gap-2">
                <Users className="h-5 w-5" />
                {isGamePast ? "Players who attended" : "Confirmed Players"}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 lg:p-6 pt-2">
              {players.length > 0 ? (
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {players.map((player) => (
                    <div
                      key={player.id}
                      className="flex items-center gap-3 p-3 rounded-lg bg-muted/50"
                    >
                      <Avatar className="h-10 w-10">
                        <AvatarImage src={player.profile?.avatar_url || undefined} />
                        <AvatarFallback className="bg-primary/10 text-primary font-semibold">
                          {player.profile?.full_name?.split(" ").map(n => n[0]).join("") || "?"}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">
                          {player.profile?.full_name || "Player"}
                          {player.user_id === user.id && " (You)"}
                        </p>
                        <div className="flex items-center gap-1">
                          {player.isPaid ? (
                            <span className="text-xs text-success flex items-center gap-1">
                              <CheckCircle2 className="h-3 w-3" /> Paid
                            </span>
                          ) : (
                            <span className="text-xs text-warning flex items-center gap-1">
                              <XCircle className="h-3 w-3" /> Pending
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-center text-muted-foreground py-4">No players yet</p>
              )}
            </CardContent>
          </Card>

          {/* Notes */}
          {session.notes && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-lg flex items-center gap-2">
                  <MessageCircle className="h-5 w-5" />
                  Notes
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 lg:p-6 pt-2">
                <p className="text-muted-foreground">{session.notes}</p>
              </CardContent>
            </Card>
          )}

          {/* Action Buttons */}
          {!isGamePast && isPlayerInGame && (
            <div className="flex gap-3 pb-4">
              <Button variant="outline" className="flex-1">
                <MessageCircle className="h-4 w-4 mr-2" />
                Group Chat
              </Button>
              {!isOrganizer && (
                <Button variant="destructive" className="flex-1">
                  Leave Game
                </Button>
              )}
            </div>
          )}
        </div>
      </div>
    </MobileLayout>
  );
}
