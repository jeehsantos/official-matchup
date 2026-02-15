import { ReactNode, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/auth-context";
import { useUserRole } from "@/hooks/useUserRole";
import { Loader2 } from "lucide-react";
import type { Database } from "@/integrations/supabase/types";

type AppRole = Database["public"]["Enums"]["app_role"];

interface ProtectedRouteProps {
  children: ReactNode;
  requiredRole?: AppRole;
  redirectTo?: string;
}

export function ProtectedRoute({ 
  children, 
  requiredRole, 
  redirectTo = "/auth" 
}: ProtectedRouteProps) {
  const navigate = useNavigate();
  const { user, isLoading: authLoading } = useAuth();
  const { hasRole, isLoading: roleLoading } = useUserRole();

  useEffect(() => {
    if (authLoading || roleLoading) return;

    if (!user) {
      navigate(redirectTo);
      return;
    }

    if (requiredRole && !hasRole(requiredRole)) {
      navigate("/", { replace: true });
    }
  }, [user, authLoading, roleLoading, requiredRole, hasRole, navigate, redirectTo]);

  if (authLoading || roleLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return null;
  }

  if (requiredRole && !hasRole(requiredRole)) {
    return null;
  }

  return <>{children}</>;
}
