// TanStack Query provider with localStorage persistence
// Caches all API responses for 5 minutes in-memory, 1 hour on disk
'use client';

import { QueryClient } from '@tanstack/react-query';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister';
import { ReactNode, useState } from 'react';

export const CACHE_PERSIST_KEY = 'tourbillon-query-cache-v2';

const STALE_TIME = 5 * 60 * 1000;   // 5 minutes — data considered fresh
const GC_TIME = 10 * 60 * 1000;     // 10 minutes — inactive cache garbage collected
const CACHE_MAX_AGE = 60 * 60 * 1000; // 1 hour — localStorage persistence window

export function QueryProvider({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: STALE_TIME,
            gcTime: GC_TIME,
            retry: 1,
            refetchOnWindowFocus: false,
          },
        },
      })
  );

  // Sync persister writes cache to localStorage on every mutation
  const persister = createSyncStoragePersister({
    storage: typeof window !== 'undefined' ? window.localStorage : undefined,
    key: CACHE_PERSIST_KEY,
  });

  return (
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{ persister, maxAge: CACHE_MAX_AGE }}
    >
      {children}
    </PersistQueryClientProvider>
  );
}
