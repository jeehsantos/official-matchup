import { ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";
import { Shield, Activity, Layers, Archive, Gift } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface AdminLayoutProps {
  children: ReactNode;
  title: string;
}

const adminNavItems = [
  { label: "Dashboard", path: "/admin", icon: Shield },
  { label: "Sports", path: "/admin/sports", icon: Activity },
  { label: "Surfaces", path: "/admin/surfaces", icon: Layers },
  { label: "Archiving", path: "/admin/archiving", icon: Archive },
  { label: "Referrals", path: "/admin/referrals", icon: Gift },
];

export function AdminLayout({ children, title }: AdminLayoutProps) {
  const location = useLocation();

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-20 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 p-4">
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            <h1 className="font-display text-xl font-semibold">{title}</h1>
          </div>
          <Button asChild variant="outline" size="sm">
            <Link to="/games">Player View</Link>
          </Button>
        </div>
        <div className="mx-auto flex max-w-6xl gap-1 overflow-x-auto px-4 pb-3">
          {adminNavItems.map(({ label, path, icon: Icon }) => {
            const isActive = location.pathname === path;

            return (
              <Link
                key={path}
                to={path}
                className={cn(
                  "inline-flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm whitespace-nowrap transition-colors",
                  isActive
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                <Icon className="h-4 w-4" />
                {label}
              </Link>
            );
          })}
        </div>
      </header>
      <main className="mx-auto max-w-6xl p-4">{children}</main>
    </div>
  );
}
