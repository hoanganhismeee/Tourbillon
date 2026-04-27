// Watches browsing page — sidebar navigation + filterable watch grid.
// Multi-select: multiple brands and/or collections can be active simultaneously.
// Filter state is URL-driven (repeatable ?brand= and ?collection= params) for shareable links.
'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { fetchBrands, fetchCollections } from '@/lib/api';
import BrandNavPanel from '../components/layout/BrandNavPanel';
import AllWatchesSection from './AllWatchesSection';
import ScrollFade from '../scrollMotion/ScrollFade';

const WatchesPage = () => {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [selectedBrandIds, setSelectedBrandIds] = useState<number[]>([]);
  const [selectedCollectionIds, setSelectedCollectionIds] = useState<number[]>([]);

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

  return (
    <div className="flex items-start py-24 pt-30">

      {/* Left: brand/collection tree */}
      <div className="pl-6 lg:pl-10 shrink-0">
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
      <div className="flex-1 min-w-0 px-8 lg:px-12 pr-10 lg:pr-16">
        <AllWatchesSection
          brands={brands}
          brandFilters={selectedBrandIds}
          collectionFilters={selectedCollectionIds}
        />
      </div>

    </div>
  );
};

export default WatchesPage;
