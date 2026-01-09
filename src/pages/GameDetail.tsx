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
import { SessionChat } from "@/components/chat/SessionChat";
import { EditPlayerLimits } from "@/components/session/EditPlayerLimits";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { useToast } from "@/hooks/use-toast";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
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
  MessageCircle,
  AlertTriangle,
  LifeBuoy,
  UserMinus,
  Trash2,
  ListOrdered
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
  isWaitingList?: boolean;
}

interface GameData {
  session: Session;
  group: Group;
  court?: Court & { venues?: Venue };
  players: PlayerWithProfile[];
  waitingList: PlayerWithProfile[];
  courtManagerId?: string;
}

export default function GameDetail() {
  const { id } = useParams<{ id: string }>();
  const { user, isLoading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [gameData, setGameData] = useState<GameData | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

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
        .eq("session_id", id)
        .order("joined_at", { ascending: true });

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

      // Separate confirmed players and waiting list based on max_players
      const confirmedPlayers = playersWithProfiles.slice(0, sessionData.max_players);
      const waitingList = playersWithProfiles.slice(sessionData.max_players).map(p => ({
        ...p,
        isWaitingList: true
      }));

      // Get court manager ID from venue
      const courtManagerId = (sessionData.courts as any)?.venues?.owner_id;

      setGameData({
        session: sessionData,
        group: groupData,
        court: sessionData.courts as (Court & { venues?: Venue }) | undefined,
        players: confirmedPlayers,
        waitingList: waitingList,
        courtManagerId,
      });
    } catch (error) {
      console.error("Error fetching game data:", error);
      setGameData(null);
    } finally {
      setLoading(false);
    }
  };

  const handleActivateRescue = async () => {
    if (!gameData || !id) return;

    setActionLoading(true);
    try {
      const { error } = await supabase
        .from("sessions")
        .update({ 
          state: "rescue" as SessionState, 
          is_rescue_open: true 
        })
        .eq("id", id);

      if (error) throw error;

      toast({
        title: "Rescue mode activated",
        description: "External players can now join this session.",
      });
      fetchGameData();
    } catch (error) {
      console.error("Error activating rescue:", error);
      toast({
        title: "Error",
        description: "Failed to activate rescue mode.",
        variant: "destructive",
      });
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeactivateRescue = async () => {
    if (!gameData || !id) return;

    setActionLoading(true);
    try {
      const { error } = await supabase
        .from("sessions")
        .update({ 
          state: "protected" as SessionState, 
          is_rescue_open: false 
        })
        .eq("id", id);

      if (error) throw error;

      toast({
        title: "Rescue mode deactivated",
        description: "Session is now protected again.",
      });
      fetchGameData();
    } catch (error) {
      console.error("Error deactivating rescue:", error);
      toast({
        title: "Error",
        description: "Failed to deactivate rescue mode.",
        variant: "destructive",
      });
    } finally {
      setActionLoading(false);
    }
  };

  const handleLeaveSession = async () => {
    if (!gameData || !id || !user) return;

    setActionLoading(true);
    try {
      const { error } = await supabase
        .from("session_players")
        .delete()
        .eq("session_id", id)
        .eq("user_id", user.id);

      if (error) throw error;

      toast({
        title: "Left session",
        description: "You have left this game session.",
      });
      navigate(-1);
    } catch (error) {
      console.error("Error leaving session:", error);
      toast({
        title: "Error",
        description: "Failed to leave the session.",
        variant: "destructive",
      });
    } finally {
      setActionLoading(false);
    }
  };

  const handleJoinRescueSession = async () => {
    if (!gameData || !id || !user) return;

    setActionLoading(true);
    try {
      // Check if already joined
      const { data: existingPlayer } = await supabase
        .from("session_players")
        .select("id")
        .eq("session_id", id)
        .eq("user_id", user.id)
        .maybeSingle();

      if (existingPlayer) {
        toast({
          title: "Already joined",
          description: "You're already in this session.",
        });
        return;
      }

      // Add player to session
      const { error } = await supabase
        .from("session_players")
        .insert({
          session_id: id,
          user_id: user.id,
          is_from_rescue: true,
        });

      if (error) throw error;

      toast({
        title: "Joined successfully!",
        description: "You've been added to this rescue session.",
      });
      fetchGameData();
    } catch (error) {
      console.error("Error joining rescue session:", error);
      toast({
        title: "Error",
        description: "Failed to join the session.",
        variant: "destructive",
      });
    } finally {
      setActionLoading(false);
    }
  };

  const handleMakePayment = async () => {
    if (!gameData || !id || !user) return;

    setActionLoading(true);
    try {
      // Call edge function to create Stripe checkout session
      const { data, error } = await supabase.functions.invoke("create-payment", {
        body: {
          sessionId: id,
          paymentType: "before_session",
          returnUrl: `/games/${id}`,
        },
      });

      if (error) throw error;

      if (data?.url) {
        // Redirect to Stripe checkout
        window.location.href = data.url;
      } else {
        throw new Error("No payment URL returned");
      }
    } catch (error) {
      console.error("Error initiating payment:", error);
      toast({
        title: "Payment Error",
        description: "Failed to initiate payment. Please try again.",
        variant: "destructive",
      });
    } finally {
      setActionLoading(false);
    }
  };

  const handleConfirmAttendance = async () => {
    if (!gameData || !id || !user) return;

    setActionLoading(true);
    try {
      const { error } = await supabase
        .from("session_players")
        .update({ 
          is_confirmed: true, 
          confirmed_at: new Date().toISOString() 
        })
        .eq("session_id", id)
        .eq("user_id", user.id);

      if (error) throw error;

      toast({
        title: "Attendance confirmed",
        description: "You've confirmed you're coming to this game.",
      });
      fetchGameData();
    } catch (error) {
      console.error("Error confirming attendance:", error);
      toast({
        title: "Error",
        description: "Failed to confirm attendance.",
        variant: "destructive",
      });
    } finally {
      setActionLoading(false);
    }
  };

  const handleCancelSession = async () => {
    if (!gameData || !id) return;

    setActionLoading(true);
    try {
      // Use database function to cancel session and release court availability
      const { data, error } = await supabase.rpc('cancel_session_and_release_court', {
        session_id: id
      });

      if (error) throw error;
      
      if (!data) {
        throw new Error("You don't have permission to cancel this session");
      }

      toast({
        title: "Session cancelled",
        description: "The session has been cancelled and the court is now available.",
      });
      navigate(`/groups/${gameData.group.id}`);
    } catch (error) {
      console.error("Error cancelling session:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to cancel the session.",
        variant: "destructive",
      });
    } finally {
      setActionLoading(false);
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

  const { session, group, court, players, waitingList, courtManagerId } = gameData;
  // Combine session date and start time for accurate past check
  const sessionDateTime = new Date(`${session.session_date}T${session.start_time}`);
  const isGamePast = isPast(sessionDateTime);
  const paidCount = players.filter(p => p.isPaid).length;
  const pricePerPlayer = session.court_price / session.min_players;
  const isOrganizer = group.organizer_id === user.id;
  const isPlayerInGame = players.some(p => p.user_id === user.id);
  const isInWaitingList = waitingList.some(p => p.user_id === user.id);
  const currentPlayerPayment = players.find(p => p.user_id === user.id);
  const isRescueActive = session.state === "rescue" && session.is_rescue_open;
  const isCourtManager = courtManagerId === user.id;
  const canJoinRescue = isRescueActive && !isPlayerInGame && !isInWaitingList && !isOrganizer && !isGamePast && players.length < session.max_players;

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

        <div className="p-4 space-y-4 max-w-4xl mx-auto lg:p-6 lg:space-y-6 pb-24">
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

          {/* Organizer Rescue Controls */}
          {isOrganizer && !isGamePast && (
            <Card className="border-warning/50 bg-warning/5">
              <CardContent className="p-4 lg:p-6">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-warning/10 flex items-center justify-center">
                      <LifeBuoy className="h-5 w-5 text-warning" />
                    </div>
                    <div>
                      <p className="font-semibold">Rescue Mode</p>
                      <p className="text-sm text-muted-foreground">
                        {isRescueActive 
                          ? "External players can join this session" 
                          : "Allow external players to fill empty spots"}
                      </p>
                    </div>
                  </div>
                  {isRescueActive ? (
                    <Button 
                      variant="outline" 
                      onClick={handleDeactivateRescue}
                      disabled={actionLoading}
                    >
                      {actionLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                      Deactivate Rescue
                    </Button>
                  ) : (
                    <Button 
                      className="bg-warning text-warning-foreground hover:bg-warning/90"
                      onClick={handleActivateRescue}
                      disabled={actionLoading}
                    >
                      {actionLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                      Activate Rescue
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Join Rescue Session - For external players */}
          {canJoinRescue && (
            <Card className="border-success/50 bg-success/5">
              <CardContent className="p-4 lg:p-6">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-success/10 flex items-center justify-center">
                      <LifeBuoy className="h-5 w-5 text-success" />
                    </div>
                    <div>
                      <p className="font-semibold">Join This Rescue Game!</p>
                      <p className="text-sm text-muted-foreground">
                        This game needs players. Join now for ${pricePerPlayer.toFixed(2)} per player.
                      </p>
                    </div>
                  </div>
                  <Button 
                    onClick={handleJoinRescueSession}
                    disabled={actionLoading}
                    className="bg-success hover:bg-success/90 text-success-foreground"
                  >
                    {actionLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                    Join Game
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

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
                    <p className="font-semibold">{format(sessionDateTime, "EEEE, MMMM d, yyyy")}</p>
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
                {session.payment_type === "single" ? (
                // Organizer pays full amount
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-success/10 flex items-center justify-center">
                      <CheckCircle2 className="h-5 w-5 text-success" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Payment</p>
                      <p className="font-semibold text-success">Covered by Organizer</p>
                      <p className="text-sm text-muted-foreground">Total: ${session.court_price.toFixed(2)}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {isOrganizer && !isGamePast && (
                      <div className="flex items-center gap-2 px-4 py-2 bg-muted rounded-lg">
                        <DollarSign className="h-5 w-5 text-muted-foreground" />
                        <span className="font-semibold">${session.court_price.toFixed(2)}</span>
                      </div>
                    )}
                    {!isOrganizer && isPlayerInGame && !isGamePast && (
                      currentPlayerPayment?.is_confirmed ? (
                        <div className="flex items-center gap-2 px-4 py-2 bg-success/10 text-success rounded-lg">
                          <CheckCircle2 className="h-5 w-5" />
                          <span className="font-semibold">Confirmed</span>
                        </div>
                      ) : (
                        <Button 
                          className="bg-success hover:bg-success/90 text-success-foreground"
                          onClick={handleConfirmAttendance}
                          disabled={actionLoading}
                        >
                          {actionLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                          Confirm Attendance
                        </Button>
                      )
                    )}
                  </div>
                </div>
              ) : (
                // Split payment
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
                  {!isGamePast && (
                    <>
                      {isPlayerInGame && (
                        currentPlayerPayment?.isPaid ? (
                          <div className="flex items-center gap-2 px-4 py-2 bg-success/10 text-success rounded-lg">
                            <CheckCircle2 className="h-5 w-5" />
                            <span className="font-semibold">Paid & Confirmed</span>
                          </div>
                        ) : (
                          <Button 
                            className="btn-athletic"
                            onClick={handleMakePayment}
                            disabled={actionLoading}
                          >
                            {actionLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                            Make Payment - ${pricePerPlayer.toFixed(2)}
                          </Button>
                        )
                      )}
                      {isInWaitingList && (
                        <Button disabled className="opacity-50">
                          Waiting List
                        </Button>
                      )}
                    </>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Player Count with Organizer Edit */}
          <Card>
            <CardContent className="p-4 lg:p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Users className="h-5 w-5 text-muted-foreground" />
                  <span className="font-semibold">Players</span>
                </div>
                <div className="flex items-center gap-2">
                  {session.payment_type === "split" && (
                    <Badge variant="outline">
                      {paidCount}/{players.length} paid
                    </Badge>
                  )}
                </div>
              </div>
              <PlayerCount
                current={players.length}
                min={session.min_players}
                max={session.max_players}
              />
              
              {/* Organizer can edit player limits */}
              {isOrganizer && !isGamePast && (
                <EditPlayerLimits 
                  sessionId={session.id}
                  currentMin={session.min_players}
                  currentMax={session.max_players}
                  courtPrice={session.court_price}
                  onUpdate={fetchGameData}
                />
              )}
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
                      {session.payment_type === "single" ? (
                            // For organizer-paid sessions, check is_confirmed
                            player.is_confirmed ? (
                              <span className="text-xs text-success flex items-center gap-1">
                                <CheckCircle2 className="h-3 w-3" /> Confirmed
                              </span>
                            ) : (
                              <span className="text-xs text-warning flex items-center gap-1">
                                <XCircle className="h-3 w-3" /> Pending
                              </span>
                            )
                          ) : (
                            // For split payment sessions, check isPaid
                            player.isPaid ? (
                              <span className="text-xs text-success flex items-center gap-1">
                                <CheckCircle2 className="h-3 w-3" /> Confirmed
                              </span>
                            ) : (
                              <span className="text-xs text-warning flex items-center gap-1">
                                <XCircle className="h-3 w-3" /> Pending
                              </span>
                            )
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

          {/* Waiting List */}
          {waitingList.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-lg flex items-center gap-2">
                  <ListOrdered className="h-5 w-5" />
                  Waiting List
                  <Badge variant="secondary" className="ml-2">{waitingList.length}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 lg:p-6 pt-2">
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {waitingList.map((player, index) => (
                    <div
                      key={player.id}
                      className="flex items-center gap-3 p-3 rounded-lg bg-muted/30 border border-dashed"
                    >
                      <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center text-xs font-semibold">
                        {index + 1}
                      </div>
                      <Avatar className="h-10 w-10">
                        <AvatarImage src={player.profile?.avatar_url || undefined} />
                        <AvatarFallback className="bg-muted text-muted-foreground font-semibold">
                          {player.profile?.full_name?.split(" ").map(n => n[0]).join("") || "?"}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">
                          {player.profile?.full_name || "Player"}
                          {player.user_id === user.id && " (You)"}
                        </p>
                        <span className="text-xs text-muted-foreground">
                          In queue
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
                <p className="text-sm text-muted-foreground mt-4 text-center">
                  Players on the waiting list will be automatically added when a spot opens up.
                </p>
              </CardContent>
            </Card>
          )}

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

          {/* Session Chat - Only for organizer or court manager */}
          {(isOrganizer || isCourtManager) && courtManagerId && (
            <SessionChat
              sessionId={session.id}
              sessionDate={session.session_date}
              sessionStartTime={session.start_time}
              sessionDurationMinutes={session.duration_minutes}
              courtManagerId={courtManagerId}
              isOrganizer={isOrganizer}
            />
          )}

          {/* Organizer Cancel Session */}
          {isOrganizer && !isGamePast && (
            <Card className="border-destructive/50">
              <CardContent className="p-4 lg:p-6">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-destructive/10 flex items-center justify-center">
                      <Trash2 className="h-5 w-5 text-destructive" />
                    </div>
                    <div>
                      <p className="font-semibold text-destructive">Cancel Session</p>
                      <p className="text-sm text-muted-foreground">
                        This will release the court and remove all players
                      </p>
                    </div>
                  </div>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="destructive" disabled={actionLoading}>
                        Cancel Session
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle className="flex items-center gap-2">
                          <AlertTriangle className="h-5 w-5 text-destructive" />
                          Cancel this session?
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                          This action cannot be undone. The court availability will be released and all players will be removed from this session.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Keep Session</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={handleCancelSession}
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                          {actionLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                          Yes, Cancel Session
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Leave Game Button - Only for non-organizer players */}
          {!isGamePast && (isPlayerInGame || isInWaitingList) && !isOrganizer && (
            <div className="pb-4">
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button 
                    variant="destructive" 
                    className="w-full"
                    disabled={actionLoading}
                  >
                    <UserMinus className="h-4 w-4 mr-2" />
                    Leave Game
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Leave this game?</AlertDialogTitle>
                    <AlertDialogDescription>
                      {isInWaitingList 
                        ? "You will be removed from the waiting list."
                        : "Your spot will be given to the next person on the waiting list."}
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Stay</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={handleLeaveSession}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      Leave Game
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          )}
        </div>
      </div>
    </MobileLayout>
  );
}
