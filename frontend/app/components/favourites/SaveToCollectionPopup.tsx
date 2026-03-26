// Portal popup for saving a watch to Favourites or a named collection.
// Positioned via getBoundingClientRect; flips upward if near the bottom of the viewport.
// Matches CompareIndicator dark luxury panel styling.
'use client';

import React, { useEffect, useRef, useState } from 'react';
import ReactDOM from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useFavourites } from '@/stores/favouritesStore';

interface SaveToCollectionPopupProps {
  watchId: number;
  anchorRect: DOMRect;
  onClose: () => void;
}

const POPUP_WIDTH = 280;
const POPUP_HEIGHT = 320;

const SaveToCollectionPopup = ({ watchId, anchorRect, onClose }: SaveToCollectionPopupProps) => {
  const {
    isFavourited,
    isInCollection,
    favouriteWatchIds,
    collections,
    toggleFavourite,
    addToCollection,
    removeFromCollection,
    createCollection,
  } = useFavourites();

  const popupRef = useRef<HTMLDivElement>(null);
  const [newName, setNewName] = useState('');
  const [showNewInput, setShowNewInput] = useState(false);
  const [creatingCollection, setCreatingCollection] = useState(false);
  // Track per-row loading state to prevent race conditions
  const [updatingRows, setUpdatingRows] = useState<Set<string>>(new Set());
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  // Click-outside and Escape close
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (popupRef.current && !popupRef.current.contains(e.target as Element)) onClose();
    };
    const handleEscape = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [onClose]);

  // Compute position: flip up if near bottom of viewport
  const left = Math.min(anchorRect.right - POPUP_WIDTH, window.innerWidth - POPUP_WIDTH - 12);
  const top =
    anchorRect.bottom + 8 + POPUP_HEIGHT > window.innerHeight
      ? anchorRect.top - POPUP_HEIGHT - 8
      : anchorRect.bottom + 8;

  const handleFavouriteClick = async () => {
    const key = 'fav';
    if (updatingRows.has(key)) return;
    setUpdatingRows(prev => new Set(prev).add(key));
    try {
      await toggleFavourite(watchId);
    } finally {
      setUpdatingRows(prev => { const next = new Set(prev); next.delete(key); return next; });
    }
  };

  const handleCollectionClick = async (collectionId: number) => {
    const key = `col-${collectionId}`;
    if (updatingRows.has(key)) return;
    setUpdatingRows(prev => new Set(prev).add(key));
    try {
      if (isInCollection(collectionId, watchId)) {
        await removeFromCollection(collectionId, watchId);
      } else {
        await addToCollection(collectionId, watchId);
      }
    } finally {
      setUpdatingRows(prev => { const next = new Set(prev); next.delete(key); return next; });
    }
  };

  const handleCreateCollection = async () => {
    const trimmed = newName.trim();
    if (!trimmed || creatingCollection) return;
    setCreatingCollection(true);
    try {
      const newCollection = await createCollection(trimmed);
      await addToCollection(newCollection.id, watchId);
      setNewName('');
      setShowNewInput(false);
    } catch {
      // name conflict or network error — keep input open
    } finally {
      setCreatingCollection(false);
    }
  };

  const favActive = isFavourited(watchId);
  const favCount = favouriteWatchIds.size;

  if (!mounted) return null;

  const content = (
    <AnimatePresence>
      <motion.div
        key="popup"
        ref={popupRef}
        initial={{ opacity: 0, y: -8, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -8, scale: 0.95 }}
        transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
        style={{
          position: 'fixed',
          left,
          top,
          width: POPUP_WIDTH,
          zIndex: 9999,
          background: 'linear-gradient(160deg, rgba(42,33,28,0.97) 0%, rgba(30,21,18,0.98) 100%)',
          backdropFilter: 'blur(24px)',
        }}
        className="rounded-2xl border border-[#bfa68a]/20 shadow-2xl shadow-black/60 overflow-hidden"
      >
        {/* Favourites row */}
        <button
          onClick={handleFavouriteClick}
          disabled={updatingRows.has('fav')}
          className="w-full flex items-center gap-3 px-4 py-3 hover:bg-white/5 transition-colors text-left"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" className="shrink-0">
            <path
              d="M12 21.593c-5.63-5.539-11-10.297-11-14.402 0-3.791 3.068-5.191 5.281-5.191 1.312 0 4.151.501 5.719 4.457 1.59-3.968 4.464-4.447 5.726-4.447 2.54 0 5.274 1.621 5.274 5.181 0 4.069-5.136 8.625-11 14.402z"
              fill={favActive ? '#f0e6d2' : 'none'}
              stroke={favActive ? '#f0e6d2' : '#bfa68a'}
              strokeWidth={favActive ? 0 : 1.5}
            />
          </svg>
          <span className="flex-1 text-sm font-inter text-[#f0e6d2]">Favourites</span>
          <span className="text-xs text-white/30 font-inter">{favCount}</span>
          {favActive && (
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="#4ade80" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M1.5 6l3 3 6-6" />
            </svg>
          )}
        </button>

        {/* Divider */}
        {collections.length > 0 && <div className="h-px mx-4 bg-white/5" />}

        {/* Collections */}
        {collections.length > 0 && (
          <div className="max-h-40 overflow-y-auto">
            {collections.map(col => {
              const inCol = isInCollection(col.id, watchId);
              const loading = updatingRows.has(`col-${col.id}`);
              return (
                <button
                  key={col.id}
                  onClick={() => handleCollectionClick(col.id)}
                  disabled={loading}
                  className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-white/5 transition-colors text-left"
                >
                  <div className={`w-3.5 h-3.5 rounded border shrink-0 flex items-center justify-center ${
                    inCol ? 'bg-[#bfa68a]/30 border-[#bfa68a]' : 'border-white/25'
                  }`}>
                    {inCol && (
                      <svg width="8" height="8" viewBox="0 0 8 8" fill="none" stroke="#bfa68a" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M1 4l2 2 4-4" />
                      </svg>
                    )}
                  </div>
                  <span className="flex-1 text-sm font-inter text-white/80 truncate">{col.name}</span>
                  <span className="text-xs text-white/25 font-inter shrink-0">{col.watchIds.length}</span>
                </button>
              );
            })}
          </div>
        )}

        {/* Divider before create */}
        <div className="h-px mx-4 bg-white/5" />

        {/* Create new collection */}
        {showNewInput ? (
          <div className="px-4 py-3 flex items-center gap-2">
            <input
              autoFocus
              value={newName}
              onChange={e => setNewName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleCreateCollection(); if (e.key === 'Escape') setShowNewInput(false); }}
              placeholder="Collection name"
              maxLength={100}
              className="flex-1 bg-white/5 border border-white/15 rounded-lg px-3 py-1.5 text-sm text-white/90 placeholder-white/25 font-inter outline-none focus:border-[#bfa68a]/40"
            />
            <button
              onClick={handleCreateCollection}
              disabled={!newName.trim() || creatingCollection}
              className="px-3 py-1.5 rounded-lg text-xs font-inter font-semibold bg-[#bfa68a]/20 text-[#bfa68a] hover:bg-[#bfa68a]/30 transition-colors disabled:opacity-40"
            >
              Save
            </button>
          </div>
        ) : (
          <button
            onClick={() => setShowNewInput(true)}
            className="w-full flex items-center gap-3 px-4 py-3 hover:bg-white/5 transition-colors text-left"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="#bfa68a" strokeOpacity="0.6" strokeWidth="1.5" strokeLinecap="round">
              <path d="M7 1v12M1 7h12" />
            </svg>
            <span className="text-sm font-inter text-white/40">Create new collection</span>
          </button>
        )}
      </motion.div>
    </AnimatePresence>
  );

  return ReactDOM.createPortal(content, document.body);
};

export default SaveToCollectionPopup;
