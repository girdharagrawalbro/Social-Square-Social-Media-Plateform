import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../store/zustand/useAuthStore';

const BASE = import.meta.env.REACT_APP_NGINIX === "true" ? "" : import.meta.env.REACT_APP_BACKEND_URL;

export const privacyKeys = {
    settings: (userId) => ['privacy', 'settings', userId],
};

export function usePrivacySettings(userId) {
    const qc = useQueryClient();

    const query = useQuery({
        queryKey: privacyKeys.settings(userId),
        queryFn: async () => {
            const res = await api.get(`${BASE}/api/auth/privacy-settings`);
            return res.data;
        },
        enabled: !!userId,
        staleTime: 1000 * 60 * 10,
    });

    const updateSettings = useMutation({
        mutationFn: (settings) => api.patch(`${BASE}/api/auth/privacy-settings`, settings),
        onSuccess: (res) => {
            qc.setQueryData(privacyKeys.settings(userId), res.data);
        },
    });

    return { ...query, updateSettings };
}
