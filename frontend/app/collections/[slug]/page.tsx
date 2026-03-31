// Collection detail page - displays collection information and watches that belong to this collection
// Data cached via TanStack Query; images use Cloudinary thumbs.
// Brand query is dependent on collection data (uses collection.brandId).
'use client';

import React, { useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { fetchCollectionBySlug, fetchWatchesByCollectionSlug, fetchBrandById } from '@/lib/api';
import { imageTransformations } from '@/lib/cloudinary';
import Image from 'next/image';
import ScrollFade from '../../scrollMotion/ScrollFade';
import StaggeredFade from '../../scrollMotion/StaggeredFade';
import WatchCard from '../../watches/[slug]/WatchCard';
import { useScrollRestore } from '@/hooks/useScrollRestore';

const CollectionPage = () => {
  const params = useParams();
  const slug = params.slug as string;

  const [imgError, setImgError] = useState(false);

  const { data: collection, isLoading: collectionLoading, error } = useQuery({
    queryKey: ['collection', slug],
    queryFn: () => fetchCollectionBySlug(slug),
    enabled: !!slug,
  });

  const { data: watches = [], isLoading: watchesLoading } = useQuery({
    queryKey: ['watches', 'collection', slug],
    queryFn: () => fetchWatchesByCollectionSlug(slug),
    enabled: !!slug,
  });

  useScrollRestore(watches.length > 0 || !watchesLoading);

  // Brand query depends on collection being loaded first
  const { data: brand } = useQuery({
    queryKey: ['brand', collection?.brandId],
    queryFn: () => fetchBrandById(collection!.brandId),
    enabled: !!collection?.brandId,
  });

  if (collectionLoading) {
    return <div className="flex justify-center items-center min-h-screen text-white/80">Loading...</div>;
  }

  if (error) {
    return <div className="flex justify-center items-center min-h-screen text-red-500">Error loading collection.</div>;
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
            <Link href={`/brands/${brand?.slug}`} className="hover:text-white/80 transition-colors">
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
            {collection.image && !imgError ? (
              <div className="w-32 h-32 mx-auto mb-6 bg-black/30 rounded-full flex items-center justify-center">
                <Image
                  src={imageTransformations.thumbnail(collection.image)}
                  alt={collection.name}
                  width={96}
                  height={96}
                  sizes="96px"
                  className="w-24 h-24 object-contain rounded-full"
                  onError={() => setImgError(true)}
                />
              </div>
            ) : null}
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
