// Main client for /favourites — auth guard, collections row, filter/sort, paginated watch grid.
'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { useAuth } from '@/contexts/AuthContext';
import { useFavourites } from '@/stores/favouritesStore';
import { getFavouriteWatches, fetchBrands, Brand, FavouriteWatchesResponse } from '@/lib/api';
import WatchCard from '@/app/watches/[watchId]/WatchCard';
import {
  WatchFilters,
  EMPTY_WATCH_FILTERS,
  BrandDropdown,
  FilterDropdown,
  CASE_MATERIAL_OPTIONS,
  MOVEMENT_OPTIONS,
  WATER_RESISTANCE_OPTIONS,
  COMPLICATION_LABELS,
  PRICE_BUCKETS,
  applyWatchFilters,
} from '@/app/components/filters/WatchFilterBar';

const PAGE_SIZE = 20;

const SORT_OPTIONS = [
  { value: 'recent', label: 'Recently Saved' },
  { value: 'brand', label: 'Brand A–Z' },
  { value: 'price_desc', label: 'Price High–Low' },
  { value: 'price_asc', label: 'Price Low–High' },
];

// Skeleton card for loading state
const SkeletonCard = () => (
  <div className="bg-black/30 border border-white/10 rounded-2xl p-6 animate-pulse">
    <div className="w-full h-64 bg-white/5 rounded-xl mb-4" />
    <div className="h-3 bg-white/5 rounded-full w-3/4 mx-auto mb-2" />
    <div className="h-3 bg-white/5 rounded-full w-1/2 mx-auto" />
  </div>
);

