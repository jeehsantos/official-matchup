import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";

export interface LobbyChatMessage {
  id: string;
  challenge_id: string;
  sender_id: string;
  content: string;
  message_type: "system" | "user";
  created_at: string;
  sender_name?: string;
  sender_avatar_url?: string;
}

export function useLobbyChatMessages(challengeId: string | undefined) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [isSubscribed, setIsSubscribed] = useState(false);

  // Fetch messages for the challenge
  const query = useQuery({
    queryKey: ["lobby-chat-messages", challengeId],
    queryFn: async () => {
      if (!challengeId) return [];

      const { data, error } = await supabase
        .from("quick_challenge_messages")
        .select("*")
        .eq("challenge_id", challengeId)
        .order("created_at", { ascending: true });

      if (error) throw error;

      // Fetch sender profiles
      const senderIds = [...new Set(data.map((m) => m.sender_id))];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, full_name, avatar_url")
        .in("user_id", senderIds);

      const profileMap = new Map(
        profiles?.map((p) => [p.user_id, p]) || []
      );

      // Attach sender info to messages
      return data.map((msg) => ({
        ...msg,
        message_type: msg.message_type as "system" | "user",
        sender_name: profileMap.get(msg.sender_id)?.full_name || "Player",
        sender_avatar_url: profileMap.get(msg.sender_id)?.avatar_url,
      })) as LobbyChatMessage[];
    },
    enabled: !!challengeId,
  });

  // Real-time subscription for new messages
  useEffect(() => {
    if (!challengeId) return;

    const channel = supabase
      .channel(`lobby-chat-${challengeId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "quick_challenge_messages",
          filter: `challenge_id=eq.${challengeId}`,
        },
        async (payload) => {
          // Fetch sender profile for the new message
          const { data: profile } = await supabase
            .from("profiles")
            .select("user_id, full_name, avatar_url")
            .eq("user_id", payload.new.sender_id)
            .single();

          const newMessage: LobbyChatMessage = {
            ...(payload.new as any),
            message_type: payload.new.message_type as "system" | "user",
            sender_name: profile?.full_name || "Player",
            sender_avatar_url: profile?.avatar_url,
          };

          // Optimistically add the message to the cache
          queryClient.setQueryData<LobbyChatMessage[]>(
            ["lobby-chat-messages", challengeId],
            (old) => {
              if (!old) return [newMessage];
              // Avoid duplicates
              if (old.some((m) => m.id === newMessage.id)) return old;
              return [...old, newMessage];
            }
          );
        }
      )
      .on(
        "postgres_changes",
        {
          event: "DELETE",
          schema: "public",
          table: "quick_challenge_messages",
          filter: `challenge_id=eq.${challengeId}`,
        },
        () => {
          // Refetch on delete (cleanup)
          queryClient.invalidateQueries({
            queryKey: ["lobby-chat-messages", challengeId],
          });
        }
      )
      .subscribe((status) => {
        setIsSubscribed(status === "SUBSCRIBED");
      });

    return () => {
      supabase.removeChannel(channel);
      setIsSubscribed(false);
    };
  }, [challengeId, queryClient]);

  // Send a user message
  const sendMessage = useMutation({
    mutationFn: async (content: string) => {
      if (!user || !challengeId) throw new Error("Not authenticated");

      const { data, error } = await supabase
        .from("quick_challenge_messages")
        .insert({
          challenge_id: challengeId,
          sender_id: user.id,
          content,
          message_type: "user",
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
  });

  // Send a system message (e.g., "Player joined")
  const sendSystemMessage = useMutation({
    mutationFn: async (content: string) => {
      if (!user || !challengeId) throw new Error("Not authenticated");

      const { data, error } = await supabase
        .from("quick_challenge_messages")
        .insert({
          challenge_id: challengeId,
          sender_id: user.id,
          content,
          message_type: "system",
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
  });

  return {
    messages: query.data || [],
    isLoading: query.isLoading,
    sendMessage: sendMessage.mutate,
    sendSystemMessage: sendSystemMessage.mutate,
    isSending: sendMessage.isPending,
  };
}
