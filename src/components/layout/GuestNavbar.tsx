import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

const navLinks = [
{ label: "Home", href: "/" },
{ label: "Our Story", href: "/about" },
{ label: "Venues", href: "/courts" },
{ label: "Contact", href: "/contact" }];


interface GuestNavbarProps {
  className?: string;
}

export function GuestNavbar({ className }: GuestNavbarProps) {
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <header className={cn("fixed top-0 left-0 right-0 z-50 border-b border-slate-200/70 bg-white/75 backdrop-blur-md", className)}>
      <div className="mx-auto flex h-20 w-full max-w-7xl items-center justify-between px-4 sm:px-6">
        <Link to="/" className="flex items-center" aria-label="Sport Arena home">
          <img src="/sportarena-logo.png" alt="Sport Arena logo" className="h-36 w-auto object-contain sm:h-14" />
        </Link>

        <nav className="hidden items-center gap-8 text-sm font-medium text-slate-600 md:flex">
          {navLinks.map((link) => {
            const isActive =
            link.href === "/" ?
            location.pathname === "/" :
            location.pathname.startsWith(link.href);

            return (
              <Link
                key={link.href}
                to={link.href}
                className={cn(
                  "transition-colors hover:text-sky-500",
                  isActive && "text-blue-600"
                )}>

                {link.label}
              </Link>);

          })}
        </nav>

        <div className="flex items-center gap-2 sm:gap-3">
          <Link to="/auth" className="hidden sm:block">
            <Button variant="ghost" className="font-semibold text-slate-700">
              Sign In
            </Button>
          </Link>
          <Link to="/auth?tab=signup" className="hidden sm:block">
            <Button className="rounded-full bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-blue-200 transition-colors hover:bg-blue-700">
              Get Started
            </Button>
          </Link>

          <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
            <SheetTrigger asChild className="md:hidden">
              <Button variant="ghost" size="icon" aria-label="Open menu">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-[280px] sm:w-[320px]">
              <div className="mt-10 flex flex-col gap-5">
                {navLinks.map((link) =>
                <Link
                  key={link.href}
                  to={link.href}
                  className={cn(
                    "text-base font-medium text-slate-700 transition-colors hover:text-sky-500",
                    location.pathname.startsWith(link.href) && link.href !== "/" && "text-blue-600",
                    location.pathname === "/" && link.href === "/" && "text-blue-600"
                  )}
                  onClick={() => setMobileMenuOpen(false)}>

                    {link.label}
                  </Link>
                )}
                <hr className="my-1 border-slate-200" />
                <Link to="/auth" onClick={() => setMobileMenuOpen(false)}>
                  <Button variant="outline" className="w-full">
                    Sign In
                  </Button>
                </Link>
                <Link to="/auth?tab=signup" onClick={() => setMobileMenuOpen(false)}>
                  <Button className="w-full bg-blue-600 hover:bg-blue-700">Get Started</Button>
                </Link>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>);

}