import { useInfiniteQuery, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../store/zustand/useAuthStore';
import dbService from '../../utils/indexedDb';

const BASE = process.env.REACT_APP_NGINIX === "true" ? "" : process.env.REACT_APP_BACKEND_URL;

// ─── QUERY KEYS ───────────────────────────────────────────────────────────────
export const exploreKeys = {
    confessions: ['posts', 'confessions'],
    trending: ['posts', 'trending'],
    search: (query) => ['search', query],
    reels: ['posts', 'reels'],
};

// ─── EXPLORE REELS (Infinite Scroll) ──────────────────────────────────────────
export function useExploreReels() {
    const queryClient = useQueryClient();
    return useInfiniteQuery({
        queryKey: exploreKeys.reels,
        queryFn: async ({ pageParam = null }) => {
            const cacheKey = 'explore_reels';
            const params = new URLSearchParams();
            if (pageParam) params.append('cursor', pageParam);
            
            const fetchPromise = api.get(`${BASE}/api/post/explore-reels?${params}`).then(async (res) => {
                if (!pageParam && res.data) {
                    await dbService.setCache(cacheKey, res.data);
                }
                return res.data;
            });

            if (!pageParam) {
                const cached = await dbService.getCache(cacheKey);
                if (cached) {
                    fetchPromise.then(freshData => {
                        queryClient.setQueryData(exploreKeys.reels, (old) => {
                            if (!old) return { pages: [freshData], pageParams: [null] };
                            return {
                                ...old,
                                pages: old.pages.map((page, idx) => idx === 0 ? freshData : page)
                            };
                        });
                    }).catch(err => console.error("Background explore reels fetch failed:", err));
                    return cached;
                }
            }

            return fetchPromise;
        },
        getNextPageParam: (lastPage) => lastPage.hasMore ? lastPage.nextCursor : undefined,
        staleTime: 1000 * 60 * 5,
    });
}

// ─── CONFESSIONS FEED (infinite scroll) ────────────────────────────────────────
export function useConfessions() {
    return useInfiniteQuery({
        queryKey: exploreKeys.confessions,
        queryFn: async ({ pageParam = null }) => {
            const params = new URLSearchParams({ limit: '10' });
            if (pageParam) params.append('cursor', pageParam);
            const res = await api.get(`${BASE}/api/post/confessions?${params}`);
            return res.data;
        },
        getNextPageParam: (lastPage) => lastPage.hasMore ? lastPage.nextCursor : undefined,
        staleTime: 1000 * 60 * 2,
    });
}

// ─── TRENDING POSTS ────────────────────────────────────────────────────────────
export function useTrending() {
    const queryClient = useQueryClient();
    return useQuery({
        queryKey: exploreKeys.trending,
        queryFn: async () => {
            const cacheKey = 'trending_posts';
            const fetchPromise = api.get(`${BASE}/api/post/trending`).then(async (res) => {
                if (res.data) {
                    await dbService.setCache(cacheKey, res.data);
                }
                return res.data;
            });

            const cached = await dbService.getCache(cacheKey);
            if (cached) {
                fetchPromise.then(freshData => {
                    queryClient.setQueryData(exploreKeys.trending, freshData);
                }).catch(() => {});
                return cached;
            }

            return fetchPromise;
        },
        staleTime: 1000 * 60 * 10, // trending changes slowly
    });
}

// ─── SEARCH USERS ─────────────────────────────────────────────────────────────
export function useSearchUsers(query) {
    return useQuery({
        queryKey: exploreKeys.search(query),
        queryFn: async () => {
            const res = await api.post(`${BASE}/api/auth/search`, { query });
            return res.data?.users || [];
        },
        enabled: !!query && query.length > 0,
        staleTime: 1000 * 60 * 5, // 5 minutes
    });
}
