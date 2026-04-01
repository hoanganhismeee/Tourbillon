// Watches browsing page — sidebar navigation + filterable watch grid.
// Brand/collection panel on the left lets users drill into specific families
// while AllWatchesSection handles the grid, pagination, and taste personalisation.
'use client';

import React, { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { fetchBrands } from '@/lib/api';
import BrandNavPanel from '../components/layout/BrandNavPanel';
import AllWatchesSection from '../components/sections/AllWatchesSection';

const WatchesPage = () => {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [activeBrandId, setActiveBrandId] = useState<number | null>(null);
  const [activeCollectionId, setActiveCollectionId] = useState<number | null>(null);

  const brandSlug = searchParams.get('brand') ?? undefined;
  const collectionSlug = searchParams.get('collection') ?? undefined;

  const { data: brands = [] } = useQuery({
    queryKey: ['brands'],
    queryFn: fetchBrands,
  });

  // Sync filter state and URL simultaneously — always resets to page 1
  const handleBrandSelect = (brandId: number | null, slug?: string) => {
    setActiveBrandId(brandId);
    setActiveCollectionId(null);
    router.replace(brandId && slug ? `/watches?brand=${slug}` : '/watches', { scroll: false });
  };

  const handleCollectionSelect = (brandId: number, brandSlug: string, collectionId: number | null, collectionSlug?: string) => {
    setActiveBrandId(brandId);
    setActiveCollectionId(collectionId);
    const url = collectionId && collectionSlug
      ? `/watches?brand=${brandSlug}&collection=${collectionSlug}`
      : `/watches?brand=${brandSlug}`;
    router.replace(url, { scroll: false });
  };

  return (
    <div className="flex items-start py-24 pt-30">

      {/* Left: brand/collection tree — small left padding so it hugs the viewport edge */}
      <div className="pl-6 lg:pl-10 shrink-0">
        <BrandNavPanel
          activeBrandId={activeBrandId}
          activeCollectionId={activeCollectionId}
          onBrandSelect={handleBrandSelect}
          onCollectionSelect={handleCollectionSelect}
          initialBrandSlug={brandSlug}
          initialCollectionSlug={collectionSlug}
        />
      </div>

      {/* Right: watch grid — takes remaining space with balanced right padding */}
      <div className="flex-1 min-w-0 px-8 lg:px-12 pr-10 lg:pr-16">
        <AllWatchesSection
          brands={brands}
          brandFilter={activeBrandId}
          collectionFilter={activeCollectionId}
        />
      </div>

    </div>
  );
};

export default WatchesPage;
