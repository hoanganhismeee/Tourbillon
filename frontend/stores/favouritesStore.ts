// Zustand store for favourites and named collections.
// No localStorage persist — state is server-side and auth-gated.
// Uses optimistic updates: snapshot → apply locally → await API → revert on error.
import { create } from 'zustand';
import { toast } from 'sonner';
import {
  UserCollectionSummary,
  getFavouritesState,
  addFavourite,
  removeFavourite,
  createCollection as apiCreateCollection,
  deleteCollection as apiDeleteCollection,
  renameCollection as apiRenameCollection,
  addToCollection as apiAddToCollection,
  removeFromCollection as apiRemoveFromCollection,
} from '@/lib/api';

interface FavouritesStore {
  favouriteWatchIds: Set<number>;
  collections: UserCollectionSummary[];
  isLoaded: boolean;
  isLoading: boolean;

  // Derived selectors
  isFavourited: (id: number) => boolean;
  isInCollection: (collectionId: number, watchId: number) => boolean;
  isSavedAnywhere: (id: number) => boolean;

  // Actions
  loadFavourites: () => Promise<void>;
  toggleFavourite: (watchId: number) => Promise<void>;
  addToCollection: (collectionId: number, watchId: number) => Promise<void>;
  removeFromCollection: (collectionId: number, watchId: number) => Promise<void>;
  createCollection: (name: string) => Promise<UserCollectionSummary>;
  renameCollection: (collectionId: number, newName: string) => Promise<void>;
  deleteCollection: (collectionId: number) => Promise<void>;
  reset: () => void;
}

export const useFavourites = create<FavouritesStore>()((set, get) => ({
  favouriteWatchIds: new Set<number>(),
  collections: [],
  isLoaded: false,
  isLoading: false,

  isFavourited: (id) => get().favouriteWatchIds.has(id),

  isInCollection: (collectionId, watchId) =>
    get().collections
      .find(c => c.id === collectionId)
      ?.watchIds.includes(watchId) ?? false,

  // Heart fills gold if the watch is in Favourites OR any collection.
  isSavedAnywhere: (id) => {
    const { favouriteWatchIds, collections } = get();
    if (favouriteWatchIds.has(id)) return true;
    return collections.some(c => c.watchIds.includes(id));
  },

  loadFavourites: async () => {
    if (get().isLoading) return;
    set({ isLoading: true });
    try {
      const state = await getFavouritesState();
      set({
        favouriteWatchIds: new Set(state.favouriteWatchIds),
        collections: state.collections,
        isLoaded: true,
      });
    } catch {
      // Not authenticated or network error — silently reset
      set({ isLoaded: true });
    } finally {
      set({ isLoading: false });
    }
  },

  toggleFavourite: async (watchId) => {
    const { favouriteWatchIds } = get();
    const wasFavourited = favouriteWatchIds.has(watchId);

    // Optimistic update
    const nextIds = new Set(favouriteWatchIds);
    if (wasFavourited) nextIds.delete(watchId);
    else nextIds.add(watchId);
    set({ favouriteWatchIds: nextIds });

    try {
      if (wasFavourited) await removeFavourite(watchId);
      else await addFavourite(watchId);
    } catch {
      set({ favouriteWatchIds: new Set(favouriteWatchIds) });
      toast.error('Could not update favourites. Please try again.');
    }
  },

  addToCollection: async (collectionId, watchId) => {
    const { collections } = get();
    // Optimistic update — watchIds and count update instantly
    set({
      collections: collections.map(c =>
        c.id === collectionId && !c.watchIds.includes(watchId)
          ? { ...c, watchIds: [...c.watchIds, watchId], updatedAt: new Date().toISOString() }
          : c
      ),
    });

    try {
      await apiAddToCollection(collectionId, watchId);
      // Refresh full state so previewImages reflect the newly added watch (latest first)
      const fresh = await getFavouritesState();
      set({ collections: fresh.collections });
    } catch {
      set({ collections });
      toast.error('Could not add to collection. Please try again.');
    }
  },

  removeFromCollection: async (collectionId, watchId) => {
    const { collections } = get();
    // Optimistic update
    set({
      collections: collections.map(c =>
        c.id === collectionId
          ? { ...c, watchIds: c.watchIds.filter(id => id !== watchId), updatedAt: new Date().toISOString() }
          : c
      ),
    });

    try {
      await apiRemoveFromCollection(collectionId, watchId);
      // Refresh so previewImages drop the removed watch
      const fresh = await getFavouritesState();
      set({ collections: fresh.collections });
    } catch {
      set({ collections });
      toast.error('Could not remove from collection. Please try again.');
    }
  },

  createCollection: async (name) => {
    const newCollection = await apiCreateCollection(name);
    set(state => ({ collections: [...state.collections, newCollection] }));
    return newCollection;
  },

  renameCollection: async (collectionId, newName) => {
    const snapshot = get().collections;
    // Optimistic update
    set({ collections: snapshot.map(c => c.id === collectionId ? { ...c, name: newName } : c) });
    try {
      const updated = await apiRenameCollection(collectionId, newName);
      // Reconcile with server response (server trims/normalizes the name)
      set(state => ({
        collections: state.collections.map(c =>
          c.id === collectionId ? { ...c, name: updated.name, updatedAt: updated.updatedAt } : c
        ),
      }));
    } catch {
      set({ collections: snapshot });
      toast.error('Could not rename collection. Please try again.');
    }
  },

  deleteCollection: async (collectionId) => {
    const { collections } = get();
    // Optimistic update
    set({ collections: collections.filter(c => c.id !== collectionId) });
    try {
      await apiDeleteCollection(collectionId);
    } catch {
      set({ collections });
      toast.error('Could not delete collection. Please try again.');
    }
  },

  reset: () => set({
    favouriteWatchIds: new Set<number>(),
    collections: [],
    isLoaded: false,
    isLoading: false,
  }),
}));
