import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { CheckCircle2, MapPin, Sparkles, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSportCategories } from "@/hooks/useSportCategories";
import { GuestNavbar } from "@/components/layout/GuestNavbar";
import { useTranslation } from "react-i18next";

export default function Landing() {
  const { data: sportCategories = [] } = useSportCategories();
  const [wordIndex, setWordIndex] = useState(0);
  const activeWordMeasureRef = useRef<HTMLSpanElement | null>(null);
  const [activeWordWidth, setActiveWordWidth] = useState<number>(72);
  const { t } = useTranslation("landing");
  const { t: tc } = useTranslation("common");

  const sliderWords = useMemo(
    () => sportCategories.map((sport) => sport.display_name).filter(Boolean),
    [sportCategories],
  );

  useEffect(() => {
    if (sliderWords.length <= 1) return;
    const intervalId = window.setInterval(() => {
      setWordIndex((current) => (current + 1) % sliderWords.length);
    }, 2200);
    return () => window.clearInterval(intervalId);
  }, [sliderWords]);

  const activeWord = sliderWords.length > 0 ? sliderWords[wordIndex] : "sports";

  useLayoutEffect(() => {
    if (!activeWordMeasureRef.current) return;
    const width = activeWordMeasureRef.current.getBoundingClientRect().width;
    setActiveWordWidth(Math.ceil(width));
  }, [activeWord]);

  const playerSteps = [
    { step: "1", title: t("howItWorks.playerStep1Title"), description: t("howItWorks.playerStep1Desc") },
    { step: "2", title: t("howItWorks.playerStep2Title"), description: t("howItWorks.playerStep2Desc") },
    { step: "3", title: t("howItWorks.playerStep3Title"), description: t("howItWorks.playerStep3Desc") },
  ];

  const managerSteps = [
    { step: "1", title: t("howItWorks.managerStep1Title"), description: t("howItWorks.managerStep1Desc") },
    { step: "2", title: t("howItWorks.managerStep2Title"), description: t("howItWorks.managerStep2Desc") },
    { step: "3", title: t("howItWorks.managerStep3Title"), description: t("howItWorks.managerStep3Desc") },
  ];

  return (
    <div className="min-h-screen bg-background text-foreground">
      <GuestNavbar />

      <main>
        <section className="overflow-hidden bg-gradient-to-br from-blue-50 to-sky-100 dark:from-background dark:to-muted px-6 pb-12 pt-28 lg:pb-16 lg:pt-32 xl:pb-20 xl:pt-36">
          <div className="mx-auto grid max-w-7xl items-center gap-8 lg:grid-cols-2 lg:gap-10 xl:gap-12">
            <div>
              <h1 className="mb-6 text-5xl font-extrabold leading-tight md:text-6xl">
                {t("hero.title1")} <br />
                <span className="text-primary">{t("hero.title2")}</span>
              </h1>

              <p className="mb-6 max-w-lg text-lg leading-relaxed text-muted-foreground lg:mb-8 xl:mb-10">
                {t("hero.findAndBook")}
                <span
                  className="relative mx-1 inline-flex h-8 items-end overflow-hidden align-bottom text-primary transition-[width] duration-500 ease-out"
                  style={{ width: `${activeWordWidth}px` }}
                >
                  <span ref={activeWordMeasureRef} key={activeWord} className="animate-word-slide inline-block whitespace-nowrap font-bold">
                    {activeWord}
                  </span>
                </span>
                {t("hero.description")}
              </p>

              <div className="relative z-40 flex max-w-2xl flex-col gap-3 sm:flex-row">
                <Link to="/auth?tab=signup" className="sm:flex-1">
                  <Button className="h-14 w-full justify-center rounded-xl bg-primary px-8 text-xl font-semibold text-primary-foreground shadow-md shadow-primary/35 transition-all duration-300 hover:bg-primary/90">
                    {t("hero.ctaPlay")}
                    <span className="ml-3 text-2xl leading-none">›</span>
                  </Button>
                </Link>
                <Link to="/courts" className="sm:flex-1">
                  <Button variant="outline" className="h-14 w-full justify-center rounded-xl border-border bg-card px-8 text-xl font-medium text-foreground hover:bg-muted">
                    <MapPin className="mr-3 h-5 w-5" />
                    {t("hero.ctaBrowse")}
                  </Button>
                </Link>
              </div>

              <div className="mt-8 flex gap-8 lg:mt-10 xl:mt-12">
                <div>
                  <div className="text-2xl font-bold">52K+</div>
                  <div className="text-xs uppercase tracking-wider text-muted-foreground">{t("hero.activePlayers")}</div>
                </div>
                <div className="border-l border-border pl-8">
                  <div className="text-2xl font-bold">150+</div>
                  <div className="text-xs uppercase tracking-wider text-muted-foreground">{t("hero.verifiedVenues")}</div>
                </div>
              </div>
            </div>

            <div className="relative hidden lg:block">
              <div className="relative aspect-[4/5] overflow-hidden rounded-[3rem] border-8 border-card shadow-2xl lg:aspect-[3/4] xl:aspect-[4/5]">
                <img src="/homeCourt.png" alt="Sport court" className="h-full w-full object-cover" />
                <div className="absolute bottom-8 left-6 z-20 w-56 rounded-xl border border-border bg-card p-4 shadow-xl">
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400">
                      <CheckCircle2 className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-[13px] font-bold leading-tight">{t("hero.courtConfirmed")}</p>
                      <p className="mt-0.5 text-[11px] text-muted-foreground">{t("hero.courtConfirmedDetail")}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="bg-muted px-6 py-24">
          <div className="mx-auto max-w-7xl">
            <div className="mb-16 flex flex-col justify-between gap-4 md:flex-row md:items-end">
              <div>
                <span className="mb-4 block text-xs font-bold uppercase tracking-widest text-muted-foreground">{t("howItWorks.label")}</span>
                <h2 className="text-4xl font-extrabold">{t("howItWorks.title")}</h2>
              </div>
              <p className="max-w-xs text-sm text-muted-foreground">{t("howItWorks.subtitle")}</p>
            </div>

            <div className="grid gap-8 lg:grid-cols-2">
              <div className="rounded-[2rem] border border-border bg-card p-10 shadow-sm">
                <div className="mb-10 flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400">
                    <Users className="h-6 w-6" />
                  </div>
                  <h3 className="text-xl font-bold">{t("howItWorks.forPlayers")}</h3>
                </div>
                <div className="space-y-8">
                  {playerSteps.map((item) => (
                    <div key={item.step} className="flex items-start gap-4">
                      <span className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-blue-600 text-xs font-bold text-white">{item.step}</span>
                      <div>
                        <h4 className="mb-1 text-sm font-bold">{item.title}</h4>
                        <p className="text-sm leading-relaxed text-muted-foreground">{item.description}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-[2rem] border border-border bg-card p-10 shadow-sm">
                <div className="mb-10 flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-50 text-green-600 dark:bg-green-900/30 dark:text-green-400">
                    <Sparkles className="h-6 w-6" />
                  </div>
                  <h3 className="text-xl font-bold">{t("howItWorks.forManagers")}</h3>
                </div>
                <div className="space-y-8">
                  {managerSteps.map((item) => (
                    <div key={item.step} className="flex items-start gap-4">
                      <span className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-green-500 text-xs font-bold text-white">{item.step}</span>
                      <div>
                        <h4 className="mb-1 text-sm font-bold">{item.title}</h4>
                        <p className="text-sm leading-relaxed text-muted-foreground">{item.description}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="py-8">
          <div className="relative overflow-hidden bg-primary px-6 py-8 text-center text-primary-foreground shadow-2xl shadow-primary/25 md:px-10 md:py-12">
            <div className="relative z-10">
              <h2 className="mb-6 text-4xl font-extrabold md:text-5xl">{t("cta.title")}</h2>
              <p className="mx-auto mb-10 max-w-2xl text-lg text-primary-foreground/80">{t("cta.description")}</p>
              <div className="flex flex-col justify-center gap-4 sm:flex-row">
                <Link to="/auth?tab=signup">
                  <Button className="rounded-2xl bg-background px-8 py-4 text-lg font-bold text-primary hover:bg-muted">{t("cta.createAccount")}</Button>
                </Link>
                <Link to="/contact#lets-talk-courts">
                  <Button variant="outline" className="rounded-2xl border-primary-foreground/40 bg-primary/80 px-8 py-4 text-lg font-bold text-primary-foreground hover:bg-primary/60">{t("cta.contactUs")}</Button>
                </Link>
              </div>
            </div>
            <div className="absolute -right-24 -top-24 h-64 w-64 rounded-full bg-primary-foreground/15 blur-3xl" />
            <div className="absolute -bottom-24 -left-24 h-64 w-64 rounded-full bg-primary-foreground/20 blur-3xl" />
          </div>
        </section>
      </main>

      <footer className="border-t border-border bg-background pb-12 pt-24">
        <div className="mx-auto max-w-7xl px-6">
          <div className="mb-20 grid gap-12 md:grid-cols-4">
            <div className="md:col-span-2">
              <Link to="/" className="mb-0 flex items-center gap-3 leading-none" aria-label="Sport Arena home">
                <img src="/sportarena-logo.png" alt="Sport Arena logo" className="block h-36 w-auto object-contain dark:brightness-0 dark:invert" />
              </Link>
              <p className="-mt-3 mb-6 max-w-xs text-sm leading-relaxed text-muted-foreground">{t("landingFooter.tagline")}</p>
              <div className="space-y-3 text-sm text-muted-foreground">
                <p className="flex items-center gap-2"><MapPin className="h-4 w-4" /> {t("landingFooter.location")}</p>
                <p>hello@sportarena.nz</p>
              </div>
            </div>

            <div>
              <h4 className="mb-6 text-sm font-bold uppercase tracking-widest text-muted-foreground">{t("landingFooter.product")}</h4>
              <ul className="space-y-4 text-sm font-medium text-foreground/70">
                <li><Link to="/courts#browse-courts" className="transition hover:text-primary">{t("landingFooter.browseCourts")}</Link></li>
                <li><Link to="/venue" className="transition hover:text-primary">Venues</Link></li>
                <li><Link to="/auth?tab=signup&role=player" className="transition hover:text-primary">{t("landingFooter.forPlayers")}</Link></li>
                <li><Link to="/auth?tab=signup&role=court_manager" className="transition hover:text-primary">{t("landingFooter.forCourtManagers")}</Link></li>
                <li><Link to="/groups" className="transition hover:text-primary">{t("landingFooter.communityGroups")}</Link></li>
              </ul>
            </div>

            <div>
              <h4 className="mb-6 text-sm font-bold uppercase tracking-widest text-muted-foreground">{t("landingFooter.company")}</h4>
              <ul className="space-y-4 text-sm font-medium text-foreground/70">
                <li><Link to="/about#lets-talk-courts" className="transition hover:text-primary">{t("landingFooter.aboutUs")}</Link></li>
                <li><Link to="/contact#lets-talk-courts" className="transition hover:text-primary">{t("landingFooter.contact")}</Link></li>
                <li><Link to="/about#privacy" className="transition hover:text-primary">{t("landingFooter.privacyPolicy")}</Link></li>
                <li><Link to="/about#terms" className="transition hover:text-primary">{t("landingFooter.termsOfService")}</Link></li>
              </ul>
            </div>
          </div>

          <div className="flex flex-col items-center justify-between gap-4 border-t border-border pt-8 md:flex-row">
            <p className="text-xs text-muted-foreground">{t("landingFooter.allRightsReserved")}</p>
            <div className="flex gap-6 text-sm text-muted-foreground">
              <Link to="/about" className="transition hover:text-primary">{t("landingFooter.about")}</Link>
              <Link to="/contact" className="transition hover:text-primary">{t("landingFooter.contact")}</Link>
              <Link to="/courts" className="transition hover:text-primary">{t("landingFooter.browse")}</Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
