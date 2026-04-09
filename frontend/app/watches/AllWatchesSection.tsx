// All watches grid + pagination.
// Uses a deterministic catalogue order, then applies a capped trend-led boost
// so recent behavior influences the first rows without taking over the page.
'use client';

import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useRouter, useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { fetchWatches, fetchCollections, getTasteProfile, Watch, Brand, TasteProfile } from '@/lib/api';
import { BrowsingEvent, getBufferedEvents } from '@/lib/behaviorTracker';
import { useScrollRestore } from '@/hooks/useScrollRestore';
import { useAuth } from '@/contexts/AuthContext';
import { WatchCard } from '../components/cards/WatchCard';

interface AllWatchesSectionProps {
  brands: Brand[];
  brandFilters?: number[];
  collectionFilters?: number[];
}

interface WatchSpecsParsed {
  case?: { material?: string; diameter?: string };
  dial?: { color?: string };
}

type SortOrder = 'default' | 'price-asc' | 'price-desc';

type RankedWatch = {
  watch: Watch;
  baseIndex: number;
  score: number;
};

const PERSONALIZED_WINDOW_SIZE = 48;
const PERSONALIZED_MIN_SCORE = 1;

function stableHash(input: string): number {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function brandCapForPosition(position: number): number {
  if (position < 12) return 3;
  if (position < 24) return 5;
  return Number.POSITIVE_INFINITY;
}

function interleaveByBrand(watches: Watch[], seed = 'tourbillon-default-grid'): Watch[] {
  const byBrand = new Map<number, Watch[]>();
  for (const watch of watches) {
    if (!byBrand.has(watch.brandId)) byBrand.set(watch.brandId, []);
    byBrand.get(watch.brandId)!.push(watch);
  }

  const groups = [...byBrand.entries()]
    .sort((a, b) => stableHash(`${seed}:brand:${a[0]}`) - stableHash(`${seed}:brand:${b[0]}`))
    .map(([, group]) =>
      [...group].sort((a, b) => stableHash(`${seed}:watch:${a.id}`) - stableHash(`${seed}:watch:${b.id}`))
    );

  const result: Watch[] = [];
  const maxLength = Math.max(...groups.map(group => group.length));
  for (let i = 0; i < maxLength; i++) {
    for (const group of groups) {
      if (i < group.length) result.push(group[i]);
    }
  }
  return result;
}

function scoreTasteMatch(watch: Watch, profile: TasteProfile): number {
  let score = 0;

  if (profile.preferredBrandIds.includes(watch.brandId)) score += 3;

  const specs: WatchSpecsParsed | null = (() => {
    try { return watch.specs ? JSON.parse(watch.specs) : null; } catch { return null; }
  })();

  if (specs?.case?.material && profile.preferredMaterials.length > 0) {
    const material = specs.case.material.toLowerCase();
    if (profile.preferredMaterials.some(value => material.includes(value.toLowerCase()))) score += 2;
  }

  if (specs?.dial?.color && profile.preferredDialColors.length > 0) {
    const color = specs.dial.color.toLowerCase();
    if (profile.preferredDialColors.some(value => color.includes(value.toLowerCase()))) score += 2;
  }

  if (specs?.case?.diameter && profile.preferredCaseSize) {
    const mmMatch = specs.case.diameter.match(/\d+\.?\d*/);
    if (mmMatch) {
      const mm = parseFloat(mmMatch[0]);
      const matches =
        profile.preferredCaseSize === 'small' ? mm < 37 :
        profile.preferredCaseSize === 'medium' ? mm >= 37 && mm <= 41 :
        mm > 41;
      if (matches) score += 1;
    }
  }

  if (profile.priceMin != null && profile.priceMax != null && watch.currentPrice > 0) {
    if (watch.currentPrice >= profile.priceMin && watch.currentPrice <= profile.priceMax) score += 1;
  }

  return score;
}

function behaviorRecencyWeight(timestamp: number): number {
  const ageInDays = (Date.now() - timestamp) / (1000 * 60 * 60 * 24);
  if (ageInDays <= 1) return 1.4;
  if (ageInDays <= 3) return 1.1;
  if (ageInDays <= 7) return 0.8;
  if (ageInDays <= 21) return 0.45;
  return 0.2;
}

function scoreBehaviorMatch(watch: Watch, events: BrowsingEvent[]): number {
  if (events.length === 0) return 0;

  let brandSignal = 0;
  let collectionSignal = 0;

  for (const event of events) {
    const weight = behaviorRecencyWeight(event.timestamp);

    if ((event.type === 'watch_view' && event.brandId === watch.brandId) ||
        (event.type === 'brand_view' && event.entityId === watch.brandId)) {
      brandSignal += event.type === 'watch_view' ? 1.15 * weight : 0.8 * weight;
    }

    if (event.type === 'collection_view' && watch.collectionId != null && event.entityId === watch.collectionId) {
      collectionSignal += 1.05 * weight;
    }
  }

  return Math.min(brandSignal, 2.6) + Math.min(collectionSignal, 1.8);
}

function hasAnyPreference(profile: TasteProfile): boolean {
  return (
    profile.preferredBrandIds.length > 0 ||
    profile.preferredMaterials.length > 0 ||
    profile.preferredDialColors.length > 0 ||
    profile.preferredCaseSize != null ||
    profile.priceMin != null ||
    profile.priceMax != null
  );
}

function blendPersonalizedOrder(
  baseWatches: Watch[],
  tasteProfile: TasteProfile | undefined,
  behaviorEvents: BrowsingEvent[],
  isPersonalized: boolean
): Watch[] {
  if (!isPersonalized) return baseWatches;

  const ranked: RankedWatch[] = baseWatches.map((watch, baseIndex) => ({
    watch,
    baseIndex,
    score: (tasteProfile ? scoreTasteMatch(watch, tasteProfile) : 0) + scoreBehaviorMatch(watch, behaviorEvents),
  }));

  const head = ranked.slice(0, PERSONALIZED_WINDOW_SIZE);
  const tail = ranked.slice(PERSONALIZED_WINDOW_SIZE);
  const promoted = head
    .filter(item => item.score >= PERSONALIZED_MIN_SCORE)
    .sort((a, b) => b.score - a.score || a.baseIndex - b.baseIndex);

  if (promoted.length === 0) return baseWatches;

  const headByBaseOrder = [...head].sort((a, b) => a.baseIndex - b.baseIndex);
  const result: RankedWatch[] = [];
  const usedIds = new Set<number>();
  const deferred: RankedWatch[] = [];
  const brandCounts = new Map<number, number>();

  for (const candidate of promoted) {
    const count = brandCounts.get(candidate.watch.brandId) ?? 0;
    if (count >= brandCapForPosition(result.length)) {
      deferred.push(candidate);
      continue;
    }

    result.push(candidate);
    usedIds.add(candidate.watch.id);
    brandCounts.set(candidate.watch.brandId, count + 1);
  }

  for (const candidate of headByBaseOrder) {
    if (usedIds.has(candidate.watch.id)) continue;

    const count = brandCounts.get(candidate.watch.brandId) ?? 0;
    if (count >= brandCapForPosition(result.length)) {
      deferred.push(candidate);
      continue;
    }

    result.push(candidate);
    usedIds.add(candidate.watch.id);
    brandCounts.set(candidate.watch.brandId, count + 1);
  }

  for (const candidate of deferred.sort((a, b) => a.baseIndex - b.baseIndex)) {
    if (!usedIds.has(candidate.watch.id)) {
      result.push(candidate);
      usedIds.add(candidate.watch.id);
    }
  }

  return [...result, ...tail].map(item => item.watch);
}

function SortDropdown({ sortOrder, onSelect, isPersonalized }: {
  sortOrder: SortOrder;
  onSelect: (value: SortOrder) => void;
  isPersonalized: boolean;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const handleOutside = useCallback((event: MouseEvent) => {
    if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false);
  }, []);

  useEffect(() => {
    if (open) document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, [open, handleOutside]);

  const options: { key: SortOrder; label: string }[] = [
    { key: 'default', label: isPersonalized ? 'Trend-Led' : 'Featured' },
    { key: 'price-asc', label: 'Price: Low to High' },
    { key: 'price-desc', label: 'Price: High to Low' },
  ];

  const active = options.find(option => option.key === sortOrder)!;

  return (
    <div ref={ref} className="relative flex justify-end mt-8">
      <button
        onClick={() => setOpen(value => !value)}
        className="flex items-center gap-2 text-[10px] tracking-[0.18em] uppercase transition-colors duration-200 text-white/40 hover:text-white/70 group"
      >
        <span className="text-white/20">Sort</span>
        <span className="text-[#bfa68a]">{active.label}</span>
        <svg
          className={`w-2.5 h-2.5 text-white/20 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
            className="absolute top-full right-0 mt-2 min-w-[160px] bg-[#0e0e0e] border border-white/10 py-1 z-20"
          >
            {options.map(option => (
              <button
                key={option.key}
                onClick={() => { onSelect(option.key); setOpen(false); }}
                className={`w-full text-left px-4 py-2.5 text-[10px] tracking-[0.14em] uppercase transition-colors duration-150 flex items-center justify-between ${
                  sortOrder === option.key
                    ? 'text-[#bfa68a]'
                    : 'text-white/35 hover:text-white/70'
                }`}
              >
                {option.label}
                {sortOrder === option.key && (
                  <span className="w-1 h-1 rounded-full bg-[#bfa68a] shrink-0" />
                )}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

const AllWatchesSection = ({ brands, brandFilters = [], collectionFilters = [] }: AllWatchesSectionProps) => {
  const { isAuthenticated } = useAuth();
  const searchParams = useSearchParams();
  const router = useRouter();
  const currentPage = Number(searchParams.get('page') ?? '1');
  const isUserPaging = useRef(false);

  const goToPage = (page: number) => {
    isUserPaging.current = true;
    const params = new URLSearchParams(searchParams.toString());
    if (page === 1) {
      params.delete('page');
    } else {
      params.set('page', String(page));
    }
    const query = params.toString();
    router.push(query ? `/watches?${query}` : '/watches', { scroll: false });
  };

  const [showAllWatches, setShowAllWatches] = useState(false);
  const [sortOrder, setSortOrder] = useState<SortOrder>('default');
  const watchesPerPage = 20;

  const [behaviorEvents, setBehaviorEvents] = useState<BrowsingEvent[]>([]);
  useEffect(() => { setBehaviorEvents(getBufferedEvents()); }, []);

  const { data: watches = [], isLoading: watchesLoading } = useQuery({
    queryKey: ['watches'],
    queryFn: fetchWatches,
  });

  const { data: collections = [] } = useQuery({
    queryKey: ['collections'],
    queryFn: fetchCollections,
  });

  const { data: tasteProfile } = useQuery({
    queryKey: ['tasteProfile'],
    queryFn: getTasteProfile,
    enabled: isAuthenticated,
    retry: false,
  });

  const isPersonalized = isAuthenticated && (
    (!!tasteProfile && hasAnyPreference(tasteProfile)) || behaviorEvents.length > 0
  );

  const orderedWatches = useMemo(() => {
    if (watches.length === 0) return [];
    const baseOrder = interleaveByBrand(watches);
    return blendPersonalizedOrder(baseOrder, tasteProfile, behaviorEvents, isPersonalized);
  }, [watches, tasteProfile, behaviorEvents, isPersonalized]);

  const filteredWatches = useMemo(() => {
    let result = orderedWatches;
    if (brandFilters.length > 0) result = result.filter(watch => brandFilters.includes(watch.brandId));
    if (collectionFilters.length > 0) {
      result = result.filter(watch => watch.collectionId != null && collectionFilters.includes(watch.collectionId));
    }
    return result;
  }, [orderedWatches, brandFilters, collectionFilters]);

  const sortedWatches = useMemo(() => {
    if (sortOrder === 'default') return filteredWatches;
    return [...filteredWatches].sort((a, b) => {
      const aPoR = a.currentPrice === 0;
      const bPoR = b.currentPrice === 0;
      if (aPoR && bPoR) return 0;
      if (aPoR) return 1;
      if (bPoR) return -1;
      return sortOrder === 'price-asc'
        ? a.currentPrice - b.currentPrice
        : b.currentPrice - a.currentPrice;
    });
  }, [filteredWatches, sortOrder]);

  const headingLabel = useMemo(() => {
    if (collectionFilters.length === 1) return collections.find(item => item.id === collectionFilters[0])?.name ?? 'All Timepieces';
    if (collectionFilters.length > 1) return `${collectionFilters.length} Collections`;
    if (brandFilters.length === 1) return brands.find(item => item.id === brandFilters[0])?.name ?? 'All Timepieces';
    if (brandFilters.length > 1) return `${brandFilters.length} Brands`;
    return 'All Timepieces';
  }, [brandFilters, collectionFilters, brands, collections]);

  const isReady = orderedWatches.length > 0 || (!watchesLoading && watches.length === 0);
  useScrollRestore(isReady);

  useEffect(() => {
    if (!isUserPaging.current) return;
    isUserPaging.current = false;
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [currentPage]);

  const initialWatches = sortedWatches.slice(0, 12);
  const additionalWatches = sortedWatches.slice(12, 20);
  const displayedWatches = showAllWatches ? [...initialWatches, ...additionalWatches] : initialWatches;

  const totalPages = Math.ceil(sortedWatches.length / watchesPerPage);
  const startIndex = (currentPage - 1) * watchesPerPage;
  const paginatedWatches = sortedWatches.slice(startIndex, startIndex + watchesPerPage);

  return (
    <section>
      <div className="mb-16">
        <div className="text-center">
          <h2 className="text-5xl font-playfair font-bold text-[#f0e6d2]">
            {currentPage === 1 ? headingLabel : `${headingLabel} - Page ${currentPage}`}
          </h2>
          {isPersonalized && (
            <>
              <span className="inline-block mt-3 px-3 py-1 rounded-full text-xs border border-[var(--primary-brown)]/40 text-[var(--primary-brown)]">
                Trend-led for you
              </span>
              <p className="mt-4 text-[10px] uppercase tracking-[0.28em] text-white/35">
                Recent signals shape the first rows. The wider catalog stays curated.
              </p>
            </>
          )}
        </div>

        {!watchesLoading && (
          <SortDropdown
            sortOrder={sortOrder}
            onSelect={setSortOrder}
            isPersonalized={isPersonalized}
          />
        )}
      </div>

      {watchesLoading ? (
        <div className="text-center py-16">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white/40 mx-auto mb-4" />
          <p className="text-white/60 font-playfair">Loading watches...</p>
        </div>
      ) : (
        <>
          {currentPage === 1 ? (
            <div>
              <div className="grid grid-cols-4 gap-x-8 gap-y-20 mb-20">
                {displayedWatches.map((watch, index) => (
                  <WatchCard
                    key={watch.id}
                    watch={watch}
                    brands={brands}
                    collections={collections}
                    isPriority={index < 4}
                    currentPage={currentPage}
                  />
                ))}
              </div>

              {sortedWatches.length > 16 && (
                <div className="text-center mt-8">
                  <button
                    onClick={(event) => {
                      event.preventDefault();
                      setShowAllWatches(value => !value);
                    }}
                    className="inline-flex items-center text-[#f0e6d2] hover:text-white transition-colors duration-500 text-xl font-playfair font-medium hover:scale-105"
                  >
                    {!showAllWatches ? (
                      <div className="flex flex-col items-center">
                        <span>Show More</span>
                        <div className="flex flex-col mt-0">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                          <svg className="w-4 h-4 -mt-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center">
                        <div className="flex flex-col mb-0">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                          </svg>
                          <svg className="w-4 h-4 -mt-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                          </svg>
                        </div>
                        <span>Show Less</span>
                      </div>
                    )}
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div>
              <div className="grid grid-cols-4 gap-x-8 gap-y-20 mb-20">
                {paginatedWatches.map(watch => (
                  <WatchCard
                    key={watch.id}
                    watch={watch}
                    brands={brands}
                    collections={collections}
                    currentPage={currentPage}
                  />
                ))}
              </div>
            </div>
          )}

          {totalPages > 1 && (showAllWatches || currentPage > 1) && (
            <div className="text-center mt-16">
              <div className="flex items-center justify-center gap-4">
                {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                  <button
                    key={page}
                    onClick={(event) => {
                      event.preventDefault();
                      goToPage(page);
                    }}
                    className={`px-4 py-2 rounded-lg transition-all duration-300 ${
                      currentPage === page
                        ? 'bg-[#f0e6d2] text-black font-semibold'
                        : 'text-[#f0e6d2] hover:text-white hover:bg-black/20'
                    }`}
                  >
                    {page}
                  </button>
                ))}
                {currentPage < totalPages && (
                  <button
                    onClick={(event) => {
                      event.preventDefault();
                      goToPage(currentPage + 1);
                    }}
                    className="text-[#f0e6d2] hover:text-white transition-colors duration-300 ml-4"
                  >
                    &gt;&gt;
                  </button>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </section>
  );
};

export default AllWatchesSection;
