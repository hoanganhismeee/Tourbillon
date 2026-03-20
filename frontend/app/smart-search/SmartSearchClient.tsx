// Smart Search page — AI watch finder results with a horizontal accordion filter bar.
// Loads AI results, then lets users refine with multi-select checkboxes for each attribute.
// All filtering is client-side; no re-fetch after initial load.
'use client';

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  watchFinderSearch,
  fetchBrands,
  fetchFilterOptions,
  fetchCollectionsByBrand,
  WatchFinderResult,
  FilterOptions,
  Brand,
  Collection,
  Watch,
} from '@/lib/api';
import WatchCard from '@/app/watches/[watchId]/WatchCard';

// ── Types ──────────────────────────────────────────────────────────────────────

interface Filters {
  brandIds: number[];
  collectionIds: number[];
  caseMaterials: string[];
  movementTypes: string[];
  dialColors: string[];
  waterResistances: string[];
  powerReserves: string[];
  complications: string[];
  diameterBuckets: string[];
  priceBuckets: string[];
}

const EMPTY_FILTERS: Filters = {
  brandIds: [],
  collectionIds: [],
  caseMaterials: [],
  movementTypes: [],
  dialColors: [],
  waterResistances: [],
  powerReserves: [],
  complications: [],
  diameterBuckets: [],
  priceBuckets: [],
};

const DIAMETER_BUCKETS = [
  { label: 'Under 36mm', test: (mm: number) => mm < 36 },
  { label: '36 – 38mm',  test: (mm: number) => mm >= 36 && mm <= 38 },
  { label: '38 – 40mm',  test: (mm: number) => mm > 38 && mm <= 40 },
  { label: '40 – 42mm',  test: (mm: number) => mm > 40 && mm <= 42 },
  { label: 'Over 42mm',  test: (mm: number) => mm > 42 },
];

const PRICE_BUCKETS = [
  { label: 'Under $10k',       test: (p: number) => p > 0 && p < 10_000 },
  { label: '$10k – $25k',      test: (p: number) => p >= 10_000 && p < 25_000 },
  { label: '$25k – $50k',      test: (p: number) => p >= 25_000 && p < 50_000 },
  { label: 'Over $50k',        test: (p: number) => p >= 50_000 },
  { label: 'Price on Request', test: (p: number) => p === 0 },
];

// ── Helpers ────────────────────────────────────────────────────────────────────

function parseSpecs(specsJson: string | null): Record<string, Record<string, unknown>> | null {
  if (!specsJson) return null;
  try { return JSON.parse(specsJson); } catch { return null; }
}

function parseDiameterMm(raw: string | undefined): number | null {
  if (!raw) return null;
  const match = raw.match(/(\d+(?:\.\d+)?)/);
  return match ? parseFloat(match[1]) : null;
}

function applyFilters(watches: Watch[], filters: Filters): Watch[] {
  return watches.filter(w => {
    const specs = parseSpecs(w.specs);

    if (filters.brandIds.length > 0 && !filters.brandIds.includes(w.brandId)) return false;
    if (filters.collectionIds.length > 0 &&
        (w.collectionId === null || !filters.collectionIds.includes(w.collectionId))) return false;

    if (filters.caseMaterials.length > 0) {
      const mat = (specs?.case?.material as string | undefined) ?? '';
      if (!filters.caseMaterials.some(m => mat.toLowerCase().includes(m.toLowerCase()))) return false;
    }
    if (filters.movementTypes.length > 0) {
      const mov = (specs?.movement?.type as string | undefined) ?? '';
      if (!filters.movementTypes.some(m => mov.toLowerCase().includes(m.toLowerCase()))) return false;
    }
    if (filters.dialColors.length > 0) {
      const col = (specs?.dial?.color as string | undefined) ?? '';
      if (!filters.dialColors.some(c => col.toLowerCase().includes(c.toLowerCase()))) return false;
    }
    if (filters.waterResistances.length > 0) {
      const wr = (specs?.case?.waterResistance as string | undefined) ?? '';
      if (!filters.waterResistances.some(r => wr.toLowerCase().includes(r.toLowerCase()))) return false;
    }
    if (filters.powerReserves.length > 0) {
      const pr = (specs?.movement?.powerReserve as string | undefined) ?? '';
      if (!filters.powerReserves.some(r => pr.toLowerCase().includes(r.toLowerCase()))) return false;
    }
    if (filters.complications.length > 0) {
      const fns = (specs?.movement?.functions as string[] | undefined) ?? [];
      if (!filters.complications.some(c => fns.some(f => f.toLowerCase().includes(c.toLowerCase())))) return false;
    }
    if (filters.diameterBuckets.length > 0) {
      const mm = parseDiameterMm(specs?.case?.diameter as string | undefined);
      if (mm === null) return false;
      const buckets = DIAMETER_BUCKETS.filter(b => filters.diameterBuckets.includes(b.label));
      if (!buckets.some(b => b.test(mm))) return false;
    }
    if (filters.priceBuckets.length > 0) {
      const buckets = PRICE_BUCKETS.filter(b => filters.priceBuckets.includes(b.label));
      if (!buckets.some(b => b.test(w.currentPrice))) return false;
    }
    return true;
  });
}

