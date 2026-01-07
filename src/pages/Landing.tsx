import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { 
  Calendar, 
  CreditCard, 
  Users, 
  Shield, 
  Clock, 
  MapPin,
  ChevronRight,
  CheckCircle2,
  Zap
} from "lucide-react";
import { SportIcon } from "@/components/ui/sport-icon";

const features = [
  {
    icon: Calendar,
    title: "Guaranteed Bookings",
    description: "Never lose your court slot to last-minute cancellations again."
  },
  {
    icon: CreditCard,
    title: "Payment Enforcement",
    description: "No pay = no play. Upfront payments ensure commitment."
  },
  {
    icon: Users,
    title: "Smart Rescue System",
    description: "Fill empty slots automatically when players cancel."
  },
  {
    icon: Shield,
    title: "Fair Access",
    description: "Released slots go to the marketplace for everyone."
  }
];

const sports = ["futsal", "basketball", "tennis", "volleyball", "badminton", "hockey"] as const;

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

export default function Landing() {
  return (
    <div className="min-h-screen bg-background">
      {/* Navigation */}
      <header className="fixed top-0 left-0 right-0 z-50 glass border-b border-border/50">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
              <span className="text-primary-foreground font-display font-bold text-sm">N</span>
            </div>
            <span className="font-display font-bold text-lg">NextPlay</span>
          </Link>
          <nav className="hidden md:flex items-center gap-6">
            <Link to="/about" className="text-muted-foreground hover:text-foreground transition-colors">About</Link>
            <Link to="/contact" className="text-muted-foreground hover:text-foreground transition-colors">Contact</Link>
            <Link to="/courts" className="text-muted-foreground hover:text-foreground transition-colors">Browse Courts</Link>
          </nav>
          <div className="flex items-center gap-3">
            <Link to="/auth">
              <Button variant="ghost">Sign In</Button>
            </Link>
            <Link to="/auth">
              <Button>Get Started</Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="pt-32 pb-20 px-4">
        <div className="container mx-auto text-center max-w-4xl">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary mb-6">
            <Zap className="h-4 w-4" />
            <span className="text-sm font-medium">No Pay = No Play</span>
          </div>
          <h1 className="font-display text-4xl md:text-6xl font-bold mb-6 leading-tight">
            Book Courts.{" "}
            <span className="text-primary">Guarantee Games.</span>
            <br />
            End No-Shows.
          </h1>
          <p className="text-lg md:text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
            NextPlay solves the chaos of group sports bookings. Upfront payments, automatic slot filling, 
            and fair access to courts across New Zealand.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link to="/auth">
              <Button size="lg" className="w-full sm:w-auto gap-2">
                Start Playing <ChevronRight className="h-4 w-4" />
              </Button>
            </Link>
            <Link to="/courts">
              <Button size="lg" variant="outline" className="w-full sm:w-auto gap-2">
                <MapPin className="h-4 w-4" /> Browse Courts
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Problem/Solution */}
      <section className="py-20 px-4 bg-muted/30">
        <div className="container mx-auto max-w-6xl">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="font-display text-3xl font-bold mb-4">
                The Problem with Group Sports
              </h2>
              <ul className="space-y-3 text-muted-foreground">
                <li className="flex items-start gap-3">
                  <span className="text-destructive">✗</span>
                  <span>WhatsApp chaos trying to confirm who's coming</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-destructive">✗</span>
                  <span>Last-minute cancellations leaving you short</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-destructive">✗</span>
                  <span>Organizers chasing payments from teammates</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-destructive">✗</span>
                  <span>Paying for empty spots on the court</span>
                </li>
              </ul>
            </div>
            <div className="bg-card rounded-2xl p-8 border border-border">
              <h3 className="font-display text-2xl font-bold mb-4 text-primary">
                The NextPlay Solution
              </h3>
              <ul className="space-y-3">
                <li className="flex items-start gap-3">
                  <CheckCircle2 className="h-5 w-5 text-primary mt-0.5" />
                  <span>Upfront payments guarantee commitment</span>
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle2 className="h-5 w-5 text-primary mt-0.5" />
                  <span>Rescue mode fills cancelled spots automatically</span>
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle2 className="h-5 w-5 text-primary mt-0.5" />
                  <span>Released slots go public after 48 hours</span>
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle2 className="h-5 w-5 text-primary mt-0.5" />
                  <span>Court managers get guaranteed revenue</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-20 px-4">
        <div className="container mx-auto max-w-6xl">
          <h2 className="font-display text-3xl font-bold text-center mb-12">
            Why Choose NextPlay?
          </h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {features.map((feature) => (
              <div key={feature.title} className="p-6 rounded-2xl bg-card border border-border hover:border-primary/50 transition-colors">
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
                  <feature.icon className="h-6 w-6 text-primary" />
                </div>
                <h3 className="font-display font-semibold text-lg mb-2">{feature.title}</h3>
                <p className="text-muted-foreground text-sm">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Sports */}
      <section className="py-20 px-4 bg-muted/30">
        <div className="container mx-auto max-w-4xl text-center">
          <h2 className="font-display text-3xl font-bold mb-4">
            All Your Favourite Sports
          </h2>
          <p className="text-muted-foreground mb-8">
            From futsal to hockey, we've got you covered
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            {sports.map((sport) => (
              <div key={sport} className="flex flex-col items-center gap-2 p-4 rounded-xl bg-card border border-border">
                <SportIcon sport={sport} className="h-10 w-10" />
                <span className="text-sm font-medium capitalize">{sport}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-20 px-4">
        <div className="container mx-auto max-w-6xl">
          <h2 className="font-display text-3xl font-bold text-center mb-12">
            How It Works
          </h2>
          <div className="grid md:grid-cols-2 gap-12">
            {/* For Players */}
            <div>
              <h3 className="font-display text-xl font-semibold mb-6 flex items-center gap-2">
                <Users className="h-5 w-5 text-primary" />
                For Players & Organizers
              </h3>
              <div className="space-y-6">
                {howItWorks.players.map((item) => (
                  <div key={item.step} className="flex gap-4">
                    <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center text-primary-foreground font-bold shrink-0">
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
            <div>
              <h3 className="font-display text-xl font-semibold mb-6 flex items-center gap-2">
                <MapPin className="h-5 w-5 text-primary" />
                For Court Managers
              </h3>
              <div className="space-y-6">
                {howItWorks.managers.map((item) => (
                  <div key={item.step} className="flex gap-4">
                    <div className="w-10 h-10 rounded-full bg-accent flex items-center justify-center text-accent-foreground font-bold shrink-0">
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

      {/* CTA */}
      <section className="py-20 px-4 bg-primary text-primary-foreground">
        <div className="container mx-auto max-w-4xl text-center">
          <h2 className="font-display text-3xl md:text-4xl font-bold mb-4">
            Ready to Never Miss a Game?
          </h2>
          <p className="text-primary-foreground/80 mb-8 max-w-xl mx-auto">
            Join thousands of players and court managers across New Zealand who've switched to smarter sports booking.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link to="/auth">
              <Button size="lg" variant="secondary" className="w-full sm:w-auto">
                Create Free Account
              </Button>
            </Link>
            <Link to="/contact">
              <Button size="lg" variant="outline" className="w-full sm:w-auto border-primary-foreground/30 text-primary-foreground hover:bg-primary-foreground/10">
                Contact Sales
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 px-4 border-t border-border">
        <div className="container mx-auto max-w-6xl">
          <div className="grid sm:grid-cols-2 md:grid-cols-4 gap-8 mb-8">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
                  <span className="text-primary-foreground font-display font-bold text-sm">N</span>
                </div>
                <span className="font-display font-bold text-lg">NextPlay</span>
              </div>
              <p className="text-muted-foreground text-sm">
                The smarter way to book courts and guarantee games across New Zealand.
              </p>
            </div>
            <div>
              <h4 className="font-semibold mb-3">Product</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><Link to="/courts" className="hover:text-foreground transition-colors">Browse Courts</Link></li>
                <li><Link to="/auth" className="hover:text-foreground transition-colors">For Players</Link></li>
                <li><Link to="/auth" className="hover:text-foreground transition-colors">For Court Managers</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-3">Company</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><Link to="/about" className="hover:text-foreground transition-colors">About Us</Link></li>
                <li><Link to="/contact" className="hover:text-foreground transition-colors">Contact</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-3">Legal</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><a href="#" className="hover:text-foreground transition-colors">Privacy Policy</a></li>
                <li><a href="#" className="hover:text-foreground transition-colors">Terms of Service</a></li>
              </ul>
            </div>
          </div>
          <div className="pt-8 border-t border-border text-center text-sm text-muted-foreground">
            © {new Date().getFullYear()} NextPlay. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
}
