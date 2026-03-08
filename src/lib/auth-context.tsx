import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from "react";
import { User, Session, AuthChangeEvent } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

type AppRole = "court_manager" | "organizer" | "player" | "admin" | "venue_staff";

interface AuthContextType {
  user: User | null;
  session: Session | null;
  userRole: AppRole | null;
  isLoading: boolean;
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
    setUser(null);
    setSession(null);
    setUserRole(null);
    await supabase.auth.signOut({ scope: "local" });
    window.location.replace("/auth");
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
        signUp,
        signIn,
        signOut,
        refreshRole,
        resetPassword,
      }}
    >
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
