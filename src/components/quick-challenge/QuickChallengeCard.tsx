import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PlayerCard, PlayerCardSkeleton } from "./PlayerCard";
import { MapPin, Clock, Users, Zap } from "lucide-react";
import { cn } from "@/lib/utils";

interface Player {
  id: string;
  userId: string;
  name: string;
  avatarUrl?: string | null;
  nationalityCode?: string | null;
  paymentStatus: "pending" | "paid" | "refunded";
  team: "left" | "right";
  slotPosition: number;
}

interface QuickChallengeCardProps {
  challenge: {
    id: string;
    sportCategoryId: string;
    sportName?: string;
    sportIcon?: string;
    gameMode: string;
    status: string;
    venueName?: string;
    venueAddress?: string;
    scheduledDate?: string;
    scheduledTime?: string;
    pricePerPlayer: number;
    totalSlots: number;
    players: Player[];
  };
  currentUserId?: string;
  onJoinSlot?: (challengeId: string, team: "left" | "right", slot: number) => void;
  onPayment?: (challengeId: string) => void;
  isLoading?: boolean;
}

export function QuickChallengeCard({
  challenge,
  currentUserId,
  onJoinSlot,
  onPayment,
  isLoading = false,
}: QuickChallengeCardProps) {
  const navigate = useNavigate();

  // Parse game mode to get players per team
  const playersPerTeam = useMemo(() => {
    const match = challenge.gameMode.match(/(\d+)vs(\d+)/);
    return match ? parseInt(match[1]) : 1;
  }, [challenge.gameMode]);

  // Generate team slots
  const leftTeamSlots = useMemo(() => {
    const slots = [];
    for (let i = 0; i < playersPerTeam; i++) {
      const player = challenge.players.find(
        p => p.team === "left" && p.slotPosition === i
      );
      slots.push({ position: i, player });
    }
    return slots;
  }, [challenge.players, playersPerTeam]);

  const rightTeamSlots = useMemo(() => {
    const slots = [];
    for (let i = 0; i < playersPerTeam; i++) {
      const player = challenge.players.find(
        p => p.team === "right" && p.slotPosition === i
      );
      slots.push({ position: i, player });
    }
    return slots;
  }, [challenge.players, playersPerTeam]);

  // Check if current user is in challenge
  const currentUserPlayer = challenge.players.find(p => p.userId === currentUserId);
  const filledSlots = challenge.players.length;
  const isOpen = challenge.status === "open";

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return "TBD";
    return new Date(dateStr).toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
    });
  };

  const formatTime = (timeStr?: string) => {
    if (!timeStr) return "";
    const [hours, minutes] = timeStr.split(":");
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? "PM" : "AM";
    const displayHour = hour % 12 || 12;
    return `${displayHour}:${minutes} ${ampm}`;
  };

  if (isLoading) {
    return (
      <Card className="overflow-hidden">
        <CardContent className="p-4 space-y-4">
          <div className="flex justify-between items-center">
            <PlayerCardSkeleton />
            <div className="text-2xl font-bold text-muted-foreground/20">VS</div>
            <PlayerCardSkeleton />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden border-border hover:border-primary/30 transition-all duration-300">
      {/* Header */}
      <div className="p-4 border-b border-border bg-muted/30">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xl">{challenge.sportIcon || "🎯"}</span>
            <span className="font-semibold">{challenge.sportName || "Sport"}</span>
            <Badge variant="outline" className="ml-1">
              {challenge.gameMode}
            </Badge>
          </div>
          <Badge
            variant={isOpen ? "default" : "secondary"}
            className={cn(
              isOpen ? "bg-green-500/20 text-green-500" : ""
            )}
          >
            {isOpen ? "Open" : challenge.status}
          </Badge>
        </div>

        {/* Venue Info */}
        {challenge.venueName && (
          <div className="mt-3 flex flex-wrap gap-3 text-sm text-muted-foreground">
            <div className="flex items-center gap-1">
              <MapPin className="h-3.5 w-3.5" />
              <span>{challenge.venueName}</span>
            </div>
            {challenge.scheduledDate && (
              <div className="flex items-center gap-1">
                <Clock className="h-3.5 w-3.5" />
                <span>
                  {formatDate(challenge.scheduledDate)}
                  {challenge.scheduledTime && ` at ${formatTime(challenge.scheduledTime)}`}
                </span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Player Cards Grid */}
      <CardContent className="p-3 md:p-4">
        <div className="flex flex-col gap-3 md:gap-4 sm:flex-row sm:items-center sm:justify-between">
          {/* Left Team */}
          <div className={cn(
            "w-full flex-1 space-y-2 md:space-y-3",
            playersPerTeam > 2 && "grid grid-cols-2 gap-2 space-y-0"
          )}>
            {leftTeamSlots.map(slot => (
              <PlayerCard
                key={`left-${slot.position}`}
                player={slot.player ? {
                  userId: slot.player.userId,
                  name: slot.player.name,
                  avatarUrl: slot.player.avatarUrl,
                  nationalityCode: slot.player.nationalityCode,
                  paymentStatus: slot.player.paymentStatus,
                } : undefined}
                isEmpty={!slot.player}
                isCurrentUser={slot.player?.userId === currentUserId}
                onJoin={() => onJoinSlot?.(challenge.id, "left", slot.position)}
                onPay={() => onPayment?.(challenge.id)}
              />
            ))}
          </div>

          {/* VS Divider */}
          <div className="flex items-center justify-center gap-3 sm:flex-col sm:gap-2 sm:px-2">
            <div className={cn(
              "w-9 h-9 md:w-12 md:h-12 rounded-full flex items-center justify-center",
              "bg-primary/10 border-2 border-primary/20"
            )}>
              <span className="text-sm md:text-lg font-bold text-primary">VS</span>
            </div>
            <Zap className="h-4 w-4 text-primary animate-pulse" />
          </div>

          {/* Right Team */}
          <div className={cn(
            "w-full flex-1 space-y-2 md:space-y-3",
            playersPerTeam > 2 && "grid grid-cols-2 gap-2 space-y-0"
          )}>
            {rightTeamSlots.map(slot => (
              <PlayerCard
                key={`right-${slot.position}`}
                player={slot.player ? {
                  userId: slot.player.userId,
                  name: slot.player.name,
                  avatarUrl: slot.player.avatarUrl,
                  nationalityCode: slot.player.nationalityCode,
                  paymentStatus: slot.player.paymentStatus,
                } : undefined}
                isEmpty={!slot.player}
                isCurrentUser={slot.player?.userId === currentUserId}
                onJoin={() => onJoinSlot?.(challenge.id, "right", slot.position)}
                onPay={() => onPayment?.(challenge.id)}
              />
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="mt-4 pt-4 border-t border-border flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Users className="h-4 w-4" />
            <span>{filledSlots}/{challenge.totalSlots} players</span>
          </div>
          {challenge.pricePerPlayer > 0 && (
            <div className="text-right">
              <span className="text-xs text-muted-foreground">Price per player</span>
              <p className="font-bold text-primary">
                ${challenge.pricePerPlayer.toFixed(2)}
              </p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
