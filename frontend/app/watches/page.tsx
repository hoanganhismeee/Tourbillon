// Watches browsing page — sidebar navigation + filterable watch grid.
// Multi-select: multiple brands and/or collections can be active simultaneously.
// Filter state is URL-driven (repeatable ?brand= and ?collection= params) for shareable links.
'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { AnimatePresence, motion } from 'framer-motion';
import { fetchBrands, fetchCollections } from '@/lib/api';
import BrandNavPanel from '../components/layout/BrandNavPanel';
import AllWatchesSection from './AllWatchesSection';
import ScrollFade from '../scrollMotion/ScrollFade';

const WatchesPage = () => {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [selectedBrandIds, setSelectedBrandIds] = useState<number[]>([]);
  const [selectedCollectionIds, setSelectedCollectionIds] = useState<number[]>([]);
  const [mobileFilterOpen, setMobileFilterOpen] = useState(false);

  const { data: brands = [] } = useQuery({ queryKey: ['brands'], queryFn: fetchBrands });
  const { data: collections = [] } = useQuery({ queryKey: ['collections'], queryFn: fetchCollections });

  // Resolve URL slugs → IDs once data loads. Runs once per navigation.
  const initializedRef = useRef(false);
  useEffect(() => {
    if (initializedRef.current || brands.length === 0 || collections.length === 0) return;

    const brandSlugs = searchParams.getAll('brand');
    const collectionSlugs = searchParams.getAll('collection');
    if (brandSlugs.length === 0 && collectionSlugs.length === 0) return;

    initializedRef.current = true;
    const resolvedBrandIds = brandSlugs
      .map(s => brands.find(b => b.slug === s)?.id)
      .filter((id): id is number => id != null);
    const resolvedCollections = collectionSlugs
      .map(s => collections.find(c => c.slug === s))
      .filter((c): c is NonNullable<typeof c> => c != null);
    const resolvedCollectionIds = resolvedCollections.map(c => c.id);

    // Auto-add parent brands for any resolved collections (so nav panel expands + highlights)
    const parentBrandIds = resolvedCollections.map(c => c.brandId);
    const mergedBrandIds = Array.from(new Set([...resolvedBrandIds, ...parentBrandIds]));

    setSelectedBrandIds(mergedBrandIds);
    setSelectedCollectionIds(resolvedCollectionIds);
  }, [brands, collections, searchParams]);

  // Build URL from current ID selections using slugs
  const buildUrl = (brandIds: number[], collectionIds: number[]) => {
    const params = new URLSearchParams();
    const sort = searchParams.get('sort');
    if (sort) params.set('sort', sort);

    brandIds.forEach(id => {
      const slug = brands.find(b => b.id === id)?.slug;
      if (slug) params.append('brand', slug);
    });
    collectionIds.forEach(id => {
      const slug = collections.find(c => c.id === id)?.slug;
      if (slug) params.append('collection', slug);
    });
    const query = params.toString();
    return query ? `/watches?${query}` : '/watches';
  };

  const handleBrandToggle = (brandId: number, _slug: string) => {
    const isDeselecting = selectedBrandIds.includes(brandId);
    const next = isDeselecting
      ? selectedBrandIds.filter(id => id !== brandId)
      : [...selectedBrandIds, brandId];
    // When deselecting a brand, also clear its collections from the filter
    const nextCols = isDeselecting
      ? selectedCollectionIds.filter(id => {
          const col = collections.find(c => c.id === id);
          return col?.brandId !== brandId;
        })
      : selectedCollectionIds;
    setSelectedBrandIds(next);
    setSelectedCollectionIds(nextCols);
    initializedRef.current = true;
    router.replace(buildUrl(next, nextCols), { scroll: false });
  };

  const handleCollectionToggle = (brandId: number, _brandSlug: string, collectionId: number, _collectionSlug: string) => {
    const nextCols = selectedCollectionIds.includes(collectionId)
      ? selectedCollectionIds.filter(id => id !== collectionId)
      : [...selectedCollectionIds, collectionId];
    // Auto-add parent brand when a collection is selected
    const nextBrands = nextCols.length > 0 && !selectedBrandIds.includes(brandId)
      ? [...selectedBrandIds, brandId]
      : selectedBrandIds;
    setSelectedBrandIds(nextBrands);
    setSelectedCollectionIds(nextCols);
    initializedRef.current = true;
    router.replace(buildUrl(nextBrands, nextCols), { scroll: false });
  };

  const handleClearAll = () => {
    setSelectedBrandIds([]);
    setSelectedCollectionIds([]);
    initializedRef.current = true;
    router.replace(buildUrl([], []), { scroll: false });
  };

  const activeFilterCount = selectedBrandIds.length + selectedCollectionIds.length;

  return (
    <div className="flex items-start py-24 pt-30">

      {/* Left: brand/collection tree — desktop only */}
      <div className="hidden lg:block pl-6 lg:pl-10 shrink-0">
        <ScrollFade>
          <BrandNavPanel
            selectedBrandIds={selectedBrandIds}
            selectedCollectionIds={selectedCollectionIds}
            onBrandToggle={handleBrandToggle}
            onCollectionToggle={handleCollectionToggle}
            onClearAll={handleClearAll}
          />
        </ScrollFade>
      </div>

      {/* Right: watch grid */}
      <div className="flex-1 min-w-0 px-4 sm:px-8 lg:px-12 pr-4 sm:pr-10 lg:pr-16">

        {/* Mobile filter button — hidden on desktop */}
        <div className="lg:hidden flex items-center justify-between mb-6">
          <button
            onClick={() => setMobileFilterOpen(true)}
            aria-label="Open filters"
            className="flex items-center gap-2 text-[10px] tracking-[0.18em] uppercase text-white/50 hover:text-white/80 transition-colors duration-200 border border-white/15 px-3 py-2"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 4h18M7 12h10M11 20h2" />
            </svg>
            <span>Filter</span>
            {activeFilterCount > 0 && (
              <span className="bg-[#bfa68a] text-black text-[9px] font-semibold rounded-full w-4 h-4 flex items-center justify-center leading-none">
                {activeFilterCount}
              </span>
            )}
          </button>
        </div>

        <AllWatchesSection
          brands={brands}
          brandFilters={selectedBrandIds}
          collectionFilters={selectedCollectionIds}
        />
      </div>

      {/* Mobile filter drawer */}
      <AnimatePresence>
        {mobileFilterOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 bg-black/60 z-40 lg:hidden"
              onClick={() => setMobileFilterOpen(false)}
            />
            {/* Drawer */}
            <motion.div
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
              className="fixed top-0 left-0 h-full w-72 max-w-[85vw] bg-[#0a0a0a] border-r border-white/10 z-50 flex flex-col lg:hidden"
            >
              {/* Drawer header */}
              <div className="flex items-center justify-between px-5 py-5 border-b border-white/10">
                <span className="text-[10px] tracking-[0.18em] uppercase text-white/40">Filters</span>
                <button
                  onClick={() => setMobileFilterOpen(false)}
                  aria-label="Close filters"
                  className="text-white/40 hover:text-white/80 transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Scrollable nav tree */}
              <div className="flex-1 overflow-y-auto py-4 px-2">
                <BrandNavPanel
                  className="w-full pr-2"
                  selectedBrandIds={selectedBrandIds}
                  selectedCollectionIds={selectedCollectionIds}
                  onBrandToggle={(brandId, slug) => { handleBrandToggle(brandId, slug); setMobileFilterOpen(false); }}
                  onCollectionToggle={(brandId, bSlug, colId, cSlug) => { handleCollectionToggle(brandId, bSlug, colId, cSlug); setMobileFilterOpen(false); }}
                  onClearAll={() => { handleClearAll(); setMobileFilterOpen(false); }}
                />
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

    </div>
  );
};

export default WatchesPage;
