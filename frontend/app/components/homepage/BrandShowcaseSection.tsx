// Brand showcase for the homepage — moved from /watches.
// "Explore Our Brands" heading → Holy Trinity showcase → Explore More Brands list.
// Identical design to what was on the watches page; self-contained data fetch.
'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { fetchBrands, Brand } from '@/lib/api';
import ScrollFade from '@/app/scrollMotion/ScrollFade';
import TrinityShowcase from './TrinityShowcase';

const TRINITY_BRAND_IDS = [1, 2, 3];

const BrandListItem = ({ brand }: { brand: Brand }) => (
  <Link
    href={`/brands/${brand.slug}`}
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

export default function BrandShowcaseSection() {
  const [showAllBrands, setShowAllBrands] = useState(false);

  const { data: brands = [] } = useQuery({
    queryKey: ['brands'],
    queryFn: fetchBrands,
  });

  const trinityBrands = TRINITY_BRAND_IDS
    .map(id => brands.find(b => b.id === id))
    .filter(Boolean) as Brand[];

  const remainingBrands = brands.filter(b => !TRINITY_BRAND_IDS.includes(b.id));
  const displayedBrands = showAllBrands ? remainingBrands : remainingBrands.slice(0, 3);

  return (
    <div className="container mx-auto px-4 sm:px-8 lg:px-16 xl:px-20 max-w-7xl">

      {/* Section heading */}
      <ScrollFade>
        <h2 className="text-3xl md:text-5xl font-playfair font-light text-center mb-15 mt-32 text-[#f0e6d2]">
          Explore Our Brands
        </h2>
      </ScrollFade>

      <div className="w-full border-t border-white/10 mb-60" />

      {/* Holy Trinity */}
      <section className="mb-20">
        <ScrollFade>
          <h3 className="text-3xl md:text-5xl font-playfair font-light text-center mb-20 text-[#f0e6d2]">
            The Holy Trinity — Haute Horlogerie
          </h3>
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
                <div className="w-full border-t border-white/10 my-24" />
                <ScrollFade>
                  <TrinityShowcase brand={trinityBrands[1]} />
                </ScrollFade>
              </>
            )}
            {trinityBrands[2] && (
              <>
                <div className="w-full border-t border-white/10 my-24" />
                <ScrollFade>
                  <TrinityShowcase brand={trinityBrands[2]} />
                </ScrollFade>
              </>
            )}
          </>
        ) : (
          <div className="text-center py-16">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white/40 mx-auto mb-4" />
            <p className="text-white/60 font-playfair">Loading luxury brands...</p>
          </div>
        )}
      </section>

      <div className="w-full border-t border-white/10 my-25" />

      {/* Explore More Brands */}
      <section className="mb-32">
        <ScrollFade>
          <h3 className="text-3xl md:text-5xl font-playfair font-light text-center mb-10 text-[#f0e6d2]">
            Explore More Brands
          </h3>
        </ScrollFade>

        <div className="max-w-2xl mx-auto">
          {displayedBrands.map(brand => (
            <ScrollFade key={brand.id}>
              <BrandListItem brand={brand} />
            </ScrollFade>
          ))}

          {remainingBrands.length > 3 && (
            <div className="text-center mt-8">
              <button
                onClick={() => setShowAllBrands(v => !v)}
                className="inline-flex flex-col items-center text-[#f0e6d2] hover:text-white transition-colors duration-500 text-xl font-playfair font-medium hover:scale-105"
              >
                {showAllBrands ? (
                  <>
                    <div className="flex flex-col mb-0">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                      </svg>
                      <svg className="w-4 h-4 -mt-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                      </svg>
                    </div>
                    <span>Show Less</span>
                  </>
                ) : (
                  <>
                    <span>Show More</span>
                    <div className="flex flex-col mt-0">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                      <svg className="w-4 h-4 -mt-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      </section>

    </div>
  );
}
