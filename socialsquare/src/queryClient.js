import { QueryClient } from '@tanstack/react-query';

// Singleton QueryClient — shared between React Query Provider and plain JS modules
// (e.g., Zustand actions that need to invalidate queries outside React components)
const queryClient = new QueryClient({
    defaultOptions: {
        queries: { staleTime: 1000 * 60 * 2, retry: 1, refetchOnWindowFocus: false },
        mutations: { retry: 0 },
    },
});

export function getQueryClient() {
    return queryClient;
}

export default queryClient;
