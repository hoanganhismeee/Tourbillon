// Smart Search page — AI watch finder results with a horizontal filter bar and page tabs.
// Top 20 best-match watches on page 1; remaining candidates on pages 2+ (20 per page).
// Page number lives in the URL so router.back() from the compare page restores the correct page.
// All filtering is client-side; no re-fetch after initial load.
'use client';

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import {
  watchFinderSearch,
  fetchBrands,
  fetchCollections,
  WatchFinderResult,
  QueryIntent,
  Brand,
  Collection,
  Watch,
} from '@/lib/api';
import { imageTransformations, getOptimizedImageUrl } from '@/lib/cloudinary';
import { calculateFitScores, parseSpecMm } from '@/lib/wristfit';
import { useNavigation } from '@/contexts/NavigationContext';
import CompareToggle from '@/app/components/compare/CompareToggle';

// ── Constants ──────────────────────────────────────────────────────────────────

// Kept for reference — page size is defined inline as PAGE_SIZE inside the component
// const OTHERS_PAGE_SIZE = 20;

// ── Types ──────────────────────────────────────────────────────────────────────

interface Filters {
  brandIds: number[];
  collectionIds: number[];
  caseMaterials: string[];
  movementTypes: string[];
  waterResistances: string[];
  powerReserves: string[];
  diameterBuckets: string[];
  priceBuckets: string[];
  complications: string[];
}

const EMPTY_FILTERS: Filters = {
  brandIds: [],
  collectionIds: [],
  caseMaterials: [],
  movementTypes: [],
  waterResistances: [],
  powerReserves: [],
  diameterBuckets: [],
  priceBuckets: [],
  complications: [],
};

// Diameter label uses floor of the parsed mm value — 37.6mm → "37mm".
// Options are derived from actual watch data so only sizes present in results appear.
function diameterLabel(mm: number): string {
  return `${Math.floor(mm)}mm`;
}

// Descending order: Price on Request first, then highest to lowest
const PRICE_BUCKETS = [
  { label: 'Price on Request', test: (p: number) => p === 0 },
  { label: 'Over $100k',       test: (p: number) => p >= 100_000 },
  { label: '$50k – $100k',     test: (p: number) => p >= 50_000 && p < 100_000 },
  { label: '$25k – $50k',      test: (p: number) => p >= 25_000 && p < 50_000 },
  { label: '$10k – $25k',      test: (p: number) => p >= 10_000 && p < 25_000 },
  { label: '$5k – $10k',       test: (p: number) => p >= 5_000  && p < 10_000 },
  { label: 'Under $5k',        test: (p: number) => p > 0       && p < 5_000  },
];

// Curated case material options — majority coverage; niche values fall under "Other"
const CASE_MATERIAL_OPTIONS = ['Steel', 'Titanium', 'Gold', 'Platinum', 'Carbon', 'Ceramic', 'Other'];
// Spring Drive is grouped under Automatic; all four options + Other cover the full catalog
const MOVEMENT_OPTIONS = ['Automatic', 'Self-winding', 'Manual-winding', 'Quartz', 'Other'];

// Per-option keyword lists — Automatic includes Spring Drive since it's the same watch family
const MOVEMENT_MATCH: Record<string, string[]> = {
  'Automatic':     ['automatic', 'spring drive'],
  'Self-winding':  ['self-winding'],
  'Manual-winding':['manual'],
  'Quartz':        ['quartz'],
};

// All keywords across named options — used to detect "Other"
const STANDARD_CASE_KEYWORDS = ['steel', 'titanium', 'gold', 'platinum', 'carbon', 'ceramic'];
const STANDARD_MOVEMENT_KEYWORDS = ['automatic', 'spring drive', 'self-winding', 'manual', 'quartz'];

// Water resistance buckets — consolidate the same depth across multiple unit formats
const WATER_RESISTANCE_BUCKETS: { label: string; test: (m: number | null) => boolean }[] = [
  { label: 'Up to 30m',    test: m => m === null || m <= 30 },
  { label: '50m – 120m',    test: m => m !== null && m >= 50  && m <= 120 },
  { label: '150m – 300m',   test: m => m !== null && m >= 150 && m <= 300 },
  { label: '600m+',         test: m => m !== null && m >= 600 },
];
const WATER_RESISTANCE_OPTIONS = WATER_RESISTANCE_BUCKETS.map(b => b.label);