// ── Shared dropdown button style ───────────────────────────────────────────────

function pillClass(active: boolean) {
  return `flex items-center gap-2 px-4 py-2 rounded-xl border text-sm font-inter whitespace-nowrap transition-colors ${
    active
      ? 'bg-[#f0e6d2]/10 border-[#f0e6d2]/30 text-[#f0e6d2]'
      : 'bg-white/5 border-white/15 text-white/60 hover:border-white/25 hover:text-white/90'
  }`;
}

function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      className={`w-3 h-3 opacity-50 flex-shrink-0 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
      fill="none" stroke="currentColor" viewBox="0 0 24 24"
    >
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
    </svg>
  );
}

function CountBadge({ count }: { count: number }) {
  if (count === 0) return null;
  return (
    <span className="bg-[#f0e6d2]/15 text-[#f0e6d2] text-xs rounded-full w-5 h-5 flex items-center justify-center font-medium leading-none">
      {count}
    </span>
  );
}

// Generic dropdown with string checkboxes
function FilterDropdown({
  label,
  options,
  selected,
  onChange,
}: {
  label: string;
  options: string[];
  selected: string[];
  onChange: (values: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const toggle = (val: string) => {
    onChange(selected.includes(val) ? selected.filter(v => v !== val) : [...selected, val]);
  };

  if (options.length === 0) return null;

  return (
    <div ref={ref} className="relative">
      <button onClick={() => setOpen(o => !o)} className={pillClass(selected.length > 0)}>
        {label}
        <CountBadge count={selected.length} />
        <Chevron open={open} />
      </button>

      {open && (
        <div className="absolute top-full mt-2 left-0 z-50 bg-[#111] border border-white/15 rounded-xl shadow-2xl min-w-52 overflow-hidden">
          <div className="max-h-64 overflow-y-auto p-2">
            {options.map(opt => {
              const active = selected.includes(opt);
              return (
                <button
                  key={opt}
                  onClick={() => toggle(opt)}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-white/5 transition-colors text-left"
                >
                  <span className={`w-4 h-4 rounded border flex-shrink-0 flex items-center justify-center transition-colors ${
                    active ? 'bg-[#f0e6d2] border-[#f0e6d2]' : 'border-white/25'
                  }`}>
                    {active && (
                      <svg className="w-2.5 h-2.5 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </span>
                  <span className={`text-sm font-inter truncate ${active ? 'text-white' : 'text-white/60'}`}>{opt}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// Brand dropdown — same pattern but works with Brand objects / number IDs
function BrandDropdown({
  brands,
  selected,
  onChange,
}: {
  brands: Brand[];
  selected: number[];
  onChange: (ids: number[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const toggle = (id: number) => {
    onChange(selected.includes(id) ? selected.filter(i => i !== id) : [...selected, id]);
  };

  if (brands.length === 0) return null;

  return (
    <div ref={ref} className="relative">
      <button onClick={() => setOpen(o => !o)} className={pillClass(selected.length > 0)}>
        Brand
        <CountBadge count={selected.length} />
        <Chevron open={open} />
      </button>

      {open && (
        <div className="absolute top-full mt-2 left-0 z-50 bg-[#111] border border-white/15 rounded-xl shadow-2xl min-w-52 overflow-hidden">
          <div className="max-h-64 overflow-y-auto p-2">
            {brands.map(b => {
              const active = selected.includes(b.id);
              return (
                <button
                  key={b.id}
                  onClick={() => toggle(b.id)}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-white/5 transition-colors text-left"
                >
                  <span className={`w-4 h-4 rounded border flex-shrink-0 flex items-center justify-center transition-colors ${
                    active ? 'bg-[#f0e6d2] border-[#f0e6d2]' : 'border-white/25'
                  }`}>
                    {active && (
                      <svg className="w-2.5 h-2.5 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </span>
                  <span className={`text-sm font-inter ${active ? 'text-white' : 'text-white/60'}`}>{b.name}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function SkeletonGrid({ count = 6 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="bg-white/5 border border-white/10 rounded-2xl p-6 animate-pulse">
          <div className="w-full h-64 bg-white/8 rounded-xl mb-5" />
          <div className="h-3 bg-white/8 rounded mb-2 w-1/2 mx-auto" />
          <div className="h-4 bg-white/8 rounded mb-2 w-3/4 mx-auto" />
          <div className="h-4 bg-white/8 rounded w-1/2 mx-auto" />
        </div>
      ))}
    </div>
  );
}

function Divider({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-4 my-10">
      <div className="flex-1 h-px bg-white/10" />
      <p className="text-xs font-inter text-white/35 uppercase tracking-widest whitespace-nowrap">{label}</p>
      <div className="flex-1 h-px bg-white/10" />
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function SmartSearchClient() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const query = searchParams.get('q') ?? '';

  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [result, setResult] = useState<WatchFinderResult | null>(null);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [filterOptions, setFilterOptions] = useState<FilterOptions | null>(null);
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [wristFit, setWristFit] = useState('');

  // Initial parallel fetch: AI results + brands + filter options
  useEffect(() => {
    if (!query) { setStatus('error'); return; }
    setStatus('loading');
    setResult(null);
    setFilters(EMPTY_FILTERS);
    setWristFit('');

    Promise.all([watchFinderSearch(query), fetchBrands(), fetchFilterOptions()])
      .then(([res, br, fo]) => {
        setResult(res);
        setBrands(br);
        setFilterOptions(fo);
        setStatus('success');
      })
      .catch(() => setStatus('error'));
  }, [query]);

  // Cascade: load collections only when exactly 1 brand is selected
  useEffect(() => {
    if (filters.brandIds.length !== 1) {
      setCollections([]);
      setFilters(prev => ({ ...prev, collectionIds: [] }));
      return;
    }
    fetchCollectionsByBrand(filters.brandIds[0])
      .then(setCollections)
      .catch(() => setCollections([]));
    setFilters(prev => ({ ...prev, collectionIds: [] }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.brandIds]);

  const setFilter = useCallback(<K extends keyof Filters>(key: K, value: Filters[K]) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  }, []);

  const clearFilters = () => { setFilters(EMPTY_FILTERS); setWristFit(''); };

  const hasActiveFilters =
    Object.values(filters).some(v => Array.isArray(v) && v.length > 0) || wristFit !== '';

  const hrefSuffix = wristFit ? `?wristFit=${encodeURIComponent(wristFit)}` : '';

  // Client-side filter + re-split into top / others
  const { topWatches, otherWatches } = useMemo(() => {
    if (!result) return { topWatches: [], otherWatches: [] };
    const topIds = new Set(result.watches.map(w => w.id));
    const all = applyFilters([...result.watches, ...result.otherCandidates], filters);
    return {
      topWatches: all.filter(w => topIds.has(w.id)),
      otherWatches: all.filter(w => !topIds.has(w.id)),
    };
  }, [result, filters]);

  if (!query) {
    return (
      <div className="container mx-auto px-4 sm:px-8 py-28 text-center">
        <p className="text-white/50 font-inter">
          No query provided.{' '}
          <Link href="/" className="text-white/70 underline underline-offset-2">Go back.</Link>
        </p>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 sm:px-8 py-8 pt-28 pb-28 text-white">

      {/* ── Header ── */}
      <div className="mb-6">
        <button
          onClick={() => router.back()}
          className="inline-flex items-center text-white/50 hover:text-white transition-colors text-sm font-inter mb-4"
        >
          <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back
        </button>

        <div className="flex items-start gap-3 flex-wrap">
          <h1 className="text-3xl font-playfair font-bold text-[#f0e6d2]">&ldquo;{query}&rdquo;</h1>
          <span className="mt-1.5 px-2 py-0.5 text-xs font-inter font-medium bg-white/10 border border-white/20 rounded-full text-white/60 uppercase tracking-wider self-start">
            AI
          </span>
        </div>

        {status === 'success' && result && (
          <p className="text-sm font-inter text-white/40 mt-1.5">
            {topWatches.length + otherWatches.length} watches
            {hasActiveFilters && ' · filtered'}
          </p>
        )}
      </div>

      {/* ── Horizontal Filter Bar ── */}
      <div className="mb-8 flex flex-wrap items-center gap-2">

        <BrandDropdown
          brands={brands}
          selected={filters.brandIds}
          onChange={v => setFilter('brandIds', v)}
        />

        {/* Collection — only visible when exactly 1 brand is selected */}
        {filters.brandIds.length === 1 && collections.length > 0 && (
          <FilterDropdown
            label="Collection"
            options={collections.map(c => c.name)}
            selected={collections.filter(c => filters.collectionIds.includes(c.id)).map(c => c.name)}
            onChange={names => {
              const ids = collections.filter(c => names.includes(c.name)).map(c => c.id);
              setFilter('collectionIds', ids);
            }}
          />
        )}

        {filterOptions && (
          <>
            <FilterDropdown
              label="Case Material"
              options={filterOptions.caseMaterials}
              selected={filters.caseMaterials}
              onChange={v => setFilter('caseMaterials', v)}
            />
            <FilterDropdown
              label="Diameter"
              options={DIAMETER_BUCKETS.map(b => b.label)}
              selected={filters.diameterBuckets}
              onChange={v => setFilter('diameterBuckets', v)}
            />
            <FilterDropdown
              label="Movement"
              options={filterOptions.movementTypes}
              selected={filters.movementTypes}
              onChange={v => setFilter('movementTypes', v)}
            />
            <FilterDropdown
              label="Dial Color"
              options={filterOptions.dialColors}
              selected={filters.dialColors}
              onChange={v => setFilter('dialColors', v)}
            />
            <FilterDropdown
              label="Water Resistance"
              options={filterOptions.waterResistance}
              selected={filters.waterResistances}
              onChange={v => setFilter('waterResistances', v)}
            />
            <FilterDropdown
              label="Power Reserve"
              options={filterOptions.powerReserve}
              selected={filters.powerReserves}
              onChange={v => setFilter('powerReserves', v)}
            />
            <FilterDropdown
              label="Complication"
              options={filterOptions.complications}
              selected={filters.complications}
              onChange={v => setFilter('complications', v)}
            />
          </>
        )}

        <FilterDropdown
          label="Price"
          options={PRICE_BUCKETS.map(b => b.label)}
          selected={filters.priceBuckets}
          onChange={v => setFilter('priceBuckets', v)}
        />

        {/* Wrist Fit — inline input pill */}
        <div className="flex items-center gap-2 px-3.5 py-2 bg-white/5 border border-white/15 rounded-xl">
          <span className="text-sm font-inter text-white/50 whitespace-nowrap">Wrist</span>
          <input
            type="number"
            min={10}
            max={25}
            step={0.5}
            placeholder="17.0"
            value={wristFit}
            onChange={e => setWristFit(e.target.value)}
            className="w-14 bg-transparent text-white text-sm font-inter placeholder-white/25 focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
          />
          <span className="text-xs text-white/35">cm</span>
        </div>

        {/* Clear all — far right */}
        {hasActiveFilters && (
          <button
            onClick={clearFilters}
            className="ml-auto text-xs font-inter text-white/35 hover:text-white/60 transition-colors"
          >
            Clear all
          </button>
        )}
      </div>

      {/* ── Results Grid ── */}
      {status === 'loading' && <SkeletonGrid count={8} />}

      {status === 'error' && (
        <div className="text-center py-20">
          <p className="text-white/40 font-inter text-sm">
            {!result
              ? 'AI service unavailable or still warming up. Please try again in a moment.'
              : 'Something went wrong.'}
          </p>
          <button
            onClick={() => router.push(`/smart-search?q=${encodeURIComponent(query)}`)}
            className="mt-4 text-sm text-white/50 hover:text-white underline underline-offset-2 font-inter transition-colors"
          >
            Retry
          </button>
        </div>
      )}

      {status === 'success' && result && (
        <>
          {topWatches.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {topWatches.map(w => (
                <WatchCard key={w.id} watch={w} hrefSuffix={hrefSuffix} />
              ))}
            </div>
          ) : (
            <div className="py-12 text-center">
              <p className="text-white/40 font-inter text-sm">No watches match your current filters.</p>
              <button
                onClick={clearFilters}
                className="mt-3 text-sm text-white/50 hover:text-white underline underline-offset-2 font-inter transition-colors"
              >
                Clear filters
              </button>
            </div>
          )}

          {otherWatches.length > 0 && (
            <>
              <Divider label="Timepieces you may also be interested in" />
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {otherWatches.map(w => (
                  <WatchCard key={w.id} watch={w} hrefSuffix={hrefSuffix} />
                ))}
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
