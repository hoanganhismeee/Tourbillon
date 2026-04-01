// Sticky left sidebar for the watches page — ALS-inspired brand/collection tree navigation.
// Brands collapse/expand to reveal their collections. Active state highlights with a cream-gold accent line.
// Shares the same TanStack Query cache keys as the page so no extra requests fire.
'use client';

import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
import { fetchBrands, fetchCollections } from '@/lib/api';

interface BrandNavPanelProps {
  activeBrandId: number | null;
  activeCollectionId: number | null;
  onBrandSelect: (brandId: number | null) => void;
  onCollectionSelect: (brandId: number, collectionId: number | null) => void;
  initialBrandSlug?: string;
  initialCollectionSlug?: string;
}

export default function BrandNavPanel({
  activeBrandId,
  activeCollectionId,
  onBrandSelect,
  onCollectionSelect,
  initialBrandSlug,
  initialCollectionSlug,
}: BrandNavPanelProps) {
  const [expandedBrandId, setExpandedBrandId] = useState<number | null>(activeBrandId);

  const { data: brands = [] } = useQuery({ queryKey: ['brands'], queryFn: fetchBrands });
  const { data: collections = [] } = useQuery({ queryKey: ['collections'], queryFn: fetchCollections });

  const getBrandCollections = (brandId: number) => collections.filter(c => c.brandId === brandId);

  // Apply URL-based initial filter once brands/collections are loaded
  const initializedRef = useRef(false);
  useEffect(() => {
    if (initializedRef.current || !initialBrandSlug || brands.length === 0) return;
    const matchedBrand = brands.find(b => b.slug === initialBrandSlug);
    if (!matchedBrand) return;
    initializedRef.current = true;
    setExpandedBrandId(matchedBrand.id);
    if (initialCollectionSlug && collections.length > 0) {
      const matchedCol = collections.find(
        c => c.brandId === matchedBrand.id && c.slug === initialCollectionSlug
      );
      if (matchedCol) {
        onCollectionSelect(matchedBrand.id, matchedCol.id);
        return;
      }
    }
    onBrandSelect(matchedBrand.id);
  }, [brands, collections, initialBrandSlug, initialCollectionSlug]);

  const handleBrandClick = (brandId: number) => {
    if (activeBrandId === brandId) {
      // Clicking the active brand deselects everything
      onBrandSelect(null);
      setExpandedBrandId(null);
    } else {
      onBrandSelect(brandId);
      setExpandedBrandId(brandId);
    }
  };

  const handleCollectionClick = (brandId: number, collectionId: number) => {
    if (activeCollectionId === collectionId) {
      onCollectionSelect(brandId, null);
    } else {
      onCollectionSelect(brandId, collectionId);
    }
  };

  return (
    <nav className="w-52 shrink-0 sticky top-28 self-start pr-4 border-r border-white/10">

      {/* All Watches reset */}
      <button
        onClick={() => { onBrandSelect(null); setExpandedBrandId(null); }}
        className={`w-full text-left py-2 pl-4 text-sm font-playfair tracking-wide border-l-2 transition-all duration-200 ${
          activeBrandId === null
            ? 'border-[#bfa68a] text-[#f0e6d2]'
            : 'border-transparent text-white/45 hover:text-white/80'
        }`}
      >
        All Watches
      </button>

      <div className="border-t border-white/10 my-3" />

      {brands.map(brand => {
        const cols = getBrandCollections(brand.id);
        const isActive = activeBrandId === brand.id;
        const isExpanded = expandedBrandId === brand.id;

        return (
          <div key={brand.id} className="mb-0.5">
            <button
              onClick={() => handleBrandClick(brand.id)}
              className={`w-full text-left py-2 pl-4 pr-2 flex items-center justify-between border-l-2 transition-all duration-200 ${
                isActive
                  ? 'border-[#bfa68a] text-[#f0e6d2]'
                  : 'border-transparent text-white/45 hover:text-white/80'
              }`}
            >
              <span className="text-sm font-playfair tracking-wide">{brand.name}</span>
              {cols.length > 0 && (
                <svg
                  className={`w-3 h-3 shrink-0 opacity-50 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}
                  fill="none" stroke="currentColor" viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 9l-7 7-7-7" />
                </svg>
              )}
            </button>

            <AnimatePresence initial={false}>
              {isExpanded && cols.length > 0 && (
                <motion.ul
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
                  className="overflow-hidden"
                >
                  {cols.map(col => (
                    <li key={col.id}>
                      <button
                        onClick={() => handleCollectionClick(brand.id, col.id)}
                        className={`w-full text-left py-1.5 pl-7 pr-2 text-xs border-l-2 transition-all duration-200 ${
                          activeCollectionId === col.id
                            ? 'border-[#bfa68a]/60 text-[#bfa68a]'
                            : 'border-transparent text-white/35 hover:text-white/65'
                        }`}
                      >
                        {col.name}
                      </button>
                    </li>
                  ))}
                </motion.ul>
              )}
            </AnimatePresence>
          </div>
        );
      })}
    </nav>
  );
}
