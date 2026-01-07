import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";
import { Shield, AlertTriangle, Unlock } from "lucide-react";

const sessionBadgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide font-display",
  {
    variants: {
      state: {
        protected: "bg-success/15 text-success border border-success/30",
        rescue: "bg-warning/15 text-warning border border-warning/30",
        released: "bg-destructive/15 text-destructive border border-destructive/30",
      },
    },
    defaultVariants: {
      state: "protected",
    },
  }
);

interface SessionBadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof sessionBadgeVariants> {}

const stateIcons = {
  protected: Shield,
  rescue: AlertTriangle,
  released: Unlock,
};

const stateLabels = {
  protected: "Protected",
  rescue: "Rescue Mode",
  released: "Released",
};

export function SessionBadge({
  className,
  state = "protected",
  ...props
}: SessionBadgeProps) {
  const Icon = stateIcons[state ?? "protected"];
  const label = stateLabels[state ?? "protected"];

  return (
    <div className={cn(sessionBadgeVariants({ state }), className)} {...props}>
      <Icon className="h-3.5 w-3.5" />
      <span>{label}</span>
    </div>
  );
}