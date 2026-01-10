import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

export type SessionType = "casual" | "competitive" | "training" | "private" | "tournament";

interface SessionTypeSelectorProps {
  value: SessionType;
  onChange: (value: SessionType) => void;
}

const sessionTypes: { value: SessionType; label: string; icon: string; description: string }[] = [
  { value: "casual", label: "Casual Pickup", icon: "🎮", description: "Relaxed game, all skill levels" },
  { value: "competitive", label: "Competitive", icon: "🏆", description: "Serious play, similar skill levels" },
  { value: "training", label: "Training/Practice", icon: "📚", description: "Skill development focus" },
  { value: "private", label: "Private Session", icon: "🔒", description: "Invited members only" },
  { value: "tournament", label: "Tournament", icon: "🎯", description: "Official competition" },
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
            key={type.value}
            className={`flex items-center gap-3 p-3 border rounded-lg cursor-pointer transition-colors ${
              value === type.value 
                ? "border-primary bg-primary/5" 
                : "border-border hover:border-muted-foreground/50"
            }`}
          >
            <RadioGroupItem value={type.value} id={type.value} />
            <span className="text-xl">{type.icon}</span>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-sm">{type.label}</p>
              <p className="text-xs text-muted-foreground truncate">{type.description}</p>
            </div>
          </label>
        ))}
      </RadioGroup>
    </div>
  );
}

export function getSessionTypeLabel(sessionType: SessionType | null | undefined): string {
  const type = sessionTypes.find(t => t.value === sessionType);
  return type ? `${type.icon} ${type.label}` : "🎮 Casual Pickup";
}

export function getSessionTypeInfo(sessionType: SessionType | null | undefined) {
  return sessionTypes.find(t => t.value === sessionType) || sessionTypes[0];
}
