// Main client for /favourites — auth guard, collections row, filter/sort, paginated watch grid.
'use client';

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { useFavourites } from '@/stores/favouritesStore';
import { getFavouriteWatches, fetchBrands, fetchCollections, Brand, Collection, FavouriteWatchesResponse } from '@/lib/api';
import WatchCard from '@/app/watches/[watchId]/WatchCard';
import {
  WatchFilters,
  EMPTY_WATCH_FILTERS,
  applyWatchFilters,
  WatchFilterBar,
  parseDiameterMm,
  parseSpecs,
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
  const [wristFit, setWristFit] = useState('');
  const [brands, setBrands] = useState<Brand[]>([]);
  const [watchCollections, setWatchCollections] = useState<Collection[]>([]);

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

  // Fetch brand list and watch collections once for the filter bar
  useEffect(() => {
    fetchBrands().then(setBrands).catch(() => {});
    fetchCollections().then(setWatchCollections).catch(() => {});
  }, []);

  const hasWatchFilters =
    Object.values(watchFilters).some((v: string[] | number[]) => v.length > 0) || wristFit !== '';

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

  // Derive diameter options from fetched watches — only sizes present are shown
  const diameterOptions = useMemo(() => {
    const watches = watchData?.watches ?? [];
    const sizes = new Set<number>();
    watches.forEach(w => {
      const specs = parseSpecs(w.specs);
      const mm = parseDiameterMm(specs?.case?.diameter as string | undefined);
      if (mm !== null) sizes.add(Math.floor(mm));
    });
    return Array.from(sizes).sort((a, b) => a - b).map(n => `${n}mm`);
  }, [watchData]);

  // Client-side filter application on top of the server-fetched data
  const displayedWatches = useMemo(() => {
    if (!watchData) return [];
    return hasWatchFilters ? applyWatchFilters(watchData.watches, watchFilters, wristFit) : watchData.watches;
  }, [watchData, watchFilters, wristFit, hasWatchFilters]);

  const setFilter = <K extends keyof WatchFilters>(key: K, value: WatchFilters[K]) => {
    setWatchFilters(prev => ({ ...prev, [key]: value }));
  };

  const clearWatchFilters = () => {
    setWatchFilters(EMPTY_WATCH_FILTERS);
    setWristFit('');
    // Reset to page 1 without scrolling so server-side pagination resumes from the start
    if (page !== 1) router.replace('/favourites', { scroll: false });
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
      <WatchFilterBar
        filters={watchFilters}
        brands={brands}
        collections={watchCollections}
        diameterOptions={diameterOptions}
        wristFit={wristFit}
        hasActiveFilters={hasWatchFilters}
        onChange={setFilter}
        onWristFitChange={setWristFit}
        onClear={clearWatchFilters}
      />

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
                  brandName={brands.find(b => b.id === watch.brandId)?.name}
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
                      ? 'bg-[#f0e6d2]/10 text-[#f0e6d2] border border-[#f0e6d2]/20'
                      : 'text-white/40 hover:text-white/70 border border-transparent hover:border-white/15'
                  }`}
                >
                  {p}
                </Link>
              ))}
            </div>
          )}
        </>
      ) : (
        <div className="py-20 text-center">
          <p className="text-white/30 font-inter text-sm">
            {hasWatchFilters ? 'No watches match your current filters.' : 'No saved watches yet.'}
          </p>
          {hasWatchFilters && (
            <button
              onClick={clearWatchFilters}
              className="mt-3 text-sm text-white/50 hover:text-white underline underline-offset-2 font-inter transition-colors"
            >
              Clear filters
            </button>
          )}
        </div>
      )}
    </main>
  );
}
