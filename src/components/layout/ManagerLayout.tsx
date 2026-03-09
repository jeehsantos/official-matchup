import { ReactNode, useEffect, useState, useMemo } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/auth-context";
import { useUserProfile } from "@/hooks/useUserProfile";
import { useTranslation } from "react-i18next";

import {
  LayoutDashboard,
  Building2,
  Calendar,
  CreditCard,
  LogOut,
  Loader2,
  Menu,
  X,
  Settings,
  Package } from
"lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface ManagerLayoutProps {
  children: ReactNode;
}

export function ManagerLayout({ children }: ManagerLayoutProps) {
  const { t } = useTranslation("manager");
  const location = useLocation();
  const navigate = useNavigate();
  const { user, userRole, signOut, isLoading } = useAuth();
  const { profile } = useUserProfile();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [hasCheckedAuth, setHasCheckedAuth] = useState(false);

  const isStaff = userRole === "venue_staff";

  const navItems = useMemo(() => [
    { icon: LayoutDashboard, label: t("nav.dashboard"), path: "/manager" },
    { icon: Building2, label: t("nav.venues"), path: "/manager/courts" },
    { icon: Calendar, label: t("nav.availability"), path: "/manager/availability" },
    { icon: Package, label: t("nav.equipment"), path: "/manager/equipment" },
    { icon: CreditCard, label: t("nav.bookings"), path: "/manager/bookings" },
    { icon: Settings, label: t("nav.settings"), path: "/manager/settings" },
  ], [t]);

  const mobileNavItems = useMemo(() => [
    { icon: LayoutDashboard, label: t("nav.dashboard"), path: "/manager" },
    { icon: Building2, label: t("nav.venues"), path: "/manager/courts" },
    { icon: CreditCard, label: t("nav.bookings"), path: "/manager/bookings" },
    { icon: Settings, label: t("nav.settings"), path: "/manager/settings" },
  ], [t]);

  // Filter nav items for staff
  const staffAllowedPaths = ["/manager/availability", "/manager/equipment", "/manager/bookings", "/manager/settings"];
  const filteredNavItems = useMemo(() =>
    isStaff ? navItems.filter(item => staffAllowedPaths.includes(item.path)) : navItems,
    [isStaff, navItems]
  );
  const filteredMobileNavItems = useMemo(() =>
    isStaff ? mobileNavItems.filter(item => staffAllowedPaths.includes(item.path)) : mobileNavItems,
    [isStaff, mobileNavItems]
  );

  useEffect(() => {
    if (!isLoading) {
      setHasCheckedAuth(true);

      if (!user) {
        navigate("/auth", { replace: true });
      } else if (userRole && userRole !== "court_manager" && userRole !== "venue_staff") {
        navigate("/", { replace: true });
      } else if (isStaff) {
        const currentPath = location.pathname;
        const isAllowed = staffAllowedPaths.some(p => currentPath === p || currentPath.startsWith(p + "/"));
        if (!isAllowed) {
          navigate("/manager/availability", { replace: true });
        }
      }
    }
  }, [user, userRole, isLoading, navigate, location.pathname]);

  if (isLoading || !hasCheckedAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>);
  }

  if (!user || userRole && userRole !== "court_manager" && userRole !== "venue_staff") {
    return null;
  }

  const handleSignOut = async () => {
    await signOut();
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Mobile Header */}
      <header className="lg:hidden fixed top-0 left-0 right-0 z-50 glass border-b border-border/50 h-16">
        <div className="flex items-center justify-between h-full px-4">
          <Link to="/manager" className="flex items-center" aria-label="Sport Arena manager home">
            <img
              src="/sportarena-logo.png"
              alt="Sport Arena logo"
              className="h-10 w-auto object-contain" />
          </Link>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setSidebarOpen(!sidebarOpen)}>
              {sidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </Button>
          </div>
        </div>
      </header>

      {/* Mobile Sidebar Overlay */}
      {sidebarOpen &&
      <div
        className="lg:hidden fixed inset-0 bg-black/50 z-40"
        onClick={() => setSidebarOpen(false)} />
      }

      {/* Sidebar */}
      <aside className={cn(
        "fixed top-0 left-0 z-50 h-full w-1/2 max-w-64 bg-card border-r border-border transition-transform lg:w-64 lg:translate-x-0",
        sidebarOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="h-14 flex items-center px-4 border-b border-border">
            <Link to="/manager" className="flex items-center gap-3" aria-label="Sport Arena manager home">
              <img
                src="/sportarena-logo.png"
                alt="Sport Arena logo"
                className="h-14 w-auto object-contain" />
              <div></div>
            </Link>
          </div>

          {/* Navigation */}
          <nav className="flex-1 p-4 space-y-1">
            {filteredNavItems.map(({ icon: Icon, label, path }) => {
              const isActive = location.pathname === path ||
              path !== "/manager" && location.pathname.startsWith(path);
              return (
                <Link
                  key={path}
                  to={path}
                  onClick={() => setSidebarOpen(false)}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2 rounded-lg transition-colors",
                    isActive ?
                    "bg-primary text-primary-foreground" :
                    "text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}>
                  <Icon className="h-5 w-5" />
                  <span className="font-medium">{label}</span>
                </Link>);
            })}
          </nav>

          {/* Theme Toggle & Sign Out */}
          <div className="p-4 border-t border-border space-y-2 pb-20 lg:pb-4">
            {profile?.full_name &&
            <p className="px-3 text-sm font-medium truncate">{profile.full_name}</p>
            }
            <Button
              variant="ghost"
              className="w-full justify-start gap-3 text-muted-foreground"
              onClick={handleSignOut}>
              <LogOut className="h-5 w-5" />
              {t("nav.signOut")}
            </Button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="lg:ml-64 pt-16 lg:pt-0 h-[calc(100dvh-4rem)] overflow-y-auto scrollbar-hide lg:h-auto lg:min-h-screen lg:overflow-visible pb-20 lg:pb-0">
        {children}
      </main>

      {/* Mobile Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 z-[100] bg-background border-t lg:hidden" style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
        <div className="flex items-center justify-around h-16 max-w-lg mx-auto">
          {filteredMobileNavItems.map(({ icon: Icon, label, path }) => {
            const isActive = location.pathname === path ||
            path !== "/manager" && location.pathname.startsWith(path);

            return (
              <Link
                key={path}
                to={path}
                className={cn(
                  "relative flex flex-col items-center justify-center gap-1 w-16 h-full transition-colors",
                  isActive ?
                  "text-primary" :
                  "text-muted-foreground hover:text-foreground"
                )}>
                <span
                  className={cn(
                    "absolute top-0 h-1 w-10 rounded-full bg-primary transition-opacity duration-200",
                    isActive ? "opacity-100" : "opacity-0"
                  )} />
                <span
                  className={cn(
                    "flex h-8 w-8 items-center justify-center rounded-full transition-all duration-200",
                    isActive && "bg-primary/10"
                  )}>
                  <Icon className={cn("h-5 w-5", isActive && "stroke-[2.5]")} />
                </span>
                <span className="text-[10px] font-medium">{label}</span>
              </Link>);
          })}
        </div>
      </nav>
    </div>);
}
