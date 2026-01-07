import { Button } from "@/components/ui/button";
import { Users, Building2, Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface RoleSelectionProps {
  selectedRole: "player" | "court_manager" | null;
  onSelect: (role: "player" | "court_manager") => void;
}

const roles = [
  {
    id: "player" as const,
    title: "Player",
    description: "Join groups, book courts, and play sports with others",
    icon: Users,
    features: ["Join weekly games", "Book court slots", "Become a group organizer"],
  },
  {
    id: "court_manager" as const,
    title: "Court Manager",
    description: "List your courts and manage bookings",
    icon: Building2,
    features: ["Register venues & courts", "Publish availability", "Receive guaranteed payments"],
  },
];

export function RoleSelection({ selectedRole, onSelect }: RoleSelectionProps) {
  return (
    <div className="space-y-4">
      <div className="text-center mb-6">
        <h3 className="font-display font-semibold text-lg">I want to...</h3>
        <p className="text-muted-foreground text-sm">You can change this later</p>
      </div>
      
      <div className="grid gap-4">
        {roles.map((role) => (
          <button
            key={role.id}
            type="button"
            onClick={() => onSelect(role.id)}
            className={cn(
              "w-full p-4 rounded-xl border-2 text-left transition-all",
              selectedRole === role.id
                ? "border-primary bg-primary/5"
                : "border-border hover:border-primary/50"
            )}
          >
            <div className="flex items-start gap-4">
              <div className={cn(
                "w-12 h-12 rounded-xl flex items-center justify-center shrink-0",
                selectedRole === role.id ? "bg-primary text-primary-foreground" : "bg-muted"
              )}>
                <role.icon className="h-6 w-6" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <h4 className="font-semibold">{role.title}</h4>
                  {selectedRole === role.id && (
                    <Check className="h-5 w-5 text-primary" />
                  )}
                </div>
                <p className="text-muted-foreground text-sm mb-3">{role.description}</p>
                <ul className="space-y-1">
                  {role.features.map((feature, i) => (
                    <li key={i} className="text-sm text-muted-foreground flex items-center gap-2">
                      <span className="w-1 h-1 rounded-full bg-primary" />
                      {feature}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
