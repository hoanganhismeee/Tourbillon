// AllWatchesSection component - handles watches display, pagination, and data management
// All watches grid + pagination. Data cached via TanStack Query; images optimized via Cloudinary.
// First row images are prioritized for a snappier feel; others lazy-load.
// Includes one-time retry for transient image load issues.
'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { fetchWatches, fetchCollections, getTasteProfile, Watch, Collection, Brand, TasteProfile } from '@/lib/api';
import { BrowsingEvent, getBufferedEvents } from '@/lib/behaviorTracker';
import { useWatchesPage } from '@/contexts/WatchesPageContext';
import { useScrollRestore } from '@/hooks/useScrollRestore';
import { useAuth } from '@/contexts/AuthContext';
import { WatchCard } from '../cards/WatchCard';

// Props interface for AllWatchesSection component
interface AllWatchesSectionProps {
  brands: Brand[]; // Passed from parent component for brand name lookup
  brandFilters?: number[];
  collectionFilters?: number[];
}

// Interleave watches so no two adjacent cards share the same brand.
// Groups by brand → shuffles within each group → shuffles brand order → round-robins columns.
// Result: a grid row always shows different brands, giving maximum visual variety.
function interleaveByBrand(watches: Watch[]): Watch[] {
  const byBrand = new Map<number, Watch[]>();
  for (const w of watches) {
    if (!byBrand.has(w.brandId)) byBrand.set(w.brandId, []);
    byBrand.get(w.brandId)!.push(w);
  }
  // Shuffle within each brand then shuffle brand order
  const groups = [...byBrand.values()]
    .map(g => [...g].sort(() => Math.random() - 0.5))
    .sort(() => Math.random() - 0.5);

  // Round-robin: pick one from each brand per pass
  const result: Watch[] = [];
  const maxLen = Math.max(...groups.map(g => g.length));
  for (let i = 0; i < maxLen; i++) {
    for (const group of groups) {
      if (i < group.length) result.push(group[i]);
    }
  }
  return result;
}

// Parsed shape of the Watch.specs JSON field used for taste scoring
interface WatchSpecsParsed {
  case?: { material?: string; diameter?: string };
  dial?: { color?: string };
}

// Score a watch against a taste profile (mirrors TasteProfileService.ScoreWatch in C#).
// +3 brand, +2 material, +2 dial color, +1 case size, +1 price = 9 max.
function scoreTasteMatch(watch: Watch, profile: TasteProfile): number {
  let score = 0;

  if (profile.preferredBrandIds.includes(watch.brandId)) score += 3;

  const specs: WatchSpecsParsed | null = (() => {
    try { return watch.specs ? JSON.parse(watch.specs) : null; } catch { return null; }
  })();

  if (specs?.case?.material && profile.preferredMaterials.length > 0) {
    const mat = specs.case.material.toLowerCase();
    if (profile.preferredMaterials.some(m => mat.includes(m.toLowerCase()))) score += 2;
  }

  if (specs?.dial?.color && profile.preferredDialColors.length > 0) {
    const col = specs.dial.color.toLowerCase();
    if (profile.preferredDialColors.some(c => col.includes(c.toLowerCase()))) score += 2;
  }

  if (specs?.case?.diameter && profile.preferredCaseSize) {
    const mmMatch = specs.case.diameter.match(/\d+\.?\d*/);
    if (mmMatch) {
      const mm = parseFloat(mmMatch[0]);
      const matches =
        profile.preferredCaseSize === 'small'  ? mm < 37 :
        profile.preferredCaseSize === 'medium' ? mm >= 37 && mm <= 41 :
        mm > 41;
      if (matches) score += 1;
    }
  }

  // Exclude PoR watches (price === 0) from price scoring
  if (profile.priceMin != null && profile.priceMax != null && watch.currentPrice > 0) {
    if (watch.currentPrice >= profile.priceMin && watch.currentPrice <= profile.priceMax) score += 1;
  }

  return score;
}

// Score a watch from raw browsing events — no AI required.
// Counts brand/collection visit frequency; capped to avoid over-weighting a single obsession.
// Brand hits: watch_view.brandId + brand_view.entityId; cap +3. Collection hits: cap +2.
function scoreBehaviorMatch(watch: Watch, events: BrowsingEvent[]): number {
  if (events.length === 0) return 0;
  let brandHits = 0;
  let collectionHits = 0;
  for (const e of events) {
    if ((e.type === 'watch_view' && e.brandId === watch.brandId) ||
        (e.type === 'brand_view' && e.entityId === watch.brandId)) {
      brandHits++;
    }
    if (e.type === 'collection_view' && watch.collectionId != null && e.entityId === watch.collectionId) {
      collectionHits++;
    }
  }
  return Math.min(brandHits, 3) + Math.min(collectionHits, 2);
}

// Returns true when the profile has at least one preference set
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

