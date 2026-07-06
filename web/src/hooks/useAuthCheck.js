import { useEffect, useState } from 'react';
import useAuthStore from '../store/zustand/useAuthStore';

export const useAuthCheck = () => {
    const [authState, setAuthState] = useState('loading'); // 'loading' | 'authenticated' | 'unauthenticated'
    const setUser = useAuthStore(s => s.setUser);
    const setInitialized = useAuthStore(s => s.setInitialized);
    const initialized = useAuthStore(s => s.initialized);

    useEffect(() => {
        const checkAuth = async () => {
            try {
                // 2. HttpOnly Cookie / Refresh Logic
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
