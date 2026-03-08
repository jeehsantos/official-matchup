import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from "react";
import { User, Session, AuthChangeEvent } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

type AppRole = "court_manager" | "organizer" | "player" | "admin" | "venue_staff";

interface AuthContextType {
  user: User | null;
  session: Session | null;
  userRole: AppRole | null;
  isLoading: boolean;
  isSigningOut: boolean;
  signUp: (email: string, password: string, fullName: string, role?: AppRole, referralCode?: string) => Promise<{ error: Error | null }>;
  signIn: (email: string, password: string) => Promise<{ error: Error | null; role?: AppRole }>;
  signOut: () => Promise<void>;
  refreshRole: () => Promise<void>;
  resetPassword: (email: string) => Promise<{ error: Error | null }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [userRole, setUserRole] = useState<AppRole | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [roleLoaded, setRoleLoaded] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);

  const fetchUserRole = useCallback(async (userId: string): Promise<AppRole | null> => {
    try {
      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId)
        .limit(1)
        .maybeSingle();

      if (error) {
        console.error("Error fetching user role:", error);
        return null;
      }

      return (data?.role as AppRole) || null;
    } catch (error) {
      console.error("Error fetching user role:", error);
      return null;
    }
  }, []);

  const refreshRole = useCallback(async () => {
    if (user) {
      const role = await fetchUserRole(user.id);
      setUserRole(role);
    }
  }, [user, fetchUserRole]);

  useEffect(() => {
    let mounted = true;

    // Set up auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event: AuthChangeEvent, currentSession: Session | null) => {
        if (!mounted) return;
        
        setSession(currentSession);
        setUser(currentSession?.user ?? null);
        
        if (currentSession?.user) {
          // Use setTimeout to avoid potential race conditions with Supabase
          setTimeout(async () => {
            if (!mounted) return;
            const role = await fetchUserRole(currentSession.user.id);
            if (mounted) {
              setUserRole(role);
              setRoleLoaded(true);
              setIsLoading(false);
            }
          }, 0);
        } else {
          setUserRole(null);
          setRoleLoaded(true);
          setIsLoading(false);
        }
      }
    );

    // Check for existing session
    supabase.auth.getSession().then(async ({ data: { session: existingSession } }) => {
      if (!mounted) return;
      
      setSession(existingSession);
      setUser(existingSession?.user ?? null);
      
      if (existingSession?.user) {
        const role = await fetchUserRole(existingSession.user.id);
        if (mounted) {
          setUserRole(role);
          setRoleLoaded(true);
          setIsLoading(false);
        }
      } else {
        setRoleLoaded(true);
        setIsLoading(false);
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [fetchUserRole]);

  const signUp = async (email: string, password: string, fullName: string, role: AppRole = "player", referralCode?: string) => {
    const redirectUrl = role === "court_manager" 
      ? `${window.location.origin}/manager`
      : `${window.location.origin}/`;
    
    const metadata: Record<string, string> = {
      full_name: fullName,
      role: role,
    };
    if (referralCode) {
      metadata.referral_code = referralCode;
    }

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl,
        data: metadata,
      },
    });

    // handle_new_user trigger creates profile + role automatically
    if (!error && data.user) {
      // Set the role locally for immediate UI use
      setUserRole(role);
    }

    return { error: error as Error | null };
  };

  const signIn = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    let role: AppRole | undefined;
    
    if (!error && data.user) {
      role = await fetchUserRole(data.user.id) || undefined;
      setUserRole(role || null);
    }

    return { error: error as Error | null, role };
  };

  const signOut = async () => {
    setIsSigningOut(true);

    // Always clear local session, even if server session is already invalid/expired.
    await new Promise(resolve => setTimeout(resolve, 200));

    const { error: globalError } = await supabase.auth.signOut({ scope: "global" });
    if (globalError) {
      console.warn("Global sign out failed, clearing local session:", globalError.message);
    }

    const { error: localError } = await supabase.auth.signOut({ scope: "local" });
    if (localError) {
      console.warn("Local sign out warning:", localError.message);
    }

    setUser(null);
    setSession(null);
    setUserRole(null);
    setRoleLoaded(true);

    window.location.href = "/auth";
  };

  const resetPassword = async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth`,
    });
    return { error: error as Error | null };
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        userRole,
        isLoading: isLoading || !roleLoaded,
        isSigningOut,
        signUp,
        signIn,
        signOut,
        refreshRole,
        resetPassword,
      }}
    >
      {isSigningOut && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-background/80 backdrop-blur-sm animate-fade-in">
          <div className="flex flex-col items-center gap-3">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            <p className="text-sm font-medium text-muted-foreground">Signing out…</p>
          </div>
        </div>
      )}
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
