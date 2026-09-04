import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (failureCount, error: any) => {
        // Do not retry 401s, let the axios interceptor handle it
        if (error.response?.status === 401) {
          return false;
        }
        // Retry 5xx and network errors with exponential backoff up to 3 times
        return failureCount < 3;
      },
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000), // Exponential backoff max 30s
      staleTime: 1000 * 60 * 2, // Consider data fresh for 2 minutes
      gcTime: 1000 * 60 * 10, // Keep in garbage collector for 10 minutes (formerly cacheTime)
      refetchOnWindowFocus: true, 
    },
  },
});
