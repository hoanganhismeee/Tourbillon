// main entry point for browsing, displaying a list of all available watch brands, and some random watches
// From here, users can navigate to a specific brand's page.
'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { fetchBrands, Brand } from '@/lib/api';

// A reusable component for displaying a single brand in a list format.
const BrandListItem = ({ brand }: { brand: Brand }) => {
    // Truncate the description for the list view.
    const truncateDescription = (text: string, length: number) => {
        return text.length > length ? text.substring(0, length) + '...' : text;
    };

    return (
        <Link href={`/brands/${brand.id}`} legacyBehavior>
            <a className="group block w-full px-8 py-6 border-t border-white/10 transition-colors duration-300 hover:bg-black/20">
                <h2 className="text-2xl font-playfair font-semibold text-[#f0e6d2] mb-2 transition-colors group-hover:text-white">
                    {brand.name}
                </h2>
                <p className="text-sm text-white/60 transition-colors group-hover:text-white/80">
                    {truncateDescription(brand.description, 200)}
                </p>
            </a>
        </Link>
    );
};

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

  return (
    <div className="container mx-auto px-4 sm:px-8 py-24 pt-48">
      <h1 className="text-5xl font-playfair font-bold text-center mb-16 text-[#f0e6d2]">Explore Our Brands</h1>

      <div className="border-b border-white/10">
        {brands.map((brand) => (
          <BrandListItem key={brand.id} brand={brand} />
        ))}
      </div>
    </div>
  );
};

export default BrandListPage; 