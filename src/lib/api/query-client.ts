import { QueryClient } from '@tanstack/svelte-query';
import { isApiError } from './errors';

/** Retry transient failures only: never 4xx, never aborted requests; at most twice. */
function shouldRetry(failureCount: number, error: unknown): boolean {
  if (isApiError(error)) {
    if (error.code === 'aborted') return false;
    if (error.status >= 400 && error.status < 500) return false;
  }
  return failureCount < 2;
}

export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // Data is entered manually by one person: it rarely changes behind our back.
        staleTime: 30_000,
        gcTime: 5 * 60_000,
        retry: shouldRetry,
        retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 8000),
        refetchOnWindowFocus: false,
        refetchOnReconnect: true,
      },
      mutations: {
        retry: false,
      },
    },
  });
}

/** Application-wide client. Import this for `invalidateQueries` outside components. */
export const queryClient = createQueryClient();
