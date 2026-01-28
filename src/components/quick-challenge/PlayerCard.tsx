import { useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, Check, Loader2, CreditCard } from "lucide-react";
import { cn } from "@/lib/utils";

interface PlayerCardProps {
  player?: {
    userId: string;
    name: string;
    avatarUrl?: string | null;
    nationalityCode?: string | null;
    paymentStatus: "pending" | "paid" | "refunded";
  };
  isEmpty?: boolean;
  isCurrentUser?: boolean;
  onJoin?: () => void;
  onPay?: () => void;
  isJoining?: boolean;
  isPaying?: boolean;
}

// Simple flag emoji from country code
const getFlagEmoji = (countryCode: string | null | undefined): string => {
  if (!countryCode) return "🌍";
  const codePoints = countryCode
    .toUpperCase()
    .split("")
    .map(char => 127397 + char.charCodeAt(0));
  return String.fromCodePoint(...codePoints);
};

export function PlayerCard({
  player,
  isEmpty = false,
  isCurrentUser = false,
  onJoin,
  onPay,
  isJoining = false,
  isPaying = false,
}: PlayerCardProps) {
  const [isHovered, setIsHovered] = useState(false);

  if (isEmpty) {
    return (
      <div
        className={cn(
          "relative flex flex-col items-center justify-center",
          "w-full min-h-[180px] p-4 rounded-xl",
          "bg-muted/30 border-2 border-dashed border-muted-foreground/20",
          "transition-all duration-300 cursor-pointer",
          "hover:border-primary/50 hover:bg-primary/5",
          "group"
        )}
        onClick={onJoin}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        <div
          className={cn(
            "w-16 h-16 rounded-full flex items-center justify-center",
            "bg-muted border-2 border-dashed border-muted-foreground/30",
            "transition-all duration-300",
            "group-hover:border-primary group-hover:bg-primary/10"
          )}
        >
          {isJoining ? (
            <Loader2 className="h-6 w-6 text-muted-foreground animate-spin" />
          ) : (
            <Plus
              className={cn(
                "h-6 w-6 text-muted-foreground/50",
                "transition-all duration-300",
                "group-hover:text-primary group-hover:scale-110"
              )}
            />
          )}
        </div>
        <p className="mt-3 text-sm text-muted-foreground font-medium">
          {isJoining ? "Joining..." : "Waiting for player..."}
        </p>
        <p className="text-xs text-muted-foreground/60 mt-1">
          Click to join
        </p>
      </div>
    );
  }

  if (!player) return null;

  const isPaid = player.paymentStatus === "paid";
  const initials = player.name
    .split(" ")
    .map(n => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <div
      className={cn(
        "relative flex flex-col items-center p-4 rounded-xl",
        "bg-card border transition-all duration-300",
        isPaid
          ? "border-green-500/30 bg-green-500/5"
          : "border-border hover:border-primary/30",
        isCurrentUser && "ring-2 ring-primary/30"
      )}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Payment Status Badge */}
      <div className="absolute top-2 right-2">
        <Badge
          variant={isPaid ? "default" : "secondary"}
          className={cn(
            "text-xs font-medium transition-all duration-300",
            isPaid
              ? "bg-green-500/20 text-green-500 border-green-500/30"
              : "bg-warning/20 text-warning border-warning/30"
          )}
        >
          {isPaid ? (
            <>
              <Check className="h-3 w-3 mr-1" />
              Paid
            </>
          ) : (
            "Pending"
          )}
        </Badge>
      </div>

      {/* Flag Badge */}
      {player.nationalityCode && (
        <div className="absolute top-2 left-2">
          <span className="text-xl" title={player.nationalityCode}>
            {getFlagEmoji(player.nationalityCode)}
          </span>
        </div>
      )}

      {/* Avatar */}
      <div className="relative mt-4">
        <Avatar className="h-16 w-16 border-2 border-border">
          <AvatarImage src={player.avatarUrl || undefined} alt={player.name} />
          <AvatarFallback className="bg-primary/10 text-primary font-semibold">
            {initials}
          </AvatarFallback>
        </Avatar>
        {isPaid && (
          <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-green-500 flex items-center justify-center animate-scale-in">
            <Check className="h-3.5 w-3.5 text-white" />
          </div>
        )}
      </div>

      {/* Name */}
      <h4 className="mt-3 font-semibold text-sm text-center line-clamp-1">
        {player.name}
      </h4>

      {/* Current User Tag */}
      {isCurrentUser && (
        <span className="text-xs text-primary font-medium mt-1">You</span>
      )}

      {/* Pay Button (only for current user with pending status) */}
      {isCurrentUser && !isPaid && (
        <Button
          size="sm"
          className={cn(
            "mt-3 w-full h-9",
            "bg-primary hover:bg-primary/90 text-primary-foreground",
            "transition-all duration-200 hover:scale-[1.02]"
          )}
          onClick={onPay}
          disabled={isPaying}
        >
          {isPaying ? (
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
          ) : (
            <CreditCard className="h-4 w-4 mr-2" />
          )}
          {isPaying ? "Processing..." : "Pay & Confirm"}
        </Button>
      )}
    </div>
  );
}

export function PlayerCardSkeleton() {
  return (
    <div className="flex flex-col items-center p-4 rounded-xl bg-card border border-border">
      <Skeleton className="w-16 h-16 rounded-full mt-4" />
      <Skeleton className="h-4 w-24 mt-3" />
      <Skeleton className="h-3 w-16 mt-2" />
    </div>
  );
}
