/**
 * useBroadcast.js
 *
 * React hook for subscribing to a broadcast channel event.
 * Automatically unsubscribes on component unmount.
 *
 * Usage:
 *   useBroadcast('LOGOUT', () => navigate('/login'));
 *   useBroadcast('POST_LIKE_COUNT', ({ postId, count }) => updateCount(postId, count));
 *   useBroadcast('PROFILE_UPDATED', ({ user }) => setProfile(user));
 */

import { useEffect } from 'react';
import { appChannel } from '../utils/broadcast';

/**
 * @param {string} type - Broadcast event type (e.g. 'LOGOUT', 'POST_CREATED')
 * @param {function} handler - Called with the event payload when fired
 */
export function useBroadcast(type, handler) {
    useEffect(() => {
        const unsubscribe = appChannel.on(type, handler);
        return unsubscribe;
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [type]);
}

export default useBroadcast;
