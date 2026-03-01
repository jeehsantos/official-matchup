import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  CheckCircle2,
  MapPin,
  Sparkles,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSportCategories } from "@/hooks/useSportCategories";
import { GuestNavbar } from "@/components/layout/GuestNavbar";

const playerSteps = [
  {
    step: "1",
    title: "Discover Courts",
    description: "Browse verified venues across New Zealand and find the perfect court.",
  },
  {
    step: "2",
    title: "Join or Create Groups",
    description: "Connect with regular players or organize your own recurring games.",
  },
  {
    step: "3",
    title: "Book & Play",
    description: "Reserve your spot and enjoy hassle-free sports sessions.",
  },
];

const managerSteps = [
  {
    step: "1",
    title: "List Your Courts",
    description: "Register your venue and showcase your facilities with photos.",
  },
  {
    step: "2",
    title: "Manage Availability",
    description: "Set your court schedules and pricing.",
  },
  {
    step: "3",
    title: "Grow Your Business",
    description: "Reach more players and fill your courts efficiently.",
  },
];

export default function Landing() {
  const { data: sportCategories = [] } = useSportCategories();
  const [wordIndex, setWordIndex] = useState(0);
  const activeWordMeasureRef = useRef<HTMLSpanElement | null>(null);
  const [activeWordWidth, setActiveWordWidth] = useState<number>(72);

  const sliderWords = useMemo(
    () => sportCategories.map((sport) => sport.display_name).filter(Boolean),
    [sportCategories],
  );

  useEffect(() => {
    if (sliderWords.length <= 1) {
      return;
    }

    const intervalId = window.setInterval(() => {
      setWordIndex((current) => (current + 1) % sliderWords.length);
    }, 2200);

    return () => window.clearInterval(intervalId);
  }, [sliderWords]);

  const activeWord = sliderWords.length > 0 ? sliderWords[wordIndex] : "sports";

  useLayoutEffect(() => {
    if (!activeWordMeasureRef.current) {
      return;
    }

    const width = activeWordMeasureRef.current.getBoundingClientRect().width;
    setActiveWordWidth(Math.ceil(width));
  }, [activeWord]);

  return (
    <div className="min-h-screen bg-white text-slate-900">
      <GuestNavbar />

      <main>
        <section className="overflow-hidden bg-gradient-to-br from-[#f0f9ff] to-[#e0f2fe] px-6 pb-20 pt-36 lg:pb-12 lg:pt-24 xl:pb-20 xl:pt-36">
          <div className="mx-auto grid max-w-7xl items-center gap-12 lg:grid-cols-2 lg:gap-8 xl:gap-12">
            <div>
              <h1 className="mb-6 text-5xl font-extrabold leading-tight md:text-6xl lg:text-5xl lg:leading-[1.05] xl:text-6xl">
                Book courts faster. <br />
                <span className="text-[#0e8ddd]">Play harder.</span>
              </h1>

              <p className="mb-10 max-w-lg text-lg leading-relaxed text-slate-700 lg:mb-7 xl:mb-10">
                Find and book
                <span
                  className="relative mx-1 inline-flex h-8 items-end overflow-hidden align-bottom text-[#0e8ddd] transition-[width] duration-500 ease-out"
                  style={{ width: `${activeWordWidth}px` }}
                >
                  <span ref={activeWordMeasureRef} key={activeWord} className="animate-word-slide inline-block whitespace-nowrap font-bold">
                    {activeWord}
                  </span>
                </span>
                courts in seconds. The cleanest way to manage your games and keep your team moving.
              </p>

              <div className="relative z-40 flex max-w-2xl flex-col gap-3 sm:flex-row">
                <Link to="/auth?tab=signup" className="sm:flex-1">
                  <Button className="h-14 w-full justify-center rounded-xl bg-[#0e8ddd] px-8 text-xl font-semibold text-white shadow-md shadow-[#0e8ddd]/35 transition-all duration-300 hover:bg-[#0b76bc]">
                    Start Playing Free
                    <span className="ml-3 text-2xl leading-none">›</span>
                  </Button>
                </Link>
                <Link to="/courts" className="sm:flex-1">
                  <Button
                    variant="outline"
                    className="h-14 w-full justify-center rounded-xl border-slate-300 bg-white px-8 text-xl font-medium text-slate-800 hover:bg-slate-50"
                  >
                    <MapPin className="mr-3 h-5 w-5" />
                    Browse Courts
                  </Button>
                </Link>
              </div>

              <div className="mt-12 flex gap-8 lg:mt-8 xl:mt-12">
                <div>
                  <div className="text-2xl font-bold">52K+</div>
                  <div className="text-xs uppercase tracking-wider text-slate-500">Active Players</div>
                </div>
                <div className="border-l border-slate-200 pl-8">
                  <div className="text-2xl font-bold">150+</div>
                  <div className="text-xs uppercase tracking-wider text-slate-500">Verified Venues</div>
                </div>
              </div>
            </div>

            <div className="relative hidden lg:block">
              <div className="relative aspect-[4/5] overflow-hidden rounded-[3rem] border-8 border-white shadow-2xl lg:aspect-[11/10] xl:aspect-[4/5]">
                <img src="/homeCourt.png" alt="Sport court" className="h-full w-full object-cover" />
                <div className="absolute bottom-8 left-6 z-20 w-56 rounded-xl border border-slate-100 bg-white p-4 shadow-xl">
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-green-100 text-green-600">
                      <CheckCircle2 className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-[13px] font-bold leading-tight">Court Confirmed!</p>
                      <p className="mt-0.5 text-[11px] text-slate-500">Stanley St Courts, 10 AM</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="bg-slate-50 px-6 py-24">
          <div className="mx-auto max-w-7xl">
            <div className="mb-16 flex flex-col justify-between gap-4 md:flex-row md:items-end">
              <div>
                <span className="mb-4 block text-xs font-bold uppercase tracking-widest text-slate-400">How it works</span>
                <h2 className="text-4xl font-extrabold">From search to serve, fast</h2>
              </div>
              <p className="max-w-xs text-sm text-slate-500">A three-step flow that keeps players and managers in sync.</p>
            </div>

            <div className="grid gap-8 lg:grid-cols-2">
              <div className="rounded-[2rem] border border-slate-100 bg-white p-10 shadow-sm">
                <div className="mb-10 flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                    <Users className="h-6 w-6" />
                  </div>
                  <h3 className="text-xl font-bold">For Players & Organizers</h3>
                </div>
                <div className="space-y-8">
                  {playerSteps.map((item) => (
                    <div key={item.step} className="flex items-start gap-4">
                      <span className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-blue-600 text-xs font-bold text-white">
                        {item.step}
                      </span>
                      <div>
                        <h4 className="mb-1 text-sm font-bold">{item.title}</h4>
                        <p className="text-sm leading-relaxed text-slate-500">{item.description}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-[2rem] border border-slate-100 bg-white p-10 shadow-sm">
                <div className="mb-10 flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-50 text-green-600">
                    <Sparkles className="h-6 w-6" />
                  </div>
                  <h3 className="text-xl font-bold">For Court Managers</h3>
                </div>
                <div className="space-y-8">
                  {managerSteps.map((item) => (
                    <div key={item.step} className="flex items-start gap-4">
                      <span className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-green-500 text-xs font-bold text-white">
                        {item.step}
                      </span>
                      <div>
                        <h4 className="mb-1 text-sm font-bold">{item.title}</h4>
                        <p className="text-sm leading-relaxed text-slate-500">{item.description}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="py-20">
          <div className="relative overflow-hidden bg-[#0e8ddd] px-6 py-12 text-center text-white shadow-2xl shadow-[#0e8ddd]/25 md:px-10 md:py-20">
            <div className="relative z-10">
              <h2 className="mb-6 text-4xl font-extrabold md:text-5xl">Ready to Find Your Next Game?</h2>
              <p className="mx-auto mb-10 max-w-2xl text-lg text-blue-50">
                Join players and court managers across New Zealand discovering the easier way to book and play sports.
              </p>
              <div className="flex flex-col justify-center gap-4 sm:flex-row">
                <Link to="/auth?tab=signup">
                  <Button className="rounded-2xl bg-white px-8 py-4 text-lg font-bold text-[#0e8ddd] hover:bg-blue-50">Create Free Account</Button>
                </Link>
                <Link to="/contact#lets-talk-courts">
                  <Button
                    variant="outline"
                    className="rounded-2xl border-white/40 bg-[#0b76bc] px-8 py-4 text-lg font-bold text-white hover:bg-[#09639e]"
                  >
                    Contact Us
                  </Button>
                </Link>
              </div>
            </div>
            <div className="absolute -right-24 -top-24 h-64 w-64 rounded-full bg-[#3ab4f2]/45 blur-3xl" />
            <div className="absolute -bottom-24 -left-24 h-64 w-64 rounded-full bg-[#2da8e8]/50 blur-3xl" />
          </div>
        </section>
      </main>

      <footer className="border-t border-slate-100 bg-white pb-12 pt-24">
        <div className="mx-auto max-w-7xl px-6">
          <div className="mb-20 grid gap-12 md:grid-cols-4">
            <div className="md:col-span-2">
              <Link to="/" className="mb-0 flex items-center gap-3 leading-none" aria-label="Sport Arena home">
                <img src="/sportarena-logo.png" alt="Sport Arena logo" className="block h-36 w-auto object-contain" />
              </Link>
              <p className="-mt-3 mb-6 max-w-xs text-sm leading-relaxed text-slate-500">
                The smarter way to book courts and guarantee games.
              </p>
              <div className="space-y-3 text-sm text-slate-400">
                <p className="flex items-center gap-2">
                  <MapPin className="h-4 w-4" /> Auckland, New Zealand
                </p>
                <p>hello@sportarena.nz</p>
              </div>
            </div>

            <div>
              <h4 className="mb-6 text-sm font-bold uppercase tracking-widest text-slate-400">Product</h4>
              <ul className="space-y-4 text-sm font-medium text-slate-600">
                <li><Link to="/courts#browse-courts" className="transition hover:text-blue-600">Browse Courts</Link></li>
                <li><Link to="/auth?tab=signup&role=player" className="transition hover:text-blue-600">For Players</Link></li>
                <li><Link to="/auth?tab=signup&role=court_manager" className="transition hover:text-blue-600">For Court Managers</Link></li>
                <li><Link to="/groups" className="transition hover:text-blue-600">Community Groups</Link></li>
              </ul>
            </div>

            <div>
              <h4 className="mb-6 text-sm font-bold uppercase tracking-widest text-slate-400">Company</h4>
              <ul className="space-y-4 text-sm font-medium text-slate-600">
                <li><Link to="/about#lets-talk-courts" className="transition hover:text-blue-600">About Us</Link></li>
                <li><Link to="/contact#lets-talk-courts" className="transition hover:text-blue-600">Contact</Link></li>
                <li><Link to="/about#privacy" className="transition hover:text-blue-600">Privacy Policy</Link></li>
                <li><Link to="/about#terms" className="transition hover:text-blue-600">Terms of Service</Link></li>
              </ul>
            </div>
          </div>

          <div className="flex flex-col items-center justify-between gap-4 border-t border-slate-100 pt-8 md:flex-row">
            <p className="text-xs text-slate-400">© 2024 Sport Arena. All rights reserved.</p>
            <div className="flex gap-6 text-sm text-slate-500">
              <Link to="/about" className="transition hover:text-blue-600">About</Link>
              <Link to="/contact" className="transition hover:text-blue-600">Contact</Link>
              <Link to="/courts" className="transition hover:text-blue-600">Browse</Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
