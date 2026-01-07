import { Link } from "react-router-dom";
import { MapPin, Calendar, Clock, DollarSign } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { SessionBadge } from "@/components/ui/session-badge";
import { PlayerCount } from "@/components/ui/player-count";
import { SportIcon, getSportLabel } from "@/components/ui/sport-icon";
import { format } from "date-fns";

type SessionState = "protected" | "rescue" | "released";
type SportType = "futsal" | "tennis" | "volleyball" | "basketball" | "turf_hockey" | "badminton" | "other";

interface GameCardProps {
  id: string;
  groupName: string;
  sport: SportType;
  courtName: string;
  venueName: string;
  date: Date;
  time: string;
  price: number;
  currentPlayers: number;
  minPlayers: number;
  maxPlayers: number;
  state: SessionState;
  isPaid?: boolean;
}

export function GameCard({
  id,
  groupName,
  sport,
  courtName,
  venueName,
  date,
  time,
  price,
  currentPlayers,
  minPlayers,
  maxPlayers,
  state,
  isPaid = false,
}: GameCardProps) {
  return (
    <Link to={`/games/${id}`}>
      <Card className="overflow-hidden hover:shadow-card-hover transition-shadow duration-200">
        <CardContent className="p-4 space-y-3">
          {/* Header */}
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <SportIcon sport={sport} />
              <div>
                <h3 className="font-display font-semibold text-base">
                  {groupName}
                </h3>
                <p className="text-xs text-muted-foreground">
                  {getSportLabel(sport)}
                </p>
              </div>
            </div>
            <SessionBadge state={state} />
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
              <DollarSign className="h-4 w-4 shrink-0" />
              <span>${price.toFixed(2)}</span>
            </div>
          </div>

          {/* Player count */}
          <PlayerCount
            current={currentPlayers}
            min={minPlayers}
            max={maxPlayers}
          />

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