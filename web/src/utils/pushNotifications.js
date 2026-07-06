
export const registerPushNotifications = async () => {
    console.log('[Push] Non-native platform: skipping native push registration');
    return;
};

export const requestNotificationPermission = async () => {
    if (typeof window === "undefined") return false;

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