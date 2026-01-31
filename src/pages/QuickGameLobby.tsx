import { useEffect, useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { MobileLayout } from "@/components/layout/MobileLayout";
import { QuickChallengeCard } from "@/components/quick-challenge/QuickChallengeCard";
import { useQuickChallenges, useJoinChallenge } from "@/hooks/useQuickChallenges";
import { useAuth } from "@/lib/auth-context";
import { Loader2, ArrowLeft } from "lucide-react";

export default function QuickGameLobby() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, isLoading } = useAuth();
  const { data: quickChallenges = [], isLoading: loadingChallenges } = useQuickChallenges();
  const joinChallenge = useJoinChallenge();

  const challenge = useMemo(
    () => quickChallenges.find((item) => item.id === id),
    [quickChallenges, id]
  );

  const handleJoinSlot = (challengeId: string, team: "left" | "right", slotPosition: number) => {
    joinChallenge.mutate({ challengeId, team, slotPosition });
  };

  const handlePayment = (challengeId: string) => {
    // TODO: Integrate with Stripe checkout
    console.log("Payment for challenge:", challengeId);
  };

  useEffect(() => {
    if (!isLoading && !user) {
      navigate("/auth", { replace: true });
    }
  }, [isLoading, user, navigate]);

  if (isLoading || loadingChallenges) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) return null;

  const handleLeaveLobby = () => {
    navigate("/discover?filter=quickgames");
  };

  return (
    <MobileLayout
      showBack
      title="Session Lobby"
      rightAction={(
        <Button
          variant="ghost"
          size="sm"
          className="h-8 px-2 text-xs font-semibold"
          onClick={handleLeaveLobby}
        >
          Leave
        </Button>
      )}
    >
      <div className="px-3 py-3 space-y-4 max-w-5xl mx-auto sm:px-4 sm:py-4 lg:px-6">
        <div className="hidden lg:flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={handleLeaveLobby}
              aria-label="Back to quick games"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <h1 className="font-display text-xl font-semibold">Session Lobby</h1>
              <p className="text-sm text-muted-foreground">
                Review players and confirm your spot.
              </p>
            </div>
          </div>
          <Button
            variant="outline"
            onClick={handleLeaveLobby}
          >
            Leave Lobby
          </Button>
        </div>

        {challenge ? (
          <QuickChallengeCard
            challenge={{
              id: challenge.id,
              sportCategoryId: challenge.sport_category_id,
              sportName: challenge.sport_categories?.display_name,
              sportIcon: challenge.sport_categories?.icon || "🎯",
              gameMode: challenge.game_mode,
              status: challenge.status,
              venueName: challenge.venues?.name,
              venueAddress: challenge.venues?.address,
              scheduledDate: challenge.scheduled_date || undefined,
              scheduledTime: challenge.scheduled_time || undefined,
              pricePerPlayer: challenge.price_per_player,
              totalSlots: challenge.total_slots,
              players: (challenge.quick_challenge_players || []).map((p) => ({
                id: p.id,
                userId: p.user_id,
                name: p.profiles?.full_name || "Player",
                avatarUrl: p.profiles?.avatar_url,
                nationalityCode: p.profiles?.nationality_code ?? null,
                paymentStatus: p.payment_status as "pending" | "paid" | "refunded",
                team: p.team as "left" | "right",
                slotPosition: p.slot_position,
              })),
            }}
            currentUserId={user.id}
            onJoinSlot={handleJoinSlot}
            onPayment={handlePayment}
          />
        ) : (
          <div className="rounded-xl border border-border p-6 text-center text-muted-foreground">
            <p className="font-medium">Quick game not found</p>
            <p className="text-sm mt-1">This session may have ended or been removed.</p>
            <Button
              className="mt-4"
              variant="outline"
              onClick={() => navigate("/discover?filter=quickgames")}
            >
              Back to Quick Games
            </Button>
          </div>
        )}
      </div>
    </MobileLayout>
  );
}