// Power reserve buckets — collapse near-duplicates ("72 hours", "Approx. 72 hours", etc.)
const POWER_RESERVE_BUCKETS: { label: string; test: (h: number | null, raw: string) => boolean }[] = [
  { label: 'Battery',    test: (_h, raw) => /battery|year|years|standby/i.test(raw) },
  { label: 'Under 48h',  test: (h, raw)  => !/battery|year|years|standby/i.test(raw) && h !== null && h < 48 },
  { label: '48h – 72h',  test: (h, raw)  => !/battery|year|years|standby/i.test(raw) && h !== null && h >= 48 && h < 72 },
  { label: '72h – 100h', test: (h, raw)  => !/battery|year|years|standby/i.test(raw) && h !== null && h >= 72 && h < 100 },
  { label: 'Over 100h',  test: (h, raw)  => !/battery|year|years|standby/i.test(raw) && h !== null && h >= 100 },
];
const POWER_RESERVE_OPTIONS = POWER_RESERVE_BUCKETS.map(b => b.label);

// Complications — keyword groups that match against specs.movement.functions
const COMPLICATION_OPTIONS: { label: string; keywords: string[] }[] = [
  { label: 'Chronograph',        keywords: ['chronograph'] },
  { label: 'Perpetual Calendar',  keywords: ['perpetual calendar'] },
  { label: 'Annual Calendar',     keywords: ['annual calendar'] },
  { label: 'Moonphase',           keywords: ['moon phase', 'moonphase', 'moon phases'] },
  { label: 'Tourbillon',          keywords: ['tourbillon'] },
  { label: 'Minute Repeater',     keywords: ['minute repeater'] },
  { label: 'GMT / World Time',    keywords: ['gmt', 'world time', 'dual time'] },
  { label: 'Flyback',             keywords: ['flyback'] },
  { label: 'Power Reserve',       keywords: ['power reserve'] },
  { label: 'Alarm',               keywords: ['alarm'] },
  { label: 'Retrograde',          keywords: ['retrograde'] },
  { label: 'Equation of Time',    keywords: ['equation of time'] },
];
const COMPLICATION_LABELS = COMPLICATION_OPTIONS.map(c => c.label);

// ── Helpers ────────────────────────────────────────────────────────────────────

// Converts a QueryIntent (brand/collection/price from the backend) into a Filters object
// so the filter bar is pre-populated to match what the query implied.
function buildFiltersFromIntent(intent: QueryIntent): Filters {
  const f = { ...EMPTY_FILTERS };
  if (intent.brandId)       f.brandIds      = [intent.brandId];
  if (intent.collectionId)  f.collectionIds = [intent.collectionId];
  if (intent.minDiameterMm !== null || intent.maxDiameterMm !== null) {
    const min = Math.floor(intent.minDiameterMm ?? 1);
    const max = Math.floor(intent.maxDiameterMm ?? 200);
    const labels: string[] = [];
    for (let mm = min; mm <= max; mm++) labels.push(`${mm}mm`);
    f.diameterBuckets = labels;
  }
  if (intent.maxPrice) {
    f.priceBuckets = PRICE_BUCKETS
      .filter(b => {
        if (b.label === 'Price on Request') return false;
        if (b.label === 'Under $5k')    return intent.maxPrice! > 0;
        if (b.label === '$5k – $10k')   return intent.maxPrice! >= 5_000;
        if (b.label === '$10k – $25k')  return intent.maxPrice! >= 10_000;
        if (b.label === '$25k – $50k')  return intent.maxPrice! >= 25_000;
        if (b.label === '$50k – $100k') return intent.maxPrice! >= 50_000;
        if (b.label === 'Over $100k')   return intent.maxPrice! > 100_000;
        return false;
      })
      .map(b => b.label);
  }
  if (intent.caseMaterial) f.caseMaterials = [intent.caseMaterial];
  if (intent.movementType) f.movementTypes = [intent.movementType];
  if (intent.waterResistance) {
    const m = parseInt(intent.waterResistance);
    const bucket = WATER_RESISTANCE_BUCKETS.find(b => b.test(m));
    if (bucket) f.waterResistances = [bucket.label];
  }
  return f;
}

function parseSpecs(specsJson: string | null): Record<string, Record<string, unknown>> | null {
  if (!specsJson) return null;
  try { return JSON.parse(specsJson); } catch { return null; }
}

function parseDiameterMm(raw: string | undefined): number | null {
  if (!raw) return null;
  const match = raw.match(/(\d+(?:\.\d+)?)/);
  return match ? parseFloat(match[1]) : null;
}

// Extract leading metre value from strings like "100 m", "100 m / 10 bar", "300 m / 1,000 ft"
function parseWaterResistanceM(raw: string | undefined): number | null {
  if (!raw) return null;
  const match = raw.match(/^(\d[\d,]*)\s*m/i);
  return match ? parseInt(match[1].replace(',', ''), 10) : null;
}

