// Three reusable components for the favourites collections row:
// CollectionCard — redesigned card with watch image mosaic and inline rename
// RenameInput — transparent inline input replacing the name text when editing
// AddCollectionCard — dashed "+ New collection" card at end of the row
'use client';

import React, { useEffect, useRef, useState } from 'react';
import { UserCollectionSummary } from '@/lib/api';
import { imageTransformations } from '@/lib/cloudinary';

// ── RenameInput ───────────────────────────────────────────────────────────────

interface RenameInputProps {
  initialValue: string;
  onCommit: (name: string) => void;
  onCancel: () => void;
}

function RenameInput({ initialValue, onCommit, onCancel }: RenameInputProps) {
  const [value, setValue] = useState(initialValue);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.select();
  }, []);

  const commit = () => {
    const trimmed = value.trim();
    if (trimmed && trimmed !== initialValue) onCommit(trimmed);
    else onCancel();
  };

  return (
    <input
      ref={inputRef}
      autoFocus
      value={value}
      onChange={e => setValue(e.target.value)}
      onBlur={commit}
      onKeyDown={e => {
        e.stopPropagation();
        if (e.key === 'Enter') { e.preventDefault(); commit(); }
        if (e.key === 'Escape') onCancel();
      }}
      onClick={e => e.stopPropagation()}
      maxLength={100}
      className="font-playfair text-[#f0e6d2] text-sm font-medium w-full
                 bg-transparent border-none border-b border-[#bfa68a]/50
                 outline-none focus:border-[#bfa68a]/80
                 pb-0.5 transition-colors"
      style={{ boxShadow: 'none' }}
    />
  );
}

// ── CollectionCard ────────────────────────────────────────────────────────────

interface CollectionCardProps {
  collection: UserCollectionSummary;
  isSelected: boolean;
  isRenaming: boolean;
  formattedDate: string;
  onSelect: () => void;
  onRenameStart: () => void;
  onRenameCommit: (name: string) => void;
  onRenameCancel: () => void;
  onDelete: () => void;
  isDeleting: boolean;
}

export function CollectionCard({
  collection,
  isSelected,
  isRenaming,
  formattedDate,
  onSelect,
  onRenameStart,
  onRenameCommit,
  onRenameCancel,
  onDelete,
  isDeleting,
}: CollectionCardProps) {
  const previews = collection.previewImages ?? [];

  return (
    <div
      className={`relative group/col shrink-0 cursor-pointer rounded-2xl border transition-all duration-300 w-[180px]
        ${isSelected
          ? 'border-[#bfa68a]/50 bg-[#bfa68a]/10'
          : 'border-white/10 bg-black/30 hover:border-white/25 hover:bg-black/40'
        }`}
      onClick={() => { if (!isRenaming) onSelect(); }}
    >
      {/* Watch image mosaic — 3 overlapping circles */}
      <div className="px-4 pt-4 pb-2 flex items-center">
        <div className="flex items-center">
          {[0, 1, 2].map(i => (
            <div
              key={i}
              className="w-[52px] h-[52px] rounded-full ring-1 ring-black/40 overflow-hidden shrink-0 bg-white/5"
              style={{ marginLeft: i === 0 ? 0 : '-14px', zIndex: 3 - i }}
            >
              {previews[i] ? (
                <img
                  src={imageTransformations.thumbnail(previews[i])}
                  alt=""
                  className="w-full h-full object-cover"
                  draggable={false}
                />
              ) : (
                <div className="w-full h-full rounded-full bg-gradient-to-br from-white/8 to-white/3" />
              )}
            </div>
          ))}
        </div>
        {/* Watch count — top-right of mosaic row */}
        <span className="ml-auto text-[10px] font-inter text-white/30 shrink-0 tabular-nums">
          {collection.watchIds.length}
        </span>
      </div>

      {/* Divider */}
      <div className="mx-4 border-t border-white/6 mb-3" />

      {/* Name + date */}
      <div className="px-4 pb-4">
        {isRenaming ? (
          <RenameInput
            initialValue={collection.name}
            onCommit={onRenameCommit}
            onCancel={onRenameCancel}
          />
        ) : (
          <p
            className="font-playfair text-[#f0e6d2] text-sm font-medium truncate pr-4
                       cursor-text hover:text-white transition-colors"
            onClick={e => { e.stopPropagation(); onRenameStart(); }}
            title="Click to rename"
          >
            {collection.name}
          </p>
        )}
        <p className="text-[10px] text-white/25 font-inter mt-1">
          {formattedDate}
        </p>
      </div>

      {/* Delete button — top-right, hover only, hidden while renaming */}
      {!isRenaming && (
        <button
          onClick={e => { e.stopPropagation(); onDelete(); }}
          disabled={isDeleting}
          className="absolute top-2.5 right-2.5 w-5 h-5 rounded-full bg-white/5 border border-white/10
                     flex items-center justify-center
                     opacity-0 group-hover/col:opacity-100 transition-opacity hover:bg-white/15
                     disabled:opacity-30"
          title="Delete collection"
        >
          {isDeleting ? (
            <div className="w-2 h-2 border border-white/40 border-t-transparent rounded-full animate-spin" />
          ) : (
            <svg width="7" height="7" viewBox="0 0 8 8" fill="none"
                 stroke="white" strokeOpacity="0.5" strokeWidth="1.5" strokeLinecap="round">
              <path d="M1 1l6 6M7 1l-6 6" />
            </svg>
          )}
        </button>
      )}
    </div>
  );
}

// ── AddCollectionCard ─────────────────────────────────────────────────────────

interface AddCollectionCardProps {
  isAdding: boolean;
  newName: string;
  createError: string;
  onStartAdding: () => void;
  onNameChange: (v: string) => void;
  onCommit: (name: string) => void;
  onCancel: () => void;
}

export function AddCollectionCard({
  isAdding,
  newName,
  createError,
  onStartAdding,
  onNameChange,
  onCommit,
  onCancel,
}: AddCollectionCardProps) {
  if (!isAdding) {
    return (
      <div
        className="shrink-0 cursor-pointer rounded-2xl border border-dashed border-white/12
                   bg-black/15 hover:border-white/25 hover:bg-white/3
                   w-[180px] flex flex-col items-center justify-center gap-2.5
                   py-8 px-4 transition-all duration-300 group/add"
        onClick={onStartAdding}
      >
        <div className="w-8 h-8 rounded-full border border-white/15 flex items-center justify-center
                        group-hover/add:border-[#bfa68a]/40 transition-colors">
          <svg width="11" height="11" viewBox="0 0 11 11" fill="none"
               stroke="rgba(191,166,138,0.5)" strokeWidth="1.7" strokeLinecap="round">
            <path d="M5.5 1v9M1 5.5h9" />
          </svg>
        </div>
        <span className="text-[11px] font-inter text-white/30 group-hover/add:text-white/50 transition-colors">
          New collection
        </span>
      </div>
    );
  }

  return (
    <div className="shrink-0 rounded-2xl border border-[#bfa68a]/30 bg-black/30
                    w-[180px] px-4 py-5 transition-all duration-200">
      <p className="text-[9px] font-inter text-white/30 mb-2.5 uppercase tracking-[0.12em]">
        Name your collection
      </p>
      <input
        autoFocus
        value={newName}
        onChange={e => onNameChange(e.target.value)}
        onKeyDown={e => {
          e.stopPropagation();
          if (e.key === 'Enter' && newName.trim()) onCommit(newName.trim());
          if (e.key === 'Escape') onCancel();
        }}
        onBlur={() => { if (!newName.trim()) onCancel(); }}
        maxLength={100}
        placeholder="e.g. Grail List"
        className="w-full bg-transparent border-b border-white/20 outline-none
                   text-sm font-playfair text-[#f0e6d2] placeholder-white/20
                   pb-1 focus:border-[#bfa68a]/60 transition-colors"
        style={{ boxShadow: 'none' }}
      />
      {createError && (
        <p className="mt-2 text-[10px] text-red-400/70 font-inter leading-tight">
          {createError}
        </p>
      )}
    </div>
  );
}
