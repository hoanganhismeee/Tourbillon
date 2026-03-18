// Reusable compare toggle button for watch cards
// Shows a balance/scales icon that glows gold when active
'use client';

import React from 'react';
import { Watch } from '@/lib/api';
import { useCompare } from '@/contexts/CompareContext';

interface CompareToggleProps {
  watch: Watch;
  variant?: 'icon' | 'button';
  className?: string;
}

const ScalesIcon = ({ active }: { active: boolean }) => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={active ? '#f0e6d2' : 'currentColor'} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 3v18" />
    <path d="M3 7h18" />
    <path d="M6 7l-3 9a5 5 0 0 0 6 0L6 7" />
    <path d="M18 7l-3 9a5 5 0 0 0 6 0L18 7" />
  </svg>
);

const CompareToggle = ({ watch, variant = 'icon', className = '' }: CompareToggleProps) => {
  const { addToCompare, removeFromCompare, isInCompare, isFull } = useCompare();
  const active = isInCompare(watch.id);
  const disabled = !active && isFull;

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
        className={`py-4 px-8 rounded-xl font-semibold transition-all duration-300 flex items-center gap-2 ${
          active
            ? 'bg-[#f0e6d2]/20 text-[#f0e6d2] border border-[#f0e6d2]/30'
            : disabled
              ? 'bg-white/5 text-white/30 cursor-not-allowed border border-white/5'
              : 'bg-white/10 text-white hover:bg-white/20 border border-white/10'
        } ${className}`}
      >
        <ScalesIcon active={active} />
        {active ? 'Remove from Comparison' : disabled ? 'Compare Full (4/4)' : 'Add to Comparison'}
      </button>
    );
  }

  return (
    <button
      onClick={handleClick}
      disabled={disabled}
      title={active ? 'Remove from comparison' : disabled ? 'Comparison full (4/4)' : 'Add to comparison'}
      className={`p-2 rounded-lg transition-all duration-300 ${
        active
          ? 'bg-[#f0e6d2]/20 text-[#f0e6d2] shadow-[0_0_12px_rgba(240,230,210,0.3)]'
          : disabled
            ? 'text-white/20 cursor-not-allowed'
            : 'text-white/40 hover:text-white/80 hover:bg-white/10'
      } ${className}`}
    >
      <ScalesIcon active={active} />
    </button>
  );
};

export default CompareToggle;
