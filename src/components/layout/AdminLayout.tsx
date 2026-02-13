import { ReactNode, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Shield, Activity, Layers, Archive, Gift, Menu, X, LogOut } from "lucide-react";
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
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleSignOut = async () => {
    await signOut();
  };

  return (
    <div className="min-h-screen bg-background lg:flex">
      <header className="fixed left-0 right-0 top-0 z-50 flex h-14 items-center justify-between border-b bg-background px-4 lg:hidden">
        <div className="flex items-center gap-2">
          <Shield className="h-5 w-5 text-primary" />
          <span className="font-display text-base font-semibold">Admin Panel</span>
        </div>
        <Button variant="ghost" size="icon" onClick={() => setSidebarOpen(!sidebarOpen)}>
          {sidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </Button>
      </header>

      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-72 -translate-x-full flex-col border-r bg-card transition-transform lg:sticky lg:top-0 lg:h-screen lg:translate-x-0",
          sidebarOpen && "translate-x-0"
        )}
      >
        <div className="border-b px-5 py-4">
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            <div>
              <h1 className="font-display text-lg font-semibold">Admin</h1>
              <p className="text-xs text-muted-foreground">System controls</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 space-y-1 p-4">
          {adminNavItems.map(({ label, path, icon: Icon }) => {
            const isActive = location.pathname === path || (path !== "/admin" && location.pathname.startsWith(path));

            return (
              <Link
                key={path}
                to={path}
                onClick={() => setSidebarOpen(false)}
                className={cn(
                  "flex items-center gap-3 rounded-md border px-3 py-2 text-sm transition-colors",
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

        <div className="space-y-2 border-t p-4">
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

      <main className="w-full px-4 pb-6 pt-20 lg:px-8 lg:pt-8">
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
