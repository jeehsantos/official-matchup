import { ReactNode, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/auth-context";
import { useUserRole } from "@/hooks/useUserRole";
import { useUserProfile } from "@/hooks/useUserProfile";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, UserCircle, Sparkles } from "lucide-react";
import type { Database } from "@/integrations/supabase/types";

type AppRole = Database["public"]["Enums"]["app_role"];

interface ProtectedRouteProps {
  children: ReactNode;
  requiredRole?: AppRole;
  redirectTo?: string;
  requireCompleteProfile?: boolean;
}

function ProfileCompletionPrompt() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="max-w-md w-full border-primary/20 shadow-lg">
        <CardContent className="pt-8 pb-8 text-center space-y-6">
          <div className="mx-auto h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
            <Sparkles className="h-8 w-8 text-primary" />
          </div>
          <div className="space-y-2">
            <h2 className="text-xl font-display font-semibold">Complete Your Profile</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              For a better, personalized experience, please complete your profile first. 
              This helps us show you only the sports and venues you care about.
            </p>
          </div>
          <div className="space-y-3">
            <Button
              className="w-full gap-2"
              onClick={() => navigate("/profile/edit")}
            >
              <UserCircle className="h-4 w-4" />
              Complete Profile
            </Button>
            <p className="text-xs text-muted-foreground">
              It only takes a minute!
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export function ProtectedRoute({ 
  children, 
  requiredRole, 
  redirectTo = "/auth",
  requireCompleteProfile = false,
}: ProtectedRouteProps) {
  const navigate = useNavigate();
  const { user, isLoading: authLoading } = useAuth();
  const { hasRole, isLoading: roleLoading } = useUserRole();
  const { isComplete, isLoading: profileLoading } = useUserProfile();

  useEffect(() => {
    if (authLoading || roleLoading) return;

    if (!user) {
      navigate(redirectTo);
      return;
    }

    if (requiredRole && !hasRole(requiredRole)) {
      navigate("/games");
    }
  }, [user, authLoading, roleLoading, requiredRole, hasRole, navigate, redirectTo]);

  if (authLoading || roleLoading || (requireCompleteProfile && profileLoading)) {
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

  if (requireCompleteProfile && !isComplete) {
    return <ProfileCompletionPrompt />;
  }

  return <>{children}</>;
}
