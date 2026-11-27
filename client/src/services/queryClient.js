import { QueryClient } from '@tanstack/react-query';

/**
 * Shared TanStack Query client for the admin tabs.
 *
 * - staleTime 60s: coming back to a tab paints the cached data instantly and
 *   only refetches in the background once the data is older than a minute.
 * - gcTime 10 min: tab data survives while the user moves between tabs.
 * - No refetch on window focus: realtime changes already arrive through SSE.
 */
export const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            staleTime: 60 * 1000,
            gcTime: 10 * 60 * 1000,
            refetchOnWindowFocus: false,
            retry: 1,
        },
    },
});

export default queryClient;
