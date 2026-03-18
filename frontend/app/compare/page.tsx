// Side-by-side watch comparison page
// Editorial layout with sectioned spec tables and difference highlighting
'use client';

import React, { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { useCompare } from '@/contexts/CompareContext';
import { imageTransformations } from '@/lib/cloudinary';
import { parseStructuredSpecs, getAllLabelsForSection } from '@/lib/specs';

const sectionKeys = ['case', 'dial', 'movement', 'strap'] as const;
const sectionTitles: Record<string, string> = { case: 'Case', dial: 'Dial', movement: 'Movement', strap: 'Strap' };

const ComparePage = () => {
  const { compareWatches, removeFromCompare, clearCompare } = useCompare();
  const [showDifferencesOnly, setShowDifferencesOnly] = useState(false);
  const router = useRouter();

  const watchCount = compareWatches.length;

  // Parse specs for all watches
  const parsedSpecs = useMemo(() => {
    return compareWatches.map(w => parseStructuredSpecs(w.specs));
  }, [compareWatches]);

  // Build comparison rows per section
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
        // Treat null vs non-null as a difference (e.g., "9.95 mm" vs missing)
        const isDifferent = hasAnyValue && !values.every(v => v === values[0]);

        return { label, values, isDifferent, hasAnyValue };
      });

      const visibleRows = rows.filter(r => r.hasAnyValue);
      return { key: sectionKey, title: sectionTitles[sectionKey], rows: visibleRows };
    }).filter(s => s.rows.length > 0);
  }, [parsedSpecs]);

  // Empty state
  if (watchCount === 0) {
    return (
      <div className="container mx-auto px-8 py-24 pt-48 max-w-5xl text-center">
        <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" className="mx-auto text-white/20 mb-6">
          <path d="M12 3v18" />
          <path d="M3 7h18" />
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

  // Need at least 2 to compare
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

  // Column width for spec table: label column + equal watch columns
  const colTemplate = `minmax(140px, 180px) repeat(${watchCount}, 1fr)`;

  return (
    <div className="container mx-auto px-4 sm:px-8 py-24 pt-48 max-w-6xl">
      {/* Back button */}
      <div className="mb-8">
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

      {/* Page title + controls */}
      <div className="flex items-center justify-between mb-10">
        <h1 className="text-4xl font-playfair font-bold text-[#f0e6d2]">Compare Watches</h1>
        <button
          onClick={() => { clearCompare(); router.push('/watches'); }}
          className="text-sm text-white/40 hover:text-white/70 transition-colors font-inter"
        >
          Clear all
        </button>
      </div>

      {/* Watch header cards */}
      <div className="pb-6">
        <div className={`grid gap-4 ${watchCount === 2 ? 'grid-cols-2' : watchCount === 3 ? 'grid-cols-3' : 'grid-cols-4'}`}>
          {compareWatches.map((watch) => (
            <div key={watch.id} className="relative bg-black/40 backdrop-blur-md border border-white/10 rounded-2xl p-5 text-center group">
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
              <Link href={`/watches/${watch.id}`}>
                <div className="w-28 h-28 mx-auto bg-black/30 rounded-xl mb-3 overflow-hidden border border-white/5">
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

              {/* Watch info */}
              <Link href={`/watches/${watch.id}`} className="hover:text-white transition-colors">
                <h3 className="text-sm font-playfair font-semibold text-[#f0e6d2] mb-1 line-clamp-1">{watch.name}</h3>
              </Link>
              <p className="text-[11px] text-white/40 font-inter mb-2 line-clamp-1">{watch.description}</p>
              <p className="text-base font-inter font-semibold text-white">
                {watch.currentPrice === 0 ? 'Price on Request' : `$${watch.currentPrice.toLocaleString()}`}
              </p>
            </div>
          ))}
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
        {/* Production status — shown first */}
        {parsedSpecs.some(s => s?.productionStatus) && (
          <div>
            <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-[#f0e6d2]/50 mb-3 font-inter">Status</h2>
            <div className="border border-white/8 rounded-xl overflow-hidden">
              <div className="grid items-stretch" style={{ gridTemplateColumns: colTemplate }}>
                <div className="px-4 py-3 text-sm text-white/40 font-inter flex items-center bg-white/[0.02]">Production</div>
                {parsedSpecs.map((specs, idx) => (
                  <div key={idx} className="px-4 py-3 text-sm font-inter font-medium text-white/70 border-l border-l-white/5 flex items-center">
                    {specs?.productionStatus || <span className="text-white/15 italic">N/A</span>}
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
            <div key={section.key}>
              <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-[#f0e6d2]/50 mb-3 font-inter">
                {section.title}
              </h2>
              <div className="border border-white/8 rounded-xl overflow-hidden">
                {filteredRows.map((row, rowIdx) => (
                  <div
                    key={row.label}
                    className={`grid items-stretch ${rowIdx > 0 ? 'border-t border-white/5' : ''}`}
                    style={{ gridTemplateColumns: colTemplate }}
                  >
                    {/* Label cell */}
                    <div className="px-4 py-3 text-sm text-white/40 font-inter flex items-center bg-white/[0.02]">
                      {row.label}
                    </div>

                    {/* Value cells */}
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
          );
        })}
      </div>

    </div>
  );
};

export default ComparePage;
