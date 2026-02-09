import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from "react";
import { User, Session, AuthChangeEvent } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

type AppRole = "court_manager" | "organizer" | "player";

interface AuthContextType {
  user: User | null;
  session: Session | null;
  userRole: AppRole | null;
  isLoading: boolean;
  signUp: (email: string, password: string, fullName: string, role?: AppRole) => Promise<{ error: Error | null }>;
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
    let latestRoleRequest = 0;

    const syncSession = async (currentSession: Session | null) => {
      if (!mounted) return;

      setSession(currentSession);
      setUser(currentSession?.user ?? null);

      if (!currentSession?.user) {
        setUserRole(null);
        setRoleLoaded(true);
        setIsLoading(false);
        return;
      }

      const requestId = ++latestRoleRequest;
      const role = await fetchUserRole(currentSession.user.id);

      if (!mounted || requestId !== latestRoleRequest) return;

      setUserRole(role);
      setRoleLoaded(true);
      setIsLoading(false);
    };

    // Set up auth state listener FIRST — handles INITIAL_SESSION + all subsequent events
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event: AuthChangeEvent, currentSession: Session | null) => {
        await syncSession(currentSession);
      }
    );

    // Explicitly hydrate the initial session to avoid intermittent auth races.
    void supabase.auth.getSession().then(({ data }) => {
      void syncSession(data.session ?? null);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [fetchUserRole]);

  const signUp = async (email: string, password: string, fullName: string, role: AppRole = "player") => {
    const redirectUrl = role === "court_manager" 
      ? `${window.location.origin}/manager`
      : `${window.location.origin}/`;
    
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl,
        data: {
          full_name: fullName,
          role: role,
        },
      },
    });

    // If signup successful and we have a user, create ONLY the selected role
    if (!error && data.user) {
      // First check if role already exists (to avoid duplicates)
      const { data: existingRole } = await supabase
        .from("user_roles")
        .select("id")
        .eq("user_id", data.user.id)
        .eq("role", role)
        .maybeSingle();

      if (!existingRole) {
        const { error: roleError } = await supabase
          .from("user_roles")
          .insert({
            user_id: data.user.id,
            role: role,
          });
        
        if (roleError) {
          console.error("Error creating user role:", roleError);
        } else {
          setUserRole(role);
        }
      } else {
        setUserRole(role);
      }
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
    // Reset state immediately
    setUser(null);
    setSession(null);
    setUserRole(null);
    setRoleLoaded(true);

    // Attempt global sign-out first so refresh tokens are revoked server-side.
    const { error } = await supabase.auth.signOut({ scope: "global" });
    if (error && error.message !== "Auth session missing!") {
      console.error("Global sign out error:", error);
    }

    // Always clear local session tokens.
    await supabase.auth.signOut({ scope: "local" });

    Object.keys(localStorage)
      .filter((key) => key.startsWith("sb-"))
      .forEach((key) => localStorage.removeItem(key));
    Object.keys(sessionStorage)
      .filter((key) => key.startsWith("sb-"))
      .forEach((key) => sessionStorage.removeItem(key));
    localStorage.removeItem("redirectAfterAuth");

    // Hard reload so every in-memory state (React tree, query cache) is wiped
    window.location.replace("/");
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
