// Collection detail page - displays collection information and watches that belong to this collection
// Shows collection description, brand info, and all watches that match the collection ID
'use client';

import React, { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { fetchCollectionById, fetchWatchesByCollection, fetchBrandById, Collection, Watch, Brand } from '@/lib/api';
import ScrollFade from '../../scrollMotion/ScrollFade';
import StaggeredFade from '../../scrollMotion/StaggeredFade';
import WatchCard from '../../watches/[watchId]/WatchCard';

const CollectionPage = () => {
  const params = useParams();
  const collectionId = Array.isArray(params.collectionId) ? params.collectionId[0] : params.collectionId;

  const [collection, setCollection] = useState<Collection | null>(null);
  const [watches, setWatches] = useState<Watch[]>([]);
  const [brand, setBrand] = useState<Brand | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!collectionId) return;

    const getCollectionData = async () => {
      try {
        setLoading(true);
        const numericCollectionId = parseInt(collectionId, 10);

        if (isNaN(numericCollectionId)) {
          throw new Error('Invalid Collection ID');
        }

        // Fetch collection data first
        const collectionData = await fetchCollectionById(numericCollectionId);
        setCollection(collectionData);

        // Then fetch watches for this collection and brand info
        const [watchesData, brandData] = await Promise.all([
          fetchWatchesByCollection(numericCollectionId),
          fetchBrandById(collectionData.brandId),
        ]);

        setWatches(watchesData);
        setBrand(brandData);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An unknown error occurred');
      } finally {
        setLoading(false);
      }
    };

    getCollectionData();
  }, [collectionId]);

  if (loading) {
    return <div className="flex justify-center items-center min-h-screen text-white/80">Loading...</div>;
  }

  if (error) {
    return <div className="flex justify-center items-center min-h-screen text-red-500">Error: {error}</div>;
  }

  if (!collection) {
    return <div className="flex justify-center items-center min-h-screen text-white/80">Collection not found.</div>;
  }
  
  return (
    <div className="container mx-auto px-4 sm:px-8 py-24 pt-48">
      {/* Breadcrumb Navigation */}
      <ScrollFade>
        <nav className="mb-8 text-white/60">
          <div className="flex items-center space-x-2 text-sm">
            <Link href="/watches" className="hover:text-white/80 transition-colors">
              Watches
            </Link>
            <span>/</span>
            <Link href={`/brands/${brand?.id}`} className="hover:text-white/80 transition-colors">
              {brand?.name}
            </Link>
            <span>/</span>
            <span className="text-white/90">{collection.name}</span>
          </div>
        </nav>
      </ScrollFade>

      {/* Collection Header */}
      <ScrollFade>
        <header className="text-center mb-12">
          <div className="mb-6">
            {collection.image && (
              <div className="w-32 h-32 mx-auto mb-6 bg-black/30 rounded-full flex items-center justify-center">
                <img 
                  src={"/" + collection.image} 
                  alt={collection.name} 
                  className="w-24 h-24 object-contain rounded-full" 
                />
              </div>
            )}
          </div>
          <h1 className="text-4xl md:text-5xl font-playfair font-bold mb-4 text-[#f0e6d2]">
            {collection.name}
          </h1>
          {brand && (
            <p className="text-xl font-playfair font-light text-white/70 mb-6">
              by {brand.name}
            </p>
          )}
          <p className="text-white/80 leading-relaxed max-w-3xl mx-auto font-inter font-light tracking-wide text-lg">
            {collection.description}
          </p>
        </header>
      </ScrollFade>

      {/* Watches Section */}
      <section>
        <ScrollFade>
          <h2 className="text-3xl font-playfair font-semibold mb-8 text-white/90">
            Watches in this Collection
          </h2>
        </ScrollFade>
        <StaggeredFade className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-8">
          {watches.length > 0 ? (
            watches.map((watch) => <WatchCard key={watch.id} watch={watch} />)
          ) : (
            <p className="text-white/60 col-span-full text-center py-12">
              No watches available in this collection yet.
            </p>
          )}
        </StaggeredFade>
      </section>
    </div>
  );
};

export default CollectionPage; 