// Extract leading hour value from strings like "72 hours", "Approx. 72 hours", "35-45 hours"
function parsePowerReserveH(raw: string | undefined): number | null {
  if (!raw) return null;
  const match = raw.match(/(\d+)/);
  return match ? parseInt(match[1], 10) : null;
}

function applyFilters(watches: Watch[], filters: Filters, wristFit: string): Watch[] {
  const wristCm = wristFit ? parseFloat(wristFit) : null;

  return watches.filter(w => {
    const specs = parseSpecs(w.specs);

    if (filters.brandIds.length > 0 && !filters.brandIds.includes(w.brandId)) return false;
    if (filters.collectionIds.length > 0 &&
        (w.collectionId === null || !filters.collectionIds.includes(w.collectionId))) return false;

    if (filters.caseMaterials.length > 0) {
      const mat = (specs?.case?.material as string | undefined)?.toLowerCase() ?? '';
      const hasOther = filters.caseMaterials.includes('Other');
      const namedSelected = filters.caseMaterials.filter(m => m !== 'Other');
      const matchesNamed = namedSelected.some(m => mat.includes(m.toLowerCase()));
      const matchesOther = hasOther && !STANDARD_CASE_KEYWORDS.some(k => mat.includes(k));
      if (!matchesNamed && !matchesOther) return false;
    }
    if (filters.movementTypes.length > 0) {
      const mov = (specs?.movement?.type as string | undefined)?.toLowerCase() ?? '';
      const hasOther = filters.movementTypes.includes('Other');
      const namedSelected = filters.movementTypes.filter(m => m !== 'Other');
      const matchesNamed = namedSelected.some(m =>
        (MOVEMENT_MATCH[m] ?? [m.toLowerCase()]).some(k => mov.includes(k))
      );
      const matchesOther = hasOther && !STANDARD_MOVEMENT_KEYWORDS.some(k => mov.includes(k));
      if (!matchesNamed && !matchesOther) return false;
    }
    if (filters.waterResistances.length > 0) {
      const wrRaw = (specs?.case?.waterResistance as string | undefined) ?? '';
      const wrM = parseWaterResistanceM(wrRaw);
      const buckets = WATER_RESISTANCE_BUCKETS.filter(b => filters.waterResistances.includes(b.label));
      if (!buckets.some(b => b.test(wrM))) return false;
    }
    if (filters.powerReserves.length > 0) {
      const prRaw = (specs?.movement?.powerReserve as string | undefined) ?? '';
      const prH = parsePowerReserveH(prRaw);
      const buckets = POWER_RESERVE_BUCKETS.filter(b => filters.powerReserves.includes(b.label));
      if (!buckets.some(b => b.test(prH, prRaw))) return false;
    }
    if (filters.diameterBuckets.length > 0) {
      const mm = parseDiameterMm(specs?.case?.diameter as string | undefined);
      if (mm === null) return false;
      if (!filters.diameterBuckets.includes(diameterLabel(mm))) return false;
    }
    if (filters.priceBuckets.length > 0) {
      const buckets = PRICE_BUCKETS.filter(b => filters.priceBuckets.includes(b.label));
      if (!buckets.some(b => b.test(w.currentPrice))) return false;
    }
    if (filters.complications.length > 0) {
      const funcsRaw = specs?.movement?.functions;
      const funcsStr = (Array.isArray(funcsRaw) ? funcsRaw.join(', ') : String(funcsRaw ?? '')).toLowerCase();
      const selected = COMPLICATION_OPTIONS.filter(c => filters.complications.includes(c.label));
      if (!selected.some(c => c.keywords.some(k => funcsStr.includes(k)))) return false;
    }

    // Wrist fit filter: exclude watches that score below 40 ("Wearable" threshold)
    if (wristCm !== null && !isNaN(wristCm)) {
      const caseSpecs = specs?.case as { diameter?: string; thickness?: string } | undefined;
      // If the watch has no diameter data, skip the filter (don't exclude it)
      if (caseSpecs?.diameter) {
        const diameterMm = parseSpecMm(caseSpecs.diameter);
        if (diameterMm !== null) {
          const fit = calculateFitScores(wristCm, caseSpecs);
          if (fit !== null && fit.overall < 40) return false;
        }
      }
    }

    return true;
  });
}

// ── SmartCard — AllWatchesSection-style card sized for a 4-col grid ───────────

