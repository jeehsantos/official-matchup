import { ReactNode, useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/auth-context";
import { ChatWidget } from "@/components/chat/ChatWidget";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { 
  LayoutDashboard, 
  Building2, 
  Calendar, 
  CreditCard,
  User,
  LogOut,
  Loader2,
  Menu,
  X,
  Settings,
  Package
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface ManagerLayoutProps {
  children: ReactNode;
}

const navItems = [
  { icon: LayoutDashboard, label: "Dashboard", path: "/manager" },
  { icon: Building2, label: "Courts", path: "/manager/courts" },
  { icon: Calendar, label: "Availability", path: "/manager/availability" },
  { icon: Package, label: "Equipment", path: "/manager/equipment" },
  { icon: CreditCard, label: "Bookings", path: "/manager/bookings" },
  { icon: Settings, label: "Settings", path: "/manager/settings" },
];

const mobileNavItems = [
  { icon: LayoutDashboard, label: "Dashboard", path: "/manager" },
  { icon: Building2, label: "Courts", path: "/manager/courts" },
  { icon: Package, label: "Gear", path: "/manager/equipment" },
  { icon: Settings, label: "Settings", path: "/manager/settings" },
];

export function ManagerLayout({ children }: ManagerLayoutProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, userRole, signOut, isLoading } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [hasCheckedAuth, setHasCheckedAuth] = useState(false);

  useEffect(() => {
    // Only redirect after loading is complete
    if (!isLoading) {
      setHasCheckedAuth(true);
      
      if (!user) {
        navigate("/auth", { replace: true });
      } else if (userRole && userRole !== "court_manager") {
        navigate("/", { replace: true });
      }
    }
  }, [user, userRole, isLoading, navigate]);

  // Show loading while checking auth
  if (isLoading || !hasCheckedAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Don't render if not authenticated or not a court manager
  if (!user || (userRole && userRole !== "court_manager")) {
    return null;
  }

  const handleSignOut = async () => {
    await signOut();
    navigate("/", { replace: true });
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Mobile Header */}
      <header className="lg:hidden fixed top-0 left-0 right-0 z-50 glass border-b border-border/50 h-14">
        <div className="flex items-center justify-between h-full px-4">
          <Link to="/manager" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
              <span className="text-primary-foreground font-display font-bold text-sm">N</span>
            </div>
            <span className="font-display font-bold">MatchUP</span>
          </Link>
          <div className="flex items-center gap-2">
            <ThemeToggle variant="ghost" size="icon" />
            <Button 
              variant="ghost" 
              size="icon"
              onClick={() => setSidebarOpen(!sidebarOpen)}
            >
              {sidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </Button>
          </div>
        </div>
      </header>

      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div 
          className="lg:hidden fixed inset-0 bg-black/50 z-40"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={cn(
        "fixed top-0 left-0 z-50 h-full w-64 bg-card border-r border-border transition-transform lg:translate-x-0",
        sidebarOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="h-14 flex items-center px-4 border-b border-border">
            <Link to="/manager" className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
                <span className="text-primary-foreground font-display font-bold text-sm">N</span>
              </div>
              <div>
                <span className="font-display font-bold">MatchUP</span>
                <span className="text-xs text-muted-foreground block">Court Manager</span>
              </div>
            </Link>
          </div>

          {/* Navigation */}
          <nav className="flex-1 p-4 space-y-1">
            {navItems.map(({ icon: Icon, label, path }) => {
              const isActive = location.pathname === path || 
                (path !== "/manager" && location.pathname.startsWith(path));
              return (
                <Link
                  key={path}
                  to={path}
                  onClick={() => setSidebarOpen(false)}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2 rounded-lg transition-colors",
                    isActive
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                >
                  <Icon className="h-5 w-5" />
                  <span className="font-medium">{label}</span>
                </Link>
              );
            })}
          </nav>

          {/* Theme Toggle & Sign Out */}
          <div className="p-4 border-t border-border space-y-2">
            <div className="flex items-center justify-between px-3 py-2">
              <span className="text-sm text-muted-foreground">Theme</span>
              <ThemeToggle variant="outline" size="icon" />
            </div>
            <Button 
              variant="ghost" 
              className="w-full justify-start gap-3 text-muted-foreground"
              onClick={handleSignOut}
            >
              <LogOut className="h-5 w-5" />
              Sign Out
            </Button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="lg:ml-64 pt-14 lg:pt-0 min-h-screen pb-20 lg:pb-0">
        {children}
      </main>

      {/* Mobile Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 z-[100] bg-background border-t lg:hidden" style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
        <div className="flex items-center justify-around h-16 max-w-lg mx-auto">
          {mobileNavItems.map(({ icon: Icon, label, path }) => {
            const isActive = location.pathname === path || 
              (path !== "/manager" && location.pathname.startsWith(path));
            return (
              <Link
                key={path}
                to={path}
                className={cn(
                  "flex flex-col items-center justify-center gap-1 w-16 h-full transition-colors",
                  isActive
                    ? "text-primary"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <Icon className={cn("h-5 w-5", isActive && "stroke-[2.5]")} />
                <span className="text-[10px] font-medium">{label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
      {/* Chat Widget for manager */}
      <ChatWidget />
    </div>
  );
}
