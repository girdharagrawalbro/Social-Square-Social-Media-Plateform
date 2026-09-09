/**
 * usePushNotifications
 *
 * Handles the full FCM push notification lifecycle:
 *  1. Requests notification permission on Android 13+
 *  2. Gets the FCM device token and registers it with the backend
 *  3. Creates a high-priority Notifee notification channel for Android
 *  4. Displays foreground notifications via Notifee
 *  5. Handles notification taps (foreground + background + killed)
 *  6. Refreshes the token if FCM rotates it
 */

import { useEffect } from 'react';
import { Platform, PermissionsAndroid } from 'react-native';
import { api } from './api';
import useAuthStore from '../store/zustand/useAuthStore';

// Dynamic requires — these native modules are only available after a full native rebuild.
// If they're missing (e.g. running on old bundle), we fail gracefully instead of crashing.
let messaging: any = null;
let notifee: any = null;
let EventType: any = {};
let AndroidImportance: any = {};
let AndroidVisibility: any = {};

try {
  messaging = require('@react-native-firebase/messaging').default;
} catch { /* native module not linked yet */ }

try {
  const notifeeModule = require('@notifee/react-native');
  notifee = notifeeModule.default;
  EventType = notifeeModule.EventType || {};
  AndroidImportance = notifeeModule.AndroidImportance || {};
  AndroidVisibility = notifeeModule.AndroidVisibility || {};
} catch { /* native module not linked yet */ }

// ─── Channel IDs ────────────────────────────────────────────────────────────
const CHANNEL_DEFAULT = 'social_square_default';
const CHANNEL_CHAT = 'social_square_chat';
const CHANNEL_CALLS = 'social_square_calls';

// ─── Create Android notification channels ───────────────────────────────────
async function createChannels() {
  if (Platform.OS !== 'android') return;

  await notifee.createChannel({
    id: CHANNEL_DEFAULT,
    name: 'General',
    importance: AndroidImportance.HIGH,
    visibility: AndroidVisibility.PUBLIC,
    sound: 'default',
    vibration: true,
  });

  await notifee.createChannel({
    id: CHANNEL_CHAT,
    name: 'Messages',
    importance: AndroidImportance.HIGH,
    visibility: AndroidVisibility.PRIVATE, // hide content on lock screen
    sound: 'default',
    vibration: true,
  });

  await notifee.createChannel({
    id: CHANNEL_CALLS,
    name: 'Calls',
    importance: AndroidImportance.HIGH,
    visibility: AndroidVisibility.PUBLIC,
    sound: 'default',
    vibration: true,
  });
}

// ─── Display a local notification via Notifee ───────────────────────────────
async function displayNotification(remoteMessage: FirebaseMessagingTypes.RemoteMessage) {
  const { notification, data } = remoteMessage;
  if (!notification?.title && !notification?.body) return;

  const type = (data?.type as string) || 'general';
  const channelId = type === 'message' ? CHANNEL_CHAT : type === 'call' ? CHANNEL_CALLS : CHANNEL_DEFAULT;

  await notifee.displayNotification({
    title: notification?.title || 'Social Square',
    body: notification?.body || '',
    data: data as Record<string, string>,
    android: {
      channelId,
      smallIcon: 'ic_notification', // must exist in android/app/src/main/res/drawable/
      pressAction: { id: 'default' },
      importance: AndroidImportance.HIGH,
      sound: 'default',
    },
  });
}

// ─── Register FCM token with backend ────────────────────────────────────────
async function registerToken(token: string) {
  try {
    await api.post('/api/user/fcm-token', { token });
    console.log('[Push] FCM token registered');
  } catch (e) {
    console.warn('[Push] Failed to register token:', e);
  }
}

// ─── Background / Quit state message handler (registered at module level) ───
if (messaging) {
  try {
    messaging().setBackgroundMessageHandler(async (remoteMessage: any) => {
      console.log('[Push] Background message:', remoteMessage.messageId);
      await displayNotification(remoteMessage);
    });
  } catch { /* not ready */ }
}

// ─── Hook ────────────────────────────────────────────────────────────────────
export function usePushNotifications(navigation: any) {
  const user = useAuthStore((s) => s.user);

  useEffect(() => {
    if (!user) return; // Only run when logged in

    let unsubscribeOnMessage: (() => void) | undefined;
    let unsubscribeTokenRefresh: (() => void) | undefined;
    let unsubscribeNotifee: (() => void) | undefined;

    async function setup() {
      // Bail out if native modules aren't linked yet (requires full native rebuild)
      if (!messaging || !notifee) {
        console.warn('[Push] Firebase/Notifee native modules not ready. Run a native rebuild.');
        return;
      }
      // 1. Create channels
      await createChannels();

      // 2. Request permission
      if (Platform.OS === 'android') {
        if (Platform.Version >= 33) {
          await PermissionsAndroid.request(
            PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS
          );
        }
      } else {
        const authStatus = await messaging().requestPermission();
        const enabled =
          authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
          authStatus === messaging.AuthorizationStatus.PROVISIONAL;
        if (!enabled) return;
      }

      // 3. Get and register FCM token
      try {
        const token = await messaging().getToken();
        if (token) await registerToken(token);
      } catch (e) {
        console.warn('[Push] Could not get FCM token:', e);
      }

      // 4. Listen for token refresh
      unsubscribeTokenRefresh = messaging().onTokenRefresh(async (newToken) => {
        await registerToken(newToken);
      });

      // 5. Foreground messages → show via Notifee
      unsubscribeOnMessage = messaging().onMessage(async (remoteMessage) => {
        console.log('[Push] Foreground message:', remoteMessage.messageId);
        await displayNotification(remoteMessage);
      });

      // 6. Notifee foreground event — handle tap
      unsubscribeNotifee = notifee.onForegroundEvent(({ type, detail }) => {
        if (type === EventType.PRESS) {
          handleNotificationTap(detail.notification?.data, navigation);
        }
      });

      // 7. App opened from a background notification tap
      messaging().onNotificationOpenedApp((remoteMessage) => {
        handleNotificationTap(remoteMessage.data, navigation);
      });

      // 8. App opened from a killed state notification tap
      messaging().getInitialNotification().then((remoteMessage) => {
        if (remoteMessage) {
          handleNotificationTap(remoteMessage.data, navigation);
        }
      });
    }

    setup();

    return () => {
      unsubscribeOnMessage?.();
      unsubscribeTokenRefresh?.();
      unsubscribeNotifee?.();
    };
  }, [user]);
}

// ─── Navigate based on notification type ─────────────────────────────────────
function handleNotificationTap(data: Record<string, any> | undefined, navigation: any) {
  if (!data || !navigation) return;

  const { type, postId, conversationId } = data;

  try {
    switch (type) {
      case 'message':
        if (conversationId) {
          navigation.navigate('ChatPane', { conversationId });
        } else {
          navigation.navigate('SocialSquare');
        }
        break;
      case 'like':
      case 'comment':
      case 'mention':
        if (postId) {
          navigation.navigate('PostDetail', { postId });
        }
        break;
      case 'follow':
      case 'follow_request':
        navigation.navigate('Notifications');
        break;
      default:
        navigation.navigate('Notifications');
    }
  } catch (e) {
    console.warn('[Push] Navigation error:', e);
  }
}