// Main component: handles watches display, pagination, and shuffle logic
const AllWatchesSection = ({ brands, brandFilters = [], collectionFilters = [] }: AllWatchesSectionProps) => {
  const { isAuthenticated } = useAuth();
  const { hasShuffledWatches, setHasShuffledWatches } = useWatchesPage();
  const searchParams = useSearchParams();
  const router = useRouter();
  const currentPage = Number(searchParams.get('page') ?? '1');

  // True only when the user explicitly clicks a pagination button.
  // Keeps scroll-to-top from firing on browser back-navigation.
  const isUserPaging = useRef(false);

  const goToPage = (page: number) => {
    isUserPaging.current = true;
    // Preserve existing brand/collection filter params when changing page
    const params = new URLSearchParams(searchParams.toString());
    if (page === 1) {
      params.delete('page');
    } else {
      params.set('page', String(page));
    }
    const query = params.toString();
    router.push(query ? `/watches?${query}` : '/watches', { scroll: false });
  };

  const [shuffledWatches, setShuffledWatches] = useState<Watch[]>([]);
  const [showAllWatches, setShowAllWatches] = useState(false);
  const watchesPerPage = 20;

  // Read browsing events from localStorage once on mount — drives instant scoring
  // without needing a generated AI profile.
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

  // Fetch taste profile for authenticated users — used for material/dial/price/size scoring.
  // Brand-level personalization comes from behaviorEvents (instant, no AI); AI profile enriches it.
  const { data: tasteProfile } = useQuery({
    queryKey: ['tasteProfile'],
    queryFn: getTasteProfile,
    enabled: isAuthenticated,
    retry: false,
  });

  // Personalized if: authenticated AND (has AI profile preferences OR has browsing history)
  const isPersonalized = isAuthenticated && (
    (!!tasteProfile && hasAnyPreference(tasteProfile)) || behaviorEvents.length > 0
  );

  // Sort watches by combined score on load and whenever profile or behavior events change.
  // Behavioral score (instant, from localStorage) + AI profile score (material/dial/price/size).
  // Matched watches (score > 0) float to top sorted highest-first; unmatched keep brand interleave.
  useEffect(() => {
    if (watches.length === 0) return;

    if (isPersonalized) {
      const scored = watches.map(w => ({
        watch: w,
        score: (tasteProfile ? scoreTasteMatch(w, tasteProfile) : 0) + scoreBehaviorMatch(w, behaviorEvents),
      }));
      const matched   = scored.filter(s => s.score > 0).sort((a, b) => b.score - a.score).map(s => s.watch);
      const unmatched = scored.filter(s => s.score === 0).map(s => s.watch);
      setShuffledWatches([...matched, ...interleaveByBrand(unmatched)]);
      setHasShuffledWatches(true);
    } else if (!hasShuffledWatches) {
      setShuffledWatches(interleaveByBrand(watches));
      setHasShuffledWatches(true);
    } else {
      setShuffledWatches(watches);
    }
  }, [watches, tasteProfile, behaviorEvents]); // eslint-disable-line react-hooks/exhaustive-deps

  // Apply brand/collection filters on top of the shuffled order
  const filteredWatches = useMemo(() => {
    let result = shuffledWatches;
    if (brandFilters.length > 0) result = result.filter(w => brandFilters.includes(w.brandId));
    if (collectionFilters.length > 0) result = result.filter(w => w.collectionId != null && collectionFilters.includes(w.collectionId));
    return result;
  }, [shuffledWatches, brandFilters, collectionFilters]);

  // Heading label reflects active filter context
  const headingLabel = useMemo(() => {
    if (collectionFilters.length === 1) return collections.find(c => c.id === collectionFilters[0])?.name ?? 'All Watches';
    if (collectionFilters.length > 1) return `${collectionFilters.length} Collections`;
    if (brandFilters.length === 1) return brands.find(b => b.id === brandFilters[0])?.name ?? 'All Watches';
    if (brandFilters.length > 1) return `${brandFilters.length} Brands`;
    return 'All Watches';
  }, [brandFilters, collectionFilters, brands, collections]);

  // isReady: content is in the DOM (either watches rendered, or confirmed empty)
  const isReady = shuffledWatches.length > 0 || (!watchesLoading && watches.length === 0);
  useScrollRestore(isReady);

  // Scroll to top only when the user explicitly clicks a pagination button.
  useEffect(() => {
    if (!isUserPaging.current) return;
    isUserPaging.current = false;
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [currentPage]);

  // Page 1 grid slices
  const initialWatches = filteredWatches.slice(0, 12);
  const additionalWatches = filteredWatches.slice(12, 20);
  const displayedWatches = showAllWatches ? [...initialWatches, ...additionalWatches] : initialWatches;

  // Pages 2+ pagination
  const totalPages = Math.ceil(filteredWatches.length / watchesPerPage);
  const startIndex = (currentPage - 1) * watchesPerPage;
  const paginatedWatches = filteredWatches.slice(startIndex, startIndex + watchesPerPage);

  return (
    <section>
      <div className="text-center mb-20">
        <h2 className="text-5xl font-playfair font-bold text-[#f0e6d2]">
          {currentPage === 1 ? headingLabel : `${headingLabel} — Page ${currentPage}`}
        </h2>
        {isPersonalized && (
          <span className="inline-block mt-3 px-3 py-1 rounded-full text-xs border border-[var(--primary-brown)]/40 text-[var(--primary-brown)]">
            Personalized for you
          </span>
        )}
      </div>

      {/* Loading state */}
      {watchesLoading ? (
        <div className="text-center py-16">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white/40 mx-auto mb-4"></div>
          <p className="text-white/60 font-playfair">Loading watches...</p>
        </div>
      ) : (
        <>
          {currentPage === 1 ? (
            // PAGE 1: Grid layout with Show More functionality
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

              {filteredWatches.length > 16 && (
                <div className="text-center mt-8">
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      setShowAllWatches(!showAllWatches);
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
            // PAGES 2+: Grid layout
            <div>
              <div className="grid grid-cols-4 gap-x-8 gap-y-20 mb-20">
                {paginatedWatches.map((watch) => (
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

          {/* Pagination Controls */}
          {totalPages > 1 && (showAllWatches || currentPage > 1) && (
            <div className="text-center mt-16">
              <div className="flex items-center justify-center gap-4">
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                  <button
                    key={page}
                    onClick={(e) => {
                      e.preventDefault();
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
                    onClick={(e) => {
                      e.preventDefault();
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
