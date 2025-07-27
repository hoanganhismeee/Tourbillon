// main entry point for browsing, displaying a list of all available watch brands, and some random watches
// From here, users can navigate to a specific brand's page.
'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { fetchBrands, Brand } from '@/lib/api';
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

  return (
    <div className="container mx-auto px-16 sm:px-20 lg:px-28 xl:px-36 py-24 pt-48 max-w-4xl">
      <ScrollFade>
        <h1 className="text-5xl font-playfair font-bold text-center mb-16 text-heading">
          Explore Our Brands
        </h1>
      </ScrollFade>

      {/* White line separator */}
      <div className="w-full h-px bg-white/20 mb-20"></div>

      {/* Holy Trinity Showcase */}
      <section className="mb-20">
        <ScrollFade>
          <h2 className="text-4xl font-playfair font-bold text-center mb-12 text-[#f0e6d2]">
            The Holy Trinity - Haute Horlogerie
          </h2>
        </ScrollFade>
        
        {trinityBrands.length >= 3 && (
          <>
            <TrinityShowcase 
              brand={trinityBrands[0]} 
              tagline="Timeless prestige in Swiss watchmaking"
            />
            <TrinityShowcase 
              brand={trinityBrands[1]} 
              tagline="Heritage and refinement since 1755"
            />
            <TrinityShowcase 
              brand={trinityBrands[2]} 
              tagline="Distinctive design meets Swiss tradition"
            />
          </>
        )}
      </section>

      {/* Explore More Brands */}
      <section>
        <ScrollFade>
          <h2 className="text-4xl font-playfair font-bold text-center mb-12 text-[#f0e6d2]">
            Explore More Brands
          </h2>
        </ScrollFade>
        
        <div className="max-w-2xl mx-auto">
          {remainingBrands.map((brand) => (
            <ScrollFade key={brand.id}>
              <BrandListItem brand={brand} />
            </ScrollFade>
          ))}
        </div>
      </section>
    </div>
  );
};

export default BrandListPage; 