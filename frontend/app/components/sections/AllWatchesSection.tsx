// AllWatchesSection component - handles watches display, pagination, and data management
// All watches grid + pagination. Data cached via TanStack Query; images optimized via Cloudinary.
// First row images are prioritized for a snappier feel; others lazy-load.
// Includes one-time retry for transient image load issues.
'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { fetchWatches, fetchCollections, getTasteProfile, Watch, Collection, Brand, TasteProfile } from '@/lib/api';
import { useWatchesPage } from '@/contexts/WatchesPageContext';
import { useScrollRestore } from '@/hooks/useScrollRestore';
import { useAuth } from '@/contexts/AuthContext';
import { WatchCard } from '../cards/WatchCard';

// Props interface for AllWatchesSection component
interface AllWatchesSectionProps {
  brands: Brand[]; // Passed from parent component for brand name lookup
  brandFilter?: number | null;
  collectionFilter?: number | null;
}

// Trinity watch IDs excluded from the "All Watches" grid (shown separately in TrinityShowcase)
const TRINITY_WATCH_IDS = [1, 2, 3, 32, 33, 34, 57, 58, 59];

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
const AllWatchesSection = ({ brands, brandFilter = null, collectionFilter = null }: AllWatchesSectionProps) => {
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
    if (page === 1) {
      router.push('/watches', { scroll: false });
    } else {
      router.push(`/watches?page=${page}`, { scroll: false });
    }
  };

  const [shuffledWatches, setShuffledWatches] = useState<Watch[]>([]);
  const [showAllWatches, setShowAllWatches] = useState(false);
  const watchesPerPage = 20;

  const { data: watches = [], isLoading: watchesLoading } = useQuery({
    queryKey: ['watches'],
    queryFn: fetchWatches,
  });

  const { data: collections = [] } = useQuery({
    queryKey: ['collections'],
    queryFn: fetchCollections,
  });

  // Fetch taste profile only for authenticated users; staleTime:Infinity so it
  // only refreshes when explicitly invalidated (i.e. after the user saves their taste).
  const { data: tasteProfile } = useQuery({
    queryKey: ['tasteProfile'],
    queryFn: getTasteProfile,
    enabled: isAuthenticated,
    staleTime: Infinity,
    retry: false,
  });

  const isPersonalized = isAuthenticated && !!tasteProfile && hasAnyPreference(tasteProfile);

  // Sort watches by taste score on load and whenever the profile changes.
  // Matched watches (score > 0) float to the top, sorted highest-first.
  // Unmatched watches keep the interleaved-by-brand shuffle for visual variety.
  // Falls back to the standard interleave shuffle when no preferences are set.
  useEffect(() => {
    if (watches.length === 0) return;
    const filtered = watches.filter(w => !TRINITY_WATCH_IDS.includes(w.id));

    if (isPersonalized && tasteProfile) {
      const scored = filtered.map(w => ({ watch: w, score: scoreTasteMatch(w, tasteProfile) }));
      const matched   = scored.filter(s => s.score > 0).sort((a, b) => b.score - a.score).map(s => s.watch);
      const unmatched = scored.filter(s => s.score === 0).map(s => s.watch);
      setShuffledWatches([...matched, ...interleaveByBrand(unmatched)]);
      setHasShuffledWatches(true);
    } else if (!hasShuffledWatches) {
      setShuffledWatches(interleaveByBrand(filtered));
      setHasShuffledWatches(true);
    } else {
      setShuffledWatches(filtered);
    }
  }, [watches, tasteProfile]); // eslint-disable-line react-hooks/exhaustive-deps

  // Apply brand/collection filters on top of the shuffled order
  const filteredWatches = useMemo(() => {
    let result = shuffledWatches;
    if (brandFilter != null) result = result.filter(w => w.brandId === brandFilter);
    if (collectionFilter != null) result = result.filter(w => w.collectionId === collectionFilter);
    return result;
  }, [shuffledWatches, brandFilter, collectionFilter]);

  // Heading label reflects active filter context
  const headingLabel = useMemo(() => {
    if (collectionFilter != null) return collections.find(c => c.id === collectionFilter)?.name ?? 'All Watches';
    if (brandFilter != null) return brands.find(b => b.id === brandFilter)?.name ?? 'All Watches';
    return 'All Watches';
  }, [brandFilter, collectionFilter, brands, collections]);

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
