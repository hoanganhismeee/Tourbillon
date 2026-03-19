// Main entry point for browsing, displaying a list of all available watch brands, and some random watches
// From here, users can navigate to a specific brand's page.
// Features Holy Trinity showcase, Explore More Brands section, and All Watches with pagination
// Main Watches hub: brands overview + Trinity showcase + the full watches grid below.
// Data cached via TanStack Query; animations add polish without blocking.
// Uses the shared watches section for optimized images and pagination.
'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'next/navigation';
import { fetchBrands, Brand } from '@/lib/api';
import ScrollFade from '../scrollMotion/ScrollFade';
import TrinityShowcase from '../components/sections/TrinityShowcase';
import AllWatchesSection from '../components/sections/AllWatchesSection';

// A reusable component for displaying a single brand in a list format.
// Used in the "Explore More Brands" section to show brand name and summary
// Provides hover effects and links to individual brand pages
const BrandListItem = ({ brand }: { brand: Brand }) => {
    return (
        <Link
            href={`/brands/${brand.id}`}
            className="group block w-full px-8 py-6 border-t border-white/10 transition-colors duration-300 hover:bg-black/20"
        >
            <h2 className="text-2xl font-playfair font-semibold brand-name mb-3 transition-colors group-hover:text-white">
                {brand.name}
            </h2>
            <p className="text-sm text-white/70 transition-colors group-hover:text-white/90 font-playfair font-light tracking-wide leading-relaxed">
                {brand.summary}
            </p>
        </Link>
    );
};

// Main component for the watches page - handles brand showcase and delegates watches to AllWatchesSection
// Manages the overall layout, data fetching, and conditional rendering based on current page
const BrandListPage = () => {
  const [showAllBrands, setShowAllBrands] = useState(false);
  const searchParams = useSearchParams();
  const currentPage = Number(searchParams.get('page') ?? '1');

  const { data: brands = [] } = useQuery({
    queryKey: ['brands'],
    queryFn: fetchBrands,
  });

  // Holy Trinity brands (first 3) - Patek Philippe, Vacheron Constantin, Audemars Piguet
  const trinityBrands = brands.slice(0, 3);
  const remainingBrands = brands.slice(3);
  const displayedBrands = showAllBrands ? remainingBrands : remainingBrands.slice(0, 3);

  return (
    <div className="container mx-auto px-8 sm:px-12 lg:px-16 xl:px-20 py-24 pt-30 max-w-7xl">
      {/* PAGE 1 CONTENT - Only show on first page */}
      {currentPage === 1 && (
        <>
          {/* Main page title with scroll animation */}
          <ScrollFade>
            <h1 className="text-5xl font-playfair font-bold text-center mb-15 mt-32 text-[#f0e6d2]">
              Explore Our Brands
            </h1>
          </ScrollFade>

          {/* White line separator for the Holy Trinity section */}
          <div className="w-full border-t border-white/10 mb-60"></div>

          {/* Holy Trinity Showcase - Features the top 3 luxury brands with individual showcases */}
          <section className="mb-20">
            <ScrollFade>
              <h2 className="text-5xl font-playfair font-bold text-center mb-20 text-[#f0e6d2]">
                The Holy Trinity - Haute Horlogerie
              </h2>
            </ScrollFade>

            {trinityBrands.length > 0 ? (
              <>
                {trinityBrands[0] && (
                  <ScrollFade>
                    <TrinityShowcase brand={trinityBrands[0]} />
                  </ScrollFade>
                )}

                {trinityBrands[1] && (
                  <>
                    <div className="w-full border-t border-white/10 my-24"></div>
                    <ScrollFade>
                      <TrinityShowcase brand={trinityBrands[1]} />
                    </ScrollFade>
                  </>
                )}

                {trinityBrands[2] && (
                  <>
                    <div className="w-full border-t border-white/10 my-24"></div>
                    <ScrollFade>
                      <TrinityShowcase brand={trinityBrands[2]} />
                    </ScrollFade>
                  </>
                )}
              </>
            ) : (
              <div className="text-center py-16">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white/40 mx-auto mb-4"></div>
                <p className="text-white/60 font-playfair">Loading luxury brands...</p>
              </div>
            )}
          </section>

          {/* White line separator between sections */}
          <div className="w-full border-t border-white/10 my-25"></div>

          {/* Explore More Brands - Shows remaining brands with expand/collapse functionality */}
          <section>
            <ScrollFade>
              <h2 className="text-5xl font-playfair font-bold text-center mb-10 text-[#f0e6d2]">
                Explore More Brands
              </h2>
            </ScrollFade>

            <div className="max-w-2xl mx-auto">
              {displayedBrands.map((brand) => (
                <ScrollFade key={brand.id}>
                  <BrandListItem brand={brand} />
                </ScrollFade>
              ))}

              {remainingBrands.length > 3 && (
                <div className="text-center mt-8">
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      setShowAllBrands(!showAllBrands);
                    }}
                    className="inline-flex items-center text-[#f0e6d2] hover:text-white transition-colors duration-500 text-xl font-playfair font-medium hover:scale-105"
                  >
                    {showAllBrands ? (
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
                    ) : (
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
                    )}
                  </button>
                </div>
              )}
            </div>
          </section>

          {/* White line separator between sections */}
          <div className="w-full border-t border-white/10 my-25"></div>
        </>
      )}

      {/* All Watches Section - Delegated to separate component with pagination state */}
      <AllWatchesSection brands={brands} />
    </div>
  );
};

export default BrandListPage;
