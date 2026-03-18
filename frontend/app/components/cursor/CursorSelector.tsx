// Cursor selector panel — bottom-left floating widget
// Lets user preview and select a watch-themed cursor
'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useCursor, CURSOR_OPTIONS, CursorStyle } from '@/contexts/CursorContext';
import { motion, AnimatePresence } from 'framer-motion';

// Mini preview icons for each cursor (14×14)
const CursorPreview = ({ id }: { id: CursorStyle }) => {
  switch (id) {
    case 'default':
      return (
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <path d="M2 2l9 4.5-4 1.5-2 5L2 2z" fill="currentColor" fillOpacity="0.7" stroke="currentColor" strokeWidth="0.5"/>
        </svg>
      );
    case 'tourbillon':
      return (
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <circle cx="7" cy="7" r="5.5" stroke="currentColor" strokeWidth="0.8" strokeOpacity="0.6" strokeDasharray="2 1.5"/>
          <circle cx="7" cy="7" r="3" stroke="currentColor" strokeWidth="0.8" strokeOpacity="0.4"/>
          <line x1="7" y1="1.5" x2="7" y2="4" stroke="currentColor" strokeWidth="1"/>
          <line x1="7" y1="10" x2="7" y2="12.5" stroke="currentColor" strokeWidth="1"/>
          <line x1="1.5" y1="7" x2="4" y2="7" stroke="currentColor" strokeWidth="1"/>
          <line x1="10" y1="7" x2="12.5" y2="7" stroke="currentColor" strokeWidth="1"/>
          <circle cx="7" cy="7" r="1.2" fill="currentColor"/>
        </svg>
      );
    case 'crosshair':
      return (
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <line x1="7" y1="1" x2="7" y2="5" stroke="currentColor" strokeWidth="1.2"/>
          <line x1="7" y1="9" x2="7" y2="13" stroke="currentColor" strokeWidth="1.2"/>
          <line x1="1" y1="7" x2="5" y2="7" stroke="currentColor" strokeWidth="1.2"/>
          <line x1="9" y1="7" x2="13" y2="7" stroke="currentColor" strokeWidth="1.2"/>
          <circle cx="7" cy="7" r="3" stroke="currentColor" strokeWidth="0.7" strokeOpacity="0.4"/>
          <circle cx="7" cy="7" r="1" fill="currentColor"/>
        </svg>
      );
    case 'lumed':
      return (
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <circle cx="7" cy="7" r="5" fill="rgba(240,200,100,0.08)" stroke="rgba(240,210,120,0.45)" strokeWidth="0.8"/>
          <circle cx="7" cy="7" r="2.5" fill="rgba(245,218,128,0.75)"/>
          <circle cx="6" cy="6" r="0.8" fill="rgba(255,242,200,0.8)"/>
        </svg>
      );
    case 'hand':
      return (
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <path d="M7 1.5L7.7 8.5H6.3Z" fill="currentColor" fillOpacity="0.85"/>
          <path d="M7 8.5L8.5 11H5.5Z" fill="currentColor" fillOpacity="0.4"/>
          <circle cx="7" cy="3.2" r="0.8" fill="rgba(245,218,128,0.9)"/>
          <circle cx="7" cy="8.5" r="1.6" stroke="currentColor" strokeWidth="0.6" strokeOpacity="0.5" fill="none"/>
        </svg>
      );
    case 'bezel':
      return (
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <circle cx="7" cy="7" r="6" stroke="currentColor" strokeWidth="0.8" strokeOpacity="0.65" fill="none"/>
          <rect x="6" y="0.5" width="2" height="2.5" rx="0.5" fill="currentColor" fillOpacity="0.8"/>
          <rect x="11.5" y="6" width="2" height="2" rx="0.4" fill="currentColor" fillOpacity="0.3"/>
          <rect x="0.5" y="6" width="2" height="2" rx="0.4" fill="currentColor" fillOpacity="0.3"/>
          <circle cx="7" cy="7" r="1" fill="currentColor" fillOpacity="0.5"/>
        </svg>
      );
    case 'compass':
      return (
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <path d="M7 1.5L8.2 6.5L7 7L5.8 6.5Z" fill="currentColor"/>
          <path d="M12.5 7L7.5 8.2L7 7L7.5 5.8Z" fill="currentColor" fillOpacity="0.35"/>
          <path d="M7 12.5L5.8 7.5L7 7L8.2 7.5Z" fill="currentColor" fillOpacity="0.25"/>
          <path d="M1.5 7L6.5 5.8L7 7L6.5 8.2Z" fill="currentColor" fillOpacity="0.55"/>
          <circle cx="7" cy="7" r="1" fill="currentColor"/>
        </svg>
      );
    case 'sapphire':
      return (
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <polygon points="7,1 12,3.75 12,9.25 7,12 2,9.25 2,3.75"
            stroke="currentColor" strokeWidth="0.7" fill="none" strokeOpacity="0.7"/>
          <line x1="7" y1="1" x2="7" y2="6.5" stroke="currentColor" strokeWidth="0.4" strokeOpacity="0.5"/>
          <line x1="12" y1="3.75" x2="7" y2="6.5" stroke="currentColor" strokeWidth="0.4" strokeOpacity="0.5"/>
          <line x1="2" y1="3.75" x2="7" y2="6.5" stroke="currentColor" strokeWidth="0.4" strokeOpacity="0.5"/>
          <circle cx="7" cy="6.5" r="1" fill="currentColor" fillOpacity="0.85"/>
        </svg>
      );
    case 'rotor':
      return (
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <path d="M7 7 L1 7 A6 6 0 0 1 13 7 Z"
            fill="currentColor" fillOpacity="0.15" stroke="currentColor" strokeWidth="0.7"/>
          <path d="M1 7 A6 6 0 0 1 13 7"
            stroke="currentColor" strokeWidth="2" strokeOpacity="0.5" fill="none" strokeLinecap="round"/>
          <circle cx="7" cy="7" r="1.5" stroke="currentColor" strokeWidth="0.6" fill="none"/>
          <circle cx="7" cy="7" r="0.6" fill="currentColor"/>
        </svg>
      );
  }
};

