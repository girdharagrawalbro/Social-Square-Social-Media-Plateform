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
        if (error.code === 'messaging/registration-token-not-registered') {
            console.warn('[Firebase] Token expired/unregistered. Clearing from DB.');
            try {
                const User = require('../models/User');
                await User.updateOne({ fcmToken: token }, { $unset: { fcmToken: "" } });
            } catch (dbErr) {
                console.error('[Firebase] Failed to clear dead token:', dbErr.message);
            }
        } else {
            console.error('[Firebase] Push Error:', error.message);
        }
        return null;
    }
};

/**
 * Send a push notification to multiple users (max 500) simultaneously
 * @param {Array<String>} tokens - Array of FCM registration tokens
 * @param {Object} payload - Notification data { title, body, data }
 */
const sendMulticast = async (tokens, { title, body, data = {} }) => {
    if (!tokens || !tokens.length) return;

    // FCM Multicast limit is 500 tokens per request
    const validTokens = tokens.filter(t => !!t).slice(0, 500);
    if (!validTokens.length) return;

    const message = {
        notification: { title, body },
        data: {
            ...data,
            click_action: 'FLUTTER_NOTIFICATION_CLICK',
        },
        tokens: validTokens,
        android: {
            priority: 'high',
            notification: { sound: 'default', channel_id: 'default' }
        },
        apns: {
            payload: { aps: { sound: 'default', badge: 1 } }
        }
    };

    try {
        const response = await admin.messaging().sendMulticast(message);
        
        // Handle failed tokens (cleanup dead tokens)
        if (response.failureCount > 0) {
            const failedTokens = [];
            response.responses.forEach((resp, idx) => {
                if (!resp.success && resp.error?.code === 'messaging/registration-token-not-registered') {
                    failedTokens.push(validTokens[idx]);
                }
            });

            if (failedTokens.length > 0) {
                console.warn(`[Firebase] Clearing ${failedTokens.length} dead tokens from DB.`);
                try {
                    const User = require('../models/User');
                    await User.updateMany(
                        { fcmToken: { $in: failedTokens } },
                        { $unset: { fcmToken: "" } }
                    );
                } catch (dbErr) {
                    console.error('[Firebase] Failed to clear dead tokens:', dbErr.message);
                }
            }
        }
        return response;
    } catch (error) {
        console.error('[Firebase] Multicast Push Error:', error.message);
        return null;
    }
};

/**
 * Send a Data-Only push notification specifically for VoIP/Incoming calls
 * @param {String} token - The user's FCM registration token
 * @param {Object} data - Call data (conversationId, callerName, etc)
 */
const sendCallPushNotification = async (token, data = {}) => {
    if (!token) return;

    // Data-only payload (NO notification object)
    const message = {
        data: {
            ...data,
            type: 'call'
        },
        token: token,
        android: {
            priority: 'high'
        },
        apns: {
            payload: {
                aps: {
                    contentAvailable: true // Wakes up iOS background
                }
            }
        }
    };

    try {
        const response = await admin.messaging().send(message);
        return response;
    } catch (error) {
        if (error.code === 'messaging/registration-token-not-registered') {
            console.warn('[Firebase] Call push: Token expired. Clearing from DB.');
            try {
                const User = require('../models/User');
                await User.updateOne({ fcmToken: token }, { $unset: { fcmToken: "" } });
            } catch (dbErr) {
                console.error('[Firebase] Failed to clear dead token:', dbErr.message);
            }
        } else {
            console.error('[Firebase] Call Push Error:', error.message);
        }
        return null;
    }
};

module.exports = {
    admin,
    sendPushNotification,
    sendMulticast,
    sendCallPushNotification
};
