import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { 
  Calendar, 
  Users, 
  Shield, 
  MapPin,
  ChevronRight,
  CheckCircle2,
  Zap,
  Star,
  Loader2
} from "lucide-react";
import { SportIcon } from "@/components/ui/sport-icon";
import { Footer } from "@/components/layout/Footer";
import { useSportCategories } from "@/hooks/useSportCategories";

const valueProps = [
  {
    icon: Calendar,
    title: "Instant Scheduling",
    description: "Check live availability and lock in courts with a few taps."
  },
  {
    icon: Users,
    title: "Team-First",
    description: "Organize groups, invite players, and keep everyone in sync."
  },
  {
    icon: Shield,
    title: "Trusted Venues",
    description: "Play on verified courts with transparent ratings and reviews."
  }
];

const features = [
  {
    icon: MapPin,
    title: "Smart Discovery",
    description: "Search by sport, location, and time in one clean map view."
  },
  {
    icon: Users,
    title: "Roster Control",
    description: "Manage recurring games, invites, and attendance in minutes."
  },
  {
    icon: Calendar,
    title: "Schedule Clarity",
    description: "See upcoming sessions at a glance with quick actions."
  },
  {
    icon: Star,
    title: "Community Ratings",
    description: "Trust real player feedback before you book."
  }
];

const howItWorks = {
  players: [
    { step: "1", title: "Discover Courts", description: "Browse verified venues across New Zealand and find the perfect court" },
    { step: "2", title: "Join or Create Groups", description: "Connect with regular players or organize your own recurring games" },
    { step: "3", title: "Book & Play", description: "Reserve your spot and enjoy hassle-free sports sessions" }
  ],
  managers: [
    { step: "1", title: "List Your Courts", description: "Register your venue and showcase your facilities with photos" },
    { step: "2", title: "Manage Availability", description: "Set your court schedules and pricing" },
    { step: "3", title: "Grow Your Business", description: "Reach more players and fill your courts efficiently" }
  ]
};

const stats = [
  { value: "5K+", label: "Active Players" },
  { value: "150+", label: "Verified Courts" },
  { value: "10K+", label: "Games Played" },
  { value: "98%", label: "Satisfaction" }
];

