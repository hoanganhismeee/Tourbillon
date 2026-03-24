// Reusable compare toggle button for watch cards
// Shows a balance/scales icon that glows gold when active
'use client';

import React from 'react';
import { Watch } from '@/lib/api';
import { useCompare, MAX_COMPARE_COUNT } from '@/stores/compareStore';

interface CompareToggleProps {
  watch: Watch;
  variant?: 'icon' | 'button';
  className?: string;
}

const CompareToggle = ({ watch, variant = 'icon', className = '' }: CompareToggleProps) => {
  const { addToCompare, removeFromCompare, isInCompare, compareWatches } = useCompare();
  const active = isInCompare(watch.id);
  const disabled = !active && compareWatches.length >= MAX_COMPARE_COUNT;

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (active) {
      removeFromCompare(watch.id);
    } else if (!disabled) {
      addToCompare(watch);
    }
  };

  if (variant === 'button') {
    return (
      <button
        onClick={handleClick}
        disabled={disabled}
        data-compare-toggle="true"
        className={`py-4 px-8 rounded-xl font-semibold transition-all duration-300 flex items-center gap-2.5 ${
          active
            ? 'bg-[#bfa68a]/20 text-[#ecddc8] border border-[#bfa68a]'
            : disabled
              ? 'border border-white/10 text-white/25 cursor-not-allowed'
              : 'border border-[#bfa68a] text-[#bfa68a] hover:bg-[#bfa68a]/10'
        } ${className}`}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 3v18" />
          <path d="M3 7h18" />
          <path d="M6 7l-3 9a5 5 0 0 0 6 0L6 7" />
          <path d="M18 7l-3 9a5 5 0 0 0 6 0L18 7" />
        </svg>
        {active ? 'Remove from Comparison' : disabled ? 'Compare Full (4/4)' : 'Add to Comparison'}
      </button>
    );
  }

  return (
    <button
      onClick={handleClick}
      disabled={disabled}
      data-compare-toggle="true"
      title={active ? 'Remove from comparison' : disabled ? 'Comparison full (4/4)' : 'Add to comparison'}
      className={`w-8 h-8 rounded-full flex items-center justify-center transition-all duration-300 ${
        active
          ? 'bg-[#f0e6d2]/20 text-[#f0e6d2] shadow-[0_0_10px_rgba(240,230,210,0.2)] border border-[#f0e6d2]/20'
          : disabled
            ? 'text-white/15 cursor-not-allowed bg-black/40'
            : 'text-white/55 hover:text-white/90 hover:bg-black/60 bg-black/40 border border-white/15 hover:border-white/35'
      } ${className}`}
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill={active ? '#f0e6d2' : 'none'} fillOpacity={active ? 0.15 : 0} stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 3v18" />
        <path d="M3 7h18" />
        <path d="M6 7l-3 9a5 5 0 0 0 6 0L6 7" />
        <path d="M18 7l-3 9a5 5 0 0 0 6 0L18 7" />
      </svg>
    </button>
  );
};

export default CompareToggle;
