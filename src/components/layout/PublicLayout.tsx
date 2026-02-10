import { ReactNode } from "react";
import { Footer } from "./Footer";
import { GuestNavbar } from "./GuestNavbar";

interface PublicLayoutProps {
  children: ReactNode;
  showBack?: boolean;
  showFooter?: boolean;
}

export function PublicLayout({ children, showFooter = true }: PublicLayoutProps) {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <GuestNavbar />
      <main className="flex-1 pt-20">{children}</main>
      {showFooter && <Footer />}
    </div>
  );
}
