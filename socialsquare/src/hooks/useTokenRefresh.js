import { refreshAccessToken } from '../store/zustand/useAuthStore';
import { useRef, useEffect } from 'react';


const BASE = process.env.REACT_APP_BACKEND_URL;

// Refresh access token 2 minutes before it expires (token is 15min)
// So refresh fires every 13 minutes
const REFRESH_INTERVAL = 13 * 60 * 1000;

export default function useTokenRefresh() {
    const intervalRef = useRef(null);

    useEffect(() => {
        const refresh = async () => {
            try {
                // refreshAccessToken handles the guard and the queue
                await refreshAccessToken();
            } catch (err) {
                // 401/403 means refresh token expired — stop interval
                if (err.response?.status === 401 || err.response?.status === 403) {
                    clearInterval(intervalRef.current);
                }
            }
        };

        // Start proactive refresh interval
        intervalRef.current = setInterval(refresh, REFRESH_INTERVAL);
        return () => clearInterval(intervalRef.current);
    }, []);
}