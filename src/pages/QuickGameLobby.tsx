import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useQuickChallenges, useJoinChallenge, useCancelChallenge, useUpdateChallengeFormat } from "@/hooks/useQuickChallenges";
import { useQuickChallengePayment } from "@/hooks/useQuickChallengePayment";
import { useAuth } from "@/lib/auth-context";
import { useTheme } from "@/hooks/useTheme";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import {
  Loader2,
  ArrowLeft,
  MapPin,
  Plus,
  Settings,
  LogOut,
  CheckCircle2,
  Clock,
  Sun,
  Moon,
  CreditCard,
  AlertTriangle,
} from "lucide-react";
import { format } from "date-fns";
import { LobbyChatPanel } from "@/components/quick-challenge/LobbyChatPanel";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

// --- TYPES ---
type TeamSide = "left" | "right";
type PaymentStatus = "pending" | "paid" | "refunded";

interface LobbyPlayer {
  id: string;
  name: string;
  avatarUrl?: string | null;
  nationalityCode?: string | null;
  team: TeamSide;
  slotPosition: number;
  paymentStatus: PaymentStatus;
  isMe?: boolean;
}

// --- SUB-COMPONENTS ---
interface PlayerSlotProps {
  role: string;
  player?: LobbyPlayer;
  side: TeamSide;
  isCurrentUser?: boolean;
  onJoin?: () => void;
  onPay?: () => void;
  isJoining?: boolean;
}

function PlayerSlot({ role, player, side, isCurrentUser, onJoin, onPay, isJoining }: PlayerSlotProps) {
  const isLeft = side === "left";
  const isEmpty = !player;
  const isMe = isCurrentUser || player?.isMe;
  const isPaid = player?.paymentStatus === "paid";

  // Get flag URL
  const getFlagUrl = (code?: string | null) => {
    if (!code) return null;
    const normalized = code.trim().toUpperCase();
    if (normalized.length !== 2) return null;
    return `https://flagcdn.com/w40/${normalized.toLowerCase()}.png`;
  };

  const flagUrl = getFlagUrl(player?.nationalityCode);

  return (
    <div
      className={cn(
        "relative flex items-center h-14 md:h-16 transition-all duration-300 rounded-lg px-2 cursor-pointer",
        isMe
          ? "bg-primary/10 ring-1 ring-primary shadow-[0_0_15px_hsl(var(--primary)/0.2)]"
          : "hover:bg-accent/50",
        isLeft ? "flex-row" : "flex-row-reverse"
      )}
      onClick={isEmpty ? onJoin : undefined}
    >
      {/* Avatar */}
      <div
        className={cn(
          "relative z-10 w-9 h-9 md:w-11 md:h-11 rounded-full border-2 shrink-0 transition-transform overflow-hidden",
          isEmpty
            ? "border-muted-foreground/20 bg-muted"
            : isMe
            ? "border-primary scale-105"
            : isLeft
            ? "border-blue-500"
            : "border-red-500"
        )}
      >
        {!isEmpty && player ? (
          <img
            src={
              player.avatarUrl ||
              `https://ui-avatars.com/api/?name=${encodeURIComponent(player.name)}&background=${isLeft ? "3b82f6" : "ef4444"}&color=fff`
            }
            className="w-full h-full rounded-full object-cover"
            alt={player.name}
          />
        ) : (
          <div className="w-full h-full rounded-full flex items-center justify-center bg-muted">
            {isJoining ? (
              <Loader2 size={14} className="text-muted-foreground animate-spin" />
            ) : (
              <Plus size={14} className="text-muted-foreground/50" />
            )}
          </div>
        )}
      </div>

      {/* Player Info */}
      <div
        className={cn(
          "flex flex-col px-2 md:px-3 z-10 overflow-hidden flex-1",
          isLeft ? "text-left" : "text-right"
        )}
      >
        <span
          className={cn(
            "text-[7px] md:text-[9px] font-bold uppercase tracking-tighter truncate",
            isMe
              ? "text-primary"
              : isLeft
              ? "text-blue-500/70"
              : "text-red-500/70"
          )}
        >
          {role}
        </span>
        <span
          className={cn(
            "text-[10px] md:text-sm font-bold truncate flex items-center gap-1",
            isMe ? "text-foreground" : "text-foreground/90",
            !isLeft && "flex-row-reverse"
          )}
        >
          {isEmpty ? (
            isJoining ? "Joining..." : "Waiting for player"
          ) : (
            <>
              {player.name}
              {flagUrl && (
                <img
                  src={flagUrl}
                  alt="flag"
                  className="h-3 w-4 rounded-sm object-cover inline-block"
                />
              )}
            </>
          )}
        </span>

        {!isEmpty && (
          <div
            className={cn(
              "flex items-center gap-1 mt-0.5",
              !isLeft && "flex-row-reverse"
            )}
          >
            {isPaid ? (
              <>
                <CheckCircle2 size={10} className="text-green-500" />
                <span className="text-[7px] md:text-[8px] font-black text-green-500 uppercase tracking-tighter">
                  Paid
                </span>
              </>
            ) : (
              <>
                <Clock size={10} className="text-warning" />
                <span className="text-[7px] md:text-[8px] font-black text-warning uppercase tracking-tighter">
                  Pending
                </span>
              </>
            )}
          </div>
        )}
      </div>

      {/* Pay Button for current user with pending status */}
      {isMe && !isPaid && !isEmpty && (
        <Button
          size="sm"
          variant="default"
          className="h-7 px-2 text-[9px] md:text-[10px] gap-1 shrink-0"
          onClick={(e) => {
            e.stopPropagation();
            onPay?.();
          }}
        >
          <CreditCard size={12} />
          Pay
        </Button>
      )}
    </div>
  );
}

