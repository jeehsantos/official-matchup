import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export type SessionType = "Futsal" | "Volleyball" | "Basketball" | "Tennis";

interface SessionTypeDropdownProps {
  value: SessionType;
  onChange: (value: SessionType) => void;
}

// Sport types 
const sessionTypes: { label: SessionType; emoji: string }[] = [
  { emoji: "⚽", label: "Futsal" },
  { emoji: "🏐", label: "Volleyball" },
  { emoji: "🏀", label: "Basketball" },
  { emoji: "🎾", label: "Tennis" },
];

export function SessionTypeDropdown({ value, onChange }: SessionTypeDropdownProps) {
  const selectedType = sessionTypes.find((t) => t.label === value);

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
              </div>
            )}
          </SelectValue>
        </SelectTrigger>
        <SelectContent className="bg-popover border border-border shadow-lg z-50">
          {sessionTypes.map((type) => (
            <SelectItem key={type.label} value={type.label} className="py-3">
              <div className="flex items-center gap-3">
                <span className="text-lg">{type.emoji}</span>
                <div>
                  <span className="font-medium">{type.label}</span>
                </div>
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

// 2. Added safe fallbacks for helper functions
export function getSessionTypeLabel(sessionType: SessionType | string | null | undefined): string {
  const type = sessionTypes.find((t) => t.label === sessionType);
  return type ? `${type.emoji} ${type.label}` : "🎾 Tennis";
}

export function getSessionTypeInfo(sessionType: SessionType | string | null | undefined) {
  return sessionTypes.find((t) => t.label === sessionType) || sessionTypes[0];
}