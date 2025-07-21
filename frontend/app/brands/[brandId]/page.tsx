'use client';

import React, { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { fetchBrandById, fetchWatchesByBrand, Brand, Watch } from '@/lib/api';

const BrandPage = () => {
  const params = useParams();
  const brandId = Array.isArray(params.brandId) ? params.brandId[0] : params.brandId;

  const [brand, setBrand] = useState<Brand | null>(null);
  const [watches, setWatches] = useState<Watch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!brandId) return;

    const getBrandData = async () => {
      try {
        setLoading(true);
        const numericBrandId = parseInt(brandId, 10);

        if (isNaN(numericBrandId)) {
          throw new Error('Invalid Brand ID');
        }

        const [brandData, watchesData] = await Promise.all([
          fetchBrandById(numericBrandId),
          fetchWatchesByBrand(numericBrandId),
        ]);

        setBrand(brandData);
        setWatches(watchesData);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An unknown error occurred');
      } finally {
        setLoading(false);
      }
    };

    getBrandData();
  }, [brandId]);

  if (loading) {
    return <div className="min-h-screen text-center py-20 tourbillon-text-color">Loading...</div>;
  }

  if (error) {
    return <div className="min-h-screen text-center py-20 text-red-500">Error: {error}</div>;
  }

  if (!brand) {
    return <div className="min-h-screen text-center py-20 tourbillon-text-color">Brand not found.</div>;
  }

  return (
    <div className="min-h-screen container mx-auto px-4 py-12">
      <header className="text-center mb-16">
        <h1 className="text-6xl font-playfair font-bold mb-4 tourbillon-text-color">{brand.name}</h1>
        <p className="max-w-4xl mx-auto text-lg text-gray-300 leading-relaxed">{brand.description}</p>
      </header>

      <main>
        <h2 className="text-4xl font-playfair font-semibold text-center mb-12 tourbillon-text-color">Our Collection</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10">
          {watches.map((watch) => (
            <Link href={`/watches/${watch.id}`} key={watch.id}>
              <div className="block border border-gray-700 rounded-lg p-6 text-center transform hover:scale-105 transition-transform duration-300 ease-in-out h-full cursor-pointer">
                <h3 className="text-2xl font-playfair font-semibold tourbillon-text-color">{watch.name}</h3>
                <p className="text-xl text-gray-400 mt-2">${watch.currentPrice.toLocaleString()}</p>
              </div>
            </Link>
          ))}
        </div>
      </main>
    </div>
  );
};

export default BrandPage; 