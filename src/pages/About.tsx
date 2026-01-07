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
          <Link to="/" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
              <span className="text-primary-foreground font-display font-bold text-sm">N</span>
            </div>
            <span className="font-display font-bold text-lg">NextPlay</span>
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
      <section className="pt-8 pb-16 px-4">
        <div className="container mx-auto max-w-4xl">
          <h1 className="font-display text-4xl md:text-5xl font-bold mb-6">
            About NextPlay
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl">
            We're on a mission to solve the chaos of group sports bookings across New Zealand.
          </p>
        </div>
      </section>

      {/* Story */}
      <section className="py-16 px-4 bg-muted/30">
        <div className="container mx-auto max-w-4xl">
          <h2 className="font-display text-2xl font-bold mb-6">Our Story</h2>
          <div className="prose prose-lg max-w-none text-muted-foreground">
            <p className="mb-4">
              It started with a frustrating WhatsApp group. Every week, the same drama: 
              "Is everyone still coming?", "Sorry, can't make it", "Who's going to cover the 
              extra cost?". Games got cancelled. Court fees were split unevenly. Organizers 
              were exhausted.
            </p>
            <p className="mb-4">
              We knew there had to be a better way. What if payments were collected upfront? 
              What if cancelled spots could be automatically filled? What if unused court time 
              could go to players who actually want to play?
            </p>
            <p>
              That's why we built NextPlay. A platform where commitment is guaranteed, 
              cancellations are handled gracefully, and everyone gets a fair shot at playing 
              the sports they love.
            </p>
          </div>
        </div>
      </section>

      {/* Problem */}
      <section className="py-16 px-4">
        <div className="container mx-auto max-w-4xl">
          <h2 className="font-display text-2xl font-bold mb-6">The Problem We Solve</h2>
          <div className="grid md:grid-cols-2 gap-8">
            <div className="bg-destructive/10 rounded-2xl p-6 border border-destructive/20">
              <h3 className="font-semibold text-lg mb-4">For Players & Organizers</h3>
              <ul className="space-y-3 text-muted-foreground">
                <li>• Last-minute cancellations ruining games</li>
                <li>• Chasing payments from teammates</li>
                <li>• Paying for empty spots on the court</li>
                <li>• WhatsApp chaos every week</li>
              </ul>
            </div>
            <div className="bg-destructive/10 rounded-2xl p-6 border border-destructive/20">
              <h3 className="font-semibold text-lg mb-4">For Court Managers</h3>
              <ul className="space-y-3 text-muted-foreground">
                <li>• No-shows leaving courts empty</li>
                <li>• Uncertain revenue from bookings</li>
                <li>• Difficulty filling cancelled slots</li>
                <li>• Managing multiple booking channels</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Values */}
      <section className="py-16 px-4 bg-muted/30">
        <div className="container mx-auto max-w-4xl">
          <h2 className="font-display text-2xl font-bold mb-8 text-center">Our Values</h2>
          <div className="grid sm:grid-cols-2 gap-6">
            {values.map((value) => (
              <div key={value.title} className="bg-card rounded-2xl p-6 border border-border">
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
      <section className="py-16 px-4">
        <div className="container mx-auto max-w-4xl text-center">
          <h2 className="font-display text-2xl font-bold mb-4">Proudly New Zealand</h2>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            NextPlay is built for the New Zealand sports community. We understand the local 
            landscape - from indoor futsal facilities in Auckland to tennis clubs in Wellington. 
            We're here to make playing sports easier for every Kiwi.
          </p>
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
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded bg-primary flex items-center justify-center">
              <span className="text-primary-foreground font-display font-bold text-xs">N</span>
            </div>
            <span className="font-display font-semibold">NextPlay</span>
          </div>
          <div className="flex gap-6 text-sm text-muted-foreground">
            <Link to="/" className="hover:text-foreground transition-colors">Home</Link>
            <Link to="/contact" className="hover:text-foreground transition-colors">Contact</Link>
          </div>
          <p className="text-sm text-muted-foreground">
            © {new Date().getFullYear()} NextPlay
          </p>
        </div>
      </footer>
    </div>
  );
}