// --- SETTINGS MODAL ---
interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  teamSize: number;
  gameMode: string;
  isOrganizer: boolean;
  challengeId: string;
  currentPlayerCount: number;
  onFormatChange: (newFormat: string) => void;
  isUpdating?: boolean;
}

const MATCH_FORMATS = ["1vs1", "2vs2", "3vs3", "4vs4", "5vs5"];

function SettingsModal({ 
  isOpen, 
  onClose, 
  teamSize, 
  gameMode, 
  isOrganizer,
  challengeId,
  currentPlayerCount,
  onFormatChange,
  isUpdating,
}: SettingsModalProps) {
  const { theme, setTheme } = useTheme();
  const [selectedFormat, setSelectedFormat] = useState(gameMode);

  // Update local state when gameMode changes
  useEffect(() => {
    setSelectedFormat(gameMode);
  }, [gameMode]);

  if (!isOpen) return null;

  const handleFormatChange = (newFormat: string) => {
    setSelectedFormat(newFormat);
    onFormatChange(newFormat);
  };

  // Calculate which formats are available based on current players
  const getFormatDisabled = (format: string) => {
    const match = format.match(/(\d+)vs(\d+)/);
    const slots = match ? parseInt(match[1]) * 2 : 2;
    return currentPlayerCount > slots;
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-sm rounded-2xl shadow-2xl p-6 border bg-card border-border">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-sm font-black uppercase tracking-widest">
            Lobby Settings
          </h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-accent rounded-full transition-colors"
          >
            <LogOut size={20} />
          </button>
        </div>

        <div className="space-y-6">
          {/* Theme Toggle */}
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase text-muted-foreground">
              Visual Theme
            </span>
            <button
              onClick={() => setTheme(theme === "light" ? "dark" : "light")}
              className="flex items-center gap-2 px-4 py-2 rounded-lg border bg-muted border-border transition-all"
            >
              {theme === "light" ? <Sun size={14} /> : <Moon size={14} />}
              <span className="text-[10px] font-black uppercase">
                {theme} Mode
              </span>
            </button>
          </div>

          {/* Match Format */}
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase text-muted-foreground">
              Match Format
            </span>
            {isOrganizer ? (
              <Select 
                value={selectedFormat} 
                onValueChange={handleFormatChange}
                disabled={isUpdating}
              >
                <SelectTrigger className="w-[120px]">
                  <SelectValue placeholder="Select format" />
                </SelectTrigger>
                <SelectContent className="z-[200]">
                  {MATCH_FORMATS.map((format) => (
                    <SelectItem 
                      key={format} 
                      value={format}
                      disabled={getFormatDisabled(format)}
                    >
                      {format}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <div className="flex items-center gap-2 px-4 py-2 rounded-lg border bg-muted border-border">
                <span className="text-[10px] font-black uppercase">
                  {gameMode}
                </span>
              </div>
            )}
          </div>
        </div>

        <Button onClick={onClose} className="w-full mt-8" variant="default">
          Close
        </Button>
      </div>
    </div>
  );
}

// --- MAIN COMPONENT ---
export default function QuickGameLobby() {
  const { id } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user, isLoading } = useAuth();
  const { data: quickChallenges = [], isLoading: loadingChallenges } = useQuickChallenges();
  const joinChallenge = useJoinChallenge();
  const cancelChallenge = useCancelChallenge();
  const updateFormat = useUpdateChallengeFormat();
  const { isPaying, initiatePayment, verifyPayment } = useQuickChallengePayment();

  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isQuitDialogOpen, setIsQuitDialogOpen] = useState(false);
  const [joiningSlot, setJoiningSlot] = useState<{ team: TeamSide; position: number } | null>(null);
  const [currentProfileId, setCurrentProfileId] = useState<string | null>(null);
  const [isVerifyingPayment, setIsVerifyingPayment] = useState(false);

  // Find the challenge
  const challenge = useMemo(
    () => quickChallenges.find((item) => item.id === id),
    [quickChallenges, id]
  );

  // Parse game mode to get team size (e.g., "5vs5" -> 5)
  const teamSize = useMemo(() => {
    if (!challenge?.game_mode) return 5;
    const match = challenge.game_mode.match(/(\d+)vs(\d+)/i);
    return match ? parseInt(match[1], 10) : 5;
  }, [challenge?.game_mode]);

  // Check if current user is the organizer
  const isOrganizer = useMemo(() => {
    if (!challenge || !user) return false;
    if (challenge.created_by === user.id) return true;
    return currentProfileId ? challenge.created_by === currentProfileId : false;
  }, [challenge, user, currentProfileId]);

  // Map players from backend to lobby format - deduplicate by user_id
  const players: LobbyPlayer[] = useMemo(() => {
    if (!challenge?.quick_challenge_players) return [];
    
    // Use a Map to deduplicate by user_id - keep the first occurrence (lowest slot)
    const uniquePlayersMap = new Map<string, typeof challenge.quick_challenge_players[0]>();
    
    // Sort by slot_position to ensure consistent ordering
    const sortedPlayers = [...challenge.quick_challenge_players].sort(
      (a, b) => a.slot_position - b.slot_position
    );
    
    for (const player of sortedPlayers) {
      if (!uniquePlayersMap.has(player.user_id)) {
        uniquePlayersMap.set(player.user_id, player);
      }
    }
    
    return Array.from(uniquePlayersMap.values()).map((p) => ({
      id: p.id,
      name: p.profiles?.full_name || "Player",
      avatarUrl: p.profiles?.avatar_url,
      nationalityCode: p.profiles?.nationality_code ?? null,
      team: p.team as TeamSide,
      slotPosition: p.slot_position,
      paymentStatus: p.payment_status as PaymentStatus,
      isMe: p.user_id === user?.id,
    }));
  }, [challenge?.quick_challenge_players, user?.id]);

  // Generate roles for each team (0-indexed to match database)
  const leftRoles = useMemo(
    () => Array.from({ length: teamSize }, (_, i) => `Player ${i + 1}`),
    [teamSize]
  );
  const rightRoles = useMemo(
    () => Array.from({ length: teamSize }, (_, i) => `Player ${i + 1}`),
    [teamSize]
  );

  // Get players by team
  const leftTeamPlayers = useMemo(
    () => players.filter((p) => p.team === "left"),
    [players]
  );
  const rightTeamPlayers = useMemo(
    () => players.filter((p) => p.team === "right"),
    [players]
  );

  // Check if current user has already joined
  const hasUserJoined = useMemo(
    () => players.some((p) => p.isMe),
    [players]
  );

  // Handlers - use 0-based slot positions to match database
  const handleJoinSlot = (team: TeamSide, slotPosition: number) => {
    if (!id || !user || hasUserJoined) return;
    setJoiningSlot({ team, position: slotPosition });
    joinChallenge.mutate(
      { challengeId: id, team, slotPosition },
      {
        onSettled: () => setJoiningSlot(null),
      }
    );
  };

  const handlePayment = async () => {
    if (!id) return;
    await initiatePayment(id);
  };

  const handleLeaveLobby = () => {
    navigate("/discover?tab=quickgames");
  };

  const handleQuitLobby = () => {
    setIsQuitDialogOpen(true);
  };

  const confirmQuitLobby = () => {
    if (!id || !isOrganizer) return;
    cancelChallenge.mutate(id, {
      onSuccess: () => {
        setIsQuitDialogOpen(false);
        navigate("/discover?tab=quickgames");
      },
      onError: () => {
        setIsQuitDialogOpen(false);
      },
    });
  };

  const handleFormatChange = (newFormat: string) => {
    if (!id || !isOrganizer) return;
    updateFormat.mutate({ challengeId: id, gameMode: newFormat });
  };

  // Auth redirect
  useEffect(() => {
    if (!isLoading && !user) {
      navigate("/auth", { replace: true });
    }
  }, [isLoading, user, navigate]);

  useEffect(() => {
    if (!user) {
      setCurrentProfileId(null);
      return;
    }

    let isMounted = true;

    const fetchProfileId = async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();

      if (!isMounted) return;

      if (error) {
        console.error("Failed to load profile id", error);
        setCurrentProfileId(null);
        return;
      }

      setCurrentProfileId(data?.id ?? null);
    };

    fetchProfileId();

    return () => {
      isMounted = false;
    };
  }, [user]);

  // Handle payment verification on return from Stripe
  useEffect(() => {
    const checkoutSessionId = searchParams.get("checkout_session_id");
    const paymentStatus = searchParams.get("payment");

    if (checkoutSessionId && paymentStatus === "success" && id) {
      setIsVerifyingPayment(true);
      verifyPayment(checkoutSessionId, id).finally(() => {
        setIsVerifyingPayment(false);
        // Clean up URL params
        setSearchParams({}, { replace: true });
      });
    } else if (paymentStatus === "cancelled") {
      // Clean up URL params
      setSearchParams({}, { replace: true });
    }
  }, [searchParams, id, verifyPayment, setSearchParams]);

  if (isLoading || loadingChallenges) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) return null;

  // Challenge not found
  if (!challenge) {
    return (
      <div className="h-screen w-full flex flex-col bg-background">
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="text-center">
            <p className="font-medium text-foreground">Quick game not found</p>
            <p className="text-sm mt-1 text-muted-foreground">
              This session may have ended or been removed.
            </p>
            <Button
              className="mt-4"
              variant="outline"
              onClick={() => navigate("/discover?tab=quickgames")}
            >
              Back to Quick Games
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Format date/time
  const formattedDateTime = challenge.scheduled_date
    ? format(
        new Date(`${challenge.scheduled_date}T${challenge.scheduled_time || "00:00"}`),
        "EEEE, MMMM d • h:mm a"
      )
    : "Date TBD";

  const totalPlayers = players.length;

  return (
    <div className="h-screen w-full flex flex-col overflow-hidden font-sans select-none border-2 md:border-4 border-border bg-background text-foreground">
      {/* Quit Lobby Confirmation Dialog */}
      <AlertDialog open={isQuitDialogOpen} onOpenChange={setIsQuitDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Cancel this lobby?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. All players will be removed from the lobby
              and the booking will be cancelled. Any pending payments will not be processed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={cancelChallenge.isPending}>
              Keep Lobby
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmQuitLobby}
              disabled={cancelChallenge.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {cancelChallenge.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Cancelling...
                </>
              ) : (
                "Yes, Cancel Lobby"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Settings Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        teamSize={teamSize}
        gameMode={challenge.game_mode}
        isOrganizer={isOrganizer}
        challengeId={challenge.id}
        currentPlayerCount={players.length}
        onFormatChange={handleFormatChange}
        isUpdating={updateFormat.isPending}
      />

      {/* Header */}
      <div className="h-14 flex items-center justify-between px-4 md:px-6 relative z-20 shrink-0 border-b border-border bg-card">
        <div className="flex items-center gap-4 w-1/4">
          <button onClick={handleLeaveLobby} className="p-1 hover:bg-accent rounded-full transition-colors">
            <ArrowLeft size={18} className="text-muted-foreground hover:text-primary cursor-pointer" />
          </button>
        </div>

        <div className="flex flex-col items-center">
          <h1 className="text-sm font-black uppercase tracking-[0.2em]">
            Quick Lobby
          </h1>
          <div className="flex items-center gap-1 text-[9px] uppercase font-bold text-muted-foreground">
            <MapPin size={10} className="text-primary" />
            <span className="truncate max-w-[150px] md:max-w-none">
              {challenge.venues?.name || "Venue TBD"}
            </span>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 w-1/4 text-muted-foreground">
          <button onClick={() => setIsSettingsOpen(true)} className="p-1 hover:bg-accent rounded-full transition-colors">
            <Settings
              size={18}
              className="cursor-pointer hover:rotate-90 transition-transform duration-500 hover:text-primary"
            />
          </button>
          {isOrganizer ? (
            <Button 
              variant="destructive" 
              size="sm" 
              className="h-7 text-[9px] uppercase font-bold tracking-wide gap-1 px-2"
              onClick={handleQuitLobby}
              disabled={cancelChallenge.isPending}
            >
              {cancelChallenge.isPending ? (
                <Loader2 size={12} className="animate-spin" />
              ) : (
                <LogOut size={12} />
              )}
              <span className="hidden sm:inline">Quit Lobby</span>
            </Button>
          ) : (
            <button onClick={handleLeaveLobby} className="p-1 hover:bg-accent rounded-full transition-colors">
              <LogOut size={18} className="cursor-pointer hover:text-destructive" />
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 flex flex-col md:flex-row relative overflow-hidden overflow-y-auto md:overflow-y-hidden bg-gradient-to-br from-background to-muted/30">
        {/* Teams Container (Mobile: side by side, Desktop: left column) */}
        <div className="flex flex-row md:flex-col shrink-0 md:w-64 lg:w-80 border-b md:border-b-0 md:border-r border-border">
          {/* Left Team (Blue) */}
          <div className="flex-1 flex flex-col p-3 md:p-5 border-r md:border-r-0 md:border-b border-border/50">
            <div className="flex items-center justify-between border-b pb-2 mb-3 border-blue-500/30">
              <span className="text-[10px] font-black uppercase tracking-widest text-blue-500">
                Team Blue
              </span>
              <div className="w-2 h-2 rounded-full bg-blue-500 shadow-[0_0_8px_#3b82f6]" />
            </div>
            <div className="flex flex-col gap-2">
              {leftRoles.map((role, i) => {
                // Use 0-indexed slot positions to match database
                const player = leftTeamPlayers.find(
                  (p) => p.slotPosition === i
                ) || leftTeamPlayers[i]; // Fallback to array index if slot_position doesn't match
                const isJoiningThis =
                  joiningSlot?.team === "left" && joiningSlot?.position === i;
                return (
                  <PlayerSlot
                    key={`left-${i}`}
                    role={role}
                    side="left"
                    player={player}
                    isCurrentUser={player?.isMe}
                    onJoin={() => handleJoinSlot("left", i)}
                    onPay={handlePayment}
                    isJoining={isJoiningThis}
                  />
                );
              })}
            </div>
          </div>

          {/* Right Team (Red) - Mobile Only */}
          <div className="flex-1 md:hidden flex flex-col p-3 border-l border-border/50">
            <div className="flex items-center justify-between border-b pb-2 mb-3 flex-row-reverse border-red-500/30">
              <span className="text-[10px] font-black uppercase tracking-widest text-red-500">
                Team Red
              </span>
              <div className="w-2 h-2 rounded-full bg-red-500 shadow-[0_0_8px_#ef4444]" />
            </div>
            <div className="flex flex-col gap-2">
              {rightRoles.map((role, i) => {
                // Use 0-indexed slot positions to match database
                const player = rightTeamPlayers.find(
                  (p) => p.slotPosition === i
                ) || rightTeamPlayers[i]; // Fallback to array index if slot_position doesn't match
                const isJoiningThis =
                  joiningSlot?.team === "right" && joiningSlot?.position === i;
                return (
                  <PlayerSlot
                    key={`right-mobile-${i}`}
                    role={role}
                    side="right"
                    player={player}
                    isCurrentUser={player?.isMe}
                    onJoin={() => handleJoinSlot("right", i)}
                    onPay={handlePayment}
                    isJoining={isJoiningThis}
                  />
                );
              })}
            </div>
          </div>
        </div>

        {/* Central Panel */}
        <div className="flex-1 flex flex-col items-center justify-center p-4 md:p-6 min-h-[300px] md:min-h-[400px]">
          {/* Date/Time Badge - Desktop */}
          <div className="hidden md:flex w-full max-w-2xl mb-6 items-center justify-center px-4 py-2 rounded-full border bg-card/50 border-border text-muted-foreground">
            <div className="text-[9px] font-bold uppercase tracking-widest flex items-center gap-2">
              <Clock size={12} className="text-primary" />
              {formattedDateTime}
            </div>
          </div>

          {/* Arena Image */}
          <div className="relative w-full max-w-2xl aspect-video border-4 md:border-[6px] shadow-[0_20px_50px_rgba(0,0,0,0.2)] overflow-hidden rounded-xl bg-muted border-card">
            <img
              src={
                challenge.courts?.photo_url ||
                challenge.venues?.photo_url ||
                "https://images.unsplash.com/photo-1544919396-1033604f552e?q=80&w=2070&auto=format&fit=crop"
              }
              className="w-full h-full object-cover opacity-90"
              alt="Arena"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-background/80 via-transparent to-transparent" />
            
            {/* Sport Badge */}
            <div className="absolute top-3 left-3 flex items-center gap-2 bg-background/80 backdrop-blur-sm px-3 py-1.5 rounded-full border border-border">
              <span className="text-lg">{challenge.sport_categories?.icon || "🎯"}</span>
              <span className="text-xs font-bold uppercase tracking-wide">
                {challenge.sport_categories?.display_name || "Sport"}
              </span>
            </div>

            {/* Game Mode Badge */}
            <div className="absolute top-3 right-3 bg-primary/90 text-primary-foreground px-3 py-1.5 rounded-full">
              <span className="text-xs font-black uppercase tracking-wide">
                {challenge.game_mode}
              </span>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="mt-6 md:mt-8 flex flex-col items-center gap-4 w-full max-w-2xl">
            <div className="flex flex-row gap-3 w-full">
              <Button
                className="flex-1 py-5 md:py-6 font-black text-[10px] md:text-xs uppercase tracking-[0.15em]"
                variant="default"
              >
                Confirm Presence
              </Button>
              <Button
                className="flex-1 py-5 md:py-6 font-black text-[10px] md:text-xs uppercase tracking-[0.15em]"
                variant="outline"
              >
                Invite Friend
              </Button>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                Price:
              </span>
              <span className="text-sm font-black uppercase tracking-widest text-primary">
                ${challenge.price_per_player?.toFixed(2) || "0.00"}
              </span>
            </div>
          </div>
        </div>

        {/* Right Team (Red) - Desktop Only */}
        <div className="hidden md:flex w-64 lg:w-80 flex-col p-5 z-10 border-l shrink-0 border-border">
          <div className="flex items-center justify-between border-b pb-2 mb-3 flex-row-reverse border-red-500/30">
            <span className="text-[10px] font-black uppercase tracking-widest text-red-500">
              Team Red
            </span>
            <div className="w-2 h-2 rounded-full bg-red-500 shadow-[0_0_8px_#ef4444]" />
          </div>
          <div className="flex flex-col gap-2">
            {rightRoles.map((role, i) => {
              // Use 0-indexed slot positions to match database
              const player = rightTeamPlayers.find(
                (p) => p.slotPosition === i
              ) || rightTeamPlayers[i]; // Fallback to array index if slot_position doesn't match
              const isJoiningThis =
                joiningSlot?.team === "right" && joiningSlot?.position === i;
              return (
                <PlayerSlot
                  key={`right-desktop-${i}`}
                  role={role}
                  side="right"
                  player={player}
                  isCurrentUser={player?.isMe}
                  onJoin={() => handleJoinSlot("right", i)}
                  onPay={handlePayment}
                  isJoining={isJoiningThis}
                />
              );
            })}
          </div>
        </div>
      </div>

      {/* Footer with Chat Panel */}
      <LobbyChatPanel
        challengeId={challenge.id}
        currentUserId={user.id}
        totalSlots={teamSize * 2}
        filledSlots={totalPlayers}
        isMatchFull={totalPlayers >= teamSize * 2}
      />
    </div>
  );
}