function SmartCard({
  watch,
  brands,
  collections,
  currentPage,
  wristFit,
}: {
  watch: Watch;
  brands: Brand[];
  collections: Collection[];
  currentPage: number;
  wristFit: string;
}) {
  const { saveNavigationState } = useNavigation();
  const router = useRouter();

  const watchHref = `/watches/${watch.id}${wristFit ? `?wristFit=${encodeURIComponent(wristFit)}` : ''}`;

  const [src, setSrc] = useState<string>(watch.imageUrl || imageTransformations.card(watch.image));
  const [retryCount, setRetryCount] = useState(0);

  const handleImgError = () => {
    if (retryCount < 1) {
      setRetryCount(1);
      const fallback = getOptimizedImageUrl(watch.image, {
        width: 400, height: 400, crop: 'fill', quality: 'auto', format: 'jpg',
      }) + `?r=${Date.now()}`;
      setSrc(fallback);
    }
  };

  const handleWatchClick = () => {
    saveNavigationState({
      scrollPosition: window.scrollY,
      currentPage,
      path: window.location.pathname + window.location.search,
      timestamp: Date.now(),
    });
  };

  const handleBrandClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    router.push(`/brands/${watch.brandId}`);
  };

  const handleCollectionClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (watch.collectionId) router.push(`/collections/${watch.collectionId}`);
  };

  const collectionName = watch.collectionId
    ? collections.find(c => c.id === watch.collectionId)?.name
    : null;

  return (
    <div className="group relative block bg-gradient-to-br from-white/5 to-white/10 backdrop-blur-sm border border-white/20 rounded-2xl p-4 transition-all duration-500 hover:bg-gradient-to-br hover:from-white/10 hover:to-white/15 hover:border-white/30 hover:scale-105 hover:shadow-2xl hover:shadow-white/10">
      {/* Image */}
      <div className="relative mb-4">
        <Link href={watchHref} onClick={handleWatchClick}>
          <div className="w-full aspect-square bg-gradient-to-br from-black/40 to-black/60 rounded-xl flex items-center justify-center border border-white/10 overflow-hidden cursor-pointer">
            {watch.image ? (
              <Image
                src={src}
                alt={watch.name}
                width={400}
                height={400}
                sizes="(min-width: 1024px) 25vw, 50vw"
                className="w-full h-full object-cover rounded-xl"
                onError={handleImgError}
              />
            ) : (
              <span className="text-white/60 text-xs font-light">{watch.name}</span>
            )}
          </div>
        </Link>
        <div className="absolute bottom-2.5 right-2.5 z-10 flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
          <CompareToggle watch={watch} />
        </div>
      </div>

      {/* Info — left-aligned, matching AllWatches card */}
      <div className="space-y-2">
        <button
          onClick={handleBrandClick}
          className="text-xs text-white/60 hover:text-white/90 font-inter font-light uppercase tracking-wide transition-colors cursor-pointer bg-transparent border-none p-0 text-left"
        >
          {brands.find(b => b.id === watch.brandId)?.name ?? ''}
        </button>

        {collectionName && (
          <button
            onClick={handleCollectionClick}
            className="block text-xs text-white/50 hover:text-white/80 font-inter font-light transition-colors cursor-pointer bg-transparent border-none p-0 text-left"
          >
            {collectionName}
          </button>
        )}

        <Link href={watchHref} onClick={handleWatchClick}>
          <h3 className="text-sm font-inter font-medium text-white group-hover:text-[#f0e6d2] transition-colors truncate cursor-pointer">
            {watch.name}
          </h3>
        </Link>

        <p className="text-lg text-[#f0e6d2] font-inter font-semibold">
          {watch.currentPrice === 0 ? 'Price on Request' : `$${watch.currentPrice.toLocaleString()}`}
        </p>
      </div>
    </div>
  );
}

// ── Filter pill style ──────────────────────────────────────────────────────────

