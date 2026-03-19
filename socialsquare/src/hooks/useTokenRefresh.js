import { useEffect, useRef } from 'react';
import axios from 'axios';
import { getFingerprint } from '../utils/fingerprint';

const BASE = process.env.REACT_APP_BACKEND_URL;

export default function useTokenRefresh() {
    const intervalRef = useRef(null);

    useEffect(() => {
        const refresh = async () => {
            const token = localStorage.getItem('token');
            if (!token) return;

            try {
                const fingerprint = await getFingerprint();
                const res = await axios.post(
                    `${BASE}/api/auth/refresh`,
                    {},
                    {
                        withCredentials: true,
                        headers: { 'x-fingerprint': fingerprint },
                    }
                );
                localStorage.setItem('token', res.data.token);
            } catch (err) {
                if (err.response?.status === 401 || err.response?.status === 403) {
                    localStorage.removeItem('token');
                    window.location.href = '/login';
                }
            }
        };

        intervalRef.current = setInterval(refresh, 13 * 60 * 1000);
        return () => clearInterval(intervalRef.current);
    }, []);
}