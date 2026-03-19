// Request permission and show push notifications

export async function requestNotificationPermission() {
    if (!('Notification' in window)) return false;
    if (Notification.permission === 'granted') return true;
    if (Notification.permission === 'denied') return false;
    const permission = await Notification.requestPermission();
    return permission === 'granted';
}

export function showPushNotification({ title, body, icon, onClick }) {
    if (!('Notification' in window) || Notification.permission !== 'granted') return;

    const notification = new Notification(title, {
        body,
        icon: icon || '/logo192.png',
        badge: '/logo192.png',
        silent: false,
    });

    if (onClick) notification.onclick = onClick;

    // Auto close after 5 seconds
    setTimeout(() => notification.close(), 5000);
}

export function usePushNotifications() {
    const request = requestNotificationPermission;
    const show = showPushNotification;
    return { request, show, isSupported: 'Notification' in window, permission: Notification.permission };
}