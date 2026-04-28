// /favourites — auth gate, collections row, filter/sort, paginated watch grid.
'use client';
export const dynamic = 'force-dynamic';

import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { useFavourites } from '@/stores/favouritesStore';
import { ROUTES } from '@/app/constants/routes';
import {
  getFavouriteWatches,
  fetchBrands,
  fetchCollections,
  fetchFilterOptions,
  Brand,
  Collection,
  FavouriteWatchesResponse,
} from '@/lib/api';
import { CollectionCard, AddCollectionCard } from '@/app/components/favourites/CollectionCard';
import WatchCard from '@/app/watches/[slug]/WatchCard';
import ScrollFade from '@/app/scrollMotion/ScrollFade';
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

const formatDate = (iso: string) => {
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
};

const SkeletonCard = () => (
  <div className="bg-black/30 border border-white/10 rounded-2xl p-6 animate-pulse">
    <div className="w-full h-64 bg-white/5 rounded-xl mb-4" />
    <div className="h-3 bg-white/5 rounded-full w-3/4 mx-auto mb-2" />
    <div className="h-3 bg-white/5 rounded-full w-1/2 mx-auto" />
  </div>
);

const GuestView = () => (
  <main className="min-h-screen pt-20 pb-24 px-8 lg:px-16">
    <section className="max-w-5xl border-t border-[#bfa68a]/12 pt-10">
      <ScrollFade>
        <div className="max-w-3xl border-l border-[#bfa68a]/35 pl-7 md:pl-10">
          <p className="text-[10px] uppercase tracking-[0.4em] text-[#bfa68a]/80">
            Favourites
          </p>
          <h1
            className="mt-5 font-playfair font-light leading-tight text-[#f0e6d2]"
            style={{ fontSize: 'clamp(2rem, 4.5vw, 4rem)' }}
          >
            Your shortlist, waiting for you.
          </h1>
          <p className="mt-6 max-w-2xl text-[14px] leading-relaxed text-white/48">
            Sign in to keep the watches that move you. Build curated collections,
            track your considerations, and return to them as your eye sharpens.
          </p>
        </div>
      </ScrollFade>

      <ScrollFade>
        <div className="mt-10 flex flex-wrap items-center gap-4">
          <Link
            href={ROUTES.AUTH_START}
            className="inline-flex items-center justify-center border border-[#bfa68a]/25 px-10 py-4 text-[10px] uppercase tracking-[0.3em] text-[#bfa68a] transition-all duration-500 hover:border-[#bfa68a]/40 hover:bg-[#bfa68a]/8"
          >
            Sign in
          </Link>
          <Link
            href={ROUTES.WATCHES}
            className="text-[10px] uppercase tracking-[0.3em] text-white/35 transition-colors duration-300 hover:text-[#f0e6d2]"
          >
            Explore the catalogue
          </Link>
        </div>
      </ScrollFade>
    </section>
  </main>
);

