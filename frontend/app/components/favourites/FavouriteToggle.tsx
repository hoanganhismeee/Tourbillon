// Heart toggle button for watch cards.
// Fills gold when the watch is saved anywhere (Favourites or any collection).
// Opens SaveToCollectionPopup anchored to the button's bounding rect on click.
'use client';

import React, { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useFavourites } from '@/stores/favouritesStore';
import SaveToCollectionPopup from './SaveToCollectionPopup';

interface FavouriteToggleProps {
  watchId: number;
  className?: string;
}

const FavouriteToggle = ({ watchId, className = '' }: FavouriteToggleProps) => {
  const { isAuthenticated } = useAuth();
  const { isSavedAnywhere, isLoaded } = useFavourites();
  const [anchorRect, setAnchorRect] = useState<DOMRect | null>(null);

  const active = isLoaded && isSavedAnywhere(watchId);

  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isAuthenticated) return;
    setAnchorRect(e.currentTarget.getBoundingClientRect());
  };

  return (
    <>
      <button
        onClick={handleClick}
        title={isAuthenticated ? (active ? 'Saved' : 'Save to favourites') : 'Sign in to save'}
        className={`w-8 h-8 rounded-full flex items-center justify-center transition-all duration-300 ${
          active
            ? 'bg-[#f0e6d2]/20 shadow-[0_0_10px_rgba(240,230,210,0.2)] border border-[#f0e6d2]/20'
            : 'text-white/55 hover:text-white/90 hover:bg-black/60 bg-black/40 border border-white/15 hover:border-white/35'
        } ${className}`}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
          <path
            d="M12 21.593c-5.63-5.539-11-10.297-11-14.402 0-3.791 3.068-5.191 5.281-5.191 1.312 0 4.151.501 5.719 4.457 1.59-3.968 4.464-4.447 5.726-4.447 2.54 0 5.274 1.621 5.274 5.181 0 4.069-5.136 8.625-11 14.402z"
            fill={active ? '#f0e6d2' : 'none'}
            stroke={active ? '#f0e6d2' : 'currentColor'}
            strokeWidth={active ? 0 : 1.5}
          />
        </svg>
      </button>

      {anchorRect && (
        <SaveToCollectionPopup
          watchId={watchId}
          anchorRect={anchorRect}
          onClose={() => setAnchorRect(null)}
        />
      )}
    </>
  );
};

export default FavouriteToggle;
