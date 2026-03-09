import { ReactNode, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Shield, Activity, Layers, Archive, Gift, LogOut, Menu, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { useAuth } from "@/lib/auth-context";
import { cn } from "@/lib/utils";

interface AdminLayoutProps {
  children: ReactNode;
  title: string;
}

const adminNavItems = [
  { label: "Dashboard", path: "/admin", icon: Shield },
  { label: "Users", path: "/admin/users", icon: Users },
  { label: "Sports", path: "/admin/sports", icon: Activity },
  { label: "Surfaces", path: "/admin/surfaces", icon: Layers },
  { label: "Archiving", path: "/admin/archiving", icon: Archive },
  { label: "Referrals", path: "/admin/referrals", icon: Gift },
];

export function AdminLayout({ children, title }: AdminLayoutProps) {
  const location = useLocation();
  const { signOut } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleSignOut = async () => {
    setMobileMenuOpen(false);
    await signOut();
  };

  const renderNavLinks = (onNavigate?: () => void) => (
    <nav className="flex flex-col gap-1 p-4">
      {adminNavItems.map(({ label, path, icon: Icon }) => {
        const isActive =
          location.pathname === path ||
          (path !== "/admin" && location.pathname.startsWith(path));

        return (
          <Link
            key={path}
            to={path}
            onClick={onNavigate}
            className={cn(
              "inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm transition-colors",
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
  );

  return (
    <div className="min-h-screen bg-background md:flex">
      <header className="sticky top-0 z-30 border-b bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80 md:hidden">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            <div>
              <p className="font-display text-base font-semibold">Admin</p>
              <p className="text-xs text-muted-foreground">{title}</p>
            </div>
          </div>

          <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" aria-label="Open admin menu">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-[280px] p-0">
              <div className="flex h-full flex-col" data-testid="admin-sidebar-mobile">
                <div className="border-b px-5 py-4">
                  <div className="flex items-center gap-2">
                    <Shield className="h-5 w-5 text-primary" />
                    <div>
                      <h1 className="font-display text-lg font-semibold">Admin</h1>
                      <p className="text-xs text-muted-foreground">System controls</p>
                    </div>
                  </div>
                </div>

                {renderNavLinks(() => setMobileMenuOpen(false))}

                <div className="mt-auto border-t p-4">
                  <Button
                    variant="ghost"
                    className="w-full justify-start gap-2 text-muted-foreground"
                    onClick={handleSignOut}
                  >
                    <LogOut className="h-4 w-4" />
                    Sign Out
                  </Button>
                </div>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </header>

      <aside data-testid="admin-sidebar" className="hidden border-r bg-card md:sticky md:top-0 md:flex md:h-screen md:w-72 md:flex-col">
        <div className="border-b px-5 py-4">
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            <div>
              <h1 className="font-display text-lg font-semibold">Admin</h1>
              <p className="text-xs text-muted-foreground">System controls</p>
            </div>
          </div>
        </div>

        {renderNavLinks()}

        <div className="mt-auto border-t p-4">
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

      <main className="w-full p-4 pt-6 md:p-8">
        <div className="mx-auto w-full max-w-6xl space-y-6">
          <div className="hidden items-center gap-2 md:flex">
            <Shield className="h-5 w-5 text-primary" />
            <h2 className="font-display text-2xl font-semibold">{title}</h2>
          </div>
          {children}
        </div>
      </main>
    </div>
  );
}
