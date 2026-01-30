import { Calendar, Clock, MapPin, Users, Zap } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface QuickChallengeSummaryCardProps {
  challenge: {
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
  };
  isSelected?: boolean;
  onSelect?: () => void;
}

export function QuickChallengeSummaryCard({
  challenge,
  isSelected = false,
  onSelect,
}: QuickChallengeSummaryCardProps) {
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

  const isOpen = challenge.status === "open";

  return (
    <Card
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onSelect?.();
        }
      }}
      className={cn(
        "group overflow-hidden border border-border transition-all duration-300",
        "hover:border-primary/40 hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
        isSelected && "border-primary shadow-lg"
      )}
    >
      <div className="relative h-40 bg-gradient-to-br from-primary/20 via-background to-accent/10">
        {challenge.courtImage && (
          <img
            src={challenge.courtImage}
            alt={`${challenge.venueName || "Court"} photo`}
            className="absolute inset-0 h-full w-full object-cover"
            loading="lazy"
          />
        )}
        <div
          className={cn(
            "absolute inset-0",
            challenge.courtImage
              ? "bg-gradient-to-t from-slate-900/70 via-slate-900/20 to-transparent"
              : "bg-transparent"
          )}
        />
        <div className="absolute inset-0 p-4 flex items-start justify-between">
          <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <span className="text-xl">{challenge.sportIcon || "🎯"}</span>
            <span className={cn(challenge.courtImage && "text-white")}>
              {challenge.sportName || "Sport"}
            </span>
          </div>
          <Badge
            variant={isOpen ? "default" : "secondary"}
            className={cn(
              isOpen && "bg-green-500/20 text-green-600",
              challenge.courtImage && "border-white/40 text-white"
            )}
          >
            {isOpen ? "Open" : challenge.status}
          </Badge>
        </div>
        <div className={cn(
          "absolute bottom-3 left-4 flex items-center gap-2 text-xs",
          challenge.courtImage ? "text-white/90" : "text-muted-foreground"
        )}>
          <Zap className={cn("h-3.5 w-3.5", challenge.courtImage ? "text-white" : "text-primary")} />
          <span>Quick Game</span>
        </div>
      </div>

      <div className="p-4 space-y-3">
        <div className="flex items-center gap-2 text-sm font-medium">
          <Badge variant="outline">{challenge.gameMode}</Badge>
        </div>

        <div className="space-y-2 text-sm text-muted-foreground">
          {challenge.venueName && (
            <div className="flex items-center gap-2">
              <MapPin className="h-4 w-4" />
              <span className="truncate">{challenge.venueName}</span>
            </div>
          )}
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            <span>{formatDate(challenge.scheduledDate)}</span>
          </div>
          {challenge.scheduledTime && (
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4" />
              <span>{formatTime(challenge.scheduledTime)}</span>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Users className="h-4 w-4" />
            <span>
              {challenge.playersCount}/{challenge.totalSlots} players
            </span>
          </div>
          {challenge.pricePerPlayer > 0 && (
            <span className="font-semibold text-primary">
              ${challenge.pricePerPlayer.toFixed(2)}
            </span>
          )}
        </div>
      </div>
    </Card>
  );
}
