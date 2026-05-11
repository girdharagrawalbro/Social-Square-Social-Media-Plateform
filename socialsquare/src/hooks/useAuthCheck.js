import { useEffect, useState } from 'react';
import { Preferences } from '@capacitor/preferences';
import useAuthStore, { setToken } from '../store/zustand/useAuthStore';
import { Capacitor } from '@capacitor/core';

export const useAuthCheck = () => {
    const [authState, setAuthState] = useState('loading'); // 'loading' | 'authenticated' | 'unauthenticated'
    const setUser = useAuthStore(s => s.setUser);
    const setInitialized = useAuthStore(s => s.setInitialized);
    const initialized = useAuthStore(s => s.initialized);

    useEffect(() => {
        const checkAuth = async () => {
            try {
                // 1. Try Preferences (Fastest on Native)
                if (Capacitor.isNativePlatform()) {
                    const { value } = await Preferences.get({ key: 'user_token' });
                    if (value) {
                        try {
                            const parsed = JSON.parse(value);
                            // Check if token is expired (default 7 days if not set)
                            if (parsed.expiresAt && Date.now() > parsed.expiresAt) {
                                await Preferences.remove({ key: 'user_token' });
                            } else {
                                if (parsed.token) setToken(parsed.token);
                                if (parsed.user) setUser(parsed.user);
                                setAuthState('authenticated');
                                setInitialized(true);
                                return;
                            }
                        } catch (parseErr) {
                            console.error('Failed to parse user_token', parseErr);
                        }
                    }
                }

                // 2. Fallback to HttpOnly Cookie / Refresh Logic (Existing behavior)
                // This ensures we still support web and cookie-based native sessions
                const initAuth = useAuthStore.getState().initAuth;
                await initAuth();

                const user = useAuthStore.getState().user;
                if (user) {
                    setAuthState('authenticated');
                } else {
                    setAuthState('unauthenticated');
                }
            } catch (e) {
                console.error('Auth check error:', e);
                setAuthState('unauthenticated');
                setInitialized(true);
            }
        };

        if (!initialized) {
            checkAuth();
        } else {
            setAuthState(useAuthStore.getState().user ? 'authenticated' : 'unauthenticated');
        }
    }, [initialized, setUser, setInitialized]);

    return authState;
};

export default useAuthCheck;
