import { Clock, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

interface HoldCountdownProps {
  remainingSeconds: number;
  className?: string;
}

export function HoldCountdown({ remainingSeconds, className }: HoldCountdownProps) {
  const minutes = Math.floor(remainingSeconds / 60);
  const seconds = remainingSeconds % 60;
  const isLow = remainingSeconds <= 120; // Less than 2 minutes
  const isCritical = remainingSeconds <= 60; // Less than 1 minute

  return (
    <div
      className={cn(
        "flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium",
        isCritical
          ? "bg-destructive/15 text-destructive border border-destructive/30 animate-pulse"
          : isLow
          ? "bg-warning/15 text-warning border border-warning/30"
          : "bg-primary/10 text-primary border border-primary/20",
        className
      )}
    >
      {isCritical ? (
        <AlertTriangle className="h-4 w-4" />
      ) : (
        <Clock className="h-4 w-4" />
      )}
      <span>
        Hold expires in {minutes}:{seconds.toString().padStart(2, "0")}
      </span>
    </div>
  );
}
