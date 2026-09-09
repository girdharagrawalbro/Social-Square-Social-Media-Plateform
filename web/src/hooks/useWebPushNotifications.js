/**
 * useWebPushNotifications
 *
 * Subscribes the browser to Web Push notifications using the VAPID API.
 * Works when the site is:
 *  - Open and focused
 *  - Open but in a background tab
 *  - Minimized
 *  - Fully closed (site not open at all)
 *
 * Call this hook once after the user logs in.
 */

import { useEffect } from 'react';
import API from '../api';

// Convert VAPID base64 public key to Uint8Array (required by browser Push API)
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)));
}

async function subscribeUserToPush() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    console.warn('[WebPush] Not supported in this browser');
    return;
  }

  // Request notification permission
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') {
    console.warn('[WebPush] Notification permission denied');
    return;
  }

  // Get the VAPID public key from the server
  const { data } = await API.get('/api/user/vapid-public-key');
  if (!data.publicKey) {
    console.warn('[WebPush] No VAPID public key from server');
    return;
  }

  // Wait for service worker
  const registration = await navigator.serviceWorker.ready;

  // Check if already subscribed
  let subscription = await registration.pushManager.getSubscription();

  if (!subscription) {
    // Subscribe with VAPID key
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(data.publicKey),
    });
  }

  // Register subscription with backend
  await API.post('/api/user/web-push-subscription', { subscription });
  console.log('[WebPush] Subscribed and registered with server');
}

export function useWebPushNotifications(user) {
  useEffect(() => {
    if (!user) return;

    // Small delay so the service worker is ready after page load
    const timer = setTimeout(() => {
      subscribeUserToPush().catch((err) => {
        console.warn('[WebPush] Setup failed:', err);
      });
    }, 2000);

    return () => clearTimeout(timer);
  }, [user?._id]);
}
