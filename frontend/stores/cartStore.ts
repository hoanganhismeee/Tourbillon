// Zustand store for shopping cart state
// Persists to localStorage via the persist middleware — survives page reloads and new tabs.
// skipHydration: true prevents SSR/client mismatch; rehydration is triggered client-side.
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { Watch } from '@/lib/api';

export interface CartItem {
  watchId: number;
  name: string;
  description: string | null;
  image: string | null;
  price: number;
  brandName: string;
}

interface CartStore {
  items: CartItem[];
  addItem: (watch: Watch, brandName: string) => void;
  removeItem: (watchId: number) => void;
  clearCart: () => void;
  isInCart: (watchId: number) => boolean;
  getTotal: () => number;
}

export const useCart = create<CartStore>()(
  persist(
    (set, get) => ({
      items: [],

      addItem: (watch, brandName) => {
        const { items } = get();
        if (items.some(i => i.watchId === watch.id)) return;
        set({
          items: [...items, {
            watchId: watch.id,
            name: watch.name,
            description: watch.description,
            image: watch.image,
            price: watch.currentPrice,
            brandName,
          }]
        });
      },

      removeItem: (watchId) =>
        set({ items: get().items.filter(i => i.watchId !== watchId) }),

      clearCart: () => set({ items: [] }),

      isInCart: (watchId) => get().items.some(i => i.watchId === watchId),

      getTotal: () => get().items.reduce((sum, i) => sum + i.price, 0),
    }),
    {
      name: 'tourbillon-cart',
      storage: createJSONStorage(() => localStorage),
      skipHydration: true,
    }
  )
);