export default function FavouritesClient() {
  const { isAuthenticated, loading: authLoading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const page = Number(searchParams.get('page') ?? '1');

  const { collections, isLoaded, loadFavourites, deleteCollection } = useFavourites();

  const [watchData, setWatchData] = useState<FavouriteWatchesResponse | null>(null);
  const [gridLoading, setGridLoading] = useState(false);
  const [selectedCollectionIds, setSelectedCollectionIds] = useState<number[]>([]);
  const [sortBy, setSortBy] = useState('recent');
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [watchFilters, setWatchFilters] = useState<WatchFilters>(EMPTY_WATCH_FILTERS);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [editingCollectionId, setEditingCollectionId] = useState<number | null>(null);
  const [editingName, setEditingName] = useState('');
  const [renamingId, setRenamingId] = useState<number | null>(null);

  // Auth guard — redirect to login if not authenticated
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.replace('/login?redirect=/favourites');
    }
  }, [authLoading, isAuthenticated, router]);

  // Load favourites store state on mount
  useEffect(() => {
    if (isAuthenticated && !isLoaded) {
      loadFavourites();
    }
  }, [isAuthenticated, isLoaded, loadFavourites]);

  // Fetch brand list once for the filter bar
  useEffect(() => {
    fetchBrands().then(setBrands).catch(() => {});
  }, []);

  const hasWatchFilters = Object.values(watchFilters).some((v: string[] | number[]) => v.length > 0);

  // When spec filters are active, fetch all (up to 500) so we can filter client-side.
  // Otherwise use normal server-side pagination.
  const fetchGrid = useCallback(async () => {
    if (!isAuthenticated) return;
    setGridLoading(true);
    try {
      const result = await getFavouriteWatches({
        page: hasWatchFilters ? 1 : page,
        pageSize: hasWatchFilters ? 500 : PAGE_SIZE,
        collectionIds: selectedCollectionIds.length > 0 ? selectedCollectionIds : undefined,
        sortBy,
      });
      setWatchData(result);
    } catch {
      setWatchData(null);
    } finally {
      setGridLoading(false);
    }
  }, [isAuthenticated, page, selectedCollectionIds, sortBy, hasWatchFilters]);

  useEffect(() => {
    fetchGrid();
  }, [fetchGrid]);

  const toggleCollectionFilter = (id: number) => {
    setSelectedCollectionIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
    // Reset to page 1 on filter change
    router.push('/favourites');
  };

  const handleDeleteCollection = async (collectionId: number) => {
    setDeletingId(collectionId);
    try {
      await deleteCollection(collectionId);
      setSelectedCollectionIds(prev => prev.filter(id => id !== collectionId));
      fetchGrid();
    } finally {
      setDeletingId(null);
    }
  };

  const getCollectionName = (id: number) =>
    collections.find(c => c.id === id)?.name ?? '';

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
  };

  // Derive up to 3 preview image URLs per collection from the currently loaded watch grid
  const collectionPreviewImages = useMemo(() => {
    if (!watchData) return {} as Record<number, string[]>;
    const idToWatch = Object.fromEntries(watchData.watches.map(w => [w.id, w]));
    const result: Record<number, string[]> = {};
    Object.entries(watchData.watchCollectionMembership).forEach(([wId, colIds]) => {
      const w = idToWatch[Number(wId)];
      if (!w?.imageUrl) return;
      colIds.forEach(cId => {
        if (!result[cId]) result[cId] = [];
        if (result[cId].length < 3) result[cId].push(w.imageUrl!);
      });
    });
    return result;
  }, [watchData]);

  const startEditing = (id: number, name: string) => {
    setEditingCollectionId(id);
    setEditingName(name);
  };

  const handleRenameSubmit = async (id: number) => {
    const trimmed = editingName.trim();
    if (!trimmed || trimmed === collections.find(c => c.id === id)?.name) {
      setEditingCollectionId(null);
      return;
    }
    setRenamingId(id);
    try {
      await renameCollection(id, trimmed);
    } finally {
      setRenamingId(null);
      setEditingCollectionId(null);
    }
  };

  // Client-side filter application on top of the server-fetched data
  const displayedWatches = useMemo(() => {
    if (!watchData) return [];
    return hasWatchFilters ? applyWatchFilters(watchData.watches, watchFilters) : watchData.watches;
  }, [watchData, watchFilters, hasWatchFilters]);

  const setFilter = <K extends keyof WatchFilters>(key: K, value: WatchFilters[K]) => {
    setWatchFilters(prev => ({ ...prev, [key]: value }));
    router.push('/favourites');
  };

  const clearWatchFilters = () => {
    setWatchFilters(EMPTY_WATCH_FILTERS);
    router.push('/favourites');
  };

  const totalPages = !hasWatchFilters && watchData ? Math.ceil(watchData.totalCount / PAGE_SIZE) : 0;

  if (authLoading || (!isAuthenticated && !authLoading)) return null;

  const headingText =
    selectedCollectionIds.length === 1
      ? `Saved in: ${getCollectionName(selectedCollectionIds[0])}`
      : selectedCollectionIds.length > 1
        ? `${selectedCollectionIds.length} Collections Selected`
        : 'All Saved Watches';

  return (
    <main className="min-h-screen pt-32 pb-24 px-8 lg:px-16">
      {/* Page header */}
      <div className="mb-10">
        <h1 className="font-playfair text-4xl lg:text-5xl font-light text-[#f0e6d2] tracking-wide">
          My Favourites
        </h1>
        {watchData && (
          <p className="mt-2 text-sm text-white/40 font-inter">
            {watchData.totalCount} {watchData.totalCount === 1 ? 'piece' : 'pieces'} saved
          </p>
        )}
      </div>

      {/* Collections row */}
      {collections.length > 0 && (
        <div className="mb-10">
          <h2 className="text-xs font-inter font-semibold text-[#bfa68a]/60 uppercase tracking-[0.15em] mb-4">
            Collections
          </h2>
          <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-hide">
            {collections.map(col => (
              <div
                key={col.id}
                className={`relative group/col shrink-0 cursor-pointer rounded-2xl border transition-all duration-300 px-5 py-4 min-w-[160px] ${
                  selectedCollectionIds.includes(col.id)
                    ? 'border-[#bfa68a]/50 bg-[#bfa68a]/10'
                    : 'border-white/10 bg-black/30 hover:border-white/25'
                }`}
                onClick={() => toggleCollectionFilter(col.id)}
              >
                <p className="font-playfair text-[#f0e6d2] text-sm font-medium truncate pr-6">{col.name}</p>
                <p className="text-xs text-white/40 font-inter mt-1">
                  {col.watchIds.length} {col.watchIds.length === 1 ? 'piece' : 'pieces'}
                </p>
                <p className="text-[10px] text-white/25 font-inter mt-0.5">
                  Updated {formatDate(col.updatedAt)}
                </p>
                {/* Delete button — appears on hover */}
                <button
                  onClick={e => { e.stopPropagation(); handleDeleteCollection(col.id); }}
                  disabled={deletingId === col.id}
                  className="absolute top-3 right-3 w-5 h-5 rounded-full bg-white/5 border border-white/10 flex items-center justify-center opacity-0 group-hover/col:opacity-100 transition-opacity hover:bg-white/15"
                  title="Delete collection"
                >
                  <svg width="7" height="7" viewBox="0 0 8 8" fill="none" stroke="white" strokeOpacity="0.5" strokeWidth="1.5" strokeLinecap="round">
                    <path d="M1 1l6 6M7 1l-6 6" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Filter bar */}
      <div className="pb-5 mb-6 border-b border-white/8">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-inter text-white/30 uppercase tracking-widest mr-1 flex-shrink-0 self-center">
            Filters
          </span>
          <BrandDropdown
            brands={brands}
            selected={watchFilters.brandIds}
            onChange={v => setFilter('brandIds', v)}
          />
          <FilterDropdown
            label="Case Material"
            options={CASE_MATERIAL_OPTIONS}
            selected={watchFilters.caseMaterials}
            onChange={v => setFilter('caseMaterials', v)}
          />
          <FilterDropdown
            label="Movement"
            options={MOVEMENT_OPTIONS}
            selected={watchFilters.movementTypes}
            onChange={v => setFilter('movementTypes', v)}
          />
          <FilterDropdown
            label="Water Resistance"
            options={WATER_RESISTANCE_OPTIONS}
            selected={watchFilters.waterResistances}
            onChange={v => setFilter('waterResistances', v)}
          />
          <FilterDropdown
            label="Complications"
            options={COMPLICATION_LABELS}
            selected={watchFilters.complications}
            onChange={v => setFilter('complications', v)}
          />
          <FilterDropdown
            label="Price"
            options={PRICE_BUCKETS.map(b => b.label)}
            selected={watchFilters.priceBuckets}
            onChange={v => setFilter('priceBuckets', v)}
          />
          {hasWatchFilters && (
            <button
              onClick={clearWatchFilters}
              className="ml-1 text-xs font-inter text-white/35 hover:text-white/60 transition-colors flex-shrink-0"
            >
              Clear all
            </button>
          )}
        </div>
      </div>

      {/* Heading + sort */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <h2 className="font-playfair text-xl text-[#f0e6d2] font-light">{headingText}</h2>
          {selectedCollectionIds.length > 0 && (
            <button
              onClick={() => { setSelectedCollectionIds([]); router.push('/favourites'); }}
              className="text-xs text-white/35 font-inter hover:text-white/60 transition-colors"
            >
              Clear filter
            </button>
          )}
        </div>

        {/* Sort dropdown */}
        <select
          value={sortBy}
          onChange={e => { setSortBy(e.target.value); router.push('/favourites'); }}
          className="bg-black/40 border border-white/15 text-white/70 text-sm font-inter rounded-xl px-4 py-2 outline-none cursor-pointer hover:border-white/30 transition-colors"
        >
          {SORT_OPTIONS.map(opt => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      </div>

      {/* Watch grid */}
      {gridLoading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
          {Array.from({ length: PAGE_SIZE }).map((_, i) => <SkeletonCard key={i} />)}
        </div>
      ) : displayedWatches.length > 0 ? (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
            {displayedWatches.map(watch => {
              const membershipIds = watchData?.watchCollectionMembership[watch.id] ?? [];
              const labels = membershipIds.map(id => getCollectionName(id)).filter(Boolean);
              return (
                <WatchCard
                  key={watch.id}
                  watch={watch}
                  collectionLabels={labels.length > 0 ? labels : undefined}
                />
              );
            })}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex justify-center gap-2 mt-12">
              {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
                <Link
                  key={p}
                  href={`/favourites?page=${p}`}
                  className={`w-9 h-9 rounded-xl flex items-center justify-center text-sm font-inter transition-all duration-200 ${
                    p === page
                      ? 'bg-[#bfa68a]/20 text-[#bfa68a] border border-[#bfa68a]/30'
                      : 'text-white/40 hover:text-white/70 border border-white/10 hover:border-white/25'
                  }`}
                >
                  {p}
                </Link>
              ))}
            </div>
          )}
        </>
      ) : (
        /* Empty state */
        <div className="flex flex-col items-center justify-center py-32 text-center">
          <div className="w-16 h-16 rounded-full border border-white/10 flex items-center justify-center mb-6">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path
                d="M12 21.593c-5.63-5.539-11-10.297-11-14.402 0-3.791 3.068-5.191 5.281-5.191 1.312 0 4.151.501 5.719 4.457 1.59-3.968 4.464-4.447 5.726-4.447 2.54 0 5.274 1.621 5.274 5.181 0 4.069-5.136 8.625-11 14.402z"
                stroke="#bfa68a"
                strokeOpacity="0.4"
                strokeWidth="1.5"
                fill="none"
              />
            </svg>
          </div>
          {hasWatchFilters ? (
            <>
              <p className="font-playfair text-xl text-[#f0e6d2]/60 mb-2">No matches</p>
              <p className="text-sm text-white/30 font-inter mb-8">
                No saved watches match the selected filters.
              </p>
              <button
                onClick={clearWatchFilters}
                className="px-6 py-3 rounded-xl border border-[#bfa68a]/30 text-[#bfa68a] text-sm font-inter hover:bg-[#bfa68a]/10 transition-colors"
              >
                Clear filters
              </button>
            </>
          ) : (
            <>
              <p className="font-playfair text-xl text-[#f0e6d2]/60 mb-2">No watches saved yet</p>
              <p className="text-sm text-white/30 font-inter mb-8">
                Hover over any watch card and click the heart to save it here.
              </p>
              <Link
                href="/watches"
                className="px-6 py-3 rounded-xl border border-[#bfa68a]/30 text-[#bfa68a] text-sm font-inter hover:bg-[#bfa68a]/10 transition-colors"
              >
                Browse Timepieces
              </Link>
            </>
          )}
        </div>
      )}
    </main>
  );
}
