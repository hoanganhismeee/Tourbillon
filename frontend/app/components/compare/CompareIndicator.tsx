// Floating compare indicator — compact pill that expands into a glass panel
// Shows selected watch thumbnails, remove buttons, and Compare CTA
'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useCompare } from '@/contexts/CompareContext';
import { imageTransformations } from '@/lib/cloudinary';
import { motion, AnimatePresence } from 'framer-motion';
import Image from 'next/image';

const CompareIndicator = () => {
  const { compareWatches, removeFromCompare, clearCompare, compareCount } = useCompare();
  const [isExpanded, setIsExpanded] = useState(false);
  const router = useRouter();

  if (compareCount === 0) return null;

  const handleCompare = () => {
    if (compareCount >= 2) {
      router.push('/compare');
    }
  };

  return (
    <div className="fixed bottom-8 right-8 z-50">
      <AnimatePresence>
        {/* Expanded panel */}
        {isExpanded && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.9 }}
            transition={{ duration: 0.3, ease: 'easeOut' }}
            className="absolute bottom-16 right-0 mb-2 bg-black/80 backdrop-blur-xl border border-white/15 rounded-2xl p-5 shadow-2xl shadow-black/50"
            style={{ minWidth: '320px' }}
          >
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-playfair font-semibold text-[#f0e6d2] tracking-wide">
                Comparison ({compareCount}/4)
              </h3>
              <button
                onClick={() => { clearCompare(); setIsExpanded(false); }}
                className="text-xs text-white/40 hover:text-white/70 transition-colors font-inter"
              >
                Clear all
              </button>
            </div>

            {/* Watch thumbnails */}
            <div className="flex gap-3 mb-4">
              {compareWatches.map((watch) => (
                <div key={watch.id} className="relative group/thumb flex-shrink-0">
                  <div className="w-16 h-16 rounded-lg overflow-hidden border border-white/10 bg-black/40">
                    {watch.image ? (
                      <Image
                        src={watch.imageUrl || imageTransformations.card(watch.image)}
                        alt={watch.name}
                        width={64}
                        height={64}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-white/30 text-[10px] font-inter text-center p-1">
                        {watch.name}
                      </div>
                    )}
                  </div>
                  {/* Remove button */}
                  <button
                    onClick={() => removeFromCompare(watch.id)}
                    className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-white/10 border border-white/20 flex items-center justify-center opacity-0 group-hover/thumb:opacity-100 transition-opacity hover:bg-white/20"
                  >
                    <svg width="8" height="8" viewBox="0 0 8 8" fill="none" stroke="white" strokeWidth="1.5" strokeLinecap="round">
                      <path d="M1 1l6 6M7 1l-6 6" />
                    </svg>
                  </button>
                  {/* Watch name tooltip */}
                  <p className="text-[10px] text-white/50 font-inter mt-1 text-center truncate w-16">
                    {watch.name}
                  </p>
                </div>
              ))}

              {/* Empty slots */}
              {Array.from({ length: 4 - compareCount }).map((_, i) => (
                <div key={`empty-${i}`} className="w-16 h-16 rounded-lg border border-dashed border-white/10 flex items-center justify-center flex-shrink-0">
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="white" strokeOpacity="0.2" strokeWidth="1.5" strokeLinecap="round">
                    <path d="M7 1v12M1 7h12" />
                  </svg>
                </div>
              ))}
            </div>

            {/* Compare button */}
            <button
              onClick={handleCompare}
              disabled={compareCount < 2}
              className={`w-full py-2.5 rounded-xl text-sm font-inter font-medium transition-all duration-300 ${
                compareCount >= 2
                  ? 'bg-[#f0e6d2] text-[#1e1512] hover:bg-[#e6d9c2] cursor-pointer'
                  : 'bg-white/5 text-white/30 cursor-not-allowed'
              }`}
            >
              {compareCount >= 2 ? 'Compare Watches' : 'Select at least 2 watches'}
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Floating pill button */}
      <motion.button
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0, opacity: 0 }}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => setIsExpanded(!isExpanded)}
        className="relative flex items-center gap-2.5 px-5 py-3 bg-black/80 backdrop-blur-xl border border-white/15 rounded-full shadow-2xl shadow-black/50 hover:border-[#f0e6d2]/30 transition-colors duration-300 cursor-pointer"
      >
        {/* Scales icon */}
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#f0e6d2" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 3v18" />
          <path d="M3 7h18" />
          <path d="M6 7l-3 9a5 5 0 0 0 6 0L6 7" />
          <path d="M18 7l-3 9a5 5 0 0 0 6 0L18 7" />
        </svg>

        {/* Count badge */}
        <span className="text-sm font-inter font-medium text-[#f0e6d2]">
          {compareCount}
        </span>

        {/* Chevron */}
        <svg
          width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="#f0e6d2" strokeOpacity="0.5" strokeWidth="1.5" strokeLinecap="round"
          className={`transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`}
        >
          <path d="M3 5l3 3 3-3" />
        </svg>
      </motion.button>
    </div>
  );
};

export default CompareIndicator;
