import { Link, useLocation } from "react-router-dom";
import { Search, Users, Calendar, User, Map } from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { icon: Calendar, label: "My Games", path: "/games" },
  { icon: Map, label: "Explore", path: "/courts" },
  { icon: Search, label: "Find", path: "/discover" },
  { icon: Users, label: "Groups", path: "/groups" },
  { icon: User, label: "Profile", path: "/profile" },
];

export function BottomNav() {
  const location = useLocation();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-[100] bg-background border-t lg:hidden" style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
      {/* Mobile bottom nav */}
      <div className="flex items-center justify-around h-16 max-w-lg mx-auto">
        {navItems.map(({ icon: Icon, label, path }) => {
          const isActive = location.pathname === path || 
            (path !== "/" && location.pathname.startsWith(path));
          return (
            <Link
              key={path}
              to={path}
              className={cn(
                "relative flex flex-col items-center justify-center gap-1 w-16 h-full transition-colors",
                isActive
                  ? "text-primary"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <span
                className={cn(
                  "absolute top-0 h-1 w-10 rounded-full bg-primary transition-opacity duration-200",
                  isActive ? "opacity-100" : "opacity-0"
                )}
              />
              <span
                className={cn(
                  "flex h-8 w-8 items-center justify-center rounded-full transition-all duration-200",
                  isActive && "bg-primary/10"
                )}
              >
                <Icon className={cn("h-5 w-5", isActive && "stroke-[2.5]")} />
              </span>
              <span className="text-[10px] font-medium">{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
