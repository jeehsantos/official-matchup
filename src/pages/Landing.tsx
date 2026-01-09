import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { 
  Calendar, 
  CreditCard, 
  Users, 
  Shield, 
  MapPin,
  ChevronRight,
  CheckCircle2,
  Zap,
  Play,
  Star,
  TrendingUp
} from "lucide-react";
import { SportIcon } from "@/components/ui/sport-icon";
import { Footer } from "@/components/layout/Footer";

const valueProps = [
  {
    icon: Calendar,
    title: "Easy Booking",
    description: "Book courts in seconds with our intuitive platform. No more phone calls or waiting."
  },
  {
    icon: CreditCard,
    title: "Secure Payments",
    description: "Powered by Stripe for safe, instant transactions. Pay upfront, play stress-free."
  },
  {
    icon: Shield,
    title: "Verified Courts",
    description: "Every venue is verified and rated by real players. Quality guaranteed."
  }
];

const features = [
  {
    icon: Users,
    title: "Smart Rescue System",
    description: "Fill empty slots automatically when players cancel. Never play short again."
  },
  {
    icon: TrendingUp,
    title: "Guaranteed Revenue",
    description: "Court managers receive upfront payments. No more no-shows or chasing payments."
  },
  {
    icon: Shield,
    title: "Fair Access",
    description: "Released slots go to the marketplace. Everyone gets a chance to play."
  },
  {
    icon: Star,
    title: "Trusted Community",
    description: "Join thousands of verified players and venues across New Zealand."
  }
];

const sports = ["futsal", "basketball", "tennis", "volleyball", "badminton", "turf_hockey"] as const;

const howItWorks = {
  players: [
    { step: "1", title: "Join a Group", description: "Find and join recurring weekly games in your area" },
    { step: "2", title: "Pay Upfront", description: "Secure your spot with payment before the deadline" },
    { step: "3", title: "Play!", description: "Show up and enjoy your guaranteed game time" }
  ],
  managers: [
    { step: "1", title: "List Your Courts", description: "Register your venue and add court details" },
    { step: "2", title: "Publish Availability", description: "Set available time slots for booking" },
    { step: "3", title: "Get Paid", description: "Receive guaranteed payments from confirmed bookings" }
  ]
};

const stats = [
  { value: "5,000+", label: "Active Players" },
  { value: "150+", label: "Verified Courts" },
  { value: "10,000+", label: "Games Played" },
  { value: "98%", label: "Satisfaction Rate" }
];

