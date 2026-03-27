// Zustand store for favourites and named collections.
// No localStorage persist — state is server-side and auth-gated.
// Uses optimistic updates: snapshot → apply locally → await API → revert on error.
import { create } from 'zustand';
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
  deleteCollection: (collectionId: number) => Promise<void>;
  renameCollection: (collectionId: number, newName: string) => Promise<void>;
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
      // Revert on failure
      set({ favouriteWatchIds: new Set(favouriteWatchIds) });
    }
  },

  addToCollection: async (collectionId, watchId) => {
    const { collections } = get();
    // Optimistic update
    const updatedCollections = collections.map(c =>
      c.id === collectionId && !c.watchIds.includes(watchId)
        ? { ...c, watchIds: [...c.watchIds, watchId], updatedAt: new Date().toISOString() }
        : c
    );
    set({ collections: updatedCollections });

    try {
      await apiAddToCollection(collectionId, watchId);
    } catch {
      set({ collections });
    }
  },

  removeFromCollection: async (collectionId, watchId) => {
    const { collections } = get();
    // Optimistic update
    const updatedCollections = collections.map(c =>
      c.id === collectionId
        ? { ...c, watchIds: c.watchIds.filter(id => id !== watchId), updatedAt: new Date().toISOString() }
        : c
    );
    set({ collections: updatedCollections });

    try {
      await apiRemoveFromCollection(collectionId, watchId);
    } catch {
      set({ collections });
    }
  },

  createCollection: async (name) => {
    const newCollection = await apiCreateCollection(name);
    set(state => ({ collections: [...state.collections, newCollection] }));
    return newCollection;
  },

  deleteCollection: async (collectionId) => {
    const { collections } = get();
    // Optimistic update
    set({ collections: collections.filter(c => c.id !== collectionId) });
    try {
      await apiDeleteCollection(collectionId);
    } catch {
      set({ collections });
    }
  },

  renameCollection: async (collectionId, newName) => {
    const { collections } = get();
    // Optimistic update
    set({ collections: collections.map(c => c.id === collectionId ? { ...c, name: newName } : c) });
    try {
      await apiRenameCollection(collectionId, newName);
    } catch {
      set({ collections });
    }
  },

  reset: () => set({
    favouriteWatchIds: new Set<number>(),
    collections: [],
    isLoaded: false,
    isLoading: false,
  }),
}));
