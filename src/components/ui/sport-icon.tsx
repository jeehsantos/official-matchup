import { cn } from "@/lib/utils";

type SportType = "futsal" | "tennis" | "volleyball" | "basketball" | "turf_hockey" | "badminton" | "other";

interface SportIconProps {
  sport: SportType;
  size?: "sm" | "md" | "lg";
  className?: string;
}

const sportEmojis: Record<SportType, string> = {
  futsal: "⚽",
  tennis: "🎾",
  volleyball: "🏐",
  basketball: "🏀",
  turf_hockey: "🏑",
  badminton: "🏸",
  other: "🎯",
};

const sportLabels: Record<SportType, string> = {
  futsal: "Futsal",
  tennis: "Tennis",
  volleyball: "Volleyball",
  basketball: "Basketball",
  turf_hockey: "Turf Hockey",
  badminton: "Badminton",
  other: "Other",
};

const sizeClasses = {
  sm: "w-8 h-8 text-base",
  md: "w-10 h-10 text-lg",
  lg: "w-14 h-14 text-2xl",
};

export function SportIcon({ sport, size = "md", className }: SportIconProps) {
  return (
    <div
      className={cn(
        "rounded-xl bg-secondary flex items-center justify-center",
        sizeClasses[size],
        className
      )}
      role="img"
      aria-label={sportLabels[sport]}
    >
      {sportEmojis[sport]}
    </div>
  );
}

export function getSportLabel(sport: SportType): string {
  return sportLabels[sport];
}