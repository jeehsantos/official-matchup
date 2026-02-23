import { useState } from "react";
import { Link } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { GuestNavbar } from "@/components/layout/GuestNavbar";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { 
  ArrowLeft, 
  Mail, 
  MessageSquare, 
  ChevronDown,
  Loader2,
  CheckCircle2
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

const contactSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Please enter a valid email"),
  subject: z.string().min(5, "Subject must be at least 5 characters"),
  message: z.string().min(10, "Message must be at least 10 characters"),
});

type ContactFormData = z.infer<typeof contactSchema>;

const faqs = [
  {
    question: "How do payments work?",
    answer: "Players pay upfront before the payment deadline (usually 24 hours before the game). This guarantees their spot and ensures the court is paid for. Payments are processed securely through Stripe."
  },
  {
    question: "What happens if I need to cancel?",
    answer: "If you cancel before the payment deadline, you get a full refund. After the deadline, your spot enters 'rescue mode' where other group members can claim it. If someone takes your spot, you get refunded."
  },
  {
    question: "What is Rescue Mode?",
    answer: "When a player cancels after the payment deadline, their spot goes into Rescue Mode for 48 hours. During this time, group members get first access to claim the slot. After 48 hours, if unfilled, it's released to the public marketplace."
  },
  {
    question: "How does the marketplace work?",
    answer: "Released slots from cancelled bookings appear in the public marketplace. Any registered player can book these slots, giving everyone fair access to court time."
  },
  {
    question: "What fees does Sport Arena charge?",
    answer: "We charge a small platform fee per player per session to cover payment processing and platform maintenance. Court managers receive the full court booking amount minus payment processing fees."
  },
  {
    question: "How do I become a Court Manager?",
    answer: "Register for an account and select 'Court Manager' as your role. You'll then be able to add your venues, courts, and publish availability slots for booking."
  },
];

