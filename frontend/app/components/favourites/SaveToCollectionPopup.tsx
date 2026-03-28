// Portal popup for saving a watch to Favourites or a named collection.
// Spotify-style UX: auto-saves to Favourites on first open; popup lets user manage collections.
// Positioned by measuring actual DOM height after mount to avoid incorrect viewport-flip.
'use client';

import React, { useEffect, useRef, useState } from 'react';
import ReactDOM from 'react-dom';
import { motion } from 'framer-motion';
import { useFavourites } from '@/stores/favouritesStore';

interface SaveToCollectionPopupProps {
  watchId: number;
  anchorRect: DOMRect;
  autoSave: boolean;
  onClose: () => void;
}

const POPUP_WIDTH = 260;
const GAP = 8;

const SaveToCollectionPopup = ({ watchId, anchorRect, autoSave, onClose }: SaveToCollectionPopupProps) => {
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

  // Positioning state — starts hidden until measured
  const [pos, setPos] = useState<{ left: number; top: number; origin: string } | null>(null);

  const [search, setSearch] = useState('');
  const [newName, setNewName] = useState('');
  const [showNewInput, setShowNewInput] = useState(false);
  const [createError, setCreateError] = useState('');
  const [creatingCollection, setCreatingCollection] = useState(false);
  const [updatingRows, setUpdatingRows] = useState<Set<string>>(new Set());
  const [pendingFav, setPendingFav] = useState<boolean | null>(null);
  const [pendingCols, setPendingCols] = useState<Map<number, boolean>>(new Map());

  // On mount: auto-save if needed, then measure and position the popup.
  // Runs after first paint so window/DOM are available.
  useEffect(() => {
    // Auto-save to Favourites on first open if not already saved
    if (autoSave && !isFavourited(watchId)) {
      toggleFavourite(watchId);
    }

    // Measure actual rendered height to decide flip direction
    const el = popupRef.current;
    if (!el) return;
    const h = el.offsetHeight;
    const idealLeft = anchorRect.right - POPUP_WIDTH;
    const left = Math.max(GAP, Math.min(idealLeft, window.innerWidth - POPUP_WIDTH - GAP));
    const fitsBelow = anchorRect.bottom + GAP + h <= window.innerHeight - GAP;
    const fitsAbove = anchorRect.top - GAP - h >= GAP;
    const openAbove = !fitsBelow && fitsAbove;
    const top = openAbove ? anchorRect.top - h - GAP : anchorRect.bottom + GAP;
    setPos({ left, top: Math.max(GAP, top), origin: openAbove ? 'bottom right' : 'top right' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // intentionally only on mount

  // Click-outside and Escape close
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (popupRef.current && !popupRef.current.contains(e.target as Node)) onClose();
    };
    const handleEscape = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [onClose]);

  // Actions — toggles update local pending state only; API calls are deferred to handleDone
  const handleFavouriteClick = () => {
    if (updatingRows.has('fav')) return;
    const currentEffective = pendingFav !== null ? pendingFav : isFavourited(watchId);
    const nextState = !currentEffective;
    setPendingFav(nextState === isFavourited(watchId) ? null : nextState);
  };

  const handleCollectionClick = (collectionId: number) => {
    const key = `col-${collectionId}`;
    if (updatingRows.has(key)) return;
    const currentEffective = pendingCols.has(collectionId)
      ? pendingCols.get(collectionId)!
      : isInCollection(collectionId, watchId);
    const nextState = !currentEffective;
    setPendingCols(prev => {
      const next = new Map(prev);
      if (nextState === isInCollection(collectionId, watchId)) {
        next.delete(collectionId); // net no-op: user toggled back to original state
      } else {
        next.set(collectionId, nextState);
      }
      return next;
    });
  };

  const effectiveFavActive = pendingFav !== null ? pendingFav : isFavourited(watchId);
  const getEffectiveColActive = (colId: number): boolean =>
    pendingCols.has(colId) ? pendingCols.get(colId)! : isInCollection(colId, watchId);
  const hasChanges = pendingFav !== null || pendingCols.size > 0;

  const handleDone = async () => {
    if (!hasChanges) { onClose(); return; }
    const keys = new Set<string>();
    if (pendingFav !== null) keys.add('fav');
    pendingCols.forEach((_, colId) => keys.add(`col-${colId}`));
    setUpdatingRows(keys);
    try {
      if (pendingFav !== null && pendingFav !== isFavourited(watchId)) {
        await toggleFavourite(watchId);
      }
      for (const [colId, intendedState] of pendingCols.entries()) {
        if (intendedState !== isInCollection(colId, watchId)) {
          if (intendedState) await addToCollection(colId, watchId);
          else await removeFromCollection(colId, watchId);
        }
      }
    } finally {
      setUpdatingRows(new Set());
    }
    onClose();
  };

  const handleCreateCollection = async () => {
    const trimmed = newName.trim();
    if (!trimmed || creatingCollection) return;
    setCreateError('');
    setCreatingCollection(true);
    try {
      const newCol = await createCollection(trimmed);
      await addToCollection(newCol.id, watchId);
      setNewName('');
      setShowNewInput(false);
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : 'Could not create collection');
    } finally {
      setCreatingCollection(false);
    }
  };

  const showSearch = collections.length > 3;
  const savedCollections = !search ? collections.filter(c => getEffectiveColActive(c.id)) : [];
  const unsavedCollections = !search
    ? collections.filter(c => !getEffectiveColActive(c.id))
    : collections.filter(c => c.name.toLowerCase().includes(search.toLowerCase()));
  const hasSaved = effectiveFavActive || savedCollections.length > 0;
  const showFavInSearch = !search || 'favourites'.includes(search.toLowerCase());

  const content = (
    // Render hidden at (0,0) first so we can measure height, then snap to correct position
    <motion.div
      ref={popupRef}
      initial={{ opacity: 0, scale: 0.9 }}
      animate={pos ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.9 }}
      exit={{ opacity: 0, scale: 0.9 }}
      transition={{ duration: 0.14, ease: [0.22, 1, 0.36, 1] }}
      style={{
        position: 'fixed',
        left: pos?.left ?? 0,
        top: pos?.top ?? 0,
        width: POPUP_WIDTH,
        zIndex: 9999,
        visibility: pos ? 'visible' : 'hidden',
        background: 'linear-gradient(160deg, rgba(38,29,24,0.98) 0%, rgba(26,18,14,0.99) 100%)',
        backdropFilter: 'blur(28px)',
        transformOrigin: pos?.origin ?? 'top right',
      }}
      className="rounded-2xl border border-white/10 shadow-2xl shadow-black/70 overflow-hidden"
      onClick={e => e.stopPropagation()}
    >
      {/* Search — shown when user has many collections */}
      {showSearch && (
        <div className="px-3 pt-3 pb-1">
          <div className="relative">
            <svg
              className="absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none"
              width="11" height="11" viewBox="0 0 24 24"
              fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="2.5"
            >
              <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
            </svg>
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Find a collection"
              className="w-full bg-white/6 rounded-lg pl-8 pr-3 py-2 text-xs text-white/80 placeholder-white/25 font-inter outline-none border border-white/8 focus:border-[#bfa68a]/50 transition-colors"
            />
          </div>
        </div>
      )}

      {/* New collection — button or inline input */}
      {showNewInput ? (
        <div className="px-3 pt-2.5 pb-2">
          <div className="flex items-center gap-2">
            <input
              autoFocus
              value={newName}
              onChange={e => { setNewName(e.target.value); setCreateError(''); }}
              onKeyDown={e => {
                e.stopPropagation();
                if (e.key === 'Enter') handleCreateCollection();
                if (e.key === 'Escape') { setShowNewInput(false); setNewName(''); setCreateError(''); }
              }}
              placeholder="Collection name"
              maxLength={100}
              className="flex-1 bg-white/6 border border-white/12 rounded-lg px-3 py-1.5 text-sm text-white/90 placeholder-white/25 font-inter outline-none focus:border-[#bfa68a]/50 transition-colors"
            />
            <button
              onClick={handleCreateCollection}
              disabled={!newName.trim() || creatingCollection}
              className="px-3 py-1.5 rounded-lg text-xs font-inter font-semibold bg-[#bfa68a]/20 text-[#bfa68a] hover:bg-[#bfa68a]/30 transition-colors disabled:opacity-40 shrink-0"
            >
              {creatingCollection ? '...' : 'Save'}
            </button>
          </div>
          {createError && (
            <p className="mt-1.5 text-[11px] text-red-400/80 font-inter">{createError}</p>
          )}
        </div>
      ) : (
        <button
          onClick={() => setShowNewInput(true)}
          className="w-full flex items-center gap-3 px-4 py-3 hover:bg-white/5 transition-colors text-left group"
        >
          <div className="w-8 h-8 rounded-md bg-white/7 flex items-center justify-center shrink-0 group-hover:bg-white/10 transition-colors">
            <svg width="11" height="11" viewBox="0 0 11 11" fill="none" stroke="rgba(191,166,138,0.65)" strokeWidth="1.6" strokeLinecap="round">
              <path d="M5.5 1v9M1 5.5h9" />
            </svg>
          </div>
          <span className="text-sm font-inter text-white/55 group-hover:text-white/75 transition-colors">New collection</span>
        </button>
      )}

      {/* Divider */}
      <div className="h-px mx-3 bg-white/8" />

      {/* List */}
      <div className="max-h-52 overflow-y-auto">
        {/* "Saved in" section header */}
        {hasSaved && !search && (
          <div className="px-4 pt-2.5 pb-1">
            <span className="text-[10px] font-inter font-semibold text-white/25 uppercase tracking-[0.1em]">Saved in</span>
          </div>
        )}

        {/* Favourites row */}
        {showFavInSearch && (
          <button
            onClick={handleFavouriteClick}
            disabled={updatingRows.has('fav')}
            className={`w-full flex items-center gap-3 px-4 py-2.5 transition-colors text-left group ${
              updatingRows.has('fav') ? 'opacity-50' : 'hover:bg-white/5'
            }`}
          >
            <div className={`w-8 h-8 rounded-md shrink-0 flex items-center justify-center transition-colors ${
              effectiveFavActive ? 'bg-[#bfa68a]/20' : 'bg-white/7'
            }`}>
              <svg width="12" height="12" viewBox="0 0 24 24">
                <path
                  d="M12 21.593c-5.63-5.539-11-10.297-11-14.402 0-3.791 3.068-5.191 5.281-5.191 1.312 0 4.151.501 5.719 4.457 1.59-3.968 4.464-4.447 5.726-4.447 2.54 0 5.274 1.621 5.274 5.181 0 4.069-5.136 8.625-11 14.402z"
                  fill={effectiveFavActive ? '#bfa68a' : 'none'}
                  stroke={effectiveFavActive ? '#bfa68a' : 'rgba(255,255,255,0.35)'}
                  strokeWidth={effectiveFavActive ? 0 : 1.5}
                />
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <span className={`block text-sm font-inter transition-colors ${
                effectiveFavActive ? 'text-white/90' : 'text-white/60 group-hover:text-white/80'
              }`}>Favourites</span>
              <span className="text-[11px] text-white/25 font-inter">{favouriteWatchIds.size} watches</span>
            </div>
            {effectiveFavActive && <CheckMark />}
          </button>
        )}

        {/* Saved collections */}
        {!search && savedCollections.map(col => (
          <CollectionRow
            key={col.id}
            name={col.name}
            count={col.watchIds.length}
            inCol={getEffectiveColActive(col.id)}
            loading={updatingRows.has(`col-${col.id}`)}
            onClick={() => handleCollectionClick(col.id)}
          />
        ))}

        {/* Divider between saved and unsaved sections */}
        {hasSaved && unsavedCollections.length > 0 && !search && (
          <div className="h-px mx-3 bg-white/6 my-0.5" />
        )}

        {/* Unsaved / filtered collections */}
        {unsavedCollections.map(col => (
          <CollectionRow
            key={col.id}
            name={col.name}
            count={col.watchIds.length}
            inCol={getEffectiveColActive(col.id)}
            loading={updatingRows.has(`col-${col.id}`)}
            onClick={() => handleCollectionClick(col.id)}
          />
        ))}

        {/* Empty search state */}
        {search && unsavedCollections.length === 0 && !showFavInSearch && (
          <p className="px-4 py-5 text-center text-xs text-white/30 font-inter">No collections found</p>
        )}
      </div>

      {/* Footer — Cancel always visible; Done appears when there are pending changes */}
      <div className="h-px bg-white/8" />
      <div className="flex items-center justify-end gap-2 px-3 py-2.5">
        <button
          onClick={onClose}
          className="px-3.5 py-1.5 rounded-full text-xs font-inter font-semibold text-white/50 hover:text-white/75 hover:bg-white/6 transition-colors"
        >
          Cancel
        </button>
        {hasChanges && (
          <button
            onClick={handleDone}
            disabled={updatingRows.size > 0}
            className="px-3.5 py-1.5 rounded-full text-xs font-inter font-semibold bg-[#bfa68a]/20 text-[#bfa68a] hover:bg-[#bfa68a]/30 transition-colors disabled:opacity-40"
          >
            {updatingRows.size > 0 ? 'Saving...' : 'Done'}
          </button>
        )}
      </div>
    </motion.div>
  );

  return ReactDOM.createPortal(content, document.body);
};

