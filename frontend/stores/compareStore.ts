// Zustand store for watch comparison state
// Persists to localStorage via the persist middleware — survives page reloads and new tabs.
// skipHydration: true prevents SSR/client mismatch; rehydration is triggered client-side.
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { Watch } from '@/lib/api';

export const MAX_COMPARE_COUNT = 4;

interface CompareStore {
  compareWatches: Watch[];
  addToCompare: (watch: Watch) => boolean;
  removeFromCompare: (id: number) => void;
  clearCompare: () => void;
  isInCompare: (id: number) => boolean;
}

export const useCompare = create<CompareStore>()(
  persist(
    (set, get) => ({
      compareWatches: [],

      addToCompare: (watch) => {
        const { compareWatches } = get();
        if (compareWatches.length >= MAX_COMPARE_COUNT) return false;
        if (compareWatches.some(w => w.id === watch.id)) return false;
        set({ compareWatches: [...compareWatches, watch] });
        return true;
      },

      removeFromCompare: (id) =>
        set({ compareWatches: get().compareWatches.filter(w => w.id !== id) }),

      clearCompare: () => set({ compareWatches: [] }),

      isInCompare: (id) => get().compareWatches.some(w => w.id === id),
    }),
    {
      name: 'tourbillon-compare',
      storage: createJSONStorage(() => localStorage),
      // Prevents hydration mismatch in Next.js App Router — rehydrate() is called client-side
      skipHydration: true,
    }
  )
);
