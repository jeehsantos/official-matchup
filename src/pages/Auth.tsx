import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";

const loginSchema = z.object({
  email: z.string().email("Please enter a valid email"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

const signUpSchema = z.object({
  fullName: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Please enter a valid email"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

type LoginFormData = z.infer<typeof loginSchema>;
type SignUpFormData = z.infer<typeof signUpSchema>;

export default function Auth() {
  const [activeTab, setActiveTab] = useState<"login" | "signup">("login");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { user, signIn, signUp, isLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const loginForm = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  const signUpForm = useForm<SignUpFormData>({
    resolver: zodResolver(signUpSchema),
    defaultValues: { fullName: "", email: "", password: "", confirmPassword: "" },
  });

  useEffect(() => {
    if (!isLoading && user) {
      navigate("/", { replace: true });
    }
  }, [user, isLoading, navigate]);

  const handleLogin = async (data: LoginFormData) => {
    setIsSubmitting(true);
    const { error } = await signIn(data.email, data.password);
    setIsSubmitting(false);

    if (error) {
      toast({
        variant: "destructive",
        title: "Login failed",
        description: error.message === "Invalid login credentials"
          ? "Incorrect email or password. Please try again."
          : error.message,
      });
    }
  };

  const handleSignUp = async (data: SignUpFormData) => {
    setIsSubmitting(true);
    const { error } = await signUp(data.email, data.password, data.fullName);
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
      toast({
        title: "Account created!",
        description: "Welcome to NextPlay. Let's get you started.",
      });
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-background">
      {/* Logo */}
      <div className="flex items-center gap-3 mb-8">
        <div className="w-12 h-12 rounded-xl bg-primary flex items-center justify-center">
          <span className="text-primary-foreground font-display font-bold text-xl">N</span>
        </div>
        <div>
          <h1 className="font-display font-bold text-2xl">NextPlay</h1>
          <p className="text-sm text-muted-foreground">No pay = No play</p>
        </div>
      </div>

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
                  <Button
                    type="submit"
                    className="w-full btn-athletic"
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      "Sign In"
                    )}
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
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      "Create Account"
                    )}
                  </Button>
                </form>
              </Form>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}