export default function Contact() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const { toast } = useToast();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ContactFormData>({
    resolver: zodResolver(contactSchema),
  });

  const onSubmit = async (data: ContactFormData) => {
    setIsSubmitting(true);
    try {
      const { error } = await supabase
        .from("contact_messages")
        .insert({
          name: data.name,
          email: data.email,
          subject: data.subject,
          message: data.message,
        });

      if (error) throw error;

      setIsSubmitted(true);
      reset();
      toast({
        title: "Message sent!",
        description: "We'll get back to you as soon as possible.",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to send message. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <GuestNavbar />

      {/* Back Link */}
      <div className="px-4 pt-28">
        <div className="container mx-auto max-w-4xl">
          <Link to="/" className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="h-4 w-4" />
            Back to Home
          </Link>
        </div>
      </div>

      {/* Hero */}
      <section id="lets-talk-courts" className="scroll-mt-24 pt-10 pb-10 px-4">
        <div className="container mx-auto max-w-5xl">
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6">
            <div>
              <p className="text-sm uppercase tracking-widest text-muted-foreground">Contact</p>
              <h1 className="font-display text-4xl md:text-5xl font-bold mt-2">
                Let’s talk courts
              </h1>
            </div>
            <p className="text-lg text-muted-foreground max-w-xl">
              Reach out for support, partnerships, or venue onboarding. We reply fast.
            </p>
          </div>
        </div>
      </section>

      {/* Contact Form & Info */}
      <section className="py-12 px-4">
        <div className="container mx-auto max-w-5xl">
          <div className="grid lg:grid-cols-[1.1fr_0.9fr] gap-8">
            {/* Form */}
            <div className="card-elevated p-6 md:p-8">
              <div className="flex items-center gap-3 mb-6">
                <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
                  <MessageSquare className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h2 className="font-display text-xl font-semibold">Send a Message</h2>
                  <p className="text-sm text-muted-foreground">We usually respond within one business day.</p>
                </div>
              </div>
              
              {isSubmitted ? (
                <div className="rounded-2xl border border-primary/20 bg-primary/10 p-8 text-center">
                  <CheckCircle2 className="h-12 w-12 text-primary mx-auto mb-4" />
                  <h3 className="font-display font-semibold text-lg mb-2">Message Sent!</h3>
                  <p className="text-muted-foreground mb-4">
                    Thank you for reaching out. We'll get back to you shortly.
                  </p>
                  <Button onClick={() => setIsSubmitted(false)} variant="outline">
                    Send Another Message
                  </Button>
                </div>
              ) : (
                <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                  <div>
                    <Label htmlFor="name">Name</Label>
                    <Input
                      id="name"
                      {...register("name")}
                      placeholder="Your name"
                      className="mt-1"
                    />
                    {errors.name && (
                      <p className="text-sm text-destructive mt-1">{errors.name.message}</p>
                    )}
                  </div>
                  
                  <div>
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      {...register("email")}
                      placeholder="your@email.com"
                      className="mt-1"
                    />
                    {errors.email && (
                      <p className="text-sm text-destructive mt-1">{errors.email.message}</p>
                    )}
                  </div>
                  
                  <div>
                    <Label htmlFor="subject">Subject</Label>
                    <Input
                      id="subject"
                      {...register("subject")}
                      placeholder="What's this about?"
                      className="mt-1"
                    />
                    {errors.subject && (
                      <p className="text-sm text-destructive mt-1">{errors.subject.message}</p>
                    )}
                  </div>
                  
                  <div>
                    <Label htmlFor="message">Message</Label>
                    <Textarea
                      id="message"
                      {...register("message")}
                      placeholder="Tell us more..."
                      rows={5}
                      className="mt-1"
                    />
                    {errors.message && (
                      <p className="text-sm text-destructive mt-1">{errors.message.message}</p>
                    )}
                  </div>
                  
                  <Button type="submit" className="w-full" disabled={isSubmitting}>
                    {isSubmitting ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Sending...
                      </>
                    ) : (
                      "Send Message"
                    )}
                  </Button>
                </form>
              )}
            </div>

            {/* Contact Info */}
            <div className="space-y-6">
              <div className="card-elevated p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
                    <Mail className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <h2 className="font-display text-lg font-semibold">Get in Touch</h2>
                    <p className="text-sm text-muted-foreground">Choose the right team to help you.</p>
                  </div>
                </div>
                <div className="space-y-4">
                  <div className="rounded-xl border border-border bg-background/70 p-4">
                    <h3 className="font-semibold mb-1">Email Support</h3>
                    <p className="text-muted-foreground text-sm mb-2">
                      For general inquiries and support.
                    </p>
                    <a 
                      href="mailto:support@sportarena.co.nz" 
                      className="text-primary text-sm font-semibold hover:underline"
                    >
                      support@sportarena.co.nz
                    </a>
                  </div>
                  <div className="rounded-xl border border-border bg-background/70 p-4">
                    <h3 className="font-semibold mb-1">Business Inquiries</h3>
                    <p className="text-muted-foreground text-sm mb-2">
                      For partnerships and venue onboarding.
                    </p>
                    <a 
                      href="mailto:business@sportarena.co.nz" 
                      className="text-primary text-sm font-semibold hover:underline"
                    >
                      business@sportarena.co.nz
                    </a>
                  </div>
                </div>
              </div>
              <div className="card-elevated p-6">
                <h3 className="font-semibold mb-3">Quick answers</h3>
                <p className="text-sm text-muted-foreground">
                  Browse our FAQs below for the fastest support.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-12 px-4 bg-muted/30">
        <div className="container mx-auto max-w-5xl">
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6 mb-8">
            <div>
              <p className="text-sm uppercase tracking-widest text-muted-foreground">FAQ</p>
              <h2 className="font-display text-3xl font-bold mt-2">
                Frequently asked questions
              </h2>
            </div>
            <p className="text-muted-foreground max-w-md">
              Still stuck? Send us a message and we’ll help.
            </p>
          </div>
          
          <Accordion type="single" collapsible className="w-full">
            {faqs.map((faq, index) => (
              <AccordionItem key={index} value={`item-${index}`}>
                <AccordionTrigger className="text-left">
                  {faq.question}
                </AccordionTrigger>
                <AccordionContent className="text-muted-foreground">
                  {faq.answer}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
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
            <Link to="/about" className="hover:text-foreground transition-colors">About</Link>
          </div>
          <p className="text-sm text-muted-foreground">
            © {new Date().getFullYear()} Sport Arena
          </p>
        </div>
      </footer>
    </div>
  );
}
