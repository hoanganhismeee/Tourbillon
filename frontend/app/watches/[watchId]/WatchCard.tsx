// This component displays a single watch card with image, details, and navigation to the watch detail page.
// It's designed to be reusable across different pages and provides a consistent watch card design.

'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Watch, Collection, fetchCollectionsByBrand } from '@/lib/api';

interface WatchCardProps {
  watch: Watch;
  className?: string;
}

const WatchCard = ({ watch, className = "" }: WatchCardProps) => {
  const [imageError, setImageError] = useState(false);
  const [imageLoading, setImageLoading] = useState(true);
  const [collection, setCollection] = useState<Collection | null>(null);
  const router = useRouter();

  const handleImageError = () => {
    setImageError(true);
    setImageLoading(false);
  };

  const handleImageLoad = () => {
    setImageLoading(false);
  };

  const handleCollectionClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    router.push(`/brands/${watch.brandId}`);
  };

  // Fetch collection data when watch has a collectionId
  useEffect(() => {
    const fetchCollection = async () => {
      if (watch.collectionId) {
        try {
          const collections = await fetchCollectionsByBrand(watch.brandId);
          const watchCollection = collections.find(c => c.id === watch.collectionId);
          setCollection(watchCollection || null);
        } catch (error) {
          console.error('Error fetching collection:', error);
          setCollection(null);
        }
      }
    };

    fetchCollection();
  }, [watch.collectionId, watch.brandId]);

  return (
    <Link 
      href={`/watches/${watch.id}`} 
      className={`group block bg-black/20 backdrop-blur-md border border-white/10 rounded-xl p-6 transition-all duration-300 hover:border-white/30 hover:scale-105 ${className}`}
    >
      {/* Watch Image */}
      <div className="w-full h-80 bg-black/30 rounded-lg mb-4 flex items-center justify-center relative overflow-hidden">
        {!imageError ? (
          <>
            {/* Loading state */}
            {imageLoading && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white/30"></div>
              </div>
            )}
            
            {/* Actual image */}
            <img 
              src={watch.image} 
              alt={watch.name} 
              className={`w-full h-full object-cover rounded-lg transition-opacity duration-300 ${imageLoading ? 'opacity-0' : 'opacity-100'}`}
              onError={handleImageError}
              onLoad={handleImageLoad}
            />
          </>
        ) : (
          /* Fallback when no image or image failed to load */
          <div className="flex flex-col items-center justify-center text-center p-4">
            <div className="w-16 h-16 bg-white/10 rounded-full flex items-center justify-center mb-3">
              <svg className="w-8 h-8 text-white/30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <span className="text-white/20 text-xs mt-1">Image unavailable</span>
          </div>
        )}
      </div>
      
      {/* Collection Name - Clickable Button */}
      {collection && (
        <div className="mb-2 text-center">
          <button 
            onClick={handleCollectionClick}
            className="inline-block text-sm text-white hover:text-white/90 transition-colors font-playfair font-semibold cursor-pointer bg-transparent border-none p-1"
          >
            {collection.name}
          </button>
        </div>
      )}
      
      {/* Watch Details */}
      <div className="space-y-2 text-center">
        <h3 className="text-lg font-semibold text-[#f0e6d2] group-hover:text-white transition-colors">
          {watch.name}
        </h3>
        <p className="text-lg text-white/80 font-semibold">
          {watch.currentPrice === 0 ? 'Price on request' : `$${watch.currentPrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
        </p>
      </div>
    </Link>
  );
};

export default WatchCard; 