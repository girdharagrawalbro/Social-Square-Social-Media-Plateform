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
async function displayNotification(remoteMessage: any) {
  const { notification, data } = remoteMessage;
  const type = (data?.type as string) || 'general';
  
  // Data-only Incoming Call payload handling
  if (type === 'call') {
    const callerName = data?.callerName || 'Someone';
    const isVideo = data?.callType === 'video';
    
    await notifee.displayNotification({
      id: 'incoming_call',
      title: `Incoming ${isVideo ? 'Video ' : ''}Call`,
      body: `${callerName} is calling you`,
      data: data as Record<string, string>,
      android: {
        channelId: CHANNEL_CALLS,
        smallIcon: 'ic_notification',
        category: 'call',
        ongoing: true,
        autoCancel: false,
        importance: AndroidImportance.HIGH,
        sound: 'default', // Ideally you would use a custom ringtone here
        // The full-screen action tells Android to wake up the screen and show this app
        fullScreenAction: {
          id: 'default',
        },
        actions: [
          {
            title: 'Reject',
            pressAction: { id: 'reject_call' },
          },
          {
            title: 'Answer',
            pressAction: { id: 'answer_call', launchActivity: 'default' },
          }
        ],
      },
    });
    return;
  }

  // Standard notification handling
  if (!notification?.title && !notification?.body) return;

  const channelId = type === 'message' ? CHANNEL_CHAT : CHANNEL_DEFAULT;

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

// Handle Background Actions (e.g. Answer/Reject when app is killed)
if (notifee) {
  notifee.onBackgroundEvent(async ({ type, detail }: any) => {
    if (type === EventType.ACTION_PRESS && detail.pressAction?.id === 'reject_call') {
      await notifee.cancelNotification(detail.notification?.id || 'incoming_call');
      // If we had a direct socket connection in background we could emit 'callDeclined',
      // but in a killed state we might need an API call. For now, just cancel.
    }
  });
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
      if (!messaging) {
        console.warn('[Push] ❌ Firebase messaging native module not linked. Run: cd android && ./gradlew clean, then rebuild.');
        return;
      }
      if (!notifee) {
        console.warn('[Push] ❌ Notifee native module not linked. Run: cd android && ./gradlew clean, then rebuild.');
        return;
      }

      console.log('[Push] ✅ Native modules loaded. Setting up push notifications...');

      // 1. Create channels
      await createChannels();
      console.log('[Push] ✅ Notification channels created.');

      // 2. Request permission
      if (Platform.OS === 'android') {
        if (Platform.Version >= 33) {
          const result = await PermissionsAndroid.request(
            PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS
          );
          console.log('[Push] Android notification permission result:', result);
          if (result !== PermissionsAndroid.RESULTS.GRANTED) {
            console.warn('[Push] ⚠️ POST_NOTIFICATIONS permission denied. FCM token will NOT be registered.');
            return;
          }
        }
        // Android < 33 doesn't need runtime permission
      } else {
        const authStatus = await messaging().requestPermission();
        const enabled =
          authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
          authStatus === messaging.AuthorizationStatus.PROVISIONAL;
        if (!enabled) {
          console.warn('[Push] ⚠️ iOS notification permission denied. FCM token will NOT be registered.');
          return;
        }
      }

      // 3. Get and register FCM token
      try {
        console.log('[Push] Getting FCM token...');
        const token = await messaging().getToken();
        if (token) {
          console.log('[Push] ✅ FCM token obtained:', token.substring(0, 20) + '...');
          await registerToken(token);
        } else {
          console.warn('[Push] ⚠️ messaging().getToken() returned empty token.');
        }
      } catch (e) {
        console.warn('[Push] ❌ Could not get FCM token:', e);
      }

      // 4. Listen for token refresh
      unsubscribeTokenRefresh = messaging().onTokenRefresh(async (newToken) => {
        console.log('[Push] FCM token refreshed, re-registering...');
        await registerToken(newToken);
      });

      // 5. Foreground messages → show via Notifee
      unsubscribeOnMessage = messaging().onMessage(async (remoteMessage) => {
        console.log('[Push] Foreground message:', remoteMessage.messageId);
        await displayNotification(remoteMessage);
      });

      // 6. Notifee foreground event — handle tap
      unsubscribeNotifee = notifee.onForegroundEvent(({ type, detail }: any) => {
        if (type === EventType.PRESS || type === EventType.ACTION_PRESS) {
          if (detail.pressAction?.id === 'reject_call') {
            notifee.cancelNotification(detail.notification?.id || 'incoming_call');
            // Logic to emit socket decline could go here
            return;
          }
          if (detail.pressAction?.id === 'answer_call' || detail.pressAction?.id === 'default') {
            notifee.cancelNotification('incoming_call');
            handleNotificationTap(detail.notification?.data, navigation);
          }
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

      console.log('[Push] ✅ Push notification setup complete.');
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

  const { type, postId, conversationId, callerId, callerName, callerAvatar, callType } = data;

  try {
    switch (type) {
      case 'call':
        navigation.navigate('Call', {
          conversationId,
          recipientId: callerId,
          recipientName: callerName,
          recipientAvatar: callerAvatar,
          callType: callType || 'video',
          isIncoming: true,
        });
        break;
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
