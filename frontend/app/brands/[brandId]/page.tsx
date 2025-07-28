'use client';

import React, { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { fetchBrandById, fetchWatchesByBrand, fetchCollectionsByBrand, Brand, Watch, Collection } from '@/api/api';
import ScrollFade from '../../scrollMotion/ScrollFade';
import StaggeredFade from '../../scrollMotion/StaggeredFade';
import WatchCard from '../../watches/[watchId]/WatchCard';




// A reusable component for displaying a single collection card.
const CollectionCard = ({ collection }: { collection: Collection }) => {
    return (
        <div className="group block bg-black/20 backdrop-blur-md border border-white/10 rounded-xl p-4 transition-all duration-300 hover:border-white/30 hover:scale-105">
            <div className="w-full h-40 bg-black/30 rounded-lg mb-4 flex items-center justify-center">
                {collection.image ? (
                    <img src={"/" + collection.image} alt={collection.name} className="h-full object-contain rounded" />
                ) : (
                    <span className="text-white/30">Image</span>
                )}
            </div>
            <h3 className="text-lg font-semibold text-[#f0e6d2] group-hover:text-white transition-colors mb-2">{collection.name}</h3>
            <p className="text-sm text-white/60 group-hover:text-white/80">{collection.description}</p>
        </div>
    );
};

const BrandPage = () => {
  const params = useParams();
  const brandId = Array.isArray(params.brandId) ? params.brandId[0] : params.brandId;

  const [brand, setBrand] = useState<Brand | null>(null);
  const [watches, setWatches] = useState<Watch[]>([]);
  const [collections, setCollections] = useState<Collection[]>([]);
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

        const [brandData, watchesData, collectionsData] = await Promise.all([
          fetchBrandById(numericBrandId),
          fetchWatchesByBrand(numericBrandId),
          fetchCollectionsByBrand(numericBrandId),
        ]);

        setBrand(brandData);
        setWatches(watchesData);
        setCollections(collectionsData);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An unknown error occurred');
      } finally {
        setLoading(false);
      }
    };

    getBrandData();
  }, [brandId]);

  if (loading) {
    return <div className="flex justify-center items-center min-h-screen text-white/80">Loading...</div>;
  }

  if (error) {
    return <div className="flex justify-center items-center min-h-screen text-red-500">Error: {error}</div>;
  }

  if (!brand) {
    return <div className="flex justify-center items-center min-h-screen text-white/80">Brand not found.</div>;
  }
  
  return (
    <div className="container mx-auto px-4 sm:px-8 py-24 pt-48">
      <ScrollFade>
        <header className="text-center mb-8">
          <h1 className="text-5xl md:text-6xl font-playfair font-bold mb-6 text-[#f0e6d2]">{brand.name}</h1>
          <p className="text-white/80 leading-relaxed whitespace-pre-line max-w-3xl mx-auto font-playfair font-light tracking-wide text-lg">
            {brand.description}
          </p>
        </header>
      </ScrollFade>

      {/* Collections Grid */}
      <section className="mb-16">
        <ScrollFade>
          <h2 className="text-3xl font-playfair font-semibold mb-8 text-white/90">Collections</h2>
        </ScrollFade>
        <StaggeredFade className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-8">
          {collections.length > 0 ? (
            collections.map((collection) => <CollectionCard key={collection.id} collection={collection} />)
          ) : (
            <p className="text-white/60 col-span-full">No collections available for this brand yet.</p>
          )}
        </StaggeredFade>
      </section>

      {/* Watch Collection */}
      <section>
        <ScrollFade>
          <h2 className="text-3xl font-playfair font-semibold mb-8 text-white/90">Watches</h2>
        </ScrollFade>
        <StaggeredFade className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-8">
          {watches.length > 0 ? (
            watches.map((watch) => <WatchCard key={watch.id} watch={watch} />)
          ) : (
            <p className="text-white/60 col-span-full">No watches available for this brand yet.</p>
          )}
        </StaggeredFade>
      </section>
    </div>
  );
};

export default BrandPage; 