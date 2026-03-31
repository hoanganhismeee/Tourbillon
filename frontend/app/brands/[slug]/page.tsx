// Brand page: shows brand logo, description, collections, and watches in one place.
// Data cached via TanStack Query; images use Cloudinary-optimized URLs with next/image.
'use client';

import React, { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { fetchBrandBySlug, fetchWatchesByBrandSlug, fetchCollectionsByBrandSlug, Collection } from '@/lib/api';
import { useScrollRestore } from '@/hooks/useScrollRestore';
import { imageTransformations } from '@/lib/cloudinary';
import Image from 'next/image';
import ScrollFade from '../../scrollMotion/ScrollFade';
import StaggeredFade from '../../scrollMotion/StaggeredFade';
import WatchCard from '../../watches/[slug]/WatchCard';
import Link from 'next/link';


// A reusable component for displaying a single collection card.
const CollectionCard = ({ collection }: { collection: Collection }) => {
    const [imgError, setImgError] = useState(false);
    return (
        <Link href={`/collections/${collection.slug}`} className="block">
            <div className="group block bg-black/20 backdrop-blur-md border border-white/10 rounded-xl p-4 transition-all duration-300 hover:border-white/30 hover:scale-105 cursor-pointer">
                <div className="w-full h-40 bg-black/30 rounded-lg mb-4 flex items-center justify-center">
                    {collection.image && !imgError ? (
                        <Image
                          src={imageTransformations.thumbnail(collection.image)}
                          alt={collection.name}
                          width={300}
                          height={160}
                          sizes="(min-width: 1024px) 300px, 50vw"
                          className="h-full w-auto object-contain rounded"
                          loading="lazy"
                          onError={() => setImgError(true)}
                        />
                    ) : (
                        <span className="text-white/30 text-sm font-playfair">{collection.name}</span>
                    )}
                </div>
                <h3 className="text-lg font-semibold text-[#f0e6d2] group-hover:text-white transition-colors mb-2">{collection.name}</h3>
                <p className="text-sm text-white/60 group-hover:text-white/80">{collection.description}</p>
            </div>
        </Link>
    );
};

const BrandPage = () => {
  const params = useParams();
  const slug = params.slug as string;

  const [logoSrc, setLogoSrc] = useState<string>('');
  const [logoError, setLogoError] = useState(false);

  const { data: brand, isLoading, error } = useQuery({
    queryKey: ['brand', slug],
    queryFn: () => fetchBrandBySlug(slug),
    enabled: !!slug,
  });

  const { data: watches = [], isLoading: watchesLoading } = useQuery({
    queryKey: ['watches', 'brand', slug],
    queryFn: () => fetchWatchesByBrandSlug(slug),
    enabled: !!slug,
  });

  useScrollRestore(watches.length > 0 || !watchesLoading);

  const { data: collections = [] } = useQuery({
    queryKey: ['collections', 'brand', slug],
    queryFn: () => fetchCollectionsByBrandSlug(slug),
    enabled: !!slug,
  });

  // Initialize brand logo source when brand data arrives
  useEffect(() => {
    if (brand?.image) {
      setLogoSrc(imageTransformations.logo(brand.image));
    }
  }, [brand?.image]);

  if (isLoading) {
    return <div className="flex justify-center items-center min-h-screen text-white/80">Loading...</div>;
  }

  if (error) {
    return <div className="flex justify-center items-center min-h-screen text-red-500">Error loading brand.</div>;
  }

  if (!brand) {
    return <div className="flex justify-center items-center min-h-screen text-white/80">Brand not found.</div>;
  }

  return (
    <div className="container mx-auto px-4 sm:px-8 py-20 pt-20">
      <ScrollFade>
        <header className="text-center mb-8">

          {/* Brand Logo */}
          {brand.image && !logoError ? (
            <div className="flex justify-center mb-10">
              <Image
                src={logoSrc || imageTransformations.logo(brand.image)}
                alt={`${brand.name} logo`}
                width={800}
                height={200}
                sizes="(min-width: 1024px) 600px, 80vw"
                className="h-32 md:h-48 lg:h-56 w-auto object-contain"
                priority
                onError={() => setLogoError(true)}
              />
            </div>
          ) : (
            <h1 className="text-5xl md:text-6xl lg:text-7xl font-playfair font-bold text-[#f0e6d2] mb-10">
              {brand.name}
            </h1>
          )}

         <div className="w-full border-t border-white/10 my-10"></div>

         <div className="mt-16 max-w-7xl mx-auto px-4 sm:px-8">
           <div className="text-white/85 leading-relaxed font-playfair font-light tracking-wide text-lg md:text-xl lg:text-2xl text-left">
                             {(() => {
                const paragraphs = brand.description
                  .split('\n')
                  .map(p => p.trim())
                  .filter(p => p.length > 0);

                return paragraphs.map((paragraph, index) => {
                  if (index === 0 && paragraph.includes('"')) {
                    return (
                      <div key={index} className="mb-8">
                        <blockquote className="text-[#f0e6d2] text-base md:text-lg lg:text-xl font-medium italic text-center border-l-4 border-[#f0e6d2]/30 pl-6 py-4">
                          {paragraph}
                        </blockquote>
                      </div>
                    );
                  }
                  return (
                    <p key={index} className="mb-6">
                      {paragraph}
                    </p>
                  );
                });
              })()}
           </div>
         </div>
               </header>
     </ScrollFade>

     <div className="w-full border-t border-white/10 my-24"></div>

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

     <div className="w-full border-t border-white/10 my-24"></div>

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
