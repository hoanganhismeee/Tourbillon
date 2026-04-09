// All watches grid + pagination.
// Featured keeps a stable catalogue order; personalized is an explicit sort mode.
'use client';

import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useRouter, useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { fetchWatches, fetchCollections, getTasteProfile, Brand } from '@/lib/api';
import { useScrollRestore } from '@/hooks/useScrollRestore';
import { useAuth } from '@/contexts/AuthContext';
import { WatchCard } from '../components/cards/WatchCard';
import { SortOrder, WatchOrderingService } from './WatchOrderingService';

interface AllWatchesSectionProps {
  brands: Brand[];
  brandFilters?: number[];
  collectionFilters?: number[];
}

function SortDropdown({ sortOrder, onSelect }: {
  sortOrder: SortOrder;
  onSelect: (value: SortOrder) => void;
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
    { key: 'default', label: 'Featured' },
    { key: 'personalized', label: 'Personalized for You' },
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
  const sortOrder = WatchOrderingService.parseSortOrder(searchParams.get('sort'));
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
  const watchesPerPage = 20;

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

  const hasPersonalizedTaste = isAuthenticated && WatchOrderingService.hasTastePreferences(tasteProfile);

  const handleSortChange = (nextSortOrder: SortOrder) => {
    const params = new URLSearchParams(searchParams.toString());
    if (nextSortOrder === 'default') {
      params.delete('sort');
    } else {
      params.set('sort', nextSortOrder);
    }
    params.delete('page');

    const query = params.toString();
    router.push(query ? `/watches?${query}` : '/watches', { scroll: false });
  };

  const featuredWatches = useMemo(() => {
    if (watches.length === 0) return [];
    return WatchOrderingService.buildFeaturedOrder(watches, brands, collections);
  }, [watches, brands, collections]);

  const personalizedWatches = useMemo(() => (
    WatchOrderingService.buildPersonalizedOrder(featuredWatches, tasteProfile, hasPersonalizedTaste)
  ), [featuredWatches, tasteProfile, hasPersonalizedTaste]);

  const activeOrder = useMemo(() => (
    sortOrder === 'personalized' && hasPersonalizedTaste ? personalizedWatches : featuredWatches
  ), [sortOrder, hasPersonalizedTaste, personalizedWatches, featuredWatches]);

  const filteredWatches = useMemo(() => {
    let result = activeOrder;
    if (brandFilters.length > 0) result = result.filter(watch => brandFilters.includes(watch.brandId));
    if (collectionFilters.length > 0) {
      result = result.filter(watch => watch.collectionId != null && collectionFilters.includes(watch.collectionId));
    }
    return result;
  }, [activeOrder, brandFilters, collectionFilters]);

  const sortedWatches = useMemo(() => {
    if (sortOrder === 'default' || sortOrder === 'personalized') return filteredWatches;
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

  const showPersonalizedHint = sortOrder === 'personalized' && !hasPersonalizedTaste;
  const personalizedHintCopy = isAuthenticated
    ? 'Tourbillon is learning your preferences as you browse. Keep exploring and your Watch DNA will begin shaping a more personal list.'
    : 'Tourbillon is learning your preferences as you browse. Sign in to create your Watch DNA and unlock a list shaped around you.';

  const isReady = featuredWatches.length > 0 || (!watchesLoading && watches.length === 0);
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
        </div>

        {!watchesLoading && (
          <>
            <SortDropdown
              sortOrder={sortOrder}
              onSelect={handleSortChange}
            />
            {showPersonalizedHint && (
              <div className="mt-4 max-w-md ml-auto text-right">
                <p className="text-[10px] uppercase tracking-[0.18em] text-white/32">
                  {personalizedHintCopy}
                </p>
              </div>
            )}
          </>
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
