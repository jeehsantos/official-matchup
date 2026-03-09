import { useState, useEffect } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Users, Building2, ShieldAlert } from "lucide-react";
import { PublicLayout } from "@/components/layout/PublicLayout";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { useTranslation } from "react-i18next";

export default function Auth() {
  const [activeTab, setActiveTab] = useState<"login" | "signup">("login");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [resetSent, setResetSent] = useState(false);
  const [lockoutUntil, setLockoutUntil] = useState<Date | null>(null);
  const [remainingAttempts, setRemainingAttempts] = useState<number | null>(null);
  const { user, userRole, signIn, signUp, resetPassword, isLoading } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();
  const { t } = useTranslation("auth");
  const { t: tc } = useTranslation("common");

  const loginSchema = z.object({
    email: z.string().email(t("validation.emailRequired")),
    password: z.string().min(1, t("validation.passwordRequired"))
  });

  const signUpSchema = z.object({
    fullName: z.string().min(2, t("validation.nameMin")),
    email: z.string().email(t("validation.emailRequired")),
    password: z.string().
    min(8, t("validation.passwordMin")).
    regex(/[A-Z]/, t("validation.passwordUppercase")).
    regex(/[a-z]/, t("validation.passwordLowercase")).
    regex(/[0-9]/, t("validation.passwordNumber")).
    regex(/[^A-Za-z0-9]/, t("validation.passwordSpecial")),
    confirmPassword: z.string(),
    role: z.enum(["player", "court_manager"], {
      required_error: t("validation.roleRequired")
    })
  }).refine((data) => data.password === data.confirmPassword, {
    message: t("validation.passwordsNoMatch"),
    path: ["confirmPassword"]
  });

  type LoginFormData = z.infer<typeof loginSchema>;
  type SignUpFormData = z.infer<typeof signUpSchema>;

  const getDefaultPathForRole = (role: string | null) => {
    if (role === "admin") return "/admin";
    if (role === "court_manager") return "/manager";
    if (role === "venue_staff") return "/manager/availability";
    return "/games";
  };

  const handleGoogleSignIn = async () => {
    setIsGoogleLoading(true);
    const { error } = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin
    });
    if (error) {
      setIsGoogleLoading(false);
      toast({ variant: "destructive", title: t("googleSignInFailed"), description: error.message || t("googleSignInError") });
    }
  };

  const loginForm = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" }
  });

  const signUpForm = useForm<SignUpFormData>({
    resolver: zodResolver(signUpSchema),
    defaultValues: { fullName: "", email: "", password: "", confirmPassword: "", role: "player" }
  });

  useEffect(() => {
    const tabParam = searchParams.get("tab");
    const roleParam = searchParams.get("role");
    const refParam = searchParams.get("ref");
    if (tabParam === "signup") setActiveTab("signup");else
    if (tabParam === "login") setActiveTab("login");
    if (roleParam === "player" || roleParam === "court_manager") signUpForm.setValue("role", roleParam, { shouldValidate: true });
    if (refParam) localStorage.setItem("referralCode", refParam);
  }, [searchParams, signUpForm]);

  useEffect(() => {
    if (!isLoading && user && userRole && !window.location.pathname.includes('/auth')) {
      const redirectPath = localStorage.getItem('redirectAfterAuth');
      if (redirectPath) {localStorage.removeItem('redirectAfterAuth');navigate(redirectPath, { replace: true });} else
      navigate(getDefaultPathForRole(userRole), { replace: true });
    }
  }, [user, userRole, isLoading, navigate]);

  useEffect(() => {
    if (!lockoutUntil) return;
    const interval = setInterval(() => {if (new Date() >= lockoutUntil) {setLockoutUntil(null);setRemainingAttempts(4);}}, 1000);
    return () => clearInterval(interval);
  }, [lockoutUntil]);

  const getLockoutTimeRemaining = () => {
    if (!lockoutUntil) return "";
    const diff = lockoutUntil.getTime() - Date.now();
    if (diff <= 0) return "";
    const mins = Math.floor(diff / 60000);
    const secs = Math.floor(diff % 60000 / 1000);
    return `${mins}m ${secs}s`;
  };

  const handleLogin = async (data: LoginFormData) => {
    setIsSubmitting(true);
    try {
      const { data: checkResult, error: checkError } = await supabase.rpc("check_login_attempt", { p_email: data.email });
      if (!checkError && checkResult) {
        const result = checkResult as Record<string, unknown>;
        if (!result.allowed) {
          setIsSubmitting(false);
          setLockoutUntil(new Date(result.locked_until as string));
          setRemainingAttempts(0);
          toast({ variant: "destructive", title: t("accountLocked"), description: t("tooManyAttempts") });
          return;
        }
      }
    } catch (e) {console.error("Login check error:", e);}

    const { error, role } = await signIn(data.email, data.password);
    setIsSubmitting(false);

    if (error) {
      try {
        const { data: failResultRaw } = await supabase.rpc("record_failed_login", { p_email: data.email });
        const failResult = failResultRaw as Record<string, unknown> | null;
        if (failResult?.locked) {
          setLockoutUntil(new Date(failResult.locked_until as string));
          setRemainingAttempts(0);
          toast({ variant: "destructive", title: t("accountLocked"), description: t("lockedFor30") });
          return;
        } else {
          setRemainingAttempts(failResult?.remaining_attempts as number ?? null);
        }
      } catch (e) {console.error("Failed to record login attempt:", e);}

      const attemptsMsg = remainingAttempts !== null && remainingAttempts <= 2 ?
      ` (${remainingAttempts} ${remainingAttempts === 1 ? t("attemptsLeft", { count: remainingAttempts }) : t("attemptsLeft_other", { count: remainingAttempts })})` :
      "";

      toast({
        variant: "destructive",
        title: t("loginFailed"),
        description: error.message === "Invalid login credentials" ? `${t("incorrectCredentials")}${attemptsMsg}` : error.message === "Email not confirmed" ? t("emailNotConfirmed") : error.message
      });
    } else if (role) {
      try {await supabase.rpc("clear_login_attempts", { p_email: data.email });} catch (e) {console.error("Failed to clear login attempts:", e);}
      setRemainingAttempts(null);
      setLockoutUntil(null);
      const redirectPath = localStorage.getItem('redirectAfterAuth');
      if (redirectPath) {localStorage.removeItem('redirectAfterAuth');navigate(redirectPath, { replace: true });} else
      navigate(getDefaultPathForRole(role), { replace: true });
    }
  };

  const handleSignUp = async (data: SignUpFormData) => {
    setIsSubmitting(true);
    const referralCode = localStorage.getItem("referralCode") || undefined;
    const { error, session } = await signUp(data.email, data.password, data.fullName, data.role, referralCode);
    setIsSubmitting(false);

    if (error) {
      toast({
        variant: "destructive",
        title: t("signUpFailed"),
        description: error.message.includes("already registered") ? t("alreadyRegistered") : error.message
      });
    } else if (!session) {
      if (referralCode) localStorage.removeItem("referralCode");
      toast({ title: t("checkEmail"), description: t("confirmationLinkSent") });
      signUpForm.reset();
      setActiveTab("login");
    } else {
      if (referralCode) localStorage.removeItem("referralCode");
      toast({ title: t("accountCreated"), description: t("welcomeMessage") });
      const redirectPath = localStorage.getItem('redirectAfterAuth');
      if (redirectPath) {localStorage.removeItem('redirectAfterAuth');navigate(redirectPath, { replace: true });} else
      navigate(getDefaultPathForRole(data.role), { replace: true });
    }
  };

  const handleForgotPassword = async () => {
    if (!resetEmail || !resetEmail.includes("@")) {
      toast({ variant: "destructive", title: t("invalidEmail"), description: t("enterValidEmail") });
      return;
    }
    setIsSubmitting(true);
    const { error } = await resetPassword(resetEmail);
    setIsSubmitting(false);
    if (error) {toast({ variant: "destructive", title: t("error"), description: error.message });} else
    {setResetSent(true);toast({ title: t("checkEmail"), description: t("resetLinkSent") });}
  };

  if (isLoading && user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>);

  }

  return (
    <PublicLayout showBack={false} showFooter={false} showNavbar={false}>
      <div className="relative min-h-screen flex flex-col items-center justify-center p-4 -mt-12">
        <div className="flex flex-col items-center gap-2 mb-8">
          <Link to="/" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
            ← {tc("backToHome")}
          </Link>
        </div>

        {showForgotPassword ?
        <Card className="w-full max-w-md">
            <CardHeader className="text-center">
              <CardTitle className="font-display">{t("resetPassword")}</CardTitle>
              <CardDescription>{resetSent ? t("resetSent") : t("resetDescription")}</CardDescription>
            </CardHeader>
            <CardContent>
              {!resetSent ?
            <div className="space-y-4">
                  <div>
                    <label className="text-sm font-medium">{t("email")}</label>
                    <Input type="email" placeholder="you@example.com" value={resetEmail} onChange={(e) => setResetEmail(e.target.value)} className="mt-1.5" />
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" className="flex-1" onClick={() => {setShowForgotPassword(false);setResetEmail("");setResetSent(false);}}>{tc("cancel")}</Button>
                    <Button className="flex-1 btn-athletic" onClick={handleForgotPassword} disabled={isSubmitting}>
                      {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : t("sendResetLink")}
                    </Button>
                  </div>
                </div> :

            <Button className="w-full btn-athletic" onClick={() => {setShowForgotPassword(false);setResetEmail("");setResetSent(false);}}>{t("backToLogin")}</Button>
            }
            </CardContent>
          </Card> :

        <Card className="w-full max-w-md">
            <CardHeader className="text-center">
              <img src="/sportarena-logo.png" alt="Sport Arena logo" className="h-8 w-auto mx-auto mb-2 object-contain" />
              <CardTitle className="font-display">{t("welcome")}</CardTitle>
              <CardDescription>{t("subtitle")}</CardDescription>
            </CardHeader>
            <CardContent>
              <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "login" | "signup")}>
                <TabsList className="grid w-full grid-cols-2 mb-6">
                  <TabsTrigger value="login">{t("login")}</TabsTrigger>
                  <TabsTrigger value="signup">{t("signUp")}</TabsTrigger>
                </TabsList>

                <TabsContent value="login">
                  <Form {...loginForm}>
                    <form onSubmit={loginForm.handleSubmit(handleLogin)} className="space-y-4">
                      <FormField control={loginForm.control} name="email" render={({ field }) =>
                    <FormItem>
                          <FormLabel>{t("email")}</FormLabel>
                          <FormControl><Input type="email" placeholder="you@example.com" {...field} /></FormControl>
                          <FormMessage />
                        </FormItem>
                    } />
                      <FormField control={loginForm.control} name="password" render={({ field }) =>
                    <FormItem>
                          <FormLabel>{t("password")}</FormLabel>
                          <FormControl><Input type="password" placeholder="••••••••" {...field} /></FormControl>
                          <FormMessage />
                        </FormItem>
                    } />
                      <div className="flex justify-end">
                        <button type="button" onClick={() => setShowForgotPassword(true)} className="text-sm text-primary hover:underline">{t("forgotPassword")}</button>
                      </div>
                      {lockoutUntil && new Date() < lockoutUntil &&
                    <div className="flex items-center gap-2 rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
                          <ShieldAlert className="h-4 w-4 shrink-0" />
                          <span>{t("accountLockedTimer", { time: getLockoutTimeRemaining() })}</span>
                        </div>
                    }
                      {remainingAttempts !== null && remainingAttempts > 0 && remainingAttempts <= 2 && !lockoutUntil &&
                    <p className="text-xs text-amber-600 dark:text-amber-400">
                          ⚠️ {t(remainingAttempts === 1 ? "attemptsRemaining" : "attemptsRemaining_other", { count: remainingAttempts })}
                        </p>
                    }
                      <Button type="submit" className="w-full btn-athletic" disabled={isSubmitting || isGoogleLoading || lockoutUntil !== null && new Date() < lockoutUntil}>
                        {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : t("signInBtn")}
                      </Button>

                      <div className="relative my-4">
                        <div className="absolute inset-0 flex items-center"><span className="w-full border-t" /></div>
                        <div className="relative flex justify-center text-xs uppercase"><span className="bg-card px-2 text-muted-foreground">{t("orContinueWith")}</span></div>
                      </div>

                      <Button type="button" variant="outline" className="w-full" onClick={handleGoogleSignIn} disabled={isSubmitting || isGoogleLoading}>
                        {isGoogleLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> :
                      <svg className="h-4 w-4 mr-2" viewBox="0 0 24 24">
                            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                          </svg>
                      }
                        {t("continueWithGoogle")}
                      </Button>
                    </form>
                  </Form>
                </TabsContent>

                <TabsContent value="signup">
                  <Form {...signUpForm}>
                    <form onSubmit={signUpForm.handleSubmit(handleSignUp)} className="space-y-4">
                      <FormField control={signUpForm.control} name="fullName" render={({ field }) =>
                    <FormItem>
                          <FormLabel>{t("fullName")}</FormLabel>
                          <FormControl><Input placeholder="John Doe" {...field} /></FormControl>
                          <FormMessage />
                        </FormItem>
                    } />
                      <FormField control={signUpForm.control} name="email" render={({ field }) =>
                    <FormItem>
                          <FormLabel>{t("email")}</FormLabel>
                          <FormControl><Input type="email" placeholder="you@example.com" {...field} /></FormControl>
                          <FormMessage />
                        </FormItem>
                    } />
                      <FormField control={signUpForm.control} name="role" render={({ field }) =>
                    <FormItem>
                          <FormLabel>{t("joinAs")}</FormLabel>
                          <FormControl>
                            <RadioGroup onValueChange={field.onChange} defaultValue={field.value} className="grid grid-cols-2 gap-3 pt-2">
                              <label htmlFor="player" className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 cursor-pointer transition-all ${field.value === "player" ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"}`}>
                                <RadioGroupItem value="player" id="player" className="sr-only" />
                                <div className={`w-12 h-12 rounded-full flex items-center justify-center ${field.value === "player" ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
                                  <Users className="h-6 w-6" />
                                </div>
                                <span className="font-semibold text-sm">{t("player")}</span>
                                <span className="text-xs text-muted-foreground text-center">{t("playerDesc")}</span>
                              </label>
                              <label htmlFor="court_manager" className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 cursor-pointer transition-all ${field.value === "court_manager" ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"}`}>
                                <RadioGroupItem value="court_manager" id="court_manager" className="sr-only" />
                                <div className={`w-12 h-12 rounded-full flex items-center justify-center ${field.value === "court_manager" ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
                                  <Building2 className="h-6 w-6" />
                                </div>
                                <span className="font-semibold text-sm">{t("courtManager")}</span>
                                <span className="text-xs text-muted-foreground text-center">{t("courtManagerDesc")}</span>
                              </label>
                            </RadioGroup>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                    } />
                      <FormField control={signUpForm.control} name="password" render={({ field }) =>
                    <FormItem>
                          <FormLabel>{t("password")}</FormLabel>
                          <FormControl><Input type="password" placeholder="••••••••" {...field} /></FormControl>
                          <FormMessage />
                          <p className="text-xs text-muted-foreground mt-1">{t("passwordRequirements")}</p>
                        </FormItem>
                    } />
                      <FormField control={signUpForm.control} name="confirmPassword" render={({ field }) =>
                    <FormItem>
                          <FormLabel>{t("confirmPassword")}</FormLabel>
                          <FormControl><Input type="password" placeholder="••••••••" {...field} /></FormControl>
                          <FormMessage />
                        </FormItem>
                    } />
                      <p className="text-xs text-muted-foreground text-center">
                        By creating an account, you agree to our{" "}
                        <Link to="/terms" className="text-primary hover:underline">Terms of Service</Link> and{" "}
                        <Link to="/privacy" className="text-primary hover:underline">Privacy Policy</Link>.
                      </p>
                      <Button type="submit" className="w-full btn-athletic" disabled={isSubmitting || isGoogleLoading}>
                        {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : t("createAccount")}
                      </Button>

                      <div className="relative my-4">
                        <div className="absolute inset-0 flex items-center"><span className="w-full border-t" /></div>
                        <div className="relative flex justify-center text-xs uppercase"><span className="bg-card px-2 text-muted-foreground">{t("orContinueWith")}</span></div>
                      </div>

                      <Button type="button" variant="outline" className="w-full" onClick={handleGoogleSignIn} disabled={isSubmitting || isGoogleLoading}>
                        {isGoogleLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> :
                      <svg className="h-4 w-4 mr-2" viewBox="0 0 24 24">
                            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                          </svg>
                      }
                        {t("continueWithGoogle")}
                      </Button>
                    </form>
                  </Form>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        }
      </div>
    </PublicLayout>);

}