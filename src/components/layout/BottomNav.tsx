import { Link, useLocation } from "react-router-dom";
import { Home, Users, Search, Calendar, User } from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { icon: Home, label: "Home", path: "/" },
  { icon: Users, label: "Groups", path: "/groups" },
  { icon: Search, label: "Discover", path: "/discover" },
  { icon: Calendar, label: "Games", path: "/games" },
  { icon: User, label: "Profile", path: "/profile" },
];

export function BottomNav() {
  const location = useLocation();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 glass border-t border-border/50 safe-bottom">
      <div className="flex items-center justify-around h-16 max-w-lg mx-auto">
        {navItems.map(({ icon: Icon, label, path }) => {
          const isActive = location.pathname === path;
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
              <span className="text-xs font-medium">{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}