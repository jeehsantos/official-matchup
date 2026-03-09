import { ReactNode } from "react";
import { Footer } from "./Footer";
import { GuestNavbar } from "./GuestNavbar";

interface PublicLayoutProps {
  children: ReactNode;
  showBack?: boolean;
  showFooter?: boolean;
  showNavbar?: boolean;
}

export function PublicLayout({ children, showFooter = true, showNavbar = true }: PublicLayoutProps) {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      {showNavbar && <GuestNavbar />}
      <main className={`flex-1 ${showNavbar ? "pt-20" : ""}`}>{children}</main>
      {showFooter && <Footer />}
    </div>
  );
}
