import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export type SessionType = "casual" | "competitive" | "training" | "private" | "tournament";

interface SessionTypeDropdownProps {
  value: SessionType;
  onChange: (value: SessionType) => void;
}

const sessionTypes: { value: SessionType; label: string; emoji: string; description: string }[] = [
  { value: "casual", label: "Casual Pickup", emoji: "🎮", description: "Relaxed game" },
  { value: "competitive", label: "Competitive", emoji: "🏆", description: "Serious play" },
  { value: "training", label: "Training", emoji: "📚", description: "Skill focus" },
  { value: "private", label: "Private", emoji: "🔒", description: "Invited only" },
  { value: "tournament", label: "Tournament", emoji: "🎯", description: "Competition" },
];

// Sport-based quick suggestions
const sportSuggestions = [
  { emoji: "⚽", label: "Futsal" },
  { emoji: "🏐", label: "Volleyball" },
  { emoji: "🏀", label: "Basketball" },
  { emoji: "🎾", label: "Tennis" },
];

export function SessionTypeDropdown({ value, onChange }: SessionTypeDropdownProps) {
  const selectedType = sessionTypes.find(t => t.value === value);

  return (
    <div className="space-y-3">
      <Label className="text-sm font-medium">Session Type</Label>
      
      {/* Quick Sport Pills */}
      <div className="flex flex-wrap gap-2 mb-3">
        {sportSuggestions.map((sport) => (
          <span
            key={sport.label}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-muted text-muted-foreground"
          >
            <span>{sport.emoji}</span>
            {sport.label}
          </span>
        ))}
      </div>

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
  const type = sessionTypes.find(t => t.value === sessionType);
  return type ? `${type.emoji} ${type.label}` : "🎮 Casual Pickup";
}

export function getSessionTypeInfo(sessionType: SessionType | null | undefined) {
  return sessionTypes.find(t => t.value === sessionType) || sessionTypes[0];
}
