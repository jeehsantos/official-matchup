import { useEffect, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

export type Notification = Tables<"notifications">;

async function fetchNotifications(userId: string): Promise<Notification[]> {
  const { data, error } = await supabase
    .from("notifications")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(30);

  if (error) throw error;
  return data || [];
}

export function useNotifications(userId: string | undefined, enabled = true) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["notifications", userId],
    queryFn: () => fetchNotifications(userId!),
    enabled: !!userId && enabled,
    staleTime: 1000 * 60 * 2, // 2 min cache
    refetchOnWindowFocus: false,
  });

  // Realtime subscription — only when enabled (dropdown open or unread badge needed)
  useEffect(() => {
    if (!userId) return;

    const channel = supabase
      .channel(`notifications-${userId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${userId}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ["notifications", userId] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, queryClient]);

  const unreadCount = (query.data || []).filter((n) => !n.is_read).length;

  const markAsRead = useCallback(async (notificationId: string) => {
    await supabase
      .from("notifications")
      .update({ is_read: true })
      .eq("id", notificationId);
    queryClient.invalidateQueries({ queryKey: ["notifications", userId] });
  }, [userId, queryClient]);

  const markAllAsRead = useCallback(async () => {
    if (!userId) return;
    await supabase
      .from("notifications")
      .update({ is_read: true })
      .eq("user_id", userId)
      .eq("is_read", false);
    queryClient.invalidateQueries({ queryKey: ["notifications", userId] });
  }, [userId, queryClient]);

  return {
    ...query,
    unreadCount,
    markAsRead,
    markAllAsRead,
  };
}