export default function Landing() {
  return (
    <div className="min-h-screen bg-background">
      {/* Navigation */}
      <header className="fixed top-0 left-0 right-0 z-50 navbar-glass">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-primary flex items-center justify-center shadow-md">
              <span className="text-primary-foreground font-display font-bold">M</span>
            </div>
            <span className="font-display font-bold text-xl">MatchUP</span>
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

      {/* Hero Section - Split Screen Design */}
      <section className="relative pt-24 pb-20 md:pt-32 md:pb-28 px-4 overflow-hidden">
        {/* Background gradient */}
        <div className="absolute inset-0 section-gradient" />
        <div className="absolute top-20 right-0 w-1/2 h-1/2 bg-primary/5 rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-0 w-1/3 h-1/3 bg-accent/5 rounded-full blur-3xl" />
        
        <div className="container mx-auto relative">
          <div className="max-w-4xl mx-auto text-center">
            {/* Badge */}
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-accent/10 text-accent border border-accent/20 mb-8 animate-fade-in">
              <Zap className="h-4 w-4" />
              <span className="text-sm font-semibold">No Pay = No Play</span>
            </div>
            
            {/* Headline */}
            <h1 className="font-display text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold mb-6 leading-[1.1] animate-fade-in">
              Book Courts.{" "}
              <span className="text-gradient-primary">Guarantee Games.</span>
              <br className="hidden sm:block" />
              <span className="text-gradient-accent">End No-Shows.</span>
            </h1>
            
            {/* Sub-headline */}
            <p className="text-lg md:text-xl text-muted-foreground mb-10 max-w-2xl mx-auto animate-fade-in">
              The sports booking marketplace that ensures commitment. Upfront payments, 
              automatic slot filling, and fair access to courts across New Zealand.
            </p>
            
            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row gap-4 justify-center animate-fade-in">
              <Link to="/auth">
                <Button size="lg" className="w-full sm:w-auto gap-2 text-base px-8 py-6 shadow-xl glow-primary">
                  Start Playing Free <ChevronRight className="h-5 w-5" />
                </Button>
              </Link>
              <Link to="/courts">
                <Button size="lg" variant="outline" className="w-full sm:w-auto gap-2 text-base px-8 py-6">
                  <MapPin className="h-5 w-5" /> Browse Courts
                </Button>
              </Link>
            </div>

            {/* Stats Bar */}
            <div className="mt-16 grid grid-cols-2 md:grid-cols-4 gap-6 max-w-3xl mx-auto">
              {stats.map((stat) => (
                <div key={stat.label} className="text-center">
                  <p className="font-display text-3xl md:text-4xl font-bold text-primary">{stat.value}</p>
                  <p className="text-sm text-muted-foreground mt-1">{stat.label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Value Props - 3 Column Trust Section */}
      <section className="py-20 px-4 bg-card border-y border-border">
        <div className="container mx-auto max-w-6xl">
          <div className="text-center mb-12">
            <h2 className="font-display text-3xl md:text-4xl font-bold mb-4">
              Why Players Love MatchUP
            </h2>
            <p className="text-muted-foreground max-w-xl mx-auto">
              Built for players, by players. Everything you need for hassle-free sports booking.
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            {valueProps.map((prop) => (
              <div key={prop.title} className="card-premium p-8 text-center group">
                <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-6 mx-auto group-hover:bg-primary/20 transition-colors">
                  <prop.icon className="h-8 w-8 text-primary" />
                </div>
                <h3 className="font-display font-bold text-xl mb-3">{prop.title}</h3>
                <p className="text-muted-foreground">{prop.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Problem/Solution */}
      <section className="py-20 px-4">
        <div className="container mx-auto max-w-6xl">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <span className="text-accent font-semibold text-sm uppercase tracking-wider">The Problem</span>
              <h2 className="font-display text-3xl md:text-4xl font-bold mt-2 mb-6">
                Group Sports Are a Logistical Nightmare
              </h2>
              <ul className="space-y-4 text-muted-foreground">
                <li className="flex items-start gap-4">
                  <span className="w-6 h-6 rounded-full bg-destructive/10 text-destructive flex items-center justify-center shrink-0 mt-0.5">✗</span>
                  <span>Endless WhatsApp messages trying to confirm who's coming</span>
                </li>
                <li className="flex items-start gap-4">
                  <span className="w-6 h-6 rounded-full bg-destructive/10 text-destructive flex items-center justify-center shrink-0 mt-0.5">✗</span>
                  <span>Last-minute cancellations leaving you scrambling for replacements</span>
                </li>
                <li className="flex items-start gap-4">
                  <span className="w-6 h-6 rounded-full bg-destructive/10 text-destructive flex items-center justify-center shrink-0 mt-0.5">✗</span>
                  <span>Organizers stuck chasing payments from flaky teammates</span>
                </li>
                <li className="flex items-start gap-4">
                  <span className="w-6 h-6 rounded-full bg-destructive/10 text-destructive flex items-center justify-center shrink-0 mt-0.5">✗</span>
                  <span>Paying for empty spots because people didn't show up</span>
                </li>
              </ul>
            </div>
            <div className="card-premium p-10 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-primary/10 rounded-full blur-2xl" />
              <span className="text-primary font-semibold text-sm uppercase tracking-wider">The Solution</span>
              <h3 className="font-display text-2xl md:text-3xl font-bold mt-2 mb-6">
                MatchUP Makes It Simple
              </h3>
              <ul className="space-y-4 relative">
                <li className="flex items-start gap-4">
                  <CheckCircle2 className="h-6 w-6 text-primary shrink-0 mt-0.5" />
                  <span>Upfront payments guarantee player commitment</span>
                </li>
                <li className="flex items-start gap-4">
                  <CheckCircle2 className="h-6 w-6 text-primary shrink-0 mt-0.5" />
                  <span>Rescue mode automatically fills cancelled spots</span>
                </li>
                <li className="flex items-start gap-4">
                  <CheckCircle2 className="h-6 w-6 text-primary shrink-0 mt-0.5" />
                  <span>Released slots go public after 48 hours for fair access</span>
                </li>
                <li className="flex items-start gap-4">
                  <CheckCircle2 className="h-6 w-6 text-primary shrink-0 mt-0.5" />
                  <span>Court managers receive guaranteed revenue upfront</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="py-20 px-4 bg-muted/30">
        <div className="container mx-auto max-w-6xl">
          <div className="text-center mb-12">
            <h2 className="font-display text-3xl md:text-4xl font-bold mb-4">
              Powerful Features for Everyone
            </h2>
            <p className="text-muted-foreground max-w-xl mx-auto">
              Whether you're a player, organizer, or court manager – we've got you covered.
            </p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {features.map((feature) => (
              <div key={feature.title} className="card-premium p-6 group">
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4 group-hover:bg-primary group-hover:text-primary-foreground transition-all duration-300">
                  <feature.icon className="h-6 w-6 text-primary group-hover:text-primary-foreground transition-colors" />
                </div>
                <h3 className="font-display font-semibold text-lg mb-2">{feature.title}</h3>
                <p className="text-muted-foreground text-sm">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Sports Showcase */}
      <section className="py-20 px-4">
        <div className="container mx-auto max-w-4xl text-center">
          <h2 className="font-display text-3xl md:text-4xl font-bold mb-4">
            All Your Favourite Sports
          </h2>
          <p className="text-muted-foreground mb-10 max-w-xl mx-auto">
            From futsal to hockey, we've got courts for every sport you love.
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            {sports.map((sport) => (
              <div 
                key={sport} 
                className="flex flex-col items-center gap-3 p-6 rounded-2xl bg-card border border-border hover:border-primary/50 hover:shadow-lg transition-all duration-300 min-w-[120px]"
              >
                <SportIcon sport={sport} className="h-12 w-12 text-primary" />
                <span className="text-sm font-medium capitalize">{sport.replace('_', ' ')}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-20 px-4 bg-card border-y border-border">
        <div className="container mx-auto max-w-6xl">
          <div className="text-center mb-12">
            <h2 className="font-display text-3xl md:text-4xl font-bold mb-4">
              How It Works
            </h2>
            <p className="text-muted-foreground max-w-xl mx-auto">
              Get started in three simple steps – whether you're playing or managing.
            </p>
          </div>
          <div className="grid md:grid-cols-2 gap-12 lg:gap-20">
            {/* For Players */}
            <div className="card-premium p-8 lg:p-10">
              <div className="flex items-center gap-3 mb-8">
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                  <Users className="h-6 w-6 text-primary" />
                </div>
                <h3 className="font-display text-xl font-bold">For Players & Organizers</h3>
              </div>
              <div className="space-y-6">
                {howItWorks.players.map((item) => (
                  <div key={item.step} className="flex gap-4">
                    <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center text-primary-foreground font-bold shrink-0 shadow-lg">
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
            <div className="card-premium p-8 lg:p-10">
              <div className="flex items-center gap-3 mb-8">
                <div className="w-12 h-12 rounded-xl bg-accent/10 flex items-center justify-center">
                  <MapPin className="h-6 w-6 text-accent" />
                </div>
                <h3 className="font-display text-xl font-bold">For Court Managers</h3>
              </div>
              <div className="space-y-6">
                {howItWorks.managers.map((item) => (
                  <div key={item.step} className="flex gap-4">
                    <div className="w-10 h-10 rounded-full bg-accent flex items-center justify-center text-accent-foreground font-bold shrink-0 shadow-lg glow-accent">
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
            Ready to Never Miss a Game?
          </h2>
          <p className="text-primary-foreground/80 mb-10 max-w-xl mx-auto text-lg">
            Join thousands of players and court managers across New Zealand who've switched to smarter sports booking.
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
                className="w-full sm:w-auto text-base px-8 py-6 border-primary-foreground/30 text-primary-foreground hover:bg-primary-foreground/10"
              >
                Talk to Sales
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <Footer />
    </div>
  );
}