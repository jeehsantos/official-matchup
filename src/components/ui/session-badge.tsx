import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";
import { AlertTriangle, Unlock, Clock, CheckCircle, Shield } from "lucide-react";

const sessionBadgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide font-display",
  {
    variants: {
      state: {
        protected: "bg-success/15 text-success border border-success/30",
        pending: "bg-muted text-muted-foreground border border-border",
        rescue: "bg-warning/15 text-warning border border-warning/30",
        released: "bg-destructive/15 text-destructive border border-destructive/30",
        completed: "bg-primary/15 text-primary border border-primary/30",
      },
    },
    defaultVariants: {
      state: "protected",
    },
  }
);

export type SessionBadgeState = NonNullable<
  VariantProps<typeof sessionBadgeVariants>["state"]
>;

export interface SessionBadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof sessionBadgeVariants> {}

const stateIcons: Record<SessionBadgeState, React.ComponentType<{ className?: string }>> = {
  protected: Shield,
  pending: Clock,
  rescue: AlertTriangle,
  released: Unlock,
  completed: CheckCircle,
};

const stateLabels: Record<SessionBadgeState, string> = {
  protected: "Booked",
  pending: "Pending",
  rescue: "Featured",
  released: "Released",
  completed: "Completed",
};

export function SessionBadge({
  className,
  state = "pending",
  ...props
}: SessionBadgeProps) {
  const safeState = (state ?? "protected") as SessionBadgeState;
  const Icon = stateIcons[safeState];
  const label = stateLabels[safeState];

  return (
    <div className={cn(sessionBadgeVariants({ state: safeState }), className)} {...props}>
      <Icon className="h-3.5 w-3.5" />
      <span>{label}</span>
    </div>
  );
}