// Green checkmark badge used for saved items
const CheckMark = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="shrink-0">
    <circle cx="8" cy="8" r="8" fill="#1ed760" />
    <path d="M4.5 8l2.5 2.5 4.5-4.5" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

interface CollectionRowProps {
  name: string;
  count: number;
  inCol: boolean;
  loading: boolean;
  onClick: () => void;
}

const CollectionRow = ({ name, count, inCol, loading, onClick }: CollectionRowProps) => (
  <button
    onClick={onClick}
    disabled={loading}
    className={`w-full flex items-center gap-3 px-4 py-2.5 transition-colors text-left group ${
      loading ? 'opacity-50' : 'hover:bg-white/5'
    }`}
  >
    <div className={`w-8 h-8 rounded-md shrink-0 flex items-center justify-center text-xs font-semibold font-inter transition-colors ${
      inCol ? 'bg-[#bfa68a]/15 text-[#bfa68a]/70' : 'bg-white/7 text-white/35 group-hover:bg-white/10'
    }`}>
      {name.charAt(0).toUpperCase()}
    </div>
    <div className="flex-1 min-w-0">
      <span className={`block text-sm font-inter truncate transition-colors ${
        inCol ? 'text-white/90' : 'text-white/60 group-hover:text-white/80'
      }`}>{name}</span>
      <span className="text-[11px] text-white/25 font-inter">{count} watches</span>
    </div>
    {inCol && <CheckMark />}
  </button>
);

export default SaveToCollectionPopup;
