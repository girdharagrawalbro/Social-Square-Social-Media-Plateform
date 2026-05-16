const admin = require('firebase-admin');

// Initialize Firebase Admin SDK only once
if (!admin.apps.length) {
    try {
        // Option 1: Use service account file if it exists
        // const serviceAccount = require('../firebase-service-account.json');
        // admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
        
        // Option 2: Fallback to environment variables or default credentials
        // For Google Cloud/Render/Heroku deployments, this is often preferred
        admin.initializeApp({
            projectId: process.env.FIREBASE_PROJECT_ID || 'social-square-official'
        });
        
        console.log('[Firebase] Admin SDK Initialized');
    } catch (error) {
        console.error('[Firebase] Initialization Error:', error.message);
    }
}

/**
 * Send a push notification to a specific user via their FCM token
 * @param {String} token - The user's FCM registration token
 * @param {Object} payload - Notification data { title, body, data }
 */
const sendPushNotification = async (token, { title, body, data = {} }) => {
    if (!token) return;

    const message = {
        notification: { title, body },
        data: {
            ...data,
            click_action: 'FLUTTER_NOTIFICATION_CLICK', // Legacy support
        },
        token: token,
        // Capacitor/Mobile specific configurations
        android: {
            priority: 'high',
            notification: {
                sound: 'default',
                channel_id: 'default'
            }
        },
        apns: {
            payload: {
                aps: {
                    sound: 'default',
                    badge: 1
                }
            }
        }
    };

    try {
        const response = await admin.messaging().send(message);
        return response;
    } catch (error) {
        // If the token is invalid/expired, we should ideally remove it from the DB
        if (error.code === 'messaging/registration-token-not-registered') {
            console.warn('[Firebase] Token expired/unregistered. Should be cleared from DB.');
        } else {
            console.error('[Firebase] Push Error:', error.message);
        }
        return null;
    }
};

module.exports = {
    admin,
    sendPushNotification
};
