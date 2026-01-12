import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

// 1. Updated Type to match the labels in your array
export type SessionType = "Futsal" | "Volleyball" | "Basketball" | "Tennis";

interface SessionTypeSelectorProps {
  value: SessionType;
  onChange: (value: SessionType) => void;
}

// 2. Explicitly type the labels as SessionType
const sessionTypes: { label: SessionType; emoji: string }[] = [
  { emoji: "⚽", label: "Futsal" },
  { emoji: "🏐", label: "Volleyball" },
  { emoji: "🏀", label: "Basketball" },
  { emoji: "🎾", label: "Tennis" },
];

export function SessionTypeSelector({ value, onChange }: SessionTypeSelectorProps) {
  return (
    <div className="space-y-3">
      <Label className="text-sm font-medium">Session Type</Label>
      <RadioGroup 
        value={value} 
        onValueChange={(val) => onChange(val as SessionType)}
        className="space-y-2"
      >
        {sessionTypes.map((type) => (
          <label
            key={type.label}
            className={`flex items-center gap-3 p-3 border rounded-lg cursor-pointer transition-colors ${
              value === type.label 
                ? "border-primary bg-primary/5" 
                : "border-border hover:border-muted-foreground/50"
            }`}
          >
            <RadioGroupItem value={type.label} id={type.label} />
            <span className="text-xl">{type.emoji}</span>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-sm">{type.label}</p>
            </div>
          </label>
        ))}
      </RadioGroup>
    </div>
  );
}

// 3. Updated helpers with wider input support for safety
export function getSessionTypeLabel(sessionType: SessionType | string | null | undefined): string {
  const type = sessionTypes.find(t => t.label === sessionType);
  return type ? `${type.emoji} ${type.label}` : "⚽ Futsal"; 
}

export function getSessionTypeInfo(sessionType: SessionType | string | null | undefined) {
  return sessionTypes.find(t => t.label === sessionType) || sessionTypes[0];
}