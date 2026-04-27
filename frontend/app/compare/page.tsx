// Side-by-side watch comparison page
// Editorial layout: label spacer column with balance icon + Playfair numeral anchor
'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { useCompare } from '@/stores/compareStore';
import { fetchWatchBySlug, Watch } from '@/lib/api';
import { imageTransformations } from '@/lib/cloudinary';
import { parseStructuredSpecs, getAllLabelsForSection } from '@/lib/specs';
import { useNavigation } from '@/contexts/NavigationContext';
import { useScrollRestore } from '@/hooks/useScrollRestore';
import ScrollFade from '../scrollMotion/ScrollFade';

const sectionKeys = ['case', 'dial', 'movement', 'strap'] as const;
const sectionTitles: Record<string, string> = { case: 'Case', dial: 'Dial', movement: 'Movement', strap: 'Strap' };

// Editorial spacer — occupies the label column in the watch card header row
const EditorialSpacer = ({ count }: { count: number }) => (
  <div className="flex flex-col items-center justify-center h-full py-6 select-none">
    {/* Fading rule — top */}
    <div className="w-px flex-1 bg-gradient-to-b from-transparent to-[#f0e6d2]/20" />

    {/* Scale / balance icon */}
    <svg
      width="22" height="22" viewBox="0 0 24 24" fill="none"
      stroke="#c9a96e" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round"
      className="my-3 opacity-70"
    >
      <path d="M12 3v18" />
      <path d="M3 7h18" />
      <path d="M6 7l-3 9a5 5 0 0 0 6 0L6 7" />
      <path d="M18 7l-3 9a5 5 0 0 0 6 0L18 7" />
    </svg>

    {/* Watch count */}
    <div className="flex flex-col items-center leading-none">
      <span className="font-playfair text-5xl font-normal italic text-[#f0e6d2]/60 tracking-wide">
        {count}
      </span>
    </div>

    {/* Fading rule — bottom */}
    <div className="w-px flex-1 bg-gradient-to-t from-transparent to-[#f0e6d2]/20 mt-3" />

    {/* Rotated label */}
    <span
      className="font-inter text-[9px] font-semibold tracking-[0.35em] text-[#f0e6d2]/30 uppercase mt-4"
      style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}
    >
      compare
    </span>
  </div>
);

