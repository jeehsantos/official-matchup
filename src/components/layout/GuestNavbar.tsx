import { forwardRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { useTranslation } from "react-i18next";

interface GuestNavbarProps {
  className?: string;
}

export const GuestNavbar = forwardRef<HTMLElement, GuestNavbarProps>(({ className }, ref) => {
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { t } = useTranslation("common");

  const navLinks = [
    { label: t("nav.home"), href: "/" },
    { label: t("nav.ourStory"), href: "/about" },
    { label: t("nav.venues"), href: "/courts" },
    { label: t("nav.contact"), href: "/contact" },
  ];

  return (
    <header ref={ref} className={cn("fixed top-0 left-0 right-0 z-50 border-b border-border/70 bg-background/75 backdrop-blur-md", className)}>
      <div className="mx-auto flex h-20 w-full items-center px-4 sm:px-8 lg:px-12 xl:px-16 2xl:px-20">
        <Link to="/" className="flex items-center lg:flex-1" aria-label="Sport Arena home">
          <img src="/sportarena-logo.png" alt="Sport Arena logo" className="h-14 w-auto object-contain" />
        </Link>

        <nav className="hidden items-center justify-center gap-8 text-sm font-medium text-muted-foreground md:flex lg:flex-1">
          {navLinks.map((link) => {
            const isActive =
              link.href === "/"
                ? location.pathname === "/"
                : location.pathname.startsWith(link.href);

            return (
              <Link
                key={link.href}
                to={link.href}
                className={cn(
                  "transition-colors hover:text-primary",
                  isActive && "text-primary"
                )}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>

        <div className="ml-auto flex items-center gap-2 sm:gap-3 lg:flex-1 lg:justify-end">
          <Link to="/auth" className="hidden sm:block">
            <Button variant="ghost" className="font-semibold text-foreground">
              {t("nav.signIn")}
            </Button>
          </Link>
          <Link to="/auth?tab=signup" className="hidden sm:block">
            <Button className="rounded-full bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-primary/20 transition-colors hover:bg-blue-700">
              {t("nav.getStarted")}
            </Button>
          </Link>

          <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
            <SheetTrigger asChild className="md:hidden">
              <Button variant="ghost" size="icon" aria-label={t("nav.openMenu")} className="ml-auto">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-[280px] sm:w-[320px]">
              <div className="mt-10 flex flex-col gap-5">
                {navLinks.map((link) => (
                  <Link
                    key={link.href}
                    to={link.href}
                    className={cn(
                      "text-base font-medium text-foreground transition-colors hover:text-primary",
                      location.pathname.startsWith(link.href) && link.href !== "/" && "text-primary",
                      location.pathname === "/" && link.href === "/" && "text-primary"
                    )}
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    {link.label}
                  </Link>
                ))}
                <hr className="my-1 border-border" />
                <Link to="/auth" onClick={() => setMobileMenuOpen(false)}>
                  <Button variant="outline" className="w-full">
                    {t("nav.signIn")}
                  </Button>
                </Link>
                <Link to="/auth?tab=signup" onClick={() => setMobileMenuOpen(false)}>
                  <Button className="w-full bg-blue-600 hover:bg-blue-700">{t("nav.getStarted")}</Button>
                </Link>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
});

GuestNavbar.displayName = "GuestNavbar";
