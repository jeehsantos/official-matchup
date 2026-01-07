import { useState, useEffect } from "react";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

type AppRole = Database["public"]["Enums"]["app_role"];

export function useUserRole() {
  const { user, isLoading: authLoading } = useAuth();
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return;
    
    if (!user) {
      setRoles([]);
      setIsLoading(false);
      return;
    }

    fetchRoles();
  }, [user, authLoading]);

  const fetchRoles = async () => {
    if (!user) return;
    
    try {
      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id);

      if (error) throw error;
      
      setRoles(data?.map(r => r.role) || []);
    } catch (error) {
      console.error("Error fetching user roles:", error);
      setRoles([]);
    } finally {
      setIsLoading(false);
    }
  };

  const hasRole = (role: AppRole) => roles.includes(role);
  const isCourtManager = hasRole("court_manager");
  const isOrganizer = hasRole("organizer");
  const isPlayer = hasRole("player");

  const addRole = async (role: AppRole) => {
    if (!user) return { error: new Error("Not authenticated") };

    try {
      const { error } = await supabase
        .from("user_roles")
        .insert({ user_id: user.id, role });

      if (error) throw error;
      
      setRoles(prev => [...prev, role]);
      return { error: null };
    } catch (error) {
      return { error: error as Error };
    }
  };

  return {
    roles,
    isLoading: authLoading || isLoading,
    hasRole,
    isCourtManager,
    isOrganizer,
    isPlayer,
    addRole,
    refetch: fetchRoles,
  };
}
