import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
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
import { Loader2, Users, Building2 } from "lucide-react";
import { PublicLayout } from "@/components/layout/PublicLayout";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
const loginSchema = z.object({
  email: z.string().email("Please enter a valid email"),
  password: z.string().min(1, "Password is required"),
});

const signUpSchema = z.object({
  fullName: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Please enter a valid email"),
  password: z.string()
    .min(8, "Password must be at least 8 characters")
    .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
    .regex(/[a-z]/, "Password must contain at least one lowercase letter")
    .regex(/[0-9]/, "Password must contain at least one number")
    .regex(/[^A-Za-z0-9]/, "Password must contain at least one special character"),
  confirmPassword: z.string(),
  role: z.enum(["player", "court_manager"], {
    required_error: "Please select a role",
  }),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

type LoginFormData = z.infer<typeof loginSchema>;
type SignUpFormData = z.infer<typeof signUpSchema>;

export default function Auth() {
  const [activeTab, setActiveTab] = useState<"login" | "signup">("login");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [resetSent, setResetSent] = useState(false);
  const { user, userRole, signIn, signUp, resetPassword, isLoading } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();

  const getDefaultPathForRole = (role: string | null) => {
    if (role === "admin") return "/admin";
    if (role === "court_manager") return "/manager";
    return "/games";
  };

  const handleGoogleSignIn = async () => {
    setIsGoogleLoading(true);
    const { error } = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
    });
    
    if (error) {
      setIsGoogleLoading(false);
      toast({
        variant: "destructive",
        title: "Google sign in failed",
        description: error.message || "Could not sign in with Google. Please try again.",
      });
    }
    // If successful, the page will redirect, so no need to reset loading state
  };

  const loginForm = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  const signUpForm = useForm<SignUpFormData>({
    resolver: zodResolver(signUpSchema),
    defaultValues: { fullName: "", email: "", password: "", confirmPassword: "", role: "player" },
  });


  useEffect(() => {
    const tabParam = searchParams.get("tab");
    const roleParam = searchParams.get("role");
    const refParam = searchParams.get("ref");

    if (tabParam === "signup") {
      setActiveTab("signup");
    } else if (tabParam === "login") {
      setActiveTab("login");
    }

    if (roleParam === "player" || roleParam === "court_manager") {
      signUpForm.setValue("role", roleParam, { shouldValidate: true });
    }

    // Store referral code for use after signup
    if (refParam) {
      localStorage.setItem("referralCode", refParam);
    }
  }, [searchParams, signUpForm]);

  useEffect(() => {
    // Only redirect if we have a user AND role loaded (not during sign out)
    // AND we're not already being redirected from logout
    if (!isLoading && user && userRole && !window.location.pathname.includes('/auth')) {
      // Check for stored redirect path from before auth
      const redirectPath = localStorage.getItem('redirectAfterAuth');
      if (redirectPath) {
        localStorage.removeItem('redirectAfterAuth');
        navigate(redirectPath, { replace: true });
      } else {
        navigate(getDefaultPathForRole(userRole), { replace: true });
      }
    }
  }, [user, userRole, isLoading, navigate]);

  const handleLogin = async (data: LoginFormData) => {
    setIsSubmitting(true);
    const { error, role } = await signIn(data.email, data.password);
    setIsSubmitting(false);

    if (error) {
      toast({
        variant: "destructive",
        title: "Login failed",
        description: error.message === "Invalid login credentials"
          ? "Incorrect email or password. Please try again."
          : error.message,
      });
    } else if (role) {
      // Check for stored redirect path from before auth
      const redirectPath = localStorage.getItem('redirectAfterAuth');
      if (redirectPath) {
        localStorage.removeItem('redirectAfterAuth');
        navigate(redirectPath, { replace: true });
      } else {
        navigate(getDefaultPathForRole(role), { replace: true });
      }
    }
  };

  const handleSignUp = async (data: SignUpFormData) => {
    setIsSubmitting(true);
    // Pass referral code to signUp so it's included in user metadata
    const referralCode = localStorage.getItem("referralCode") || undefined;
    const { error } = await signUp(data.email, data.password, data.fullName, data.role, referralCode);
    setIsSubmitting(false);

    if (error) {
      const friendlyMessage =
        error.message.includes("already registered")
          ? "This email is already registered. Please log in instead."
          : error.message;
      
      toast({
        variant: "destructive",
        title: "Sign up failed",
        description: friendlyMessage,
      });
    } else {
      // Clear referral code from localStorage after successful signup
      if (referralCode) {
        localStorage.removeItem("referralCode");
      }

      toast({
        title: "Account created!",
        description: "Welcome to Sport Arena. Let's get you started.",
      });
      
      // Check for stored redirect path from before auth
      const redirectPath = localStorage.getItem('redirectAfterAuth');
      if (redirectPath) {
        localStorage.removeItem('redirectAfterAuth');
        navigate(redirectPath, { replace: true });
      } else {
        navigate(getDefaultPathForRole(data.role), { replace: true });
      }
    }
  };

  const handleForgotPassword = async () => {
    if (!resetEmail || !resetEmail.includes("@")) {
      toast({
        variant: "destructive",
        title: "Invalid email",
        description: "Please enter a valid email address.",
      });
      return;
    }

    setIsSubmitting(true);
    const { error } = await resetPassword(resetEmail);
    setIsSubmitting(false);

    if (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message,
      });
    } else {
      setResetSent(true);
      toast({
        title: "Check your email",
        description: "We've sent you a password reset link.",
      });
    }
  };

  // Only show loading spinner if there's a user session being processed
  // Don't show spinner when user is null (logged out or not logged in)
  if (isLoading && user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <PublicLayout showBack={false} showFooter={false}>
      <div className="relative min-h-screen flex flex-col items-center justify-center p-4 -mt-12">
      {/* Back Button */}
      <Button
        variant="ghost"
        size="sm"
        onClick={() => navigate(-1)}
        className="self-start mb-4 gap-2 text-muted-foreground hover:text-foreground"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="m15 18-6-6 6-6"/>
        </svg>
        Back
      </Button>

      <div className="flex flex-col items-center gap-3 mb-8">
        <img
          src="/sportarena-logo.png"
          alt="Sport Arena logo"
          className="h-16 w-auto mix-blend-screen"
        />
        <p className="text-sm text-muted-foreground">Discover. Book. Play.</p>
      </div>

      {showForgotPassword ? (
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle className="font-display">Reset Password</CardTitle>
            <CardDescription>
              {resetSent 
                ? "Check your email for a password reset link"
                : "Enter your email to receive a password reset link"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!resetSent ? (
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium">Email</label>
                  <Input
                    type="email"
                    placeholder="you@example.com"
                    value={resetEmail}
                    onChange={(e) => setResetEmail(e.target.value)}
                    className="mt-1.5"
                  />
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={() => {
                      setShowForgotPassword(false);
                      setResetEmail("");
                      setResetSent(false);
                    }}
                  >
                    Cancel
                  </Button>
                  <Button
                    className="flex-1 btn-athletic"
                    onClick={handleForgotPassword}
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      "Send Reset Link"
                    )}
                  </Button>
                </div>
              </div>
            ) : (
              <Button
                className="w-full btn-athletic"
                onClick={() => {
                  setShowForgotPassword(false);
                  setResetEmail("");
                  setResetSent(false);
                }}
              >
                Back to Login
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle className="font-display">Welcome</CardTitle>
            <CardDescription>
              Sign in to manage your games or create an account
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "login" | "signup")}>
              <TabsList className="grid w-full grid-cols-2 mb-6">
                <TabsTrigger value="login">Login</TabsTrigger>
                <TabsTrigger value="signup">Sign Up</TabsTrigger>
              </TabsList>

              <TabsContent value="login">
                <Form {...loginForm}>
                  <form onSubmit={loginForm.handleSubmit(handleLogin)} className="space-y-4">
                    <FormField
                      control={loginForm.control}
                      name="email"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Email</FormLabel>
                          <FormControl>
                            <Input
                              type="email"
                              placeholder="you@example.com"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={loginForm.control}
                      name="password"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Password</FormLabel>
                          <FormControl>
                            <Input
                              type="password"
                              placeholder="••••••••"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <div className="flex justify-end">
                      <button
                        type="button"
                        onClick={() => setShowForgotPassword(true)}
                        className="text-sm text-primary hover:underline"
                      >
                        Forgot password?
                      </button>
                    </div>
                    <Button
                      type="submit"
                      className="w-full btn-athletic"
                      disabled={isSubmitting || isGoogleLoading}
                    >
                      {isSubmitting ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        "Sign In"
                      )}
                    </Button>

                    <div className="relative my-4">
                      <div className="absolute inset-0 flex items-center">
                        <span className="w-full border-t" />
                      </div>
                      <div className="relative flex justify-center text-xs uppercase">
                        <span className="bg-card px-2 text-muted-foreground">
                          Or continue with
                        </span>
                      </div>
                    </div>

                    <Button
                      type="button"
                      variant="outline"
                      className="w-full"
                      onClick={handleGoogleSignIn}
                      disabled={isSubmitting || isGoogleLoading}
                    >
                      {isGoogleLoading ? (
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      ) : (
                        <svg className="h-4 w-4 mr-2" viewBox="0 0 24 24">
                          <path
                            d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                            fill="#4285F4"
                          />
                          <path
                            d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                            fill="#34A853"
                          />
                          <path
                            d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                            fill="#FBBC05"
                          />
                          <path
                            d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                            fill="#EA4335"
                          />
                        </svg>
                      )}
                      Continue with Google
                    </Button>
                  </form>
                </Form>
              </TabsContent>

            <TabsContent value="signup">
              <Form {...signUpForm}>
                <form onSubmit={signUpForm.handleSubmit(handleSignUp)} className="space-y-4">
                  <FormField
                    control={signUpForm.control}
                    name="fullName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Full Name</FormLabel>
                        <FormControl>
                          <Input placeholder="John Doe" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={signUpForm.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email</FormLabel>
                        <FormControl>
                          <Input
                            type="email"
                            placeholder="you@example.com"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  {/* Role Selection */}
                  <FormField
                    control={signUpForm.control}
                    name="role"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>I want to join as</FormLabel>
                        <FormControl>
                          <RadioGroup
                            onValueChange={field.onChange}
                            defaultValue={field.value}
                            className="grid grid-cols-2 gap-3 pt-2"
                          >
                            <label
                              htmlFor="player"
                              className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 cursor-pointer transition-all ${
                                field.value === "player"
                                  ? "border-primary bg-primary/5"
                                  : "border-border hover:border-primary/50"
                              }`}
                            >
                              <RadioGroupItem value="player" id="player" className="sr-only" />
                              <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                                field.value === "player" ? "bg-primary text-primary-foreground" : "bg-muted"
                              }`}>
                                <Users className="h-6 w-6" />
                              </div>
                              <span className="font-semibold text-sm">Player</span>
                              <span className="text-xs text-muted-foreground text-center">
                                Join games & groups
                              </span>
                            </label>
                            <label
                              htmlFor="court_manager"
                              className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 cursor-pointer transition-all ${
                                field.value === "court_manager"
                                  ? "border-primary bg-primary/5"
                                  : "border-border hover:border-primary/50"
                              }`}
                            >
                              <RadioGroupItem value="court_manager" id="court_manager" className="sr-only" />
                              <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                                field.value === "court_manager" ? "bg-primary text-primary-foreground" : "bg-muted"
                              }`}>
                                <Building2 className="h-6 w-6" />
                              </div>
                              <span className="font-semibold text-sm">Court Manager</span>
                              <span className="text-xs text-muted-foreground text-center">
                                Manage venues & courts
                              </span>
                            </label>
                          </RadioGroup>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                    <FormField
                      control={signUpForm.control}
                      name="password"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Password</FormLabel>
                          <FormControl>
                            <Input
                              type="password"
                              placeholder="••••••••"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                          <p className="text-xs text-muted-foreground mt-1">
                            Must be 8+ characters with uppercase, lowercase, number, and special character
                          </p>
                        </FormItem>
                      )}
                    />
                  <FormField
                    control={signUpForm.control}
                    name="confirmPassword"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Confirm Password</FormLabel>
                        <FormControl>
                          <Input
                            type="password"
                            placeholder="••••••••"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <Button
                    type="submit"
                    className="w-full btn-athletic"
                    disabled={isSubmitting || isGoogleLoading}
                  >
                    {isSubmitting ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      "Create Account"
                    )}
                  </Button>

                  <div className="relative my-4">
                    <div className="absolute inset-0 flex items-center">
                      <span className="w-full border-t" />
                    </div>
                    <div className="relative flex justify-center text-xs uppercase">
                      <span className="bg-card px-2 text-muted-foreground">
                        Or continue with
                      </span>
                    </div>
                  </div>

                  <Button
                    type="button"
                    variant="outline"
                    className="w-full"
                    onClick={handleGoogleSignIn}
                    disabled={isSubmitting || isGoogleLoading}
                  >
                    {isGoogleLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <svg className="h-4 w-4 mr-2" viewBox="0 0 24 24">
                        <path
                          d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                          fill="#4285F4"
                        />
                        <path
                          d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                          fill="#34A853"
                        />
                        <path
                          d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                          fill="#FBBC05"
                        />
                        <path
                          d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                          fill="#EA4335"
                        />
                      </svg>
                    )}
                    Continue with Google
                  </Button>
                </form>
              </Form>
            </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      )}
      </div>
    </PublicLayout>
  );
}
