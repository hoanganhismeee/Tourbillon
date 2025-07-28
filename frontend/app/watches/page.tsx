// main entry point for browsing, displaying a list of all available watch brands, and some random watches
// From here, users can navigate to a specific brand's page.
'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { fetchBrands, Brand } from '@/api/api';
import ScrollFade from '../scrollMotion/ScrollFade';
import TrinityShowcase from './TrinityShowcase';

// A reusable component for displaying a single brand in a list format.
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

// Special showcase component for the Holy Trinity brands


const BrandListPage = () => {
  const [brands, setBrands] = useState<Brand[]>([]);
  const [showAllBrands, setShowAllBrands] = useState(false);

  useEffect(() => {
    const getBrands = async () => {
      try {
        const brandsData = await fetchBrands();
        setBrands(brandsData);
      } catch (error) {
        console.error('Error fetching brands:', error);
      }
    };

    getBrands();
  }, []);

  // Get the first 3 brands for the Holy Trinity showcase
  const trinityBrands = brands.slice(0, 3);
  const remainingBrands = brands.slice(3);
  
  // Show only first 3 remaining brands initially, or all if showAllBrands is true
  const displayedBrands = showAllBrands ? remainingBrands : remainingBrands.slice(0, 3);

  // Debug logging
  console.log('Brands loaded:', brands.length);
  console.log('Trinity brands:', trinityBrands.map(b => b.name));

  return (
    <div className="container mx-auto px-8 sm:px-12 lg:px-16 xl:px-20 py-24 pt-30 max-w-7xl">
      <ScrollFade>
        <h1 className="text-4xl font-playfair font-bold text-center mb-10 text-[#f0e6d2]">
          Explore Our Brands
        </h1>
      </ScrollFade>

      {/* White line separator */}
      <div className="w-full h-[2px] bg-white/60 mb-20"></div>

      {/* Holy Trinity Showcase */}
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
                <TrinityShowcase 
                  brand={trinityBrands[0]} 
                  tagline="Timeless prestige in Swiss watchmaking"
                />
              </ScrollFade>
            )}
            {trinityBrands[1] && (
              <>
                {/* White line separator between Trinity brands */}
                <div className="w-full h-[2px] bg-white/60 my-24"></div>
                <ScrollFade>
                  <TrinityShowcase 
                    brand={trinityBrands[1]} 
                    tagline="Heritage and refinement since 1755"
                  />
                </ScrollFade>
              </>
            )}
            {trinityBrands[2] && (
              <>
                {/* White line separator between Trinity brands */}
                <div className="w-full h-[2px] bg-white/60 my-24"></div>
                <ScrollFade>
                  <TrinityShowcase 
                    brand={trinityBrands[2]} 
                    tagline="Distinctive design meets Swiss tradition"
                  />
                </ScrollFade>
              </>
            )}
          </>
        ) : (
          // Loading state for Trinity showcase
          <div className="text-center py-16">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white/40 mx-auto mb-4"></div>
            <p className="text-white/60 font-playfair">Loading luxury brands...</p>
          </div>
        )}
      </section>

      {/* White line separator between sections */}
      <div className="w-full h-[2px] bg-white/60 my-25"></div>

      {/* Explore More Brands */}
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
          
          {/* Show More/Less Button */}
          {remainingBrands.length > 3 && (
            <div className="text-center mt-8">
              <button
                onClick={() => setShowAllBrands(!showAllBrands)}
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
    </div>
  );
};

export default BrandListPage; 