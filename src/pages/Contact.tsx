import { useState } from "react";
import { Link } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { GuestNavbar } from "@/components/layout/GuestNavbar";
import { Footer } from "@/components/layout/Footer";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Mail, MessageSquare, Loader2, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { useTranslation } from "react-i18next";

export default function Contact() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const { toast } = useToast();
  const { t } = useTranslation("contact");
  const { t: tc } = useTranslation("common");

  const contactSchema = z.object({
    name: z.string().min(2, t("validation.nameMin")),
    email: z.string().email(t("validation.emailInvalid")),
    subject: z.string().min(5, t("validation.subjectMin")),
    message: z.string().min(10, t("validation.messageMin")),
  });

  type ContactFormData = z.infer<typeof contactSchema>;

  const faqs = [
    { question: t("faqs.q1"), answer: t("faqs.a1") },
    { question: t("faqs.q2"), answer: t("faqs.a2") },
    { question: t("faqs.q3"), answer: t("faqs.a3") },
    { question: t("faqs.q4"), answer: t("faqs.a4") },
    { question: t("faqs.q5"), answer: t("faqs.a5") },
    { question: t("faqs.q6"), answer: t("faqs.a6") },
    { question: t("faqs.q7"), answer: t("faqs.a7") },
  ];

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
      const { data: result, error } = await supabase.functions.invoke("send-contact-email", {
        body: {
          name: data.name,
          email: data.email,
          subject: data.subject,
          message: data.message,
        },
      });
      if (error) throw error;
      setIsSubmitted(true);
      reset();
      toast({ title: t("toastSuccess"), description: t("toastSuccessDesc") });
    } catch {
      toast({ title: t("toastError"), description: t("toastErrorDesc"), variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <GuestNavbar />

      <div className="px-4 pt-28">
        <div className="container mx-auto max-w-4xl">
          <Link to="/" className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="h-4 w-4" />
            {tc("backToHome")}
          </Link>
        </div>
      </div>

      <section id="lets-talk-courts" className="scroll-mt-24 pt-10 pb-10 px-4">
        <div className="container mx-auto max-w-5xl">
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6">
            <div>
              <p className="text-sm uppercase tracking-widest text-muted-foreground">{t("label")}</p>
              <h1 className="font-display text-4xl md:text-5xl font-bold mt-2">{t("title")}</h1>
            </div>
            <p className="text-lg text-muted-foreground max-w-xl">{t("subtitle")}</p>
          </div>
        </div>
      </section>

      <section className="py-12 px-4">
        <div className="container mx-auto max-w-5xl">
          <div className="grid lg:grid-cols-[1.1fr_0.9fr] gap-8">
            <div className="card-elevated p-6 md:p-8">
              <div className="flex items-center gap-3 mb-6">
                <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
                  <MessageSquare className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h2 className="font-display text-xl font-semibold">{t("sendMessage")}</h2>
                  <p className="text-sm text-muted-foreground">{t("respondTime")}</p>
                </div>
              </div>

              {isSubmitted ? (
                <div className="rounded-2xl border border-primary/20 bg-primary/10 p-8 text-center">
                  <CheckCircle2 className="h-12 w-12 text-primary mx-auto mb-4" />
                  <h3 className="font-display font-semibold text-lg mb-2">{t("messageSent")}</h3>
                  <p className="text-muted-foreground mb-4">{t("messageSentDesc")}</p>
                  <Button onClick={() => setIsSubmitted(false)} variant="outline">{t("sendAnother")}</Button>
                </div>
              ) : (
                <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                  <div>
                    <Label htmlFor="name">{t("name")}</Label>
                    <Input id="name" {...register("name")} placeholder={t("namePlaceholder")} className="mt-1" />
                    {errors.name && <p className="text-sm text-destructive mt-1">{errors.name.message}</p>}
                  </div>
                  <div>
                    <Label htmlFor="email">{t("email")}</Label>
                    <Input id="email" type="email" {...register("email")} placeholder={t("emailPlaceholder")} className="mt-1" />
                    {errors.email && <p className="text-sm text-destructive mt-1">{errors.email.message}</p>}
                  </div>
                  <div>
                    <Label htmlFor="subject">{t("subject")}</Label>
                    <Input id="subject" {...register("subject")} placeholder={t("subjectPlaceholder")} className="mt-1" />
                    {errors.subject && <p className="text-sm text-destructive mt-1">{errors.subject.message}</p>}
                  </div>
                  <div>
                    <Label htmlFor="message">{t("message")}</Label>
                    <Textarea id="message" {...register("message")} placeholder={t("messagePlaceholder")} rows={5} className="mt-1" />
                    {errors.message && <p className="text-sm text-destructive mt-1">{errors.message.message}</p>}
                  </div>
                  <Button type="submit" className="w-full" disabled={isSubmitting}>
                    {isSubmitting ? (<><Loader2 className="h-4 w-4 mr-2 animate-spin" />{t("sending")}</>) : t("sendBtn")}
                  </Button>
                </form>
              )}
            </div>

            <div className="space-y-6">
              <div className="card-elevated p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
                    <Mail className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <h2 className="font-display text-lg font-semibold">{t("getInTouch")}</h2>
                    <p className="text-sm text-muted-foreground">{t("chooseTeam")}</p>
                  </div>
                </div>
                <div className="space-y-4">
                  <div className="rounded-xl border border-border bg-background/70 p-4">
                    <h3 className="font-semibold mb-1">{t("emailSupport")}</h3>
                    <p className="text-muted-foreground text-sm mb-2">{t("emailSupportDesc")}</p>
                    <a href="mailto:support@sportarena.co.nz" className="text-primary text-sm font-semibold hover:underline">support@sportarena.co.nz</a>
                  </div>
                  <div className="rounded-xl border border-border bg-background/70 p-4">
                    <h3 className="font-semibold mb-1">{t("businessInquiries")}</h3>
                    <p className="text-muted-foreground text-sm mb-2">{t("businessInquiriesDesc")}</p>
                    <a href="mailto:business@sportarena.co.nz" className="text-primary text-sm font-semibold hover:underline">business@sportarena.co.nz</a>
                  </div>
                </div>
              </div>
              <div className="card-elevated p-6">
                <h3 className="font-semibold mb-3">{t("quickAnswers")}</h3>
                <p className="text-sm text-muted-foreground">{t("quickAnswersDesc")}</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="py-12 px-4 bg-muted/30">
        <div className="container mx-auto max-w-5xl">
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6 mb-8">
            <div>
              <p className="text-sm uppercase tracking-widest text-muted-foreground">{t("faqLabel")}</p>
              <h2 className="font-display text-3xl font-bold mt-2">{t("faqTitle")}</h2>
            </div>
            <p className="text-muted-foreground max-w-md">{t("faqSubtitle")}</p>
          </div>
          <Accordion type="single" collapsible className="w-full">
            {faqs.map((faq, index) => (
              <AccordionItem key={index} value={`item-${index}`}>
                <AccordionTrigger className="text-left">{faq.question}</AccordionTrigger>
                <AccordionContent className="text-muted-foreground">{faq.answer}</AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </section>

      <Footer />
    </div>
  );
}
