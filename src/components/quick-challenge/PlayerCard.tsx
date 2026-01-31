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

const normalizeCountryCode = (countryCode?: string | null): string | null => {
  if (!countryCode) return null;
  const normalized = countryCode.trim().toLowerCase();
  if (normalized.length !== 2) return null;
  return normalized;
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
          "w-full min-h-[150px] p-3 rounded-xl md:min-h-[180px] md:p-4",
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
            "w-12 h-12 rounded-full flex items-center justify-center md:w-16 md:h-16",
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
                "h-5 w-5 text-muted-foreground/50 md:h-6 md:w-6",
                "transition-all duration-300",
                "group-hover:text-primary group-hover:scale-110"
              )}
            />
          )}
        </div>
        <p className="mt-3 text-xs text-muted-foreground font-medium md:text-sm">
          {isJoining ? "Joining..." : "Waiting for player..."}
        </p>
        <p className="text-[0.7rem] text-muted-foreground/60 mt-1 md:text-xs">
          Click to join
        </p>
      </div>
    );
  }

  if (!player) return null;

  const isPaid = player.paymentStatus === "paid";
  const flagCode = normalizeCountryCode(player.nationalityCode);
  const initials = player.name
    .split(" ")
    .map(n => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <div
      className={cn(
        "relative flex flex-col items-center p-3 rounded-xl md:p-4",
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
            "text-[0.65rem] font-medium transition-all duration-300 md:text-xs",
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
      {flagCode && (
        <div className="absolute top-2 left-2">
          <span
            className={cn("fi", `fi-${flagCode}`, "rounded-sm shadow-sm text-base md:text-lg")}
            title={player.nationalityCode?.toUpperCase()}
            aria-label={`Flag of ${player.nationalityCode?.toUpperCase()}`}
          />
        </div>
      )}

      {/* Avatar */}
      <div className="relative mt-3 md:mt-4">
        <Avatar className="h-14 w-14 border-2 border-border md:h-16 md:w-16">
          <AvatarImage src={player.avatarUrl || undefined} alt={player.name} />
          <AvatarFallback className="bg-primary/10 text-primary font-semibold">
            {initials}
          </AvatarFallback>
        </Avatar>
        {isPaid && (
          <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-green-500 flex items-center justify-center animate-scale-in md:w-6 md:h-6">
            <Check className="h-3 w-3 text-white md:h-3.5 md:w-3.5" />
          </div>
        )}
      </div>

      {/* Name */}
      <h4 className="mt-2 font-semibold text-xs text-center line-clamp-1 md:mt-3 md:text-sm">
        {player.name}
      </h4>

      {/* Current User Tag */}
      {isCurrentUser && (
        <span className="text-[0.7rem] text-primary font-medium mt-1 md:text-xs">You</span>
      )}

      {/* Pay Button (only for current user with pending status) */}
      {isCurrentUser && !isPaid && (
        <Button
          size="sm"
          className={cn(
            "mt-3 w-full h-8 px-2 text-[0.7rem] leading-tight md:h-9 md:text-xs",
            "bg-primary hover:bg-primary/90 text-primary-foreground",
            "transition-all duration-200 hover:scale-[1.02]",
            "gap-1 whitespace-nowrap"
          )}
          onClick={onPay}
          disabled={isPaying}
        >
          {isPaying ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin md:h-4 md:w-4" />
          ) : (
            <CreditCard className="h-3.5 w-3.5 md:h-4 md:w-4" />
          )}
          {isPaying ? "Processing..." : "Pay & Confirm"}
        </Button>
      )}
    </div>
  );
}

export function PlayerCardSkeleton() {
  return (
    <div className="flex flex-col items-center p-3 rounded-xl bg-card border border-border md:p-4">
      <Skeleton className="w-14 h-14 rounded-full mt-3 md:mt-4 md:w-16 md:h-16" />
      <Skeleton className="h-3 w-24 mt-3 md:h-4" />
      <Skeleton className="h-3 w-16 mt-2" />
    </div>
  );
}
