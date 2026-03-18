// Reusable watch card used across the app: image, quick details, and navigation.
// Handles scroll-position memory and resilient image loading in a compact, clean UI.

'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Watch, Collection, fetchCollectionsByBrand } from '@/lib/api';
import { imageTransformations } from '@/lib/cloudinary';
import { useNavigation } from '@/contexts/NavigationContext';
import { useWatchesPage } from '@/contexts/WatchesPageContext';
import CompareToggle from '../../components/compare/CompareToggle';
import Image from 'next/image';


interface WatchCardProps {
  watch: Watch;
  className?: string;
}

const WatchCard = ({ watch, className = "" }: WatchCardProps) => {
  const [imageError, setImageError] = useState(false);
  const [imageLoading, setImageLoading] = useState(true);
  const [collection, setCollection] = useState<Collection | null>(null);
  const [imgSrc, setImgSrc] = useState<string>(watch.imageUrl || imageTransformations.showcase(watch.image));
  const [retryCount, setRetryCount] = useState<number>(0);
  const router = useRouter();
  
  // Get navigation context for saving back state
  const { saveNavigationState } = useNavigation();
  // Get current page from watches page context
  const { currentPage } = useWatchesPage();

  const handleImageError = () => {
    // Retry strategy: try 2 times with different approaches
    if (retryCount === 0) {
      // First retry: add cache-busting query param to force reload
      setRetryCount(1);
      setImgSrc((watch.imageUrl || imageTransformations.showcase(watch.image)) + `?r=${Date.now()}`);
      return;
    } else if (retryCount === 1) {
      // Second retry: try with explicit format
      setRetryCount(2);
      const baseUrl = watch.imageUrl || imageTransformations.showcase(watch.image);
      setImgSrc(baseUrl.replace('/f_auto', '/f_jpg') + `?r=${Date.now()}`);
      return;
    }
    // All retries exhausted
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

  // Handle watch card click to save navigation state
  const handleWatchClick = () => {
    // Save current navigation state for back functionality
    const navigationState = {
      scrollPosition: window.scrollY, // Current scroll position
      currentPage: currentPage, // Current page number
      path: window.location.pathname, // Current path
      timestamp: Date.now(), // Timestamp for state management
    };
    saveNavigationState(navigationState);
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
    <div className={`group relative bg-black/30 backdrop-blur-md border border-white/20 rounded-2xl p-6 transition-all duration-500 hover:border-white/40 hover:bg-black/40 hover:scale-[1.02] ${className}`}>
      {/* Image + action button overlay */}
      <div className="relative mb-4">
        <Link href={`/watches/${watch.id}`} onClick={handleWatchClick} className="block">
          <div className="w-full h-80 bg-black/40 rounded-xl flex items-center justify-center relative overflow-hidden">
            {!imageError ? (
              <>
                {imageLoading && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                    <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-white/40"></div>
                  </div>
                )}
                <Image
                  src={imgSrc}
                  alt={watch.name}
                  width={600}
                  height={600}
                  sizes="(min-width: 1024px) 300px, 80vw"
                  className={`w-full h-full object-cover rounded-xl transition-opacity duration-500 ${imageLoading ? 'opacity-0' : 'opacity-100'}`}
                  onError={handleImageError}
                  onLoad={handleImageLoad}
                />
              </>
            ) : (
              <div className="flex flex-col items-center justify-center text-center p-8">
                <div className="w-20 h-20 bg-white/15 rounded-full flex items-center justify-center mb-4">
                  <svg className="w-10 h-10 text-white/40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <span className="text-white/30 text-sm font-playfair">Image unavailable</span>
              </div>
            )}
          </div>
        </Link>
        {/* Action button field — bottom-right of image, visible on hover. Extend with more buttons here. */}
        <div className="absolute bottom-2.5 right-2.5 z-10 flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
          <CompareToggle watch={watch} />
        </div>
      </div>

      {/* Collection Name - Clickable Button */}
      {collection && (
        <div className="mb-3 text-center">
          <button
            onClick={handleCollectionClick}
            className="inline-block text-sm text-white/80 hover:text-white transition-colors font-playfair font-medium cursor-pointer bg-transparent border-none p-1"
          >
            {collection.name}
          </button>
        </div>
      )}

      {/* Watch Details */}
      <Link href={`/watches/${watch.id}`} onClick={handleWatchClick}>
        <div className="space-y-3 text-center">
          <h3 className="text-xl font-playfair font-semibold text-[#f0e6d2] group-hover:text-white transition-colors">
            {watch.name}
          </h3>
          <p className="text-lg text-white/90 font-playfair font-medium">
            {watch.currentPrice === 0 ? 'Price on request' : `$${watch.currentPrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
          </p>
        </div>
      </Link>
    </div>
  );
};

export default WatchCard;