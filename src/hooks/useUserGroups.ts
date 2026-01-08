import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import type { Database } from "@/integrations/supabase/types";

type Group = Database["public"]["Tables"]["groups"]["Row"];

export function useUserGroups() {
  const { user } = useAuth();
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [isOrganizer, setIsOrganizer] = useState(false);

  useEffect(() => {
    if (user) {
      fetchUserGroups();
    } else {
      setGroups([]);
      setIsOrganizer(false);
      setLoading(false);
    }
  }, [user]);

  const fetchUserGroups = async () => {
    if (!user) return;

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("groups")
        .select("*")
        .eq("organizer_id", user.id)
        .eq("is_active", true);

      if (error) throw error;

      setGroups(data || []);
      setIsOrganizer((data || []).length > 0);
    } catch (error) {
      console.error("Error fetching user groups:", error);
    } finally {
      setLoading(false);
    }
  };

  const refetch = () => {
    fetchUserGroups();
  };

  return { groups, loading, isOrganizer, refetch };
}
