import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useSportCategories, type SportCategory } from "@/hooks/useSportCategories";
import { Loader2 } from "lucide-react";

export type SessionType = "casual" | "competitive" | "training" | "private" | "tournament";

interface SessionTypeDropdownProps {
  value: SessionType;
  onChange: (value: SessionType) => void;
}

// Fallback session types when backend data is not available
const fallbackSessionTypes: { value: SessionType; label: string; emoji: string; description: string }[] = [
  { value: "casual", label: "Casual Pickup", emoji: "🎮", description: "Relaxed game" },
  { value: "competitive", label: "Competitive", emoji: "🏆", description: "Serious play" },
  { value: "training", label: "Training", emoji: "📚", description: "Skill focus" },
  { value: "private", label: "Private", emoji: "🔒", description: "Invited only" },
  { value: "tournament", label: "Tournament", emoji: "🎯", description: "Competition" },
];

// Map session type values to emojis
const sessionTypeEmojis: Record<string, string> = {
  casual: "🎮",
  competitive: "🏆",
  training: "📚",
  private: "🔒",
  tournament: "🎯",
};

export function SessionTypeDropdown({ value, onChange }: SessionTypeDropdownProps) {
  // Note: sport_categories table is for sports (futsal, tennis, etc.)
  // Session types are still managed as an enum in the database
  // We keep the static list but could migrate to a session_types table in the future
  
  const sessionTypes = fallbackSessionTypes;
  const selectedType = sessionTypes.find(t => t.value === value);

  return (
    <div className="space-y-3">
      <Label className="text-sm font-medium">Session Type</Label>

      <Select value={value} onValueChange={(val) => onChange(val as SessionType)}>
        <SelectTrigger className="w-full h-12">
          <SelectValue>
            {selectedType && (
              <div className="flex items-center gap-2">
                <span className="text-lg">{selectedType.emoji}</span>
                <span>{selectedType.label}</span>
                <span className="text-xs text-muted-foreground">— {selectedType.description}</span>
              </div>
            )}
          </SelectValue>
        </SelectTrigger>
        <SelectContent className="bg-popover border border-border shadow-lg z-50">
          {sessionTypes.map((type) => (
            <SelectItem key={type.value} value={type.value} className="py-3">
              <div className="flex items-center gap-3">
                <span className="text-lg">{type.emoji}</span>
                <div>
                  <span className="font-medium">{type.label}</span>
                  <span className="text-xs text-muted-foreground ml-2">— {type.description}</span>
                </div>
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

export function getSessionTypeLabel(sessionType: SessionType | null | undefined): string {
  const type = fallbackSessionTypes.find(t => t.value === sessionType);
  return type ? `${type.emoji} ${type.label}` : "🎮 Casual Pickup";
}

export function getSessionTypeInfo(sessionType: SessionType | null | undefined) {
  return fallbackSessionTypes.find(t => t.value === sessionType) || fallbackSessionTypes[0];
}
