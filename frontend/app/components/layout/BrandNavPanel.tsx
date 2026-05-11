// Sticky left sidebar for the watches page — brand/collection tree navigation.
// Supports multi-select: multiple brands and collections can be active simultaneously.
// Clicking an active item deselects it; Clear All resets everything.
'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
import { fetchBrands, fetchCollections } from '@/lib/api';
import { useNavigation } from '@/contexts/NavigationContext';

interface BrandNavPanelProps {
  selectedBrandIds: number[];
  selectedCollectionIds: number[];
  onBrandToggle: (brandId: number, brandSlug: string) => void;
  onCollectionToggle: (brandId: number, brandSlug: string, collectionId: number, collectionSlug: string) => void;
  onClearAll: () => void;
  className?: string;
}

export default function BrandNavPanel({
  selectedBrandIds,
  selectedCollectionIds,
  onBrandToggle,
  onCollectionToggle,
  onClearAll,
  className,
}: BrandNavPanelProps) {
  const router = useRouter();
  const { saveNavigationState } = useNavigation();
  const [expandedBrandIds, setExpandedBrandIds] = useState<number[]>([]);

  const { data: brands = [] } = useQuery({ queryKey: ['brands'], queryFn: fetchBrands });
  const { data: collections = [] } = useQuery({ queryKey: ['collections'], queryFn: fetchCollections });

  const getBrandCollections = (brandId: number) => collections.filter(c => c.brandId === brandId);

  const hasActiveFilters = selectedBrandIds.length > 0 || selectedCollectionIds.length > 0;

  const handleBrandClick = (brandId: number, brandSlug: string) => {
    onBrandToggle(brandId, brandSlug);
    // Expand the brand tree when selecting; collapse only when explicitly deselecting
    setExpandedBrandIds(prev =>
      prev.includes(brandId) ? prev.filter(id => id !== brandId) : [...prev, brandId]
    );
  };

  return (
    <nav className={className ?? 'w-52 shrink-0 sticky top-28 self-start pr-4 border-r border-white/10'}>

      {/* All Watches + Clear All */}
      <div className="flex items-center justify-between mb-1">
        <button
          onClick={onClearAll}
          className={`py-2 pl-4 text-sm font-playfair tracking-wide border-l-2 transition-all duration-200 ${
            !hasActiveFilters
              ? 'border-[#bfa68a] text-[#f0e6d2]'
              : 'border-transparent text-white/45 hover:text-white/80'
          }`}
        >
          All Timepieces
        </button>

        {hasActiveFilters && (
          <button
            onClick={onClearAll}
            className="text-[9px] tracking-[0.1em] uppercase text-[#bfa68a] hover:text-[#f0e6d2] transition-colors pr-1"
          >
            Clear all
          </button>
        )}
      </div>

      <div className="border-t border-white/10 my-3" />

      {brands.map(brand => {
        const cols = getBrandCollections(brand.id);
        const isBrandSelected = selectedBrandIds.includes(brand.id);
        const isExpanded = expandedBrandIds.includes(brand.id) || isBrandSelected;

        return (
          <div key={brand.id} className="mb-0.5">
            <button
              onClick={() => handleBrandClick(brand.id, brand.slug)}
              className={`group w-full text-left py-2 pl-4 pr-2 flex items-center justify-between border-l-2 transition-all duration-200 ${
                isBrandSelected
                  ? 'border-[#bfa68a] text-[#f0e6d2]'
                  : 'border-transparent text-white/45 hover:text-white/80'
              }`}
            >
              <span className="text-sm font-playfair tracking-wide">{brand.name}</span>
              <div className="flex items-center gap-1.5 shrink-0">
                {/* Navigate to brand page — visible on row hover, stops filter toggle */}
                <span
                  onClick={(e) => {
                    e.stopPropagation();
                    saveNavigationState({
                      scrollPosition: window.scrollY,
                      currentPage: 1,
                      path: window.location.pathname + window.location.search,
                      timestamp: Date.now(),
                    });
                    router.push(`/brands/${brand.slug}`);
                  }}
                  title={`View ${brand.name}`}
                  className="opacity-0 group-hover:opacity-40 hover:!opacity-90 transition-opacity duration-150 cursor-pointer"
                >
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                </span>
                {/* Selected indicator dot */}
                {isBrandSelected && (
                  <span className="w-1.5 h-1.5 rounded-full bg-[#bfa68a]" />
                )}
                {cols.length > 0 && (
                  <svg
                    className={`w-3 h-3 opacity-50 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}
                    fill="none" stroke="currentColor" viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 9l-7 7-7-7" />
                  </svg>
                )}
              </div>
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
                  {cols.map(col => {
                    const isColSelected = selectedCollectionIds.includes(col.id);
                    return (
                      <li key={col.id}>
                        <button
                          onClick={() => onCollectionToggle(brand.id, brand.slug, col.id, col.slug)}
                          className={`w-full text-left py-1.5 pl-7 pr-2 text-xs border-l-2 transition-all duration-200 flex items-center justify-between ${
                            isColSelected
                              ? 'border-[#bfa68a]/60 text-[#bfa68a]'
                              : 'border-transparent text-white/35 hover:text-white/65'
                          }`}
                        >
                          <span>{col.name}</span>
                          {isColSelected && (
                            <span className="w-1.5 h-1.5 rounded-full bg-[#bfa68a]/60 shrink-0" />
                          )}
                        </button>
                      </li>
                    );
                  })}
                </motion.ul>
              )}
            </AnimatePresence>
          </div>
        );
      })}
    </nav>
  );
}