export default function Landing() {
  // Fetch sports from database - NO FALLBACKS
  const { data: sportCategories = [], isLoading: loadingSports } = useSportCategories();
  
  return (
    <div className="min-h-screen bg-background">
      {/* Navigation */}
      <header className="fixed top-0 left-0 right-0 z-50 navbar-glass">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center" aria-label="Sport Arena home">
            <img
              src="/sportarena-logo.png"
              alt="Sport Arena logo"
              className="h-10 w-auto mix-blend-screen"
            />
          </Link>
          <nav className="hidden md:flex items-center gap-8">
            <Link to="/about" className="nav-link text-sm font-medium">About</Link>
            <Link to="/contact" className="nav-link text-sm font-medium">Contact</Link>
            <Link to="/courts" className="nav-link text-sm font-medium">Browse Courts</Link>
          </nav>
          <div className="flex items-center gap-3">
            <Link to="/auth">
              <Button variant="ghost" className="hidden sm:inline-flex">Sign In</Button>
            </Link>
            <Link to="/auth">
              <Button className="shadow-lg">Get Started</Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative pt-24 pb-16 md:pt-32 md:pb-24 px-4">
        <div className="absolute inset-0 section-gradient" />
        <div className="container mx-auto relative">
          <div className="grid lg:grid-cols-[1.2fr_0.8fr] gap-12 items-center">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary border border-primary/20 mb-6">
                <Zap className="h-4 w-4" />
                <span className="text-xs font-semibold uppercase tracking-wider">Sport Arena</span>
              </div>
              <h1 className="font-display text-4xl sm:text-5xl md:text-6xl font-bold mb-5 leading-[1.08]">
                Book courts faster.{" "}
                <span className="text-gradient-primary">Play harder.</span>
              </h1>
              <p className="text-lg text-muted-foreground mb-8 max-w-xl">
                The clean, sporty way to discover courts, manage games, and keep your team
                moving across New Zealand.
              </p>
              <div className="flex flex-col sm:flex-row gap-4">
                <Link to="/auth">
                  <Button size="lg" className="w-full sm:w-auto gap-2 text-base px-8 py-6 shadow-premium">
                    Start Playing Free <ChevronRight className="h-5 w-5" />
                  </Button>
                </Link>
                <Link to="/courts">
                  <Button size="lg" variant="outline" className="w-full sm:w-auto gap-2 text-base px-8 py-6">
                    <MapPin className="h-5 w-5" /> Browse Courts
                  </Button>
                </Link>
              </div>
              <div className="mt-10 flex flex-wrap gap-3">
                {stats.map((stat) => (
                  <div key={stat.label} className="flex items-center gap-3 rounded-full border border-border px-4 py-2 bg-background/80 shadow-sm">
                    <span className="font-display text-lg font-bold text-primary">{stat.value}</span>
                    <span className="text-xs uppercase tracking-wide text-muted-foreground">{stat.label}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="card-elevated p-6 md:p-8 space-y-6">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
                  <Shield className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-semibold">Guaranteed Commitment</p>
                  <p className="text-xs text-muted-foreground">Upfront payments keep games on track.</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-accent/10 flex items-center justify-center">
                  <Users className="h-5 w-5 text-accent" />
                </div>
                <div>
                  <p className="text-sm font-semibold">Roster Ready</p>
                  <p className="text-xs text-muted-foreground">Invite, confirm, and fill spots fast.</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
                  <Calendar className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-semibold">All Sessions, One View</p>
                  <p className="text-xs text-muted-foreground">Stay synced with your weekly schedule.</p>
                </div>
              </div>
              <div className="bg-muted/60 rounded-xl p-4">
                <p className="text-xs uppercase tracking-wide text-muted-foreground mb-2">Popular Today</p>
                <div className="flex flex-wrap gap-2">
                  {["Futsal", "Basketball", "Tennis", "Netball"].map((sport) => (
                    <span key={sport} className="text-xs font-semibold px-3 py-1 rounded-full bg-background border border-border">
                      {sport}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Value Props */}
      <section className="py-16 px-4 bg-card border-y border-border">
        <div className="container mx-auto max-w-6xl">
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6 mb-10">
            <div>
              <p className="text-sm uppercase tracking-widest text-muted-foreground">Why Sport Arena</p>
              <h2 className="font-display text-3xl md:text-4xl font-bold mt-2">
                Clean, fast, and built for athletes
              </h2>
            </div>
            <p className="text-muted-foreground max-w-md">
              A sporty experience that keeps your games organized without the noise.
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {valueProps.map((prop) => (
              <div key={prop.title} className="card-elevated p-6">
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
                  <prop.icon className="h-6 w-6 text-primary" />
                </div>
                <h3 className="font-display font-semibold text-lg mb-2">{prop.title}</h3>
                <p className="text-muted-foreground text-sm">{prop.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Quick Benefits */}
      <section className="py-16 px-4">
        <div className="container mx-auto max-w-6xl">
          <div className="grid lg:grid-cols-[1fr_1.1fr] gap-10">
            <div className="card-elevated p-8">
              <h3 className="font-display text-2xl font-bold mb-3">Game day, simplified</h3>
              <p className="text-muted-foreground mb-6">
                Sport Arena keeps everyone accountable so you spend less time organizing and more time playing.
              </p>
              <div className="space-y-4">
                {[
                  "Verified venues with real-time availability.",
                  "Upfront payments that protect organizers.",
                  "Rescue mode to refill spots quickly.",
                ].map((item) => (
                  <div key={item} className="flex items-start gap-3">
                    <CheckCircle2 className="h-5 w-5 text-primary mt-0.5" />
                    <span className="text-sm text-muted-foreground">{item}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="grid sm:grid-cols-2 gap-6">
              {features.map((feature) => (
                <div key={feature.title} className="card-elevated p-5">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                    <feature.icon className="h-5 w-5 text-primary" />
                  </div>
                  <h3 className="font-display font-semibold text-base mb-2">{feature.title}</h3>
                  <p className="text-muted-foreground text-sm">{feature.description}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Sports Showcase - Dynamic from database */}
      <section className="py-20 px-4">
        <div className="container mx-auto max-w-4xl text-center">
          <h2 className="font-display text-3xl md:text-4xl font-bold mb-4">
            All Your Favourite Sports
          </h2>
          <p className="text-muted-foreground mb-10 max-w-xl mx-auto">
            From futsal to hockey, we've got courts for every sport you love.
          </p>
          {loadingSports ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : sportCategories.length === 0 ? (
            <p className="text-muted-foreground py-12">
              Sports coming soon...
            </p>
          ) : (
            <div className="flex flex-wrap justify-center gap-4">
              {sportCategories.map((sport) => (
                <div 
                  key={sport.id} 
                  className="flex flex-col items-center gap-3 p-6 rounded-2xl bg-card border border-border hover:border-primary/50 hover:shadow-lg transition-all duration-300 min-w-[120px]"
                >
                  <SportIcon 
                    sport={sport.name} 
                    icon={sport.icon}
                    label={sport.display_name}
                    className="h-12 w-12 text-primary" 
                  />
                  <span className="text-sm font-medium">{sport.display_name}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* How It Works */}
      <section className="py-16 px-4 bg-card border-y border-border">
        <div className="container mx-auto max-w-6xl">
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6 mb-10">
            <div>
              <p className="text-sm uppercase tracking-widest text-muted-foreground">How it works</p>
              <h2 className="font-display text-3xl md:text-4xl font-bold mt-2">
                From search to serve, fast
              </h2>
            </div>
            <p className="text-muted-foreground max-w-md">
              A three-step flow that keeps players and managers in sync.
            </p>
          </div>
          <div className="grid md:grid-cols-2 gap-8">
            {/* For Players */}
            <div className="card-elevated p-6 md:p-8">
              <div className="flex items-center gap-3 mb-8">
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                  <Users className="h-6 w-6 text-primary" />
                </div>
                <h3 className="font-display text-xl font-bold">For Players & Organizers</h3>
              </div>
              <div className="space-y-6">
                {howItWorks.players.map((item) => (
                  <div key={item.step} className="flex gap-4 items-start">
                    <div className="w-9 h-9 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold shrink-0">
                      {item.step}
                    </div>
                    <div>
                      <h4 className="font-semibold mb-1">{item.title}</h4>
                      <p className="text-muted-foreground text-sm">{item.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            {/* For Managers */}
            <div className="card-elevated p-6 md:p-8">
              <div className="flex items-center gap-3 mb-8">
                <div className="w-12 h-12 rounded-xl bg-accent/10 flex items-center justify-center">
                  <MapPin className="h-6 w-6 text-accent" />
                </div>
                <h3 className="font-display text-xl font-bold">For Court Managers</h3>
              </div>
              <div className="space-y-6">
                {howItWorks.managers.map((item) => (
                  <div key={item.step} className="flex gap-4 items-start">
                    <div className="w-9 h-9 rounded-full bg-accent text-accent-foreground flex items-center justify-center font-bold shrink-0">
                      {item.step}
                    </div>
                    <div>
                      <h4 className="font-semibold mb-1">{item.title}</h4>
                      <p className="text-muted-foreground text-sm">{item.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-24 px-4 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary to-primary/80" />
        <div className="absolute top-0 right-0 w-96 h-96 bg-accent/20 rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-primary-foreground/10 rounded-full blur-3xl" />
        
        <div className="container mx-auto max-w-4xl text-center relative">
          <h2 className="font-display text-3xl md:text-5xl font-bold mb-6 text-primary-foreground">
            Ready to Find Your Next Game?
          </h2>
          <p className="text-primary-foreground/80 mb-10 max-w-xl mx-auto text-lg">
            Join players and court managers across New Zealand discovering the easier way to book and play sports.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link to="/auth">
              <Button size="lg" variant="secondary" className="w-full sm:w-auto text-base px-8 py-6 shadow-xl">
                Create Free Account
              </Button>
            </Link>
            <Link to="/contact">
              <Button 
                size="lg" 
                variant="outline" 
                className="w-full sm:w-auto text-base px-8 py-6 border-primary-foreground/20 text-primary-foreground hover:bg-primary-foreground/10"
              >
                Contact Us
              </Button>
            </Link>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