const ComparePage = () => {
  const { compareWatches, removeFromCompare, clearCompare } = useCompare();
  const [showDifferencesOnly, setShowDifferencesOnly] = useState(false);
  // Enriched watches re-fetched from the API to ensure brandSlug/collectionSlug are always fresh
  const [enrichedWatches, setEnrichedWatches] = useState<Watch[]>(compareWatches);
  const router = useRouter();
  const { saveNavigationState } = useNavigation();
  useScrollRestore(true);

  useEffect(() => {
    useCompare.persist.rehydrate();
  }, []);

  // Re-fetch each watch by slug so stale localStorage snapshots get fresh brand/collection data
  useEffect(() => {
    if (compareWatches.length === 0) { setEnrichedWatches([]); return; }
    let cancelled = false;
    Promise.all(
      compareWatches.map(w =>
        fetchWatchBySlug(w.slug).catch(() => w) // fall back to cached data on error
      )
    ).then(results => {
      if (!cancelled) setEnrichedWatches(results);
    });
    return () => { cancelled = true; };
  }, [compareWatches]);

  const handleWatchClick = () => {
    saveNavigationState({
      scrollPosition: window.scrollY,
      currentPage: 1,
      path: '/compare',
      timestamp: Date.now(),
    });
  };

  const watchCount = compareWatches.length;

  const parsedSpecs = useMemo(() => {
    return enrichedWatches.map(w => parseStructuredSpecs(w.specs));
  }, [enrichedWatches]);

  const sections = useMemo(() => {
    return sectionKeys.map(sectionKey => {
      const labels = getAllLabelsForSection(sectionKey);
      const rows = Object.entries(labels).map(([field, label]) => {
        const values = parsedSpecs.map(specs => {
          if (!specs) return null;
          const section = specs[sectionKey] as Record<string, unknown> | undefined;
          if (!section || section[field] == null) return null;
          const val = section[field];
          if (Array.isArray(val)) {
            return val.map((v, i) => i === 0 ? String(v) : String(v).toLowerCase()).join(', ');
          }
          return String(val);
        });

        const hasAnyValue = values.some(v => v !== null);
        const isDifferent = hasAnyValue && !values.every(v => v === values[0]);
        return { label, values, isDifferent, hasAnyValue };
      });

      const visibleRows = rows.filter(r => r.hasAnyValue);
      return { key: sectionKey, title: sectionTitles[sectionKey], rows: visibleRows };
    }).filter(s => s.rows.length > 0);
  }, [parsedSpecs]);

  // Grid template: label/spacer column + one column per watch
  const colTemplate = `minmax(140px, 180px) repeat(${watchCount}, 1fr)`;

  if (watchCount === 0) {
    return (
      <div className="container mx-auto px-8 py-24 pt-48 max-w-5xl text-center">
        <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" className="mx-auto text-white/20 mb-6">
          <path d="M12 3v18" /><path d="M3 7h18" />
          <path d="M6 7l-3 9a5 5 0 0 0 6 0L6 7" />
          <path d="M18 7l-3 9a5 5 0 0 0 6 0L18 7" />
        </svg>
        <h1 className="text-3xl font-playfair font-bold text-[#f0e6d2] mb-3">No Watches to Compare</h1>
        <p className="text-white/50 font-inter mb-8">Browse our collection and add watches to compare their specifications side by side.</p>
        <Link href="/watches" className="inline-block py-3 px-8 rounded-xl font-semibold bg-[#f0e6d2] text-[#1e1512] hover:bg-[#e6d9c2] transition-colors">
          Browse Watches
        </Link>
      </div>
    );
  }

  if (watchCount === 1) {
    return (
      <div className="container mx-auto px-8 py-24 pt-48 max-w-5xl text-center">
        <h1 className="text-3xl font-playfair font-bold text-[#f0e6d2] mb-3">Add One More Watch</h1>
        <p className="text-white/50 font-inter mb-8">Select at least 2 watches to compare. You currently have 1 selected.</p>
        <Link href="/watches" className="inline-block py-3 px-8 rounded-xl font-semibold bg-[#f0e6d2] text-[#1e1512] hover:bg-[#e6d9c2] transition-colors">
          Browse Watches
        </Link>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 sm:px-8 py-8 pt-28">

      {/* Back button */}
      <div className="mb-8 -ml-2">
        <button
          onClick={() => router.back()}
          className="inline-flex items-center text-white/60 hover:text-white transition-colors duration-300 text-lg font-playfair font-medium"
        >
          <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back
        </button>
      </div>

      {/* Page title + Clear all */}
      <ScrollFade>
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-4xl font-playfair font-bold text-[#f0e6d2]">Compare Watches</h1>
          <button
            onClick={() => { clearCompare(); router.push('/watches'); }}
            className="text-base text-white/40 hover:text-white/70 transition-colors font-inter"
          >
            Clear all
          </button>
        </div>
      </ScrollFade>

      {/* Watch header cards — same grid as spec table so columns align */}
      <div className="pb-6">
        <div className="grid gap-4" style={{ gridTemplateColumns: colTemplate }}>
          {/* Editorial spacer occupies the label column */}
          <EditorialSpacer count={watchCount} />

          {enrichedWatches.map((watch, idx) => {
            const specs = parsedSpecs[idx];
            const diameter = specs?.case?.diameter ? String(specs.case.diameter) : null;
            const movementType = specs?.movement?.type ? String(specs.movement.type) : null;
            const powerReserve = specs?.movement?.powerReserve ? String(specs.movement.powerReserve) : null;
            const pills = [diameter, movementType, powerReserve].filter(Boolean) as string[];

            const slugToTitle = (slug: string) =>
              slug.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');

            const brandName = watch.brandSlug ? slugToTitle(watch.brandSlug) : null;

            // Strip leading brand-slug prefix from collection slug (e.g. "patek-philippe-grand-complications" → "Grand Complications")
            const rawCollection = watch.collectionSlug
              ? (watch.brandSlug && watch.collectionSlug.startsWith(watch.brandSlug + '-')
                  ? watch.collectionSlug.slice(watch.brandSlug.length + 1)
                  : watch.collectionSlug)
              : null;
            const collectionName = rawCollection ? slugToTitle(rawCollection) : null;

            return (
              <ScrollFade key={watch.id}>
              <div className="relative bg-black/40 backdrop-blur-md border border-white/10 rounded-2xl p-5 text-center group flex flex-col">
                {/* Remove button */}
                <button
                  onClick={() => removeFromCompare(watch.id)}
                  className="absolute top-3 right-3 w-7 h-7 rounded-full bg-white/5 border border-white/10 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-white/20"
                >
                  <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="white" strokeWidth="1.5" strokeLinecap="round">
                    <path d="M1 1l8 8M9 1l-8 8" />
                  </svg>
                </button>

                {/* Watch image */}
                <Link href={`/watches/${watch.slug || watch.id}`} onClick={handleWatchClick}>
                  <div className="w-36 h-36 mx-auto bg-black/30 rounded-xl mb-3 overflow-hidden border border-white/5">
                    {watch.image ? (
                      <Image
                        src={watch.imageUrl || imageTransformations.card(watch.image)}
                        alt={watch.name}
                        width={200}
                        height={200}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-white/30 text-[10px] font-inter p-2">
                        {watch.name}
                      </div>
                    )}
                  </div>
                </Link>

                {/* Brand — WatchCard style scaled down for narrow grid */}
                <div className="mb-0.5 text-center min-h-[1rem]">
                  {brandName && (
                    <p className="text-[10px] font-inter text-white/50 uppercase tracking-widest">{brandName}</p>
                  )}
                </div>

                {/* Collection — WatchCard font family, one step smaller than name */}
                <div className="mb-2 text-center min-h-[1.25rem]">
                  {collectionName && (
                    <p className="text-xs text-white/70 font-playfair font-medium">{collectionName}</p>
                  )}
                </div>

                {/* Watch name — primary identity, clearly larger than brand/collection */}
                <Link href={`/watches/${watch.slug || watch.id}`} onClick={handleWatchClick} className="group-hover:text-white transition-colors">
                  <h3 className="text-sm font-playfair font-semibold text-[#f0e6d2] mb-3 line-clamp-2">{watch.name}</h3>
                </Link>

                {/* Spec pills — centered */}
                <div className="flex flex-wrap justify-center gap-1.5 min-h-[1.5rem]">
                  {pills.map((pill) => (
                    <span
                      key={pill}
                      className="px-2.5 py-0.5 rounded-full text-[10px] text-white/50 border border-white/10 bg-white/5"
                    >
                      {pill}
                    </span>
                  ))}
                </div>

                {/* Price — matches WatchCard: text-lg font-playfair font-medium text-white/90 */}
                <p className="text-lg text-white/90 font-playfair font-medium mt-auto pt-4">
                  {watch.currentPrice === 0 ? 'Price on Request' : `$${watch.currentPrice.toLocaleString()}`}
                </p>
              </div>
              </ScrollFade>
            );
          })}
        </div>
      </div>

      {/* Differences toggle */}
      <div className="flex items-center justify-end mb-6 mt-2">
        <label className="flex items-center gap-3 cursor-pointer select-none">
          <span className="text-sm text-white/50 font-inter">Show differences only</span>
          <button
            onClick={() => setShowDifferencesOnly(!showDifferencesOnly)}
            className={`relative w-11 h-6 rounded-full transition-colors duration-300 ${
              showDifferencesOnly ? 'bg-[#f0e6d2]/30' : 'bg-white/10'
            }`}
          >
            <span
              className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full transition-all duration-300 ${
                showDifferencesOnly ? 'translate-x-5 bg-[#f0e6d2]' : 'bg-white/50'
              }`}
            />
          </button>
        </label>
      </div>

      {/* Spec comparison sections */}
      <div className="space-y-8">
        {parsedSpecs.some(s => s?.productionStatus) && (
          <div>
            <h2 className="text-[13px] font-semibold uppercase tracking-[0.35em] text-[#bfa68a] mb-3 font-inter">Status</h2>
            <div className="border border-white/8 rounded-xl overflow-hidden">
              <div className="grid items-stretch" style={{ gridTemplateColumns: colTemplate }}>
                <div className="px-4 py-3 text-sm text-white/40 font-inter flex items-center bg-white/[0.02]">Production</div>
                {parsedSpecs.map((specs, idx) => (
                  <div key={idx} className="px-4 py-3 text-sm font-inter font-medium border-l border-l-white/5 flex items-center">
                    {specs?.productionStatus ? (
                        <span className={`px-2 py-0.5 text-xs rounded-full border ${
                            specs.productionStatus === 'Discontinued'
                                ? 'text-white/40 border-white/15 bg-white/5'
                                : specs.productionStatus === 'Limited edition'
                                ? 'text-amber-300/80 border-amber-400/30 bg-amber-400/10'
                                : 'text-[#f0e6d2]/70 border-[#f0e6d2]/20 bg-[#f0e6d2]/5'
                        }`}>
                            {specs.productionStatus}
                        </span>
                    ) : (
                        <span className="text-white/15 italic">N/A</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {sections.map((section) => {
          const filteredRows = showDifferencesOnly
            ? section.rows.filter(r => r.isDifferent)
            : section.rows;

          if (filteredRows.length === 0) return null;

          return (
            <ScrollFade key={section.key}>
              <div>
                <h2 className="text-[13px] font-semibold uppercase tracking-[0.35em] text-[#bfa68a] mb-3 font-inter">
                  {section.title}
                </h2>
                <div className="border border-white/8 rounded-xl overflow-hidden">
                  {filteredRows.map((row, rowIdx) => (
                    <div
                      key={row.label}
                      className={`grid items-stretch ${rowIdx > 0 ? 'border-t border-white/5' : ''}`}
                      style={{ gridTemplateColumns: colTemplate }}
                    >
                      <div className="px-4 py-3 text-sm text-white/40 font-inter flex items-center bg-white/[0.02]">
                        {row.label}
                      </div>
                      {row.values.map((value, colIdx) => (
                        <div
                          key={colIdx}
                          className={`px-4 py-3 text-sm font-inter font-medium flex items-center border-l ${
                            row.isDifferent
                              ? 'text-white/90 border-l-[#f0e6d2]/25 bg-[#f0e6d2]/[0.03]'
                              : 'text-white/50 border-l-white/5'
                          }`}
                        >
                          {value || <span className="text-white/15 italic">N/A</span>}
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            </ScrollFade>
          );
        })}
      </div>

    </div>
  );
};

export default ComparePage;
