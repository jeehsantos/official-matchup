import { useState, useEffect, useRef, useCallback } from "react";
import { Link, useLocation } from "react-router-dom";
import { Search, Heart, User } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTranslation } from "react-i18next";

export function GuestBottomNav() {
  const location = useLocation();
  const { t } = useTranslation("common");
  const [isVisible, setIsVisible] = useState(true);
  const lastScrollY = useRef(0);
  const ticking = useRef(false);

  const navItems = [
    { icon: Search, label: t("bottomNav.explore"), path: "/courts" },
    { icon: Heart, label: t("bottomNav.favourite"), path: "/auth", showLoginPrompt: true },
    { icon: User, label: t("bottomNav.logIn"), path: "/auth" },
  ];

  const handleScroll = useCallback(() => {
    if (!ticking.current) {
      window.requestAnimationFrame(() => {
        const currentScrollY = window.scrollY;
        if (Math.abs(currentScrollY - lastScrollY.current) > 10) {
          if (currentScrollY > lastScrollY.current && currentScrollY > 100) {
            setIsVisible(false);
          } else {
            setIsVisible(true);
          }
          lastScrollY.current = currentScrollY;
        }
        ticking.current = false;
      });
      ticking.current = true;
    }
  }, []);

  useEffect(() => {
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [handleScroll]);

  return (
    <nav
      className={cn(
        "fixed bottom-0 left-0 right-0 z-[100] bg-background border-t lg:hidden transition-transform duration-300 ease-in-out will-change-transform",
        isVisible ? "translate-y-0" : "translate-y-full"
      )}
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
    >
      <div className="flex items-center justify-around h-16 max-w-lg mx-auto">
        {navItems.map(({ icon: Icon, label, path }) => {
          const isActive = location.pathname === path || 
            (path !== "/" && path !== "/auth" && location.pathname.startsWith(path));
          return (
            <Link
              key={label}
              to={path}
              className={cn(
                "relative flex flex-col items-center justify-center gap-1 w-16 h-full transition-colors",
                isActive ? "text-primary" : "text-muted-foreground hover:text-foreground"
              )}
            >
              <span className={cn("absolute top-0 h-1 w-10 rounded-full bg-primary transition-opacity duration-200", isActive ? "opacity-100" : "opacity-0")} />
              <span className={cn("flex h-8 w-8 items-center justify-center rounded-full transition-all duration-200", isActive && "bg-primary/10")}>
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
