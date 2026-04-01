// Watch card for the All Watches grid — extracted from AllWatchesSection.
// Displays brand, collection, model name, price; handles Cloudinary image retry.
// Phase 10D: near-3D tilt on mousemove (useTilt) + gold shimmer stripe on hover.
'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import Image from 'next/image';
import { Watch, Collection, Brand } from '@/lib/api';
import { imageTransformations, getOptimizedImageUrl } from '@/lib/cloudinary';
import { useNavigation } from '@/contexts/NavigationContext';
import { useTilt } from '@/hooks/useTilt';
import CompareToggle from '../compare/CompareToggle';
import FavouriteToggle from '../favourites/FavouriteToggle';

interface WatchCardProps {
  watch: Watch;
  brands: Brand[];
  collections: Collection[];
  isPriority?: boolean;
  currentPage: number;
}

export const WatchCard = ({ watch, brands, collections, isPriority = false, currentPage }: WatchCardProps) => {
  const { saveNavigationState } = useNavigation();
  const { rotateX, rotateY, handleMouseMove, handleMouseLeave } = useTilt();

  const [src, setSrc] = useState<string>(watch.imageUrl || imageTransformations.card(watch.image));
  const [retryCount, setRetryCount] = useState(0);
  const [shimmer, setShimmer] = useState(false);

  const router = useRouter();

  const handleWatchClick = () => {
    saveNavigationState({
      scrollPosition: window.scrollY,
      currentPage,
      path: window.location.pathname,
      timestamp: Date.now(),
    });
  };

  const handleImgError = () => {
    if (retryCount < 1) {
      setRetryCount(1);
      setSrc(
        getOptimizedImageUrl(watch.image, { width: 800, height: 800, crop: 'fit', quality: 'auto', format: 'jpg' }) +
        `?r=${Date.now()}`
      );
    }
  };

  const handleBrandClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (watch.brandSlug) router.push(`/brands/${watch.brandSlug}`);
  };

  const handleCollectionClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (watch.collectionSlug) router.push(`/collections/${watch.collectionSlug}`);
  };

  return (
    <motion.div
      className="group relative block bg-gradient-to-br from-white/5 to-white/10 backdrop-blur-sm border border-white/20 rounded-2xl p-4 transition-colors duration-500 hover:bg-gradient-to-br hover:from-white/10 hover:to-white/15 hover:border-white/30 hover:shadow-2xl hover:shadow-white/10 overflow-hidden"
      style={{
        rotateX,
        rotateY,
        transformPerspective: 800,
        transformStyle: 'preserve-3d',
        willChange: 'transform',
      }}
      onMouseMove={e => { handleMouseMove(e); setShimmer(true); }}
      onMouseLeave={() => { handleMouseLeave(); setShimmer(false); }}
    >
      {/* Gold shimmer stripe — slides across on hover */}
      <div
        className="pointer-events-none absolute inset-0 z-10 rounded-2xl transition-opacity duration-300"
        style={{
          opacity: shimmer ? 1 : 0,
          background: 'linear-gradient(105deg, transparent 40%, rgba(240,230,210,0.08) 50%, transparent 60%)',
          backgroundSize: '200% 100%',
          animation: shimmer ? 'shimmer 1.2s ease-in-out' : 'none',
        }}
      />

      {/* Watch image */}
      <div className="relative mb-4" style={{ transform: 'translateZ(20px)' }}>
        <Link href={`/watches/${watch.slug || watch.id}`} onClick={handleWatchClick}>
          <div className="w-full aspect-square bg-gradient-to-br from-black/40 to-black/60 rounded-xl flex items-center justify-center border border-white/10 overflow-hidden cursor-pointer">
            {watch.image ? (
              <Image
                src={src}
                alt={watch.name}
                width={400}
                height={400}
                sizes="(min-width: 1280px) 25vw, (min-width: 768px) 33vw, 50vw"
                className="w-full h-full object-contain rounded-xl"
                priority={isPriority}
                fetchPriority={isPriority ? 'high' as const : 'auto'}
                placeholder="blur"
                blurDataURL={getOptimizedImageUrl(watch.image, { width: 16, height: 16, quality: 1, crop: 'fill', format: 'jpg' })}
                onError={handleImgError}
              />
            ) : (
              <span className="text-white/60 text-xs font-light">{watch.name}</span>
            )}
          </div>
        </Link>
        {/* Action buttons */}
        <div className="absolute bottom-2.5 right-2.5 z-10 flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
          <FavouriteToggle watchId={watch.id} />
          <CompareToggle watch={watch} />
        </div>
      </div>

      {/* Text info */}
      <div className="space-y-2" style={{ transform: 'translateZ(10px)' }}>
        <button
          onClick={handleBrandClick}
          className="text-xs text-white/60 hover:text-white/90 font-inter font-light uppercase tracking-wide transition-colors cursor-pointer bg-transparent border-none p-0 text-left"
        >
          {brands.find(b => b.id === watch.brandId)?.name || 'Unknown Brand'}
        </button>

        {watch.collectionId && collections.find(c => c.id === watch.collectionId) && (
          <button
            onClick={handleCollectionClick}
            className="block text-xs text-white/50 hover:text-white/80 font-inter font-light transition-colors cursor-pointer bg-transparent border-none p-0 text-left"
          >
            {collections.find(c => c.id === watch.collectionId)?.name}
          </button>
        )}

        <Link href={`/watches/${watch.slug || watch.id}`} onClick={handleWatchClick}>
          <h3 className="text-sm font-inter font-medium text-white group-hover:text-[#f0e6d2] transition-colors truncate cursor-pointer">
            {watch.name}
          </h3>
        </Link>

        <p className="text-lg text-[#f0e6d2] font-inter font-semibold">
          {watch.currentPrice === 0 ? 'Price on Request' : `$${watch.currentPrice.toLocaleString()}`}
        </p>
      </div>
    </motion.div>
  );
};

export default WatchCard;
