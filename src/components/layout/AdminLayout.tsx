import { ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";
import { Shield, Activity, Layers, Archive, Gift, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth-context";
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
  const { signOut } = useAuth();

  const handleSignOut = async () => {
    await signOut();
  };

  return (
    <div className="min-h-screen bg-background md:flex">
      <aside className="border-b bg-card md:sticky md:top-0 md:h-screen md:w-72 md:border-b-0 md:border-r">
        <div className="border-b px-5 py-4">
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            <div>
              <h1 className="font-display text-lg font-semibold">Admin</h1>
              <p className="text-xs text-muted-foreground">System controls</p>
            </div>
          </div>
        </div>

        <nav className="flex gap-1 overflow-x-auto p-4 md:flex-col md:overflow-visible">
          {adminNavItems.map(({ label, path, icon: Icon }) => {
            const isActive =
              location.pathname === path ||
              (path !== "/admin" && location.pathname.startsWith(path));

            return (
              <Link
                key={path}
                to={path}
                className={cn(
                  "inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm whitespace-nowrap transition-colors",
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
        </nav>

        <div className="border-t p-4 md:mt-auto">
          <Button
            variant="ghost"
            className="w-full justify-start gap-2 text-muted-foreground"
            onClick={handleSignOut}
          >
            <LogOut className="h-4 w-4" />
            Sign Out
          </Button>
        </div>
      </aside>

      <main className="w-full p-4 md:p-8">
        <div className="mx-auto w-full max-w-6xl space-y-6">
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            <h2 className="font-display text-2xl font-semibold">{title}</h2>
          </div>
          {children}
        </div>
      </main>
    </div>
  );
}
