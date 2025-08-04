'use client';

import React, { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { fetchBrandById, fetchWatchesByBrand, fetchCollectionsByBrand, Brand, Watch, Collection } from '@/lib/api';
import { imageTransformations } from '@/lib/cloudinary';
import ScrollFade from '../../scrollMotion/ScrollFade';
import StaggeredFade from '../../scrollMotion/StaggeredFade';
import WatchCard from '../../watches/[watchId]/WatchCard';
import Link from 'next/link';


// A reusable component for displaying a single collection card.
const CollectionCard = ({ collection }: { collection: Collection }) => {
    return (
        <Link href={`/collections/${collection.id}`} className="block">
            <div className="group block bg-black/20 backdrop-blur-md border border-white/10 rounded-xl p-4 transition-all duration-300 hover:border-white/30 hover:scale-105 cursor-pointer">
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
        </Link>
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
    <div className="container mx-auto px-4 sm:px-8 py-20 pt-20">
      <ScrollFade>
        <header className="text-center mb-8">
          
            {/* Brand Logo */}
            {brand.image && (
              <div className="flex justify-center mb-10">
                {(() => {
                  const logoUrl = imageTransformations.logo(brand.image);
                  console.log(`🔍 Brand: ${brand.name}, Image: ${brand.image}, URL: ${logoUrl}`);
                  return (
                    <img 
                      src={logoUrl}
                      alt={`${brand.name} logo`}
                      className="h-32 md:h-48 lg:h-56 object-contain"
                      onError={(e) => {
                        console.log(`❌ Failed to load brand logo: ${brand.image}`);
                        console.log(`❌ Error target src:`, e.currentTarget.src);
                      }}
                      onLoad={() => console.log(`Brand logo loaded successfully: ${brand.name}`)}
                    />
                  );
                })()}
              </div>
            )}

           {/* White line separator between logo and description */}
           <div className="w-full border-t border-white/10 my-10"></div>

           <div className="mt-16 max-w-7xl mx-auto px-4 sm:px-8">
             <div className="text-white/85 leading-relaxed font-playfair font-light tracking-wide text-lg md:text-xl lg:text-2xl text-left">
                               {(() => {
                  // Split by actual newlines and filter out empty paragraphs
                  const paragraphs = brand.description
                    .split('\n')
                    .map(p => p.trim())
                    .filter(p => p.length > 0);
                  
                  return paragraphs.map((paragraph, index) => {
                    // Check if this is the adage (first paragraph with quotes)
                    if (index === 0 && paragraph.includes('"')) {
                      return (
                        <div key={index} className="mb-8">
                          <blockquote className="text-[#f0e6d2] text-base md:text-lg lg:text-xl font-medium italic text-center border-l-4 border-[#f0e6d2]/30 pl-6 py-4">
                            {paragraph}
                          </blockquote>
                        </div>
                      );
                    }
                    // Regular paragraphs
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

       {/* White line separator between description and collections */}
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

       {/* White line separator between collections and watches */}
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