function pillClass(active: boolean) {
  return `flex items-center gap-2 px-4 py-2.5 rounded-full border text-sm font-inter whitespace-nowrap transition-colors flex-shrink-0 ${
    active
      ? 'bg-[#f0e6d2]/15 border-[#f0e6d2]/40 text-[#f0e6d2]'
      : 'bg-transparent border-white/12 text-white/50 hover:border-white/25 hover:text-white/80'
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
    <span className="bg-[#f0e6d2]/20 text-[#f0e6d2] text-xs rounded-full w-5 h-5 flex items-center justify-center font-medium leading-none">
      {count}
    </span>
  );
}

// Generic dropdown with string checkboxes
function FilterDropdown({
  label, options, selected, onChange,
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
    <div ref={ref} className="relative flex-shrink-0">
      <button onClick={() => setOpen(o => !o)} className={pillClass(selected.length > 0)}>
        {label}
        <CountBadge count={selected.length} />
        <Chevron open={open} />
      </button>

      {open && (
        <div className="absolute top-full mt-2 left-0 z-50 bg-[#111] border border-white/15 border-t-2 border-t-[#f0e6d2]/15 rounded-2xl shadow-2xl min-w-52 overflow-hidden">
          <div className="max-h-64 overflow-y-auto p-2">
            {options.map(opt => {
              const active = selected.includes(opt);
              return (
                <button
                  key={opt}
                  onClick={() => toggle(opt)}
                  className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-white/[0.04] transition-colors text-left"
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
  brands, selected, onChange,
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
    <div ref={ref} className="relative flex-shrink-0">
      <button onClick={() => setOpen(o => !o)} className={pillClass(selected.length > 0)}>
        Brand
        <CountBadge count={selected.length} />
        <Chevron open={open} />
      </button>

      {open && (
        <div className="absolute top-full mt-2 left-0 z-50 bg-[#111] border border-white/15 border-t-2 border-t-[#f0e6d2]/15 rounded-2xl shadow-2xl min-w-52 overflow-hidden">
          <div className="max-h-64 overflow-y-auto p-2">
            {brands.map(b => {
              const active = selected.includes(b.id);
              return (
                <button
                  key={b.id}
                  onClick={() => toggle(b.id)}
                  className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-white/[0.04] transition-colors text-left"
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

// Collection dropdown — same pattern as BrandDropdown, works with Collection objects / number IDs
function CollectionDropdown({
  collections, selected, onChange,
}: {
  collections: Collection[];
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

  if (collections.length === 0) return null;

  return (
    <div ref={ref} className="relative flex-shrink-0">
      <button onClick={() => setOpen(o => !o)} className={pillClass(selected.length > 0)}>
        Collection
        <CountBadge count={selected.length} />
        <Chevron open={open} />
      </button>

      {open && (
        <div className="absolute top-full mt-2 left-0 z-50 bg-[#111] border border-white/15 border-t-2 border-t-[#f0e6d2]/15 rounded-2xl shadow-2xl min-w-52 overflow-hidden">
          <div className="max-h-64 overflow-y-auto p-2">
            {collections.map(c => {
              const active = selected.includes(c.id);
              return (
                <button
                  key={c.id}
                  onClick={() => toggle(c.id)}
                  className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-white/[0.04] transition-colors text-left"
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
                  <span className={`text-sm font-inter ${active ? 'text-white' : 'text-white/60'}`}>{c.name}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function SkeletonGrid({ count = 20 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="bg-white/5 border border-white/10 rounded-2xl p-4 animate-pulse">
          <div className="w-full aspect-square bg-white/8 rounded-xl mb-4" />
          <div className="h-2.5 bg-white/8 rounded mb-2 w-1/3" />
          <div className="h-3 bg-white/8 rounded mb-2 w-2/3" />
          <div className="h-5 bg-white/8 rounded w-1/2" />
        </div>
      ))}
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function SmartSearchClient() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const query = searchParams.get('q') ?? '';

  // Page lives in the URL — router.back() from /compare returns to the correct page automatically
  const activePage = Number(searchParams.get('page') ?? '1');

  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [result, setResult] = useState<WatchFinderResult | null>(null);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [wristFit, setWristFit] = useState('');
  const [editQuery, setEditQuery] = useState(query);

  // Keyword search results — arrive fast (<100ms) before AI results (~4s)
  const [kwBrands, setKwBrands] = useState<Array<{ id: number; name: string }>>([]);
  const [kwCollections, setKwCollections] = useState<Array<{ id: number; name: string; brand?: { name: string } }>>([]);
  // Normalized Watch[] so SmartCard can render them during AI loading
  const [kwWatches, setKwWatches] = useState<Watch[]>([]);

  // Load filter metadata immediately (fast DB queries) so the filter bar renders during the AI call.
  // watchFinderSearch is slow (~4s) and runs separately — filter pills appear right away.
  useEffect(() => {
    Promise.all([fetchBrands(), fetchCollections()])
      .then(([br, cols]) => {
        setBrands(br);
        setCollections(cols);
      })
      .catch(() => {});
  }, []);

  // Sync editable query header when URL query changes (e.g. browser back/forward)
  useEffect(() => { setEditQuery(query); }, [query]);

  // Persist wrist fit to sessionStorage so it survives back navigation from product detail page
  const wristKey = `smartsearch-wrist:${query}`;
  useEffect(() => {
    if (!query) return;
    try {
      if (wristFit) sessionStorage.setItem(wristKey, wristFit);
      else sessionStorage.removeItem(wristKey);
    } catch { /* ignore */ }
  }, [wristFit, wristKey, query]);

  // AI search — checks sessionStorage first to avoid re-running on back navigation
  useEffect(() => {
    if (!query) { setStatus('error'); return; }
    setStatus('loading');
    setResult(null);
    setFilters(EMPTY_FILTERS);

    // Restore wrist fit from sessionStorage (back navigation) or reset
    try {
      const savedWrist = sessionStorage.getItem(`smartsearch-wrist:${query}`);
      setWristFit(savedWrist ?? '');
    } catch { setWristFit(''); }

    const CACHE_TTL = 30 * 60 * 1000; // 30 minutes
    const cacheKey = `smartsearch:${query}`;

    try {
      const cached = sessionStorage.getItem(cacheKey);
      if (cached) {
        const { result: cachedResult, ts } = JSON.parse(cached) as { result: WatchFinderResult; ts: number };
        if (Date.now() - ts < CACHE_TTL) {
          setResult(cachedResult);
          if (cachedResult.queryIntent) setFilters(buildFiltersFromIntent(cachedResult.queryIntent));
          setStatus('success');
          return;
        }
      }
    } catch {
      // sessionStorage unavailable (private browsing, storage full) — proceed with fetch
    }

    // Keyword search runs in parallel — fast (<100ms), populates watch grid immediately + brand/collection pills
    setKwBrands([]);
    setKwCollections([]);
    setKwWatches([]);
    fetch(`/api/search?q=${encodeURIComponent(query)}`)
      .then(r => r.ok ? r.json() : null)
      .then((data: {
        watches?: Array<{ id: number; name: string; description?: string; currentPrice?: number; image?: string; specs?: string; brand: { id: number; name: string }; collection?: { id: number; name: string } }>;
        brands?: Array<{ id: number; name: string }>;
        collections?: Array<{ id: number; name: string; brand?: { name: string } }>;
      } | null) => {
        if (data) {
          setKwBrands(data.brands?.slice(0, 5) ?? []);
          setKwCollections(data.collections?.slice(0, 5) ?? []);
          // Normalize to Watch type so SmartCard renders them without changes
          const normalized: Watch[] = (data.watches ?? []).map(kw => ({
            id: kw.id,
            name: kw.name,
            description: kw.description ?? '',
            image: kw.image ?? '',
            currentPrice: kw.currentPrice ?? 0,
            brandId: kw.brand.id,
            collectionId: kw.collection?.id ?? null,
            specs: kw.specs ?? null,
          }));
          setKwWatches(normalized);
        }
      })
      .catch(() => {});

    watchFinderSearch(query)
      .then(res => {
        setResult(res);
        if (res.queryIntent) setFilters(buildFiltersFromIntent(res.queryIntent));
        setStatus('success');
        try {
          sessionStorage.setItem(cacheKey, JSON.stringify({ result: res, ts: Date.now() }));
        } catch {
          // ignore storage errors
        }
      })
      .catch(() => setStatus('error'));
  }, [query]);

  const setFilter = useCallback(<K extends keyof Filters>(key: K, value: Filters[K]) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  }, []);

  const clearFilters = () => { setFilters(EMPTY_FILTERS); setWristFit(''); };

  const hasActiveFilters =
    Object.values(filters).some(v => Array.isArray(v) && v.length > 0) || wristFit !== '';

  // Diameter options derived from actual result watches — only sizes present are shown.
  // Sorted numerically so the dropdown reads 36mm, 37mm, 38mm, 39mm...
  const diameterOptions = useMemo(() => {
    if (!result) return [];
    const sizes = new Set<number>();
    for (const w of [...result.watches, ...result.otherCandidates]) {
      const specs = parseSpecs(w.specs);
      const mm = parseDiameterMm(specs?.case?.diameter as string | undefined);
      if (mm !== null) sizes.add(Math.floor(mm));
    }
    return Array.from(sizes).sort((a, b) => a - b).map(n => `${n}mm`);
  }, [result]);

  // Client-side filter + split top / others.
  // Keyword-exclusive watches (exact ref matches like "4063" not found by AI) go first —
  // if the user typed a reference number, that's what they want. For semantic queries
  // ("dress watch for wedding"), kwExclusive is typically empty so AI results lead naturally.
  const { topWatches, otherWatches } = useMemo(() => {
    if (!result) return { topWatches: [], otherWatches: [] };
    const topIds = new Set(result.watches.map(w => w.id));
    const aiIds = new Set([...result.watches, ...result.otherCandidates].map(w => w.id));
    const kwExclusive = kwWatches.filter(w => !aiIds.has(w.id));
    const kwExclusiveIds = new Set(kwExclusive.map(w => w.id));
    // Keyword-exclusive first (exact ref matches), then AI ranked results
    const all = applyFilters([...kwExclusive, ...result.watches, ...result.otherCandidates], filters, wristFit);
    return {
      topWatches: all.filter(w => topIds.has(w.id) || kwExclusiveIds.has(w.id)),
      otherWatches: all.filter(w => !topIds.has(w.id) && !kwExclusiveIds.has(w.id)),
    };
  }, [result, filters, wristFit, kwWatches]);

  // Reset to page 1 when filters change
  useEffect(() => {
    if (activePage !== 1 && status === 'success') {
      router.replace(`/smart-search?q=${encodeURIComponent(query)}`, { scroll: false });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters, wristFit]);

  const goToPage = (page: number) => {
    const url = page === 1
      ? `/smart-search?q=${encodeURIComponent(query)}`
      : `/smart-search?q=${encodeURIComponent(query)}&page=${page}`;
    router.replace(url, { scroll: true });
  };

  const PAGE_SIZE = 20;

  // Flatten into a single ordered list: top matches first, then others.
  // When wrist fit is active, sort by fit score descending (best fit first).
  const allWatches = useMemo(() => {
    const combined = [...topWatches, ...otherWatches];
    const wristCm = wristFit ? parseFloat(wristFit) : null;
    if (wristCm !== null && !isNaN(wristCm)) {
      combined.sort((a, b) => {
        const specsA = parseSpecs(a.specs)?.case as { diameter?: string; thickness?: string } | undefined;
        const specsB = parseSpecs(b.specs)?.case as { diameter?: string; thickness?: string } | undefined;
        const fitA = specsA?.diameter ? calculateFitScores(wristCm, specsA) : null;
        const fitB = specsB?.diameter ? calculateFitScores(wristCm, specsB) : null;
        return (fitB?.overall ?? 0) - (fitA?.overall ?? 0);
      });
    }
    return combined;
  }, [topWatches, otherWatches, wristFit]);

  const totalPages = Math.max(1, Math.ceil(allWatches.length / PAGE_SIZE));

  const currentGrid = useMemo(() => {
    const offset = (activePage - 1) * PAGE_SIZE;
    return allWatches.slice(offset, offset + PAGE_SIZE);
  }, [allWatches, activePage]);

  // Show "Timepieces" label when this page starts inside the otherWatches zone
  const pageStartIndex = (activePage - 1) * PAGE_SIZE;
  const showOthersLabel = otherWatches.length > 0 && topWatches.length > 0 && pageStartIndex >= topWatches.length;

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

  const currentPage = activePage;

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
          <input
            type="text"
            value={editQuery}
            onChange={e => setEditQuery(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && editQuery.trim()) {
                router.replace(`/smart-search?q=${encodeURIComponent(editQuery.trim())}`);
              }
            }}
            className="text-3xl font-playfair font-bold text-[#f0e6d2] bg-transparent border-none outline-none focus:border-b focus:border-[#f0e6d2]/30 min-w-0 flex-1"
            aria-label="Edit search query"
          />
          <span className="mt-1.5 px-2 py-0.5 text-xs font-inter font-medium bg-white/10 border border-white/20 rounded-full text-white/60 uppercase tracking-wider self-start flex-shrink-0">
            AI
          </span>
        </div>

        {status === 'success' && result && (
          <p className="text-sm font-inter text-white/40 mt-1.5">
            {topWatches.length + otherWatches.length} Watches found
            {hasActiveFilters && ' · with filtered'}
          </p>
        )}
      </div>

      {/* ── Keyword matches: brands & collections ── */}
      {(kwBrands.length > 0 || kwCollections.length > 0) && (
        <div className="flex items-center gap-2 flex-wrap mb-5">
          <span className="text-xs font-inter text-white/30 uppercase tracking-widest mr-1 flex-shrink-0">
            Jump to
          </span>
          {kwBrands.map(b => (
            <a
              key={`brand-${b.id}`}
              href={`/brands/${b.id}`}
              className="px-3 py-1 text-xs font-inter text-white/60 hover:text-white border border-white/15 hover:border-white/35 rounded-full bg-white/5 hover:bg-white/10 transition-all"
            >
              {b.name}
            </a>
          ))}
          {kwCollections.map(c => (
            <a
              key={`col-${c.id}`}
              href={`/collections/${c.id}`}
              className="px-3 py-1 text-xs font-inter text-white/50 hover:text-white/80 border border-white/10 hover:border-white/25 rounded-full bg-white/3 hover:bg-white/8 transition-all"
            >
              {c.brand ? `${c.brand.name} ${c.name}` : c.name}
            </a>
          ))}
        </div>
      )}

      {/* ── Filter Bar ── */}
      <div className="pb-5 mb-6 border-b border-white/8">
        <div className="flex items-center gap-2 flex-wrap">

          {/* "Filters" label */}
          <span className="text-xs font-inter text-white/30 uppercase tracking-widest mr-1 flex-shrink-0 self-center">
            Filters
          </span>

          <BrandDropdown
            brands={brands}
            selected={filters.brandIds}
            onChange={v => setFilter('brandIds', v)}
          />
          <CollectionDropdown
            collections={collections}
            selected={filters.collectionIds}
            onChange={v => setFilter('collectionIds', v)}
          />

          <FilterDropdown
            label="Case Material"
            options={CASE_MATERIAL_OPTIONS}
            selected={filters.caseMaterials}
            onChange={v => setFilter('caseMaterials', v)}
          />
          <FilterDropdown
            label="Diameter"
            options={diameterOptions}
            selected={filters.diameterBuckets}
            onChange={v => setFilter('diameterBuckets', v)}
          />
          <FilterDropdown
            label="Movement"
            options={MOVEMENT_OPTIONS}
            selected={filters.movementTypes}
            onChange={v => setFilter('movementTypes', v)}
          />
          <FilterDropdown
            label="Water Resistance"
            options={WATER_RESISTANCE_OPTIONS}
            selected={filters.waterResistances}
            onChange={v => setFilter('waterResistances', v)}
          />
          <FilterDropdown
            label="Power Reserve"
            options={POWER_RESERVE_OPTIONS}
            selected={filters.powerReserves}
            onChange={v => setFilter('powerReserves', v)}
          />

          <FilterDropdown
            label="Complications"
            options={COMPLICATION_LABELS}
            selected={filters.complications}
            onChange={v => setFilter('complications', v)}
          />

          <FilterDropdown
            label="Price"
            options={PRICE_BUCKETS.map(b => b.label)}
            selected={filters.priceBuckets}
            onChange={v => setFilter('priceBuckets', v)}
          />

          {/* Wrist Fit */}
          <div className="flex items-center gap-2 px-3.5 py-2.5 bg-transparent border border-white/12 rounded-full flex-shrink-0">
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

          {hasActiveFilters && (
            <button
              onClick={clearFilters}
              className="ml-2 text-xs font-inter text-white/35 hover:text-white/60 transition-colors flex-shrink-0"
            >
              Clear all
            </button>
          )}
        </div>
      </div>

      {/* ── Page tabs ── */}
      {status === 'success' && result && totalPages > 1 && (
        <div className="flex items-center gap-1 mb-6">
          {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
            <button
              key={p}
              onClick={() => goToPage(p)}
              className={`w-8 h-8 rounded-full text-sm font-inter transition-colors ${
                activePage === p
                  ? 'bg-[#f0e6d2]/15 text-[#f0e6d2] border border-[#f0e6d2]/30'
                  : 'text-white/35 hover:text-white/60 border border-transparent'
              }`}
            >
              {p}
            </button>
          ))}
        </div>
      )}

      {/* ── "Timepieces you may also be interested in" label on page 2+ ── */}
      {status === 'success' && showOthersLabel && (
        <p className="text-xs font-inter text-white/35 uppercase tracking-widest mb-6">
          Timepieces you may also be interested in
        </p>
      )}

      {/* ── Results Grid ── */}
      {status === 'loading' && (
        kwWatches.length > 0 ? (
          <>
            {/* AI still running — show keyword matches immediately with a subtle indicator */}
            <div className="flex items-center gap-2 mb-6">
              <div className="w-3.5 h-3.5 rounded-full border-2 border-white/20 border-t-white/55 animate-spin flex-shrink-0" />
              <span className="text-xs font-inter text-white/35">AI analysis running…</span>
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
              {kwWatches.map(w => (
                <SmartCard key={w.id} watch={w} brands={brands} collections={collections} currentPage={1} wristFit={wristFit} />
              ))}
            </div>
          </>
        ) : (
          <SkeletonGrid count={20} />
        )
      )}

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
          {currentGrid.length > 0 ? (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
              {currentGrid.map(w => (
                <SmartCard
                  key={w.id}
                  watch={w}
                  brands={brands}
                  collections={collections}
                  currentPage={currentPage}
                  wristFit={wristFit}
                />
              ))}
            </div>
          ) : (
            <div className="py-12 text-center">
              <p className="text-white/40 font-inter text-sm">No watches match your current filters.</p>
              {hasActiveFilters && (
                <button
                  onClick={clearFilters}
                  className="mt-3 text-sm text-white/50 hover:text-white underline underline-offset-2 font-inter transition-colors"
                >
                  Clear filters
                </button>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
