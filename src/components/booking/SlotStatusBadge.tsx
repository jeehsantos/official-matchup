import { Badge } from "@/components/ui/badge";
import { Users, Lock, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

type SlotStatus = "AVAILABLE" | "HELD" | "CONFIRMED" | "SELECTING";

interface SlotStatusBadgeProps {
  status: SlotStatus;
  heldByCurrentUser?: boolean;
  className?: string;
}

export function SlotStatusBadge({ status, heldByCurrentUser, className }: SlotStatusBadgeProps) {
  if (status === "AVAILABLE") {
    return null;
  }

  if (status === "SELECTING") {
    return (
      <Badge
        variant="outline"
        className={cn(
          "bg-muted/80 text-muted-foreground border-muted-foreground/30 text-xs gap-1",
          className
        )}
      >
        <Users className="h-3 w-3" />
        <span>Selecting</span>
      </Badge>
    );
  }

  if (status === "HELD") {
    return (
      <Badge
        variant="outline"
        className={cn(
          heldByCurrentUser
            ? "bg-primary/15 text-primary border-primary/30"
            : "bg-warning/15 text-warning border-warning/30",
          "text-xs gap-1",
          className
        )}
      >
        <Lock className="h-3 w-3" />
        <span>{heldByCurrentUser ? "Your Hold" : "Held"}</span>
      </Badge>
    );
  }

  if (status === "CONFIRMED") {
    return (
      <Badge
        variant="outline"
        className={cn(
          "bg-muted text-muted-foreground border-muted-foreground/30 text-xs gap-1",
          className
        )}
      >
        <CheckCircle2 className="h-3 w-3" />
        <span>Booked</span>
      </Badge>
    );
  }

  return null;
}
