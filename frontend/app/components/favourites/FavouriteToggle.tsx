// Heart toggle button for watch cards.
// Outline when unsaved → solid when saved, crossfade transition.
// Unauthenticated clicks show a "Sign in" nudge.
// Authenticated first-click auto-saves to Favourites; popup lets user manage collections.
'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import ReactDOM from 'react-dom';
import Link from 'next/link';
import { AnimatePresence, motion } from 'framer-motion';
import { useAuth } from '@/contexts/AuthContext';
import { useFavourites } from '@/stores/favouritesStore';
import SaveToCollectionPopup from './SaveToCollectionPopup';

interface FavouriteToggleProps {
  watchId: number;
  className?: string;
}

const SignInNudge = ({ anchorRect, onClose }: { anchorRect: DOMRect; onClose: () => void }) => {
  // Auto-dismiss after 1.5 seconds
  useEffect(() => {
    const timer = setTimeout(onClose, 1500);
    return () => clearTimeout(timer);
  }, [onClose]);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [onClose]);

  const left = Math.max(8, Math.min(anchorRect.right - 220, window.innerWidth - 232));
  const top = anchorRect.bottom + 8;

  return ReactDOM.createPortal(
    <motion.div
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -4 }}
      transition={{ duration: 0.18, ease: 'easeOut' }}
      style={{ position: 'fixed', left, top, zIndex: 9999, width: 220 }}
      className="rounded-xl border border-[#bfa68a]/35 shadow-xl shadow-black/50 px-4 py-3 text-center"
      onClick={e => e.stopPropagation()}
    >
      <div
        className="absolute inset-0 rounded-xl"
        style={{
          background: 'linear-gradient(160deg, rgba(42,33,28,0.97) 0%, rgba(30,21,18,0.98) 100%)',
          backdropFilter: 'blur(20px)',
          zIndex: -1,
        }}
      />
      {/* Caret arrow pointing up to the button */}
      <svg
        width="12" height="7" viewBox="0 0 12 7" fill="none"
        className="absolute -top-[7px] right-4"
        aria-hidden="true"
      >
        <path
          d="M0 7 L6 0 L12 7"
          fill="rgba(42,33,28,0.97)"
          stroke="rgba(191,166,138,0.35)"
          strokeWidth="1"
        />
      </svg>
      <p className="text-xs text-white/60 font-inter mb-1">Sign in to save watches</p>
      <p className="text-[11px] text-white/35 font-inter mb-2.5">and receive email alerts on price drops for your favourites</p>
      <Link
        href="/login?redirect=/favourites"
        onClick={onClose}
        className="inline-block px-4 py-1.5 rounded-lg bg-[#bfa68a]/15 border border-[#bfa68a]/30 text-xs font-inter font-semibold text-[#bfa68a] hover:bg-[#bfa68a]/25 hover:text-[#d4b896] transition-colors"
      >
        Sign in
      </Link>
    </motion.div>,
    document.body
  );
};

const FavouriteToggle = ({ watchId, className = '' }: FavouriteToggleProps) => {
  const { isAuthenticated } = useAuth();
  const { isSavedAnywhere, isLoaded } = useFavourites();
  const [anchorRect, setAnchorRect] = useState<DOMRect | null>(null);
  const [autoSave, setAutoSave] = useState(false);
  const [showNudge, setShowNudge] = useState(false);
  // Ref mirrors the intended nudge toggle state so rapid clicks read the correct
  // value even before React commits the previous setState.
  const nudgeOpen = useRef(false);

  const active = isLoaded && isSavedAnywhere(watchId);

  const closeNudge = useCallback(() => {
    nudgeOpen.current = false;
    setShowNudge(false);
    setAnchorRect(null);
  }, []);

  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.stopPropagation();

    if (!isAuthenticated) {
      if (nudgeOpen.current) {
        closeNudge();
      } else {
        nudgeOpen.current = true;
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

      <AnimatePresence>
        {showNudge && anchorRect && (
          <SignInNudge
            key="sign-in-nudge"
            anchorRect={anchorRect}
            onClose={closeNudge}
          />
        )}
      </AnimatePresence>

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