const CursorSelector = () => {
  const { cursor, setCursor } = useCursor();
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  return (
    <div ref={containerRef} className="fixed bottom-8 left-8 z-50 select-none">
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 16, scale: 0.93 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.93 }}
            transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
            className="absolute bottom-14 left-0 mb-1"
            style={{ width: '220px' }}
          >
            <div
              className="rounded-2xl overflow-hidden border border-[#bfa68a]/15 shadow-2xl shadow-black/60"
              style={{ background: 'linear-gradient(160deg, rgba(42,33,28,0.97) 0%, rgba(30,21,18,0.98) 100%)', backdropFilter: 'blur(24px)' }}
            >
              {/* Header */}
              <div className="px-4 py-3 border-b border-white/5">
                <span className="text-[11px] font-inter font-semibold text-[#bfa68a] uppercase tracking-[0.15em]">
                  Cursor Style
                </span>
              </div>

              {/* Scrollable options list — shows 5, scroll for more */}
              <div
                className="py-2 overflow-y-auto"
                style={{
                  maxHeight: '258px',
                  scrollbarWidth: 'thin',
                  scrollbarColor: 'rgba(191,166,138,0.25) transparent',
                }}
              >
                {CURSOR_OPTIONS.map((option) => {
                  const isActive = cursor === option.id;
                  return (
                    <button
                      key={option.id}
                      onClick={() => { setCursor(option.id); setIsOpen(false); }}
                      className={`w-full flex items-center gap-3 px-4 py-2.5 transition-all duration-200 text-left ${
                        isActive
                          ? 'bg-[#bfa68a]/12 text-[#f0e6d2]'
                          : 'text-white/50 hover:bg-white/4 hover:text-white/80'
                      }`}
                    >
                      {/* Preview icon */}
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center border flex-shrink-0 ${
                        isActive
                          ? 'border-[#bfa68a]/30 bg-[#bfa68a]/10 text-[#bfa68a]'
                          : 'border-white/8 bg-white/4 text-white/40'
                      }`}>
                        <CursorPreview id={option.id} />
                      </div>

                      {/* Label + description */}
                      <div className="flex-1 min-w-0">
                        <div className={`text-sm font-inter font-medium leading-none mb-0.5 ${isActive ? 'text-[#f0e6d2]' : 'text-white/70'}`}>
                          {option.label}
                        </div>
                        <div className="text-[10px] font-inter text-white/25 truncate">
                          {option.description}
                        </div>
                      </div>

                      {/* Active indicator */}
                      {isActive && (
                        <div className="w-1.5 h-1.5 rounded-full bg-[#bfa68a] flex-shrink-0" />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Toggle pill */}
      <motion.button
        whileHover={{ scale: 1.04 }}
        whileTap={{ scale: 0.97 }}
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2.5 px-4 py-3 rounded-2xl border border-[#bfa68a]/20 shadow-xl shadow-black/40 cursor-pointer"
        style={{ background: 'linear-gradient(135deg, rgba(42,33,28,0.9) 0%, rgba(30,21,18,0.95) 100%)', backdropFilter: 'blur(20px)' }}
      >
        {/* Current cursor preview */}
        <div className="w-7 h-7 rounded-lg border border-[#bfa68a]/20 bg-[#bfa68a]/8 flex items-center justify-center text-[#bfa68a]">
          <CursorPreview id={cursor} />
        </div>
        <div className="flex flex-col items-start leading-none">
          <span className="text-[9px] font-inter text-[#bfa68a]/50 uppercase tracking-[0.15em] mb-0.5">Cursor</span>
          <span className="text-sm font-playfair font-medium text-[#f0e6d2]">
            {CURSOR_OPTIONS.find(o => o.id === cursor)?.label}
          </span>
        </div>
        <svg
          width="10" height="10" viewBox="0 0 12 12" fill="none" stroke="#bfa68a" strokeOpacity="0.5" strokeWidth="1.5" strokeLinecap="round"
          className={`transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`}
        >
          <path d="M3 5l3 3 3-3" />
        </svg>
      </motion.button>
    </div>
  );
};

export default CursorSelector;
