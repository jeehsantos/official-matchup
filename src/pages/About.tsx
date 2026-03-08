import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Check, Lightbulb, Sprout, Trophy } from "lucide-react";
import { GuestNavbar } from "@/components/layout/GuestNavbar";
import { Footer } from "@/components/layout/Footer";
import { useTranslation } from "react-i18next";

export default function About() {
  const { t } = useTranslation("about");

  const journeyCards = [
    { icon: Sprout, title: t("journey.evolutionTitle"), description: t("journey.evolutionDesc"), iconClass: "bg-orange-50 text-orange-500 dark:bg-orange-900/30 dark:text-orange-400" },
    { icon: Lightbulb, title: t("journey.innovationTitle"), description: t("journey.innovationDesc"), iconClass: "bg-blue-50 text-blue-500 dark:bg-blue-900/30 dark:text-blue-400" },
    { icon: Trophy, title: t("journey.impactTitle"), description: t("journey.impactDesc"), iconClass: "bg-emerald-50 text-emerald-500 dark:bg-emerald-900/30 dark:text-emerald-400" },
  ];

  const playerHighlights: string[] = t("builtFor.playerHighlights", { returnObjects: true }) as string[];
  const managerHighlights: string[] = t("builtFor.managerHighlights", { returnObjects: true }) as string[];

  return (
    <div className="min-h-screen bg-background text-foreground antialiased">
      <GuestNavbar />

      <main className="overflow-hidden pt-20">
        <header className="relative px-4 pb-16 pt-20 sm:px-6">
          <div className="pointer-events-none absolute -left-24 -top-24 h-[26rem] w-[26rem] rounded-full bg-[radial-gradient(circle,hsl(var(--primary)/0.16)_0%,transparent_70%)] blur-3xl" />
          <div className="mx-auto max-w-7xl">
            <div className="max-w-3xl">
              <span className="mb-6 inline-flex rounded-full bg-primary/10 px-4 py-1.5 text-xs font-bold uppercase tracking-[0.2em] text-primary">{t("badge")}</span>
              <h1 className="mb-8 text-4xl font-extrabold leading-tight sm:text-5xl md:text-6xl">
                {t("title")}{" "}
                <span className="bg-gradient-to-br from-sky-500 to-blue-700 bg-clip-text text-transparent">{t("titleHighlight")}</span>
              </h1>
              <p className="text-lg leading-relaxed text-muted-foreground sm:text-xl">{t("subtitle")}</p>
            </div>
          </div>
        </header>

        <section className="bg-muted/70 px-4 py-20 sm:px-6">
          <div className="mx-auto grid max-w-7xl gap-8 md:grid-cols-3">
            {journeyCards.map((card) => (
              <article key={card.title} className="rounded-3xl border border-border bg-card/80 p-8 shadow-[0_10px_30px_-5px_rgba(0,0,0,0.04)] backdrop-blur-sm transition-all hover:-translate-y-1 hover:shadow-[0_20px_40px_-10px_rgba(0,0,0,0.08)]">
                <div className={`mb-6 flex h-12 w-12 items-center justify-center rounded-2xl ${card.iconClass}`}>
                  <card.icon className="h-5 w-5" />
                </div>
                <h3 className="mb-4 text-xl font-bold">{card.title}</h3>
                <p className="leading-relaxed text-muted-foreground">{card.description}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="px-4 py-24 sm:px-6">
          <div className="mx-auto max-w-7xl">
            <div className="mb-16 text-center">
              <h2 className="mb-4 text-3xl font-bold md:text-4xl">{t("builtFor.title")}</h2>
              <p className="mx-auto max-w-2xl text-muted-foreground">{t("builtFor.subtitle")}</p>
            </div>

            <div className="grid gap-8 md:grid-cols-2 md:gap-12">
              <article className="group relative overflow-hidden rounded-[2rem] border border-border bg-card p-8 sm:p-10">
                <div className="absolute -right-8 -top-8 h-32 w-32 rounded-bl-full bg-primary/10 transition-all group-hover:scale-110" />
                <h3 className="mb-6 flex items-center gap-3 text-2xl font-bold">
                  <span className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-600 text-sm text-white">1</span>
                  {t("builtFor.playersTitle")}
                </h3>
                <ul className="space-y-4">
                  {playerHighlights.map((item) => (
                    <li key={item} className="flex items-start gap-3 text-muted-foreground">
                      <Check className="mt-1 h-4 w-4 shrink-0 text-blue-500" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </article>

              <article className="group relative overflow-hidden rounded-[2rem] bg-slate-900 p-8 text-white sm:p-10">
                <div className="absolute -right-8 -top-8 h-32 w-32 rounded-bl-full bg-white/5 transition-all group-hover:scale-110" />
                <h3 className="mb-6 flex items-center gap-3 text-2xl font-bold">
                  <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-sm text-white">2</span>
                  {t("builtFor.managersTitle")}
                </h3>
                <ul className="space-y-4">
                  {managerHighlights.map((item) => (
                    <li key={item} className="flex items-start gap-3 text-slate-300">
                      <Check className="mt-1 h-4 w-4 shrink-0 text-blue-400" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </article>
            </div>
          </div>
        </section>

        <section className="px-4 py-24 sm:px-6">
          <div className="mx-auto max-w-7xl rounded-[2.5rem] bg-slate-900 p-8 text-white sm:p-12 lg:p-16">
            <div className="grid items-center gap-10 lg:grid-cols-[1.2fr_0.8fr]">
              <div>
                <span className="mb-4 block text-xs font-bold uppercase tracking-[0.2em] text-blue-400">{t("heritage.label")}</span>
                <h2 className="mb-6 text-4xl font-bold md:text-5xl">{t("heritage.title")}</h2>
                <p className="mb-5 text-lg leading-relaxed text-slate-300">{t("heritage.paragraph1")}</p>
                <p className="text-slate-400">{t("heritage.paragraph2")}</p>
              </div>
              <div className="mx-auto w-full max-w-[280px] sm:max-w-[320px]">
                <svg viewBox="0 0 400 500" className="h-full w-full drop-shadow-[0_0_25px_rgba(59,130,246,0.3)]" xmlns="http://www.w3.org/2000/svg">
                  <defs>
                    <linearGradient id="mapGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" style={{ stopColor: "#3b82f6", stopOpacity: 1 }} />
                      <stop offset="100%" style={{ stopColor: "#2563eb", stopOpacity: 1 }} />
                    </linearGradient>
                  </defs>
                  <path fill="url(#mapGradient)" d="M260,40 C280,30 310,40 330,60 C350,80 340,110 330,130 C320,150 280,180 260,200 C240,220 230,250 220,280 L190,290 C170,280 160,250 165,220 C170,190 190,160 180,130 C170,100 150,80 160,60 C170,40 190,40 210,50 L260,40 Z" />
                  <path fill="url(#mapGradient)" d="M185,310 L210,330 C200,360 170,400 150,440 C130,480 90,490 70,480 C50,470 40,440 60,410 C80,380 120,340 150,320 L185,310 Z" opacity="0.9" />
                  <circle cx="85" cy="485" r="8" fill="url(#mapGradient)" opacity="0.8" />
                  <circle cx="215" cy="240" r="4" fill="white">
                    <animate attributeName="r" values="3;6;3" dur="3s" repeatCount="indefinite" />
                    <animate attributeName="opacity" values="1;0.4;1" dur="3s" repeatCount="indefinite" />
                  </circle>
                </svg>
              </div>
            </div>
          </div>
        </section>

        <section className="px-4 py-20 text-center sm:px-6">
          <div className="mx-auto max-w-3xl">
            <h2 className="mb-6 text-4xl font-extrabold md:text-5xl">{t("ctaTitle")}</h2>
            <p className="mb-10 text-lg leading-relaxed text-muted-foreground">{t("ctaSubtitle")}</p>
            <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
              <Link to="/auth?tab=signup" className="w-full sm:w-auto">
                <Button className="w-full rounded-2xl bg-blue-600 px-8 py-6 font-bold text-white shadow-xl shadow-primary/20 hover:bg-blue-700">{t("createAccount")}</Button>
              </Link>
              <Link to="/contact" className="w-full sm:w-auto">
                <Button variant="outline" className="w-full rounded-2xl border-border px-8 py-6 font-bold text-foreground hover:bg-muted">{t("contactTeam")}</Button>
              </Link>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
