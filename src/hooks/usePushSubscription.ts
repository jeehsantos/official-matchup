import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

// Module-level flag to prevent duplicate subscriptions across remounts
let pushSubscribed = false;

export function usePushSubscription(userId: string | undefined) {
  useEffect(() => {
    if (!userId || pushSubscribed) return;
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) return;

    // Defer push subscription to avoid blocking initial render
    const timeoutId = setTimeout(() => {
      subscribe(userId);
    }, 5000); // 5s delay — let the app load first

    return () => clearTimeout(timeoutId);
  }, [userId]);
}

async function subscribe(userId: string) {
  if (pushSubscribed) return;

  try {
    const registration = await navigator.serviceWorker.ready;

    // Check if already subscribed — skip VAPID fetch if so
    let subscription = await registration.pushManager.getSubscription();

    if (subscription) {
      // Already subscribed, just ensure DB record exists
      await upsertSubscription(userId, subscription);
      pushSubscribed = true;
      return;
    }

    // Only fetch VAPID key + request permission if not yet subscribed
    const { data: vapidData, error: vapidError } = await supabase.functions.invoke(
      "get-vapid-public-key"
    );
    if (vapidError || !vapidData?.publicKey) return;

    const permission = await Notification.requestPermission();
    if (permission !== "granted") {
      pushSubscribed = true; // Don't retry if denied
      return;
    }

    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidData.publicKey) as BufferSource,
    });

    await upsertSubscription(userId, subscription);
    pushSubscribed = true;
  } catch (err) {
    console.warn("Push subscription failed, falling back to in-app notifications:", err);
    pushSubscribed = true; // Don't retry on error
  }
}

async function upsertSubscription(userId: string, subscription: PushSubscription) {
  const subJson = subscription.toJSON();
  if (!subJson.endpoint || !subJson.keys?.p256dh || !subJson.keys?.auth) return;

  await supabase.from("push_subscriptions").upsert(
    {
      user_id: userId,
      endpoint: subJson.endpoint,
      p256dh: subJson.keys.p256dh,
      auth: subJson.keys.auth,
    },
    { onConflict: "user_id,endpoint" }
  );
}
