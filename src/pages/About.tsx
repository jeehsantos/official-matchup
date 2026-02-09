import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Target, Heart, Users, Shield } from "lucide-react";

const values = [
  {
    icon: Target,
    title: "Commitment",
    description: "We believe in showing up. That's why we enforce upfront payments - because your teammates are counting on you."
  },
  {
    icon: Heart,
    title: "Fairness",
    description: "Everyone deserves a chance to play. Our rescue and release system ensures unused slots go to those who want them."
  },
  {
    icon: Users,
    title: "Community",
    description: "Sports bring people together. We're building the infrastructure that makes regular games possible."
  },
  {
    icon: Shield,
    title: "Reliability",
    description: "Court managers get guaranteed income. Players get guaranteed games. No more uncertainty."
  }
];

export default function About() {
  return (
    <div className="min-h-screen bg-background">
      {/* Navigation */}
      <header className="fixed top-0 left-0 right-0 z-50 glass border-b border-border/50">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center" aria-label="Sport Arena home">
            <img
              src="/sportarena-logo.png"
              alt="Sport Arena logo"
              className="h-10 w-auto mix-blend-screen"
            />
          </Link>
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

      {/* Back Link */}
      <div className="pt-24 px-4">
        <div className="container mx-auto max-w-4xl">
          <Link to="/" className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="h-4 w-4" />
            Back to Home
          </Link>
        </div>
      </div>

      {/* Hero */}
      <section className="pt-10 pb-12 px-4">
        <div className="container mx-auto max-w-5xl">
          <div className="grid lg:grid-cols-[1.1fr_0.9fr] gap-10 items-center">
            <div>
              <p className="text-sm uppercase tracking-widest text-muted-foreground">Our story</p>
              <h1 className="font-display text-4xl md:text-5xl font-bold mb-4">
                Sport Arena is built for real players
              </h1>
              <p className="text-lg text-muted-foreground max-w-2xl">
                We take the chaos out of group bookings so you can focus on the game.
              </p>
            </div>
            <div className="card-elevated p-6 space-y-4">
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Our mission</p>
                <p className="font-semibold text-lg">Make every game happen.</p>
              </div>
              <p className="text-sm text-muted-foreground">
                From upfront payments to smart rescue mode, we remove last-minute drama
                and keep courts full.
              </p>
              <div className="flex flex-wrap gap-3">
                {["Fair play", "Reliable venues", "Committed teams"].map((item) => (
                  <span key={item} className="text-xs font-semibold px-3 py-1 rounded-full bg-muted border border-border">
                    {item}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Story */}
      <section className="py-12 px-4 bg-muted/30">
        <div className="container mx-auto max-w-5xl">
          <div className="grid md:grid-cols-3 gap-6">
            {[
              {
                title: "The problem",
                body: "Group chats, no-shows, and uneven payments were cancelling too many games."
              },
              {
                title: "The idea",
                body: "Collect payments upfront, automate cancellations, and reward consistency."
              },
              {
                title: "The result",
                body: "Sport Arena: a clean, sporty platform where commitment is guaranteed."
              },
            ].map((item) => (
              <div key={item.title} className="card-elevated p-6">
                <p className="text-xs uppercase tracking-widest text-muted-foreground">{item.title}</p>
                <p className="mt-3 text-sm text-muted-foreground">{item.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Focus Areas */}
      <section className="py-12 px-4">
        <div className="container mx-auto max-w-5xl">
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6 mb-8">
            <div>
              <p className="text-sm uppercase tracking-widest text-muted-foreground">Our focus</p>
              <h2 className="font-display text-3xl font-bold mt-2">Built for players and venues</h2>
            </div>
            <p className="text-muted-foreground max-w-md">
              Everyone wins when bookings are clear and commitments are honored.
            </p>
          </div>
          <div className="grid md:grid-cols-2 gap-6">
            <div className="card-elevated p-6">
              <h3 className="font-semibold text-lg mb-3">Players & Organizers</h3>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>• Guaranteed spots with upfront payments</li>
                <li>• Faster group coordination and reminders</li>
                <li>• Automatic rescue mode for cancellations</li>
              </ul>
            </div>
            <div className="card-elevated p-6">
              <h3 className="font-semibold text-lg mb-3">Court Managers</h3>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>• Predictable revenue and fewer no-shows</li>
                <li>• Centralized venue availability control</li>
                <li>• Smart visibility to fill courts faster</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Values */}
      <section className="py-12 px-4 bg-muted/30">
        <div className="container mx-auto max-w-5xl">
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6 mb-8">
            <div>
              <p className="text-sm uppercase tracking-widest text-muted-foreground">Values</p>
              <h2 className="font-display text-3xl font-bold mt-2">What we stand for</h2>
            </div>
            <p className="text-muted-foreground max-w-md">
              These values keep Sport Arena focused on athletes first.
            </p>
          </div>
          <div className="grid sm:grid-cols-2 gap-6">
            {values.map((value) => (
              <div key={value.title} className="card-elevated p-6">
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
                  <value.icon className="h-6 w-6 text-primary" />
                </div>
                <h3 className="font-display font-semibold text-lg mb-2">{value.title}</h3>
                <p className="text-muted-foreground text-sm">{value.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* New Zealand Focus */}
      <section className="py-12 px-4">
        <div className="container mx-auto max-w-5xl">
          <div className="card-elevated p-8 flex flex-col md:flex-row md:items-center md:justify-between gap-6">
            <div>
              <h2 className="font-display text-2xl font-bold mb-2">Proudly New Zealand</h2>
              <p className="text-muted-foreground max-w-2xl">
                We understand local leagues and community venues, from Auckland futsal to Wellington tennis.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {["Auckland", "Wellington", "Christchurch", "Hamilton"].map((city) => (
                <span key={city} className="text-xs font-semibold px-3 py-1 rounded-full bg-muted border border-border">
                  {city}
                </span>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Contact Anchor */}
      <section id="lets-talk-courts" className="scroll-mt-24 px-4 py-10 bg-muted/30">
        <div className="container mx-auto max-w-5xl">
          <div className="card-elevated p-6 md:p-8 text-center">
            <p className="text-sm uppercase tracking-widest text-muted-foreground">Connect</p>
            <h2 className="font-display text-3xl font-bold mt-2">Let’s talk courts</h2>
            <p className="text-muted-foreground mt-3">
              Have questions about Sport Arena, partnerships, or venue onboarding? We’d love to hear from you.
            </p>
            <div className="mt-6">
              <Link to="/contact#lets-talk-courts">
                <Button>Contact Us</Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 px-4 bg-primary text-primary-foreground">
        <div className="container mx-auto max-w-4xl text-center">
          <h2 className="font-display text-2xl font-bold mb-4">
            Ready to Get Started?
          </h2>
          <p className="text-primary-foreground/80 mb-6">
            Join the movement towards guaranteed, hassle-free sports bookings.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link to="/auth">
              <Button size="lg" variant="secondary">
                Create Free Account
              </Button>
            </Link>
            <Link to="/contact">
              <Button size="lg" variant="outline" className="border-primary-foreground/30 text-primary-foreground hover:bg-primary-foreground/10">
                Contact Us
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 px-4 border-t border-border">
        <div className="container mx-auto max-w-4xl flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center">
            <img
              src="/sportarena-logo.png"
              alt="Sport Arena logo"
              className="h-8 w-auto mix-blend-screen"
            />
          </div>
          <div className="flex gap-6 text-sm text-muted-foreground">
            <Link to="/" className="hover:text-foreground transition-colors">Home</Link>
            <Link to="/contact" className="hover:text-foreground transition-colors">Contact</Link>
          </div>
          <p className="text-sm text-muted-foreground">
            © {new Date().getFullYear()} Sport Arena
          </p>
        </div>
      </footer>
    </div>
  );
}