export default function FavouritesPage() {
  const { isAuthenticated, loading: authLoading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const page = Number(searchParams.get('page') ?? '1');

  const { collections, isLoaded, loadFavourites, deleteCollection, createCollection, renameCollection } = useFavourites();

  const [watchData, setWatchData] = useState<FavouriteWatchesResponse | null>(null);
  const [gridLoading, setGridLoading] = useState(false);
  const [selectedCollectionIds, setSelectedCollectionIds] = useState<number[]>([]);
  const [sortBy, setSortBy] = useState('recent');
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [renamingId, setRenamingId] = useState<number | null>(null);
  const [isAddingCollection, setIsAddingCollection] = useState(false);
  const [newCollectionName, setNewCollectionName] = useState('');
  const [createError, setCreateError] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [watchFilters, setWatchFilters] = useState<WatchFilters>(EMPTY_WATCH_FILTERS);
  const [wristFit, setWristFit] = useState('');
  const [brands, setBrands] = useState<Brand[]>([]);
  const [watchCollections, setWatchCollections] = useState<Collection[]>([]);
  const [catalogDiameterOptions, setCatalogDiameterOptions] = useState<string[]>([]);
  const sortDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (isAuthenticated && !isLoaded) loadFavourites();
  }, [isAuthenticated, isLoaded, loadFavourites]);

  useEffect(() => {
    if (!isAuthenticated) return;
    fetchBrands().then(setBrands).catch(() => {});
    fetchCollections().then(setWatchCollections).catch(() => {});
    fetchFilterOptions().then(options => setCatalogDiameterOptions(options.diameters ?? [])).catch(() => {});
  }, [isAuthenticated]);

  const hasWatchFilters =
    Object.values(watchFilters).some((v: string[] | number[]) => v.length > 0) || wristFit !== '';

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

  useEffect(() => { fetchGrid(); }, [fetchGrid]);

  const toggleCollectionFilter = (id: number) => {
    setSelectedCollectionIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
    router.push('/favourites', { scroll: false });
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

  const handleRenameCommit = async (collectionId: number, newName: string) => {
    setRenamingId(null);
    try {
      await renameCollection(collectionId, newName);
    } catch {
      // store reverts optimistically on error
    }
  };

  const handleAddCollection = async (name: string) => {
    if (isCreating) return;
    setIsCreating(true);
    setCreateError('');
    try {
      await createCollection(name);
      setIsAddingCollection(false);
      setNewCollectionName('');
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : 'Could not create collection');
    } finally {
      setIsCreating(false);
    }
  };

  const getCollectionName = useMemo(() => {
    const map = new Map(collections.map(c => [c.id, c.name]));
    return (id: number) => map.get(id) ?? '';
  }, [collections]);

  const watchCollectionNameMap = useMemo(() => {
    return new Map(watchCollections.map(c => [c.id, c.name]));
  }, [watchCollections]);

  const diameterOptions = useMemo(() => {
    const sizes = new Set<number>();
    catalogDiameterOptions.forEach(label => {
      const mm = parseInt(label, 10);
      if (!Number.isNaN(mm)) sizes.add(mm);
    });
    (watchData?.watches ?? []).forEach(w => {
      const specs = parseSpecs(w.specs);
      const mm = parseDiameterMm(specs?.case?.diameter as string | undefined);
      if (mm !== null) sizes.add(Math.floor(mm));
    });
    return Array.from(sizes).sort((a, b) => a - b).map(n => `${n}mm`);
  }, [catalogDiameterOptions, watchData]);

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
    if (page !== 1) router.replace('/favourites', { scroll: false });
  };

  const totalPages = !hasWatchFilters && watchData ? Math.ceil(watchData.totalCount / PAGE_SIZE) : 0;

  if (authLoading) return null;
  if (!isAuthenticated) return <GuestView />;

  const headingText =
    selectedCollectionIds.length === 1
      ? `Saved in: ${getCollectionName(selectedCollectionIds[0])}`
      : selectedCollectionIds.length > 1
        ? `${selectedCollectionIds.length} Collections Selected`
        : 'All Saved Watches';

  return (
    <main className="min-h-screen pt-32 pb-24 px-8 lg:px-16">
      <ScrollFade>
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
      </ScrollFade>

      <ScrollFade>
        <div className="mb-10">
          <h2 className="text-xs font-inter font-semibold text-[#bfa68a]/60 uppercase tracking-[0.15em] mb-4">
            Collections
          </h2>
          <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-hide">
            {collections.map(col => (
              <CollectionCard
                key={col.id}
                collection={col}
                isSelected={selectedCollectionIds.includes(col.id)}
                isRenaming={renamingId === col.id}
                formattedDate={`Updated ${formatDate(col.updatedAt)}`}
                onSelect={() => toggleCollectionFilter(col.id)}
                onRenameStart={() => setRenamingId(col.id)}
                onRenameCommit={name => handleRenameCommit(col.id, name)}
                onRenameCancel={() => setRenamingId(null)}
                onDelete={() => handleDeleteCollection(col.id)}
                isDeleting={deletingId === col.id}
              />
            ))}
            <AddCollectionCard
              isAdding={isAddingCollection}
              newName={newCollectionName}
              createError={createError}
              onStartAdding={() => { setIsAddingCollection(true); setCreateError(''); }}
              onNameChange={setNewCollectionName}
              onCommit={handleAddCollection}
              onCancel={() => { setIsAddingCollection(false); setNewCollectionName(''); setCreateError(''); }}
            />
          </div>
        </div>
      </ScrollFade>

      <ScrollFade>
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
      </ScrollFade>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <h2 className="font-playfair text-xl text-[#f0e6d2] font-light">{headingText}</h2>
          {selectedCollectionIds.length > 0 && (
            <button
              onClick={() => { setSelectedCollectionIds([]); router.push('/favourites', { scroll: false }); }}
              className="text-xs text-white/35 font-inter hover:text-white/60 transition-colors"
            >
              Clear filter
            </button>
          )}
        </div>

        <select
          value={sortBy}
          onChange={e => {
            const next = e.target.value;
            setSortBy(next);
            if (sortDebounceRef.current) clearTimeout(sortDebounceRef.current);
            sortDebounceRef.current = setTimeout(() => {
              router.push('/favourites', { scroll: false });
            }, 350);
          }}
          className="bg-black/40 border border-white/15 text-white/70 text-sm font-inter rounded-xl px-4 py-2 outline-none cursor-pointer hover:border-white/30 transition-colors"
        >
          {SORT_OPTIONS.map(opt => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      </div>

      {!watchData && gridLoading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
          {Array.from({ length: PAGE_SIZE }).map((_, i) => <SkeletonCard key={i} />)}
        </div>
      ) : displayedWatches.length > 0 ? (
        <>
          <div
            className={`grid grid-cols-2 lg:grid-cols-4 gap-6 transition-opacity duration-300 ${
              gridLoading ? 'opacity-40 pointer-events-none' : 'opacity-100'
            }`}
          >
            {displayedWatches.map(watch => {
              const membershipIds = watchData?.watchCollectionMembership[watch.id] ?? [];
              const labels = membershipIds.map(id => getCollectionName(id)).filter(Boolean);
              return (
                <ScrollFade key={watch.id}>
                  <WatchCard
                    watch={watch}
                    brandName={brands.find(b => b.id === watch.brandId)?.name}
                    collectionLabels={labels.length > 0 ? labels : undefined}
                    collectionName={watch.collectionId ? watchCollectionNameMap.get(watch.collectionId) : undefined}
                  />
                </ScrollFade>
              );
            })}
          </div>

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
      ) : !gridLoading ? (
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
      ) : null}
    </main>
  );
}
