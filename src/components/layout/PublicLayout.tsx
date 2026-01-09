import { ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Menu } from "lucide-react";
import { Footer } from "./Footer";
import {
  Sheet,
  SheetContent,
  SheetTrigger,
} from "@/components/ui/sheet";
import { useState } from "react";

interface PublicLayoutProps {
  children: ReactNode;
  showBack?: boolean;
  showFooter?: boolean;
}

const navLinks = [
  { label: "About", href: "/about" },
  { label: "Contact", href: "/contact" },
  { label: "Browse Courts", href: "/courts" },
];

export function PublicLayout({ children, showBack = false, showFooter = true }: PublicLayoutProps) {
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Navigation - Sticky Frosted Glass */}
      <header className="fixed top-0 left-0 right-0 z-50 navbar-glass">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            {showBack && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => navigate(-1)}
                className="shrink-0"
              >
                <ArrowLeft className="h-5 w-5" />
              </Button>
            )}
            <Link to="/" className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-primary flex items-center justify-center shadow-md">
                <span className="text-primary-foreground font-display font-bold">M</span>
              </div>
              <span className="font-display font-bold text-xl">MatchUP</span>
            </Link>
          </div>
          
          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-8">
            {navLinks.map((link) => (
              <Link 
                key={link.href}
                to={link.href} 
                className="nav-link text-sm font-medium"
              >
                {link.label}
              </Link>
            ))}
          </nav>
          
          <div className="flex items-center gap-3">
            <Link to="/auth" className="hidden sm:block">
              <Button variant="ghost">Sign In</Button>
            </Link>
            <Link to="/auth" className="hidden sm:block">
              <Button className="shadow-lg">Get Started</Button>
            </Link>
            
            {/* Mobile Menu */}
            <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
              <SheetTrigger asChild className="md:hidden">
                <Button variant="ghost" size="icon">
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-[280px] sm:w-[320px]">
                <div className="flex flex-col gap-6 mt-8">
                  {navLinks.map((link) => (
                    <Link 
                      key={link.href}
                      to={link.href} 
                      className="text-lg font-medium hover:text-primary transition-colors"
                      onClick={() => setMobileMenuOpen(false)}
                    >
                      {link.label}
                    </Link>
                  ))}
                  <hr className="border-border" />
                  <Link to="/auth" onClick={() => setMobileMenuOpen(false)}>
                    <Button variant="outline" className="w-full">Sign In</Button>
                  </Link>
                  <Link to="/auth" onClick={() => setMobileMenuOpen(false)}>
                    <Button className="w-full">Get Started</Button>
                  </Link>
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </header>

      {/* Main Content with top padding for fixed header */}
      <main className="pt-16 flex-1">
        {children}
      </main>

      {/* Footer */}
      {showFooter && <Footer />}
    </div>
  );
}