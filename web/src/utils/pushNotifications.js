import { PushNotifications } from '@capacitor/push-notifications';
import { Capacitor } from '@capacitor/core';
import { api } from '../store/zustand/useAuthStore';

export const registerPushNotifications = async () => {
    if (!Capacitor.isNativePlatform()) {
        console.log('[Push] Not a native platform, skipping Capacitor Push registration');
        return;
    }

    let permStatus = await PushNotifications.checkPermissions();

    if (permStatus.receive === 'prompt') {
        permStatus = await PushNotifications.requestPermissions();
    }

    if (permStatus.receive !== 'granted') {
        console.warn('[Push] User denied permissions!');
        return;
    }

    await PushNotifications.register();

    // Listeners
    PushNotifications.addListener('registration', (token) => {
        console.log('[Push] Registration token:', token.value);
        // Send token to backend
        api.post('/api/user/fcm-token', { token: token.value })
            .catch(err => console.error('[Push] Failed to save token to backend:', err.message));
    });

    PushNotifications.addListener('registrationError', (err) => {
        console.error('[Push] Registration error:', err.error);
    });

    PushNotifications.addListener('pushNotificationReceived', (notification) => {
        console.log('[Push] Notification received:', notification);
    });

    PushNotifications.addListener('pushNotificationActionPerformed', (notification) => {
        console.log('[Push] Action performed:', notification.actionId, notification.notification);
        if (notification.notification.data?.postId) {
            window.location.href = `/post/${notification.notification.data.postId}`;
        }
    });
};

export const requestNotificationPermission = async () => {
    if (typeof window === "undefined" || Capacitor.isNativePlatform()) return false;

    if (!("Notification" in window)) {
        console.log("Browser does not support notifications");
        return false;
    }

    if (Notification.permission === "granted") {
        return true;
    }

    if (Notification.permission === "denied") {
        return false;
    }

    const permission = await Notification.requestPermission();

    return permission === "granted";
};


export const showNotification = ({
    title,
    body,
    icon = "/logo.jpg",
    onClick
}) => {

    console.log("here", Notification.permission);
    if (typeof window === "undefined") return;

    if (!("Notification" in window)) return;

    if (Notification.permission !== "granted") return;

    const notification = new Notification(title, {
        body,
        icon,
        badge: icon,
    });

    notification.onclick = (event) => {

        window.focus();

        if (onClick) {
            onClick(event);
        }

        notification.close();
    };

    setTimeout(() => {
        notification.close();
    }, 5000);
};