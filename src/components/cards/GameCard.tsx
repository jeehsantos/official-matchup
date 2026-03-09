import { Link } from "react-router-dom";
import { MapPin, Calendar, Clock, DollarSign } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { SessionBadge, type SessionBadgeState } from "@/components/ui/session-badge";
import { PlayerCount } from "@/components/ui/player-count";
import { SportIcon } from "@/components/ui/sport-icon";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import type { Database } from "@/integrations/supabase/types";

type SessionState = "protected" | "pending" | "rescue" | "released";
type SportType =
  | "futsal"
  | "tennis"
  | "volleyball"
  | "basketball"
  | "turf_hockey"
  | "badminton"
  | "hockey"
  | "other";
type SportCategory = Database["public"]["Tables"]["sport_categories"]["Row"];

interface GameCardProps {
  id: string;
  groupName: string;
  sport: SportType;
  sportCategory?: SportCategory;
  courtName: string;
  venueName: string;
  date: Date;
  time: string;
  endTime?: string;
  price: number;
  currentPlayers: number;
  minPlayers: number;
  maxPlayers: number;
  state: SessionState;
  isPaid?: boolean;
  /** @deprecated Service fee is calculated at checkout by the backend */
  serviceFee?: number;
  linkTo?: string;
}

export function GameCard({
  id,
  groupName,
  sport,
  sportCategory,
  courtName,
  venueName,
  date,
  time,
  endTime,
  price,
  currentPlayers,
  minPlayers,
  maxPlayers,
  state,
  isPaid = false,
  linkTo,
}: GameCardProps) {
  const totalPrice = price; // Service fee added at checkout

  const sportDisplayName = sportCategory?.display_name || "Sport TBD";

  const dateStr = format(date, "yyyy-MM-dd");
  const effectiveEndTime = (endTime && endTime.length >= 5 ? endTime.slice(0, 5) : time).slice(0, 5);

  let endDt = new Date(`${dateStr}T${effectiveEndTime}:00`);
  // Handle cross-midnight sessions (end time earlier than start time)
  if (effectiveEndTime < time) {
    endDt = new Date(endDt.getTime() + 24 * 60 * 60 * 1000);
  }

  const isPast = endDt.getTime() <= Date.now();

  // Badge rules:
  // - Only show "Completed" when session ended AND payment is confirmed.
  // - "Booked" (protected) only when paid, otherwise "Pending".
  let badgeState: SessionBadgeState = (state === "protected"
    ? isPaid
      ? "protected"
      : "pending"
    : (state as SessionBadgeState));

  if (isPaid && isPast && (state === "protected" || state === "rescue")) {
    badgeState = "completed";
  }

  return (
    <Link to={linkTo || `/games/${id}`}>
      <Card className="overflow-hidden hover:shadow-card-hover transition-shadow duration-200 h-full">
        <CardContent className="p-4 space-y-3">
          {/* Header */}
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <SportIcon sport={sport} icon={sportCategory?.icon} label={sportDisplayName} />
              <div>
                <h3 className="font-display font-semibold text-base">{groupName}</h3>
                <p className="text-xs text-muted-foreground">{sportDisplayName}</p>
              </div>
            </div>
            <SessionBadge state={badgeState} />
          </div>

          {/* Details */}
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div className="flex items-center gap-2 text-muted-foreground">
              <MapPin className="h-4 w-4 shrink-0" />
              <span className="truncate">{courtName}</span>
            </div>
            <div className="flex items-center gap-2 text-muted-foreground">
              <Calendar className="h-4 w-4 shrink-0" />
              <span>{format(date, "EEE, MMM d")}</span>
            </div>
            <div className="flex items-center gap-2 text-muted-foreground">
              <Clock className="h-4 w-4 shrink-0" />
              <span>{time}</span>
            </div>
            <div className="flex items-center gap-2 font-semibold text-foreground">
              {totalPrice === 0 ? (
                <Badge className="bg-success text-success-foreground border-0 shadow-sm">✓ FREE</Badge>
              ) : (
                <>
                  <DollarSign className="h-4 w-4 shrink-0" />
                  <span>${totalPrice.toFixed(2)}</span>
                </>
              )}
            </div>
          </div>

          {/* Player count */}
          <PlayerCount current={currentPlayers} min={minPlayers} max={maxPlayers} />

          {/* Payment status indicator */}
          {isPaid && (
            <div className="flex items-center justify-center py-2 bg-success/10 text-success rounded-lg text-sm font-semibold">
              ✓ Paid & Confirmed
            </div>
          )}
        </CardContent>
      </Card>
    </Link>
  );
}
