import { ReactNode, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { BottomNav } from "./BottomNav";
import { Header } from "./Header";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  Search, 
  Users, 
  Calendar, 
  User, 
  LogOut,
  Menu,
  X
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";

interface MobileLayoutProps {
  children: ReactNode;
  title?: string;
  showBack?: boolean;
  showHeader?: boolean;
  showBottomNav?: boolean;
  rightAction?: ReactNode;
}

const navItems = [
  { icon: Search, label: "Explore", path: "/" },
  { icon: Users, label: "Groups", path: "/groups" },
  { icon: Calendar, label: "Games", path: "/games" },
  { icon: User, label: "Profile", path: "/profile" },
];

export function MobileLayout({
  children,
  title,
  showBack = false,
  showHeader = true,
  showBottomNav = true,
  rightAction,
}: MobileLayoutProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { signOut } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleSignOut = async () => {
    await signOut();
    navigate("/", { replace: true });
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex fixed top-0 left-0 z-50 h-full w-64 bg-card border-r border-border flex-col">
        {/* Logo */}
        <div className="h-14 flex items-center px-4 border-b border-border">
          <Link to="/" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
              <span className="text-primary-foreground font-display font-bold text-sm">N</span>
            </div>
            <span className="font-display font-bold text-lg">NextPlay</span>
          </Link>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4 space-y-1">
          {navItems.map(({ icon: Icon, label, path }) => {
            const isActive = location.pathname === path || 
              (path !== "/" && location.pathname.startsWith(path));
            return (
              <Link
                key={path}
                to={path}
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

        {/* Sign Out */}
        <div className="p-4 border-t border-border">
          <Button 
            variant="ghost" 
            className="w-full justify-start gap-3 text-muted-foreground"
            onClick={handleSignOut}
          >
            <LogOut className="h-5 w-5" />
            Sign Out
          </Button>
        </div>
      </aside>

      {/* Mobile Header */}
      {showHeader && (
        <Header title={title} showBack={showBack} rightAction={rightAction} />
      )}

      {/* Main content with responsive padding for sidebar on desktop */}
      <main className={cn(
        "flex-1 overflow-y-auto lg:pb-6 lg:pl-64",
        showBottomNav ? "pb-24" : "pb-safe"
      )} style={showBottomNav ? { paddingBottom: 'calc(5rem + env(safe-area-inset-bottom, 0px))' } : undefined}>
        <div className="max-w-7xl mx-auto">
          {children}
        </div>
      </main>

      {/* Mobile Bottom Nav */}
      {showBottomNav && <BottomNav />}
    </div>
  );
}
