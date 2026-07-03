/**
 * broadcast.js
 *
 * Unified broadcast channel for Social Square web.
 *
 * Uses the native browser BroadcastChannel API so events cross tabs.
 * Also provides an in-tab pub/sub layer (via EventTarget) so components
 * within the same tab can subscribe without serialising through the
 * BroadcastChannel message loop.
 *
 * Message types (same shape as the React Native counterpart):
 *
 *   LOGOUT                 — { type: "LOGOUT" }
 *   THEME_CHANGED          — { type: "THEME_CHANGED", isDark: boolean }
 *   PROFILE_UPDATED        — { type: "PROFILE_UPDATED", user: object }
 *   SESSION_EXPIRED        — { type: "SESSION_EXPIRED", reason: string }
 *   TOKEN_REFRESHED        — { type: "TOKEN_REFRESHED", token: string }
 *   NOTIFICATION_RECEIVED  — { type: "NOTIFICATION_RECEIVED", notification: object }
 *   NOTIFICATION_MARK_READ — { type: "NOTIFICATION_MARK_READ", ids: string[] }
 *   MESSAGE_MARK_READ      — { type: "MESSAGE_MARK_READ", chatId: string, messageIds: string[] }
 *   DRAFT_SYNC             — { type: "DRAFT_SYNC", draftId: string, content: string, updatedAt: number }
 *   STORY_CREATED          — { type: "STORY_CREATED", story: object }
 *   STORY_DELETED          — { type: "STORY_DELETED", storyId: string }
 *   POST_CREATED           — { type: "POST_CREATED", post: object }
 *   POST_DELETED           — { type: "POST_DELETED", postId: string }
 *   POST_LIKE_COUNT        — { type: "POST_LIKE_COUNT", postId: string, count: number, liked: boolean }
 *   USER_FOLLOW            — { type: "USER_FOLLOW", targetUserId: string, isFollowing: boolean }
 *   USER_BLOCK             — { type: "USER_BLOCK", targetUserId: string }
 *   UPLOAD_PROGRESS        — { type: "UPLOAD_PROGRESS", uploadId: string, progress: number, status: "uploading"|"done"|"error" }
 *   CACHE_INVALIDATE       — { type: "CACHE_INVALIDATE", keys: string[] }
 */

// ─── In-tab EventTarget bus ────────────────────────────────────────────────────
// We use a plain EventTarget so we can subscribe with addEventListener.
const _bus = new EventTarget();

// ─── Native BroadcastChannel (cross-tab) ──────────────────────────────────────
const _channel = new BroadcastChannel('social-square');

// When another tab posts a message, re-fire it on the in-tab bus too.
_channel.addEventListener('message', (e) => {
    const event = new CustomEvent(e.data.type, { detail: e.data });
    _bus.dispatchEvent(event);
});

/**
 * Post a message — fires to:
 *   1. All in-tab subscribers (same tab, immediate)
 *   2. All other tabs via BroadcastChannel
 */
function postMessage(payload) {
    // In-tab dispatch
    const event = new CustomEvent(payload.type, { detail: payload });
    _bus.dispatchEvent(event);
    // Cross-tab dispatch
    try {
        _channel.postMessage(payload);
    } catch (e) {
        // Channel may be closed during teardown
    }
}

/**
 * Subscribe to a broadcast event type.
 * @param {string} type  — event type e.g. 'LOGOUT'
 * @param {function} handler — receives the full payload object
 * @returns {function} unsubscribe
 */
function on(type, handler) {
    const listener = (e) => handler(e.detail);
    _bus.addEventListener(type, listener);
    return () => _bus.removeEventListener(type, listener);
}

/**
 * Unsubscribe a specific handler.
 */
function off(type, handler) {
    _bus.removeEventListener(type, handler);
}

// ─── Exported singleton ────────────────────────────────────────────────────────
// `appChannel.postMessage(...)` — preserves backward compat with existing code
// `appChannel.on(type, handler)` — new typed helper
export const appChannel = {
    postMessage,
    on,
    off,
    /** @deprecated Use on() instead — kept for backward compatibility */
    set onmessage(handler) {
        if (handler) {
            _channel.onmessage = (e) => handler(e);
        } else {
            _channel.onmessage = null;
        }
    },
    get onmessage() {
        return _channel.onmessage;
    },
};