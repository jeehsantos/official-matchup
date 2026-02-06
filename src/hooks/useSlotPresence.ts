import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";

interface PresencePayload {
  user_id: string;
  selecting_start: string | null;
  selecting_end: string | null;
  updated_at: string;
}

interface PresenceState {
  [key: string]: PresencePayload;
}

export function useSlotPresence(venueId: string | null, date: string | null) {
  const { user } = useAuth();
  const [otherUsersSelecting, setOtherUsersSelecting] = useState<PresenceState>({});
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  // Track the current user's selection
  const trackSelection = useCallback((startTime: string | null, endTime: string | null) => {
    if (!channelRef.current || !user) return;

    channelRef.current.track({
      user_id: user.id,
      selecting_start: startTime,
      selecting_end: endTime,
      updated_at: new Date().toISOString(),
    });
  }, [user]);

  // Check if a slot has someone else selecting it
  const isSlotBeingSelected = useCallback((slotTime: string): boolean => {
    if (!user) return false;

    return Object.values(otherUsersSelecting).some((presence) => {
      if (presence.user_id === user.id) return false;
      if (!presence.selecting_start || !presence.selecting_end) return false;

      const slotMinutes = timeToMinutes(slotTime);
      const startMinutes = timeToMinutes(presence.selecting_start);
      const endMinutes = timeToMinutes(presence.selecting_end);

      return slotMinutes >= startMinutes && slotMinutes < endMinutes;
    });
  }, [otherUsersSelecting, user]);

  // Setup presence channel
  useEffect(() => {
    if (!venueId || !date) return;

    const channelName = `presence:venue:${venueId}:date:${date}`;
    const channel = supabase.channel(channelName, {
      config: {
        presence: {
          key: user?.id || "anonymous",
        },
      },
    });

    channel
      .on("presence", { event: "sync" }, () => {
        const state = channel.presenceState<PresencePayload>();
        const presenceMap: PresenceState = {};

        Object.entries(state).forEach(([key, presences]) => {
          if (presences.length > 0) {
            presenceMap[key] = presences[0];
          }
        });

        setOtherUsersSelecting(presenceMap);
      })
      .on("presence", { event: "join" }, ({ key, newPresences }) => {
        if (newPresences.length > 0) {
          const presence = newPresences[0] as unknown as PresencePayload;
          setOtherUsersSelecting((prev) => ({
            ...prev,
            [key]: presence,
          }));
        }
      })
      .on("presence", { event: "leave" }, ({ key }) => {
        setOtherUsersSelecting((prev) => {
          const next = { ...prev };
          delete next[key];
          return next;
        });
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED" && user) {
          await channel.track({
            user_id: user.id,
            selecting_start: null,
            selecting_end: null,
            updated_at: new Date().toISOString(),
          });
        }
      });

    channelRef.current = channel;

    return () => {
      channel.unsubscribe();
      channelRef.current = null;
    };
  }, [venueId, date, user?.id]);

  return {
    trackSelection,
    isSlotBeingSelected,
    selectingUsersCount: Object.keys(otherUsersSelecting).length,
  };
}

function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}
