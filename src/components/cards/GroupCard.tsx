import { Link } from "react-router-dom";
import { Users, Calendar, MapPin } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { SportIcon, getSportLabel } from "@/components/ui/sport-icon";
import { Badge } from "@/components/ui/badge";

type SportType = "futsal" | "tennis" | "volleyball" | "basketball" | "turf_hockey" | "badminton" | "other";

interface GroupCardProps {
  id: string;
  name: string;
  sport: SportType;
  city: string;
  memberCount: number;
  schedule: string; // e.g., "Wednesdays at 7:00 PM"
  isPublic: boolean;
  photoUrl?: string;
}

export function GroupCard({
  id,
  name,
  sport,
  city,
  memberCount,
  schedule,
  isPublic,
  photoUrl,
}: GroupCardProps) {
  return (
    <Link to={`/groups/${id}`}>
      <Card className="overflow-hidden hover:shadow-card-hover transition-shadow duration-200">
        {/* Photo banner */}
        <div className="h-24 bg-gradient-to-br from-primary/20 to-primary/5 relative">
          {photoUrl && (
            <img
              src={photoUrl}
              alt={name}
              className="w-full h-full object-cover"
            />
          )}
          <div className="absolute top-2 right-2">
            <Badge variant={isPublic ? "secondary" : "outline"} className="text-xs">
              {isPublic ? "Public" : "Private"}
            </Badge>
          </div>
        </div>

        <CardContent className="p-4 space-y-3">
          {/* Header */}
          <div className="flex items-center gap-3">
            <SportIcon sport={sport} />
            <div className="flex-1 min-w-0">
              <h3 className="font-display font-semibold text-base truncate">
                {name}
              </h3>
              <p className="text-xs text-muted-foreground">
                {getSportLabel(sport)}
              </p>
            </div>
          </div>

          {/* Details */}
          <div className="space-y-1.5 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 shrink-0" />
              <span className="truncate">{schedule}</span>
            </div>
            <div className="flex items-center gap-2">
              <MapPin className="h-4 w-4 shrink-0" />
              <span>{city}</span>
            </div>
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 shrink-0" />
              <span>{memberCount} members</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}