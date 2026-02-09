import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  MapPin,
  Search,
  Sparkles,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSportCategories } from "@/hooks/useSportCategories";

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
  const { data: sportCategories = [], isLoading: isSportsLoading } = useSportCategories();
  const [wordIndex, setWordIndex] = useState(0);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [selectedSport, setSelectedSport] = useState("Any Sport");

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

  useEffect(() => {
    const handleClickOutside = () => setIsDropdownOpen(false);

    if (isDropdownOpen) {
      document.addEventListener("click", handleClickOutside);
    }

    return () => document.removeEventListener("click", handleClickOutside);
  }, [isDropdownOpen]);

  const activeWord = sliderWords.length > 0 ? sliderWords[wordIndex] : "sports";

  return (
    <div className="min-h-screen bg-white text-slate-900">
      <header className="fixed top-0 z-50 w-full border-b border-white/50 bg-white/80 backdrop-blur-[10px]">
        <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between px-6">
          <Link to="/" className="flex items-center gap-3" aria-label="Sport Arena home">
            <img src="/sportarena-logo.png" alt="Sport Arena logo" className="h-10 w-auto object-contain" />
            <span className="text-xl font-bold uppercase tracking-tight">Sport Arena</span>
          </Link>

          <nav className="hidden items-center gap-8 text-sm font-medium text-slate-600 md:flex">
            <Link to="/about" className="transition hover:text-blue-600">About</Link>
            <Link to="/contact" className="transition hover:text-blue-600">Contact</Link>
            <Link to="/courts" className="transition hover:text-blue-600">Browse Courts</Link>
          </nav>

          <div className="flex items-center gap-3">
            <Link to="/auth">
              <Button variant="ghost" className="hidden sm:inline-flex">Sign In</Button>
            </Link>
            <Link to="/auth">
              <Button className="bg-blue-600 hover:bg-blue-700">Get Started</Button>
            </Link>
          </div>
        </div>
      </header>

      <main>
        <section className="overflow-hidden bg-gradient-to-br from-[#f0f9ff] to-[#e0f2fe] px-6 pb-20 pt-32">
          <div className="mx-auto grid max-w-7xl items-center gap-12 lg:grid-cols-2">
            <div>
              <h1 className="mb-6 text-5xl font-extrabold leading-tight md:text-6xl">
                Book your court. <br />
                <span className="text-blue-600">Play your game.</span>
              </h1>

              <p className="mb-10 max-w-lg text-lg leading-relaxed text-slate-700">
                Find and book
                <span className="relative mx-1 inline-flex h-8 min-w-[120px] items-end overflow-hidden align-bottom text-blue-600">
                  <span key={activeWord} className="animate-word-slide inline-block font-bold">
                    {activeWord}
                  </span>
                </span>
                courts in seconds. The cleanest way to manage your games and keep your team moving.
              </p>

              <div className="relative z-40 flex max-w-2xl flex-col gap-2 rounded-2xl border border-blue-100 bg-white/85 p-2 shadow-xl md:flex-row">
                <div className="flex flex-[1.8] items-center border-b border-slate-100 px-3 py-3 md:border-b-0 md:border-r">
                  <MapPin className="mr-2 h-5 w-5 shrink-0 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Where are you playing?"
                    className="w-full border-none bg-transparent text-sm font-medium text-slate-900 outline-none placeholder:text-slate-400 sm:text-base"
                  />
                </div>

                <div className="relative flex-1">
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      setIsDropdownOpen((current) => !current);
                    }}
                    className="flex h-full w-full items-center px-3 py-3 text-left"
                  >
                    <CalendarDays className="mr-2 h-5 w-5 shrink-0 text-slate-400" />
                    <span className="flex-1 truncate text-sm font-medium text-slate-900 sm:text-base">{selectedSport}</span>
                    <ChevronDown
                      className={`ml-1 h-4 w-4 shrink-0 text-slate-400 transition-transform duration-200 ${
                        isDropdownOpen ? "rotate-180" : ""
                      }`}
                    />
                  </button>

                  {isDropdownOpen && (
                    <div
                      id="sportDropdownMenu"
                      className="absolute left-0 right-0 top-full z-50 mt-2 animate-in fade-in zoom-in-95 rounded-xl border border-slate-100 bg-white py-2 shadow-2xl"
                    >
                      <button
                        type="button"
                        className="flex w-full items-center gap-3 px-5 py-3 text-left transition hover:bg-slate-50"
                        onClick={() => {
                          setSelectedSport("Any Sport");
                          setIsDropdownOpen(false);
                        }}
                      >
                        <span className="text-lg">🎯</span>
                        <span className="font-medium text-slate-700">Any Sport</span>
                      </button>
                      {sportCategories.map((sport) => (
                        <button
                          key={sport.id}
                          type="button"
                          className="flex w-full items-center gap-3 px-5 py-3 text-left transition hover:bg-slate-50"
                          onClick={() => {
                            setSelectedSport(sport.display_name);
                            setIsDropdownOpen(false);
                          }}
                        >
                          <span className="text-lg">{sport.icon ?? "🎯"}</span>
                          <span className="font-medium text-slate-700">{sport.display_name}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <Button className="rounded-xl bg-blue-600 px-6 py-3 text-sm font-bold text-white hover:bg-blue-700 sm:text-base">
                  <Search className="mr-2 h-4 w-4" />
                  Search
                </Button>
              </div>

              <div className="mt-12 flex gap-8">
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
              <div className="relative aspect-[4/5] overflow-hidden rounded-[3rem] border-8 border-white shadow-2xl">
                <img
                  src="https://images.unsplash.com/photo-1595435063821-26c714b6099b?q=80&w=1200&auto=format&fit=crop"
                  alt="Sport court"
                  className="h-full w-full object-cover"
                />
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

        <section className="px-6 py-20">
          <div className="relative mx-auto max-w-7xl overflow-hidden rounded-[3rem] bg-blue-600 p-12 text-center text-white shadow-2xl shadow-blue-200 md:p-20">
            <div className="relative z-10">
              <h2 className="mb-6 text-4xl font-extrabold md:text-5xl">Ready to Find Your Next Game?</h2>
              <p className="mx-auto mb-10 max-w-2xl text-lg text-blue-100">
                Join players and court managers across New Zealand discovering the easier way to book and play sports.
              </p>
              <div className="flex flex-col justify-center gap-4 sm:flex-row">
                <Link to="/auth">
                  <Button className="rounded-2xl bg-white px-8 py-4 text-lg font-bold text-blue-600 hover:bg-blue-50">Create Free Account</Button>
                </Link>
                <Link to="/contact">
                  <Button
                    variant="outline"
                    className="rounded-2xl border-blue-400/30 bg-blue-500 px-8 py-4 text-lg font-bold text-white hover:bg-blue-400"
                  >
                    Contact Us
                  </Button>
                </Link>
              </div>
            </div>
            <div className="absolute -right-24 -top-24 h-64 w-64 rounded-full bg-blue-500/70 blur-3xl" />
            <div className="absolute -bottom-24 -left-24 h-64 w-64 rounded-full bg-blue-400/70 blur-3xl" />
          </div>
        </section>
      </main>

      <footer className="border-t border-slate-100 bg-white pb-12 pt-24">
        <div className="mx-auto max-w-7xl px-6">
          <div className="mb-20 grid gap-12 md:grid-cols-4">
            <div className="md:col-span-2">
              <Link to="/" className="mb-6 flex items-center gap-3" aria-label="Sport Arena home">
                <img src="/sportarena-logo.png" alt="Sport Arena logo" className="h-10 w-auto object-contain" />
                <span className="text-xl font-bold uppercase tracking-tight">Sport Arena</span>
              </Link>
              <p className="mb-8 max-w-xs text-sm leading-relaxed text-slate-500">
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
                <li><Link to="/courts" className="transition hover:text-blue-600">Browse Courts</Link></li>
                <li><Link to="/discover" className="transition hover:text-blue-600">For Players</Link></li>
                <li><Link to="/manager" className="transition hover:text-blue-600">For Court Managers</Link></li>
                <li><Link to="/groups" className="transition hover:text-blue-600">Community Groups</Link></li>
              </ul>
            </div>

            <div>
              <h4 className="mb-6 text-sm font-bold uppercase tracking-widest text-slate-400">Company</h4>
              <ul className="space-y-4 text-sm font-medium text-slate-600">
                <li><Link to="/about" className="transition hover:text-blue-600">About Us</Link></li>
                <li><Link to="/contact" className="transition hover:text-blue-600">Contact</Link></li>
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
