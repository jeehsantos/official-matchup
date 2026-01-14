import { cn } from "@/lib/utils";

export type SportType = "futsal" | "tennis" | "volleyball" | "basketball" | "turf_hockey" | "badminton" | "hockey" | "other" | string;

interface SportIconProps {
  sport: SportType;
  size?: "sm" | "md" | "lg";
  className?: string;
  icon?: string | null;
  label?: string;
}

// Default emoji mappings - used as fallback when icon prop not provided
const defaultSportEmojis: Record<string, string> = {
  futsal: "⚽",
  tennis: "🎾",
  volleyball: "🏐",
  basketball: "🏀",
  turf_hockey: "🏑",
  badminton: "🏸",
  hockey: "🏒",
  other: "🎯",
};

// Default label mappings - used as fallback when label prop not provided
const defaultSportLabels: Record<string, string> = {
  futsal: "Futsal",
  tennis: "Tennis",
  volleyball: "Volleyball",
  basketball: "Basketball",
  turf_hockey: "Turf Hockey",
  badminton: "Badminton",
  hockey: "Hockey",
  other: "Other",
};

const sizeClasses = {
  sm: "w-8 h-8 text-base",
  md: "w-10 h-10 text-lg",
  lg: "w-14 h-14 text-2xl",
};

export function SportIcon({ sport, size = "md", className, icon, label }: SportIconProps) {
  // Use provided icon or fallback to default mapping
  const displayIcon = icon || defaultSportEmojis[sport] || "🎯";
  const displayLabel = label || defaultSportLabels[sport] || sport;
  
  return (
    <div
      className={cn(
        "rounded-xl bg-secondary flex items-center justify-center",
        sizeClasses[size],
        className
      )}
      role="img"
      aria-label={displayLabel}
    >
      {displayIcon}
    </div>
  );
}

export function getSportLabel(sport: SportType, customLabel?: string): string {
  return customLabel || defaultSportLabels[sport] || sport;
}

export function getSportEmoji(sport: SportType, customIcon?: string | null): string {
  return customIcon || defaultSportEmojis[sport] || "🎯";
}
