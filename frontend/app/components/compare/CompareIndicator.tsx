// Floating compare indicator — pill that expands into a sophisticated panel
// Matches Tourbillon's dark luxury aesthetic: warm brown, cream-gold accents
'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useCompare } from '@/contexts/CompareContext';
import { imageTransformations } from '@/lib/cloudinary';
import { motion, AnimatePresence } from 'framer-motion';
import Image from 'next/image';

const CompareIndicator = () => {
  const { compareWatches, removeFromCompare, clearCompare, compareCount } = useCompare();
  const [isExpanded, setIsExpanded] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Element;
      if (target.closest('[data-compare-toggle]')) return;
      if (panelRef.current && !panelRef.current.contains(target)) {
        setIsExpanded(false);
      }
    };
    if (isExpanded) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isExpanded]);

  if (compareCount === 0) return null;

  const handleCompare = () => {
    if (compareCount >= 2) {
      setIsExpanded(false);
      router.push('/compare');
    }
  };

  return (
    <div className="fixed bottom-8 right-8 z-50 select-none" ref={panelRef}>
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.92 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.92 }}
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
            className="absolute mb-1"
            style={{ width: '380px', right: '10%', bottom: 'calc(3rem + 4vh)' }}
          >
            {/* Panel */}
            <div className="rounded-2xl overflow-hidden border border-[#bfa68a]/20 shadow-2xl shadow-black/60"
              style={{ background: 'linear-gradient(160deg, rgba(42,33,28,0.97) 0%, rgba(30,21,18,0.98) 100%)', backdropFilter: 'blur(24px)' }}
            >
              {/* Header strip */}
              <div className="flex items-center justify-between px-5 py-3.5 border-b border-white/5">
                <div className="flex items-center gap-2">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#bfa68a" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 3v18" /><path d="M3 7h18" />
                    <path d="M6 7l-3 9a5 5 0 0 0 6 0L6 7" />
                    <path d="M18 7l-3 9a5 5 0 0 0 6 0L18 7" />
                  </svg>
                  <span className="text-[11px] font-inter font-semibold text-[#bfa68a] uppercase tracking-[0.15em]">
                    Comparison
                  </span>
                  <span className="text-[11px] font-inter text-white/30">{compareCount}/4</span>
                </div>
                <button
                  onClick={() => { clearCompare(); setIsExpanded(false); }}
                  className="text-[11px] text-white/25 hover:text-white/50 transition-colors font-inter"
                >
                  Clear all
                </button>
              </div>

              {/* Watch thumbnails grid */}
              <div className="px-5 py-4">
                <div className="grid grid-cols-4 gap-2.5">
                  {compareWatches.map((watch) => (
                    <div key={watch.id} className="relative group/thumb">
                      <div className="aspect-square rounded-xl overflow-hidden border border-white/8 bg-black/40 relative">
                        {watch.image ? (
                          <Image
                            src={watch.imageUrl || imageTransformations.card(watch.image)}
                            alt={watch.name}
                            width={80}
                            height={80}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-white/20 text-[8px] font-inter p-1 text-center">
                            {watch.name}
                          </div>
                        )}
                        {/* Hover overlay with remove */}
                        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover/thumb:opacity-100 transition-opacity flex items-center justify-center">
                          <button
                            onClick={() => removeFromCompare(watch.id)}
                            className="w-6 h-6 rounded-full bg-white/10 border border-white/20 flex items-center justify-center"
                          >
                            <svg width="7" height="7" viewBox="0 0 8 8" fill="none" stroke="white" strokeWidth="1.5" strokeLinecap="round">
                              <path d="M1 1l6 6M7 1l-6 6" />
                            </svg>
                          </button>
                        </div>
                      </div>
                      <p className="text-[9px] text-white/30 font-inter mt-1 text-center truncate leading-tight">
                        {watch.name}
                      </p>
                    </div>
                  ))}

                  {/* Empty slots */}
                  {Array.from({ length: 4 - compareCount }).map((_, i) => (
                    <div key={`empty-${i}`}>
                      <div className="aspect-square rounded-xl border border-dashed border-white/8 flex items-center justify-center">
                        <svg width="10" height="10" viewBox="0 0 12 12" fill="none" stroke="white" strokeOpacity="0.12" strokeWidth="1.5" strokeLinecap="round">
                          <path d="M6 1v10M1 6h10" />
                        </svg>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Divider */}
              <div className="h-px mx-5 bg-white/5" />

              {/* CTA */}
              <div className="px-5 py-4">
                <button
                  onClick={handleCompare}
                  disabled={compareCount < 2}
                  className={`w-full py-3 rounded-xl text-sm font-inter font-semibold tracking-wide transition-all duration-300 ${
                    compareCount >= 2
                      ? 'bg-gradient-to-r from-[#bfa68a] to-[#d4b896] text-[#1a1008] hover:from-[#d4b896] hover:to-[#e8cca6] shadow-lg shadow-[#bfa68a]/20 cursor-pointer'
                      : 'bg-white/4 text-white/20 cursor-not-allowed'
                  }`}
                >
                  {compareCount >= 2
                    ? 'Compare Watches'
                    : `Select ${2 - compareCount} more to compare`}
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Floating pill */}
      <motion.button
        initial={{ opacity: 0, scale: 0.8, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.8 }}
        whileHover={{ scale: 1.04 }}
        whileTap={{ scale: 0.97 }}
        onClick={() => setIsExpanded(!isExpanded)}
        className="relative flex items-center gap-4 px-6 py-4 rounded-2xl border border-[#bfa68a]/25 shadow-xl shadow-black/50 cursor-pointer"
        style={{ background: 'linear-gradient(135deg, rgba(42,33,28,0.95) 0%, rgba(30,21,18,0.97) 100%)', backdropFilter: 'blur(20px)' }}
      >
        {/* Scales icon */}
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#bfa68a" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 3v18" /><path d="M3 7h18" />
          <path d="M6 7l-3 9a5 5 0 0 0 6 0L6 7" />
          <path d="M18 7l-3 9a5 5 0 0 0 6 0L18 7" />
        </svg>

        {/* Label + count */}
        <div className="flex flex-col items-start leading-none">
          <span className="text-[11px] font-inter text-[#bfa68a]/60 uppercase tracking-[0.15em] mb-0.5">Compare</span>
          <span className="text-lg font-playfair font-semibold text-[#f0e6d2]">{compareCount} <span className="text-white/30 text-base font-inter font-normal">/ 4</span></span>
        </div>

        {/* Thin divider */}
        <div className="w-px h-7 bg-white/8" />

        {/* Chevron */}
        <svg
          width="14" height="14" viewBox="0 0 12 12" fill="none" stroke="#bfa68a" strokeOpacity="0.6" strokeWidth="1.5" strokeLinecap="round"
          className={`transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`}
        >
          <path d="M3 5l3 3 3-3" />
        </svg>
      </motion.button>
    </div>
  );
};

export default CompareIndicator;
