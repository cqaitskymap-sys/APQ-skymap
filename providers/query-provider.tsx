'use client';

import { QueryClient, QueryClientProvider, useIsFetching, useIsMutating } from '@tanstack/react-query';
import { useEffect, type ReactNode } from 'react';
import { useLoading } from '@/contexts/loading-context';

function ReactQueryLoadingBridge() {
  const fetching = useIsFetching();
  const mutating = useIsMutating();
  const { startTask, endTask } = useLoading();

  useEffect(() => {
    if (fetching > 0) {
      startTask('rq-fetch', { message: 'Loading data...', priority: 'medium' });
    } else {
      endTask('rq-fetch');
    }
  }, [fetching, startTask, endTask]);

  useEffect(() => {
    if (mutating > 0) {
      startTask('rq-mutate', { message: 'Saving changes...', priority: 'small' });
    } else {
      endTask('rq-mutate');
    }
  }, [mutating, startTask, endTask]);

  return null;
}

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        gcTime: 5 * 60_000,
        refetchOnWindowFocus: false,
        retry: 2,
      },
      mutations: {
        retry: 1,
      },
    },
  });
}

let browserQueryClient: QueryClient | undefined;

function getQueryClient() {
  if (typeof window === 'undefined') return makeQueryClient();
  if (!browserQueryClient) browserQueryClient = makeQueryClient();
  return browserQueryClient;
}

export function QueryProvider({ children }: { children: ReactNode }) {
  const queryClient = getQueryClient();

  return (
    <QueryClientProvider client={queryClient}>
      <ReactQueryLoadingBridge />
      {children}
    </QueryClientProvider>
  );
}

export { getQueryClient };
