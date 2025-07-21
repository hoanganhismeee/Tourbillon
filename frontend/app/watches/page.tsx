// This page serves as the main entry point for browsing, displaying a list of all available watch brands.
// From here, users can navigate to a specific brand's page.
'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { fetchBrands, Brand } from '@/lib/api';

const BrandListPage = () => { // Renamed from WatchesPage for clarity
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
    <div className="min-h-screen container mx-auto px-4 py-12">
      <h1 className="text-5xl font-playfair font-bold text-center mb-16 tourbillon-text-color">Explore Our Brands</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10">
        {brands.map((brand) => (
          <Link href={`/brands/${brand.id}`} key={brand.id}>
            <div className="block border border-gray-700 rounded-lg p-6 text-center transform hover:scale-105 transition-transform duration-300 ease-in-out cursor-pointer h-full">
              <h2 className="text-3xl font-playfair font-semibold tourbillon-text-color">{brand.name}</h2>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
};

export default BrandListPage; 