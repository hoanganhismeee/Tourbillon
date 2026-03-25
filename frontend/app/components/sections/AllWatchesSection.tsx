// AllWatchesSection component - handles watches display, pagination, and data management
// All watches grid + pagination. Data cached via TanStack Query; images optimized via Cloudinary.
// First row images are prioritized for a snappier feel; others lazy-load.
// Includes one-time retry for transient image load issues.
'use client';

import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { fetchWatches, fetchCollections, getTasteProfile, Watch, Collection, Brand, TasteProfile } from '@/lib/api';
import { imageTransformations, getOptimizedImageUrl } from '@/lib/cloudinary';
import Image from 'next/image';
import { useWatchesPage } from '@/contexts/WatchesPageContext';
import { useNavigation } from '@/contexts/NavigationContext';
import { useScrollRestore } from '@/hooks/useScrollRestore';
import { useAuth } from '@/contexts/AuthContext';
import CompareToggle from '../compare/CompareToggle';


// Individual watch card component for grid layout
// Displays watch image, brand name, collection, model name, and price
const WatchCard = ({ watch, brands, collections, isPriority = false, currentPage }: {
  watch: Watch;
  brands: Brand[];
  collections: Collection[];
  // Eager-load above-the-fold images to improve perceived speed on first render
  isPriority?: boolean;
  currentPage: number;
}) => {
  const { saveNavigationState } = useNavigation();

  const handleWatchClick = () => {
    saveNavigationState({
      scrollPosition: window.scrollY,
      currentPage,
      path: window.location.pathname,
      timestamp: Date.now(),
    });
  };

  // Local retry state for handling intermittent Cloudinary/optimizer hiccups
  const [src, setSrc] = useState<string>(watch.imageUrl || imageTransformations.card(watch.image));
  const [retryCount, setRetryCount] = useState<number>(0);

  const handleImgError = () => {
    // One fallback attempt: switch to explicit JPG and add a cache-busting query param
    if (retryCount < 1) {
      setRetryCount(1);
      const fallback = getOptimizedImageUrl(watch.image, {
        width: 800,
        height: 800,
        crop: 'fit',
        quality: 'auto',
        format: 'jpg',
      }) + `?r=${Date.now()}`;
      setSrc(fallback);
    }
  };

  const router = useRouter();

  const handleBrandClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    router.push(`/brands/${watch.brandId}`);
  };

  const handleCollectionClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (watch.collectionId) {
      router.push(`/collections/${watch.collectionId}`);
    }
  };

  return (
    <div className="group relative block bg-gradient-to-br from-white/5 to-white/10 backdrop-blur-sm border border-white/20 rounded-2xl p-4 transition-all duration-500 hover:bg-gradient-to-br hover:from-white/10 hover:to-white/15 hover:border-white/30 hover:scale-105 hover:shadow-2xl hover:shadow-white/10">
      {/* Watch image with Cloudinary optimization - Clickable to watch details */}
      <div className="relative mb-4">
        <Link href={`/watches/${watch.id}`} onClick={handleWatchClick}>
          <div className="w-full aspect-square bg-gradient-to-br from-black/40 to-black/60 rounded-xl flex items-center justify-center border border-white/10 overflow-hidden cursor-pointer">
            {watch.image ? (
              <Image
                src={src}
                alt={watch.name}
                width={400}
                height={400}
                sizes="(min-width: 1280px) 25vw, (min-width: 768px) 33vw, 50vw"
                className="w-full h-full object-contain rounded-xl"
                priority={isPriority}
                fetchPriority={isPriority ? 'high' as const : 'auto'}
                placeholder="blur"
                blurDataURL={getOptimizedImageUrl(watch.image, { width: 16, height: 16, quality: 1, crop: 'fill', format: 'jpg' })}
                onError={handleImgError}
              />
            ) : (
              <span className="text-white/60 text-xs font-light">{watch.name}</span>
            )}
          </div>
        </Link>
        {/* Action button field — bottom-right of image, visible on hover */}
        <div className="absolute bottom-2.5 right-2.5 z-10 flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
          <CompareToggle watch={watch} />
        </div>
      </div>

      {/* Watch information - brand, collection, model, price */}
      <div className="space-y-2">
        <button
          onClick={handleBrandClick}
          className="text-xs text-white/60 hover:text-white/90 font-inter font-light uppercase tracking-wide transition-colors cursor-pointer bg-transparent border-none p-0 text-left"
        >
          {brands.find(b => b.id === watch.brandId)?.name || 'Unknown Brand'}
        </button>

        {watch.collectionId && collections.find(c => c.id === watch.collectionId) && (
          <button
            onClick={handleCollectionClick}
            className="block text-xs text-white/50 hover:text-white/80 font-inter font-light transition-colors cursor-pointer bg-transparent border-none p-0 text-left"
          >
            {collections.find(c => c.id === watch.collectionId)?.name}
          </button>
        )}

        <Link href={`/watches/${watch.id}`} onClick={handleWatchClick}>
          <h3 className="text-sm font-inter font-medium text-white group-hover:text-[#f0e6d2] transition-colors truncate cursor-pointer">
            {watch.name}
          </h3>
        </Link>

        <p className="text-lg text-[#f0e6d2] font-inter font-semibold">
          {watch.currentPrice === 0 ? 'Price on Request' : `$${watch.currentPrice.toLocaleString()}`}
        </p>
      </div>
    </div>
  );
};

// Props interface for AllWatchesSection component
interface AllWatchesSectionProps {
  brands: Brand[]; // Passed from parent component for brand name lookup
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
const AllWatchesSection = ({ brands }: AllWatchesSectionProps) => {
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
  const initialWatches = shuffledWatches.slice(0, 12);
  const additionalWatches = shuffledWatches.slice(12, 20);
  const displayedWatches = showAllWatches ? [...initialWatches, ...additionalWatches] : initialWatches;

  // Pages 2+ pagination
  const totalPages = Math.ceil(shuffledWatches.length / watchesPerPage);
  const startIndex = (currentPage - 1) * watchesPerPage;
  const paginatedWatches = shuffledWatches.slice(startIndex, startIndex + watchesPerPage);

  return (
    <section>
      <div className="text-center mb-20">
        <h2 className="text-5xl font-playfair font-bold text-[#f0e6d2]">
          {currentPage === 1 ? 'All Watches' : `Watches - Page ${currentPage}`}
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
            <div className="max-w-7xl mx-auto">
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

              {shuffledWatches.length > 16 && (
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
            <div className="max-w-7xl mx-auto">
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
