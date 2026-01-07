import { ReactNode } from "react";
import { BottomNav } from "./BottomNav";
import { Header } from "./Header";

interface MobileLayoutProps {
  children: ReactNode;
  title?: string;
  showBack?: boolean;
  showHeader?: boolean;
  showBottomNav?: boolean;
  rightAction?: ReactNode;
}

export function MobileLayout({
  children,
  title,
  showBack = false,
  showHeader = true,
  showBottomNav = true,
  rightAction,
}: MobileLayoutProps) {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      {showHeader && (
        <Header title={title} showBack={showBack} rightAction={rightAction} />
      )}
      <main className="flex-1 overflow-y-auto pb-20">
        {children}
      </main>
      {showBottomNav && <BottomNav />}
    </div>
  );
}