import { Users } from "lucide-react";
import { cn } from "@/lib/utils";

interface PlayerCountProps {
  current: number;
  min: number;
  max: number;
  className?: string;
}

export function PlayerCount({ current, min, max, className }: PlayerCountProps) {
  const percentage = Math.min((current / min) * 100, 100);
  const isFull = current >= max;
  const hasMinimum = current >= min;

  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex items-center justify-between text-sm">
        <div className="flex items-center gap-1.5 text-muted-foreground">
          <Users className="h-4 w-4" />
          <span>Players</span>
        </div>
        <span
          className={cn(
            "font-semibold font-display",
            isFull && "text-primary",
            !hasMinimum && "text-warning"
          )}
        >
          {current} / {max}
        </span>
      </div>

      <div className="h-2 bg-muted rounded-full overflow-hidden">
        <div
          className={cn(
            "h-full rounded-full transition-all duration-500",
            hasMinimum ? "bg-primary" : "bg-warning"
          )}
          style={{ width: `${Math.min((current / max) * 100, 100)}%` }}
        />
      </div>

      {!hasMinimum && (
        <p className="text-xs text-warning font-medium">
          Need {min - current} more to confirm
        </p>
      )}
    </div>
  );
}