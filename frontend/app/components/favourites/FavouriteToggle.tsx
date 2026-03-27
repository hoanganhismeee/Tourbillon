// Heart toggle button for watch cards.
// Outline when unsaved → solid when saved, crossfade transition.
// Unauthenticated clicks show a "Sign in" nudge.
// Authenticated first-click auto-saves to Favourites; popup lets user manage collections.
'use client';

import React, { useState, useRef, useEffect } from 'react';
import ReactDOM from 'react-dom';
import Link from 'next/link';
import { AnimatePresence } from 'framer-motion';
import { useAuth } from '@/contexts/AuthContext';
import { useFavourites } from '@/stores/favouritesStore';
import SaveToCollectionPopup from './SaveToCollectionPopup';

interface FavouriteToggleProps {
  watchId: number;
  className?: string;
}

// Auto-dismissing tooltip that appears when unauthenticated users click the heart.
// Second click on the heart closes it; it also closes itself after 1.5s.
const SignInNudge = ({ anchorRect, onClose }: { anchorRect: DOMRect; onClose: () => void }) => {
  const ref = useRef<HTMLDivElement>(null);
  const [barStarted, setBarStarted] = useState(false);

  // Auto-dismiss after 1.5s
  useEffect(() => {
    const t = setTimeout(onClose, 1500);
    return () => clearTimeout(t);
  }, [onClose]);

  // Start progress bar animation on next frame (allows CSS transition to fire)
  useEffect(() => {
    const id = requestAnimationFrame(() => setBarStarted(true));
    return () => cancelAnimationFrame(id);
  }, []);

  useEffect(() => {
    const handleOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Element)) onClose();
    };
    const handleEscape = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('mousedown', handleOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [onClose]);

  const left = Math.max(8, Math.min(anchorRect.right - 168, window.innerWidth - 180));
  const top = anchorRect.bottom + 8;

  return ReactDOM.createPortal(
    <div
      ref={ref}
      style={{ position: 'fixed', left, top, zIndex: 9999, width: 168 }}
      className="rounded-xl overflow-hidden shadow-xl shadow-black/50"
      onClick={e => e.stopPropagation()}
    >
      <div
        className="absolute inset-0"
        style={{
          background: 'linear-gradient(160deg, rgba(42,33,28,0.97) 0%, rgba(30,21,18,0.98) 100%)',
          backdropFilter: 'blur(20px)',
          border: '1px solid rgba(191,166,138,0.15)',
          borderRadius: 'inherit',
        }}
      />
      <div className="relative px-4 pt-3 pb-2.5 text-center">
        <p className="text-xs text-white/55 font-inter mb-2">Sign in to save watches</p>
        <Link
          href="/login?redirect=/favourites"
          onClick={onClose}
          className="block text-xs font-inter font-semibold text-[#bfa68a] hover:text-[#d4b896] transition-colors"
        >
          Sign in
        </Link>
      </div>
      {/* Shrinking progress bar showing time until auto-dismiss */}
      <div className="relative h-[2px] bg-white/5">
        <div
          className="absolute inset-y-0 left-0 bg-[#bfa68a]/40"
          style={{
            width: barStarted ? '0%' : '100%',
            transition: 'width 1.5s linear',
          }}
        />
      </div>
    </div>,
    document.body
  );
};

const FavouriteToggle = ({ watchId, className = '' }: FavouriteToggleProps) => {
  const { isAuthenticated } = useAuth();
  const { isSavedAnywhere, isLoaded } = useFavourites();
  const [anchorRect, setAnchorRect] = useState<DOMRect | null>(null);
  const [autoSave, setAutoSave] = useState(false);
  const [showNudge, setShowNudge] = useState(false);

  const active = isLoaded && isSavedAnywhere(watchId);

  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.stopPropagation();

    if (!isAuthenticated) {
      if (showNudge) {
        setShowNudge(false);
        setAnchorRect(null);
      } else {
        setShowNudge(true);
        setAnchorRect(e.currentTarget.getBoundingClientRect());
      }
      return;
    }

    setShowNudge(false);

    // Toggle popup closed if already open
    if (anchorRect) {
      setAnchorRect(null);
      return;
    }

    // Capture whether we should auto-save at click time, then let popup handle the save
    setAutoSave(!active);
    setAnchorRect(e.currentTarget.getBoundingClientRect());
  };

  return (
    <>
      <button
        onClick={handleClick}
        aria-label={active ? 'Saved to favourites' : 'Save to favourites'}
        className={`w-8 h-8 rounded-full flex items-center justify-center transition-all duration-300 ${
          active
            ? 'bg-[#f0e6d2]/20 shadow-[0_0_10px_rgba(240,230,210,0.2)] border border-[#f0e6d2]/20'
            : 'text-white/55 hover:text-white/90 hover:bg-black/60 bg-black/40 border border-white/15 hover:border-white/35'
        } ${className}`}
      >
        <span className="relative w-[14px] h-[14px]">
          <svg
            width="14" height="14" viewBox="0 0 24 24"
            fill="none" stroke="currentColor" strokeWidth="1.5"
            strokeLinecap="round" strokeLinejoin="round"
            className="absolute inset-0 transition-opacity duration-300"
            style={{ opacity: active ? 0 : 1 }}
          >
            <path d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12Z" />
          </svg>
          <svg
            width="14" height="14" viewBox="0 0 24 24"
            fill="#f0e6d2"
            className="absolute inset-0 transition-opacity duration-300"
            style={{ opacity: active ? 1 : 0 }}
          >
            <path d="m11.645 20.91-.007-.003-.022-.012a15.247 15.247 0 0 1-.383-.218 25.18 25.18 0 0 1-4.244-3.17C4.688 15.36 2.25 12.174 2.25 8.25 2.25 5.322 4.714 3 7.688 3A5.5 5.5 0 0 1 12 5.052 5.5 5.5 0 0 1 16.313 3c2.973 0 5.437 2.322 5.437 5.25 0 3.925-2.438 7.111-4.739 9.256a25.175 25.175 0 0 1-4.244 3.17 15.247 15.247 0 0 1-.383.219l-.022.012-.007.004-.003.001a.752.752 0 0 1-.704 0l-.003-.001Z" />
          </svg>
        </span>
      </button>

      {showNudge && anchorRect && (
        <SignInNudge
          anchorRect={anchorRect}
          onClose={() => { setShowNudge(false); setAnchorRect(null); }}
        />
      )}

      <AnimatePresence>
        {!showNudge && anchorRect && (
          <SaveToCollectionPopup
            key={`popup-${watchId}`}
            watchId={watchId}
            anchorRect={anchorRect}
            autoSave={autoSave}
            onClose={() => setAnchorRect(null)}
          />
        )}
      </AnimatePresence>
    </>
  );
};

export default FavouriteToggle;
