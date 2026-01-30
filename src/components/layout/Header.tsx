import { ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Bell } from "lucide-react";
import { Button } from "@/components/ui/button";

interface HeaderProps {
  title?: string;
  showBack?: boolean;
  rightAction?: ReactNode;
}

export function Header({ title, showBack = false, rightAction }: HeaderProps) {
  const navigate = useNavigate();

  return (
    <header className="sticky top-0 z-50 glass border-b border-border/50 safe-top lg:hidden">
      <div className="flex items-center justify-between h-14 px-4">
        <div className="flex items-center gap-3">
          {showBack ? (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate(-1)}
              className="h-9 w-9 -ml-2"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
          ) : (
            <div className="flex items-center">
              <img
                src="/sportarena-logo.png"
                alt="Sport Arena logo"
                className="h-10 w-auto mix-blend-screen"
              />
            </div>
          )}
          {showBack && title && (
            <h1 className="font-display font-semibold text-lg">{title}</h1>
          )}
        </div>

        <div className="flex items-center gap-2">
          {rightAction}
          <Button variant="ghost" size="icon" className="h-9 w-9 relative">
            <Bell className="h-5 w-5" />
            <span className="absolute top-1 right-1 w-2 h-2 bg-accent rounded-full" />
          </Button>
        </div>
      </div>
    </header>
  );
}
