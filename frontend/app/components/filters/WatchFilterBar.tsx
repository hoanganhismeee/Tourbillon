// Shared filter bar components and logic for watch listing pages.
// Used by SmartSearchClient and FavouritesClient. All filtering is client-side.
'use client';

import { useState, useEffect, useRef } from 'react';
import { Brand, Collection, Watch } from '@/lib/api';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface WatchFilters {
  brandIds: number[];
  caseMaterials: string[];
  movementTypes: string[];
  waterResistances: string[];
  powerReserves: string[];
  priceBuckets: string[];
  complications: string[];
}

export const EMPTY_WATCH_FILTERS: WatchFilters = {
  brandIds: [],
  caseMaterials: [],
  movementTypes: [],
  waterResistances: [],
  powerReserves: [],
  priceBuckets: [],
  complications: [],
};

// ── Constants ─────────────────────────────────────────────────────────────────

// PoR watches (price = 0) come first; adjust order as desired
export const PRICE_BUCKETS = [
  { label: 'Price on Request', test: (p: number) => p === 0 },
  { label: 'Over $100k',       test: (p: number) => p >= 100_000 },
  { label: '$50k – $100k',     test: (p: number) => p >= 50_000 && p < 100_000 },
  { label: '$25k – $50k',      test: (p: number) => p >= 25_000 && p < 50_000 },
  { label: '$10k – $25k',      test: (p: number) => p >= 10_000 && p < 25_000 },
  { label: '$5k – $10k',       test: (p: number) => p >= 5_000  && p < 10_000 },
  { label: 'Under $5k',        test: (p: number) => p > 0       && p < 5_000  },
];

export const CASE_MATERIAL_OPTIONS = ['Steel', 'Titanium', 'Gold', 'Platinum', 'Carbon', 'Ceramic', 'Other'];
export const MOVEMENT_OPTIONS = ['Automatic', 'Self-winding', 'Manual-winding', 'Quartz', 'Other'];

export const MOVEMENT_MATCH: Record<string, string[]> = {
  'Automatic':      ['automatic', 'spring drive'],
  'Self-winding':   ['self-winding'],
  'Manual-winding': ['manual'],
  'Quartz':         ['quartz'],
};

export const STANDARD_CASE_KEYWORDS = ['steel', 'titanium', 'gold', 'platinum', 'carbon', 'ceramic'];
export const STANDARD_MOVEMENT_KEYWORDS = ['automatic', 'spring drive', 'self-winding', 'manual', 'quartz'];

export const WATER_RESISTANCE_BUCKETS: { label: string; test: (m: number | null) => boolean }[] = [
  { label: 'Up to 30m',   test: m => m === null || m <= 30 },
  { label: '50m – 120m',  test: m => m !== null && m >= 50  && m <= 120 },
  { label: '150m – 300m', test: m => m !== null && m >= 150 && m <= 300 },
  { label: '600m+',       test: m => m !== null && m >= 600 },
];
export const WATER_RESISTANCE_OPTIONS = WATER_RESISTANCE_BUCKETS.map(b => b.label);

export const POWER_RESERVE_BUCKETS: { label: string; test: (h: number | null, raw: string) => boolean }[] = [
  { label: 'Battery',    test: (_h, raw) => /battery|year|years|standby/i.test(raw) },
  { label: 'Under 48h',  test: (h, raw)  => !/battery|year|years|standby/i.test(raw) && h !== null && h < 48 },
  { label: '48h – 72h',  test: (h, raw)  => !/battery|year|years|standby/i.test(raw) && h !== null && h >= 48 && h < 72 },
  { label: '72h – 100h', test: (h, raw)  => !/battery|year|years|standby/i.test(raw) && h !== null && h >= 72 && h < 100 },
  { label: 'Over 100h',  test: (h, raw)  => !/battery|year|years|standby/i.test(raw) && h !== null && h >= 100 },
];
export const POWER_RESERVE_OPTIONS = POWER_RESERVE_BUCKETS.map(b => b.label);

export const COMPLICATION_OPTIONS: { label: string; keywords: string[] }[] = [
  { label: 'Chronograph',       keywords: ['chronograph'] },
  { label: 'Perpetual Calendar', keywords: ['perpetual calendar'] },
  { label: 'Annual Calendar',   keywords: ['annual calendar'] },
  { label: 'Moonphase',         keywords: ['moon phase', 'moonphase', 'moon phases'] },
  { label: 'Tourbillon',        keywords: ['tourbillon'] },
  { label: 'Minute Repeater',   keywords: ['minute repeater'] },
  { label: 'GMT / World Time',  keywords: ['gmt', 'world time', 'dual time'] },
  { label: 'Flyback',           keywords: ['flyback'] },
  { label: 'Power Reserve',     keywords: ['power reserve'] },
  { label: 'Alarm',             keywords: ['alarm'] },
  { label: 'Retrograde',        keywords: ['retrograde'] },
  { label: 'Equation of Time',  keywords: ['equation of time'] },
];
export const COMPLICATION_LABELS = COMPLICATION_OPTIONS.map(c => c.label);

// ── Helpers ───────────────────────────────────────────────────────────────────

export function parseSpecs(specsJson: string | null | undefined): Record<string, Record<string, unknown>> | null {
  if (!specsJson) return null;
  try { return JSON.parse(specsJson); } catch { return null; }
}

export function parseDiameterMm(raw: string | undefined): number | null {
  if (!raw) return null;
  const m = raw.match(/(\d+(?:\.\d+)?)/);
  return m ? parseFloat(m[1]) : null;
}

export function parseWaterResistanceM(raw: string | undefined): number | null {
  if (!raw) return null;
  const m = raw.match(/^(\d[\d,]*)\s*m/i);
  return m ? parseInt(m[1].replace(',', ''), 10) : null;
}

export function parsePowerReserveH(raw: string | undefined): number | null {
  if (!raw) return null;
  const m = raw.match(/(\d+)/);
  return m ? parseInt(m[1], 10) : null;
}

// Apply WatchFilters to a Watch array. Pass wristFit='' to skip wrist fit scoring.
export function applyWatchFilters(watches: Watch[], filters: WatchFilters): Watch[] {
  return watches.filter(w => {
    const specs = parseSpecs(w.specs);

    if (filters.brandIds.length > 0 && !filters.brandIds.includes(w.brandId)) return false;

    if (filters.caseMaterials.length > 0) {
      const mat = (specs?.case?.material as string | undefined)?.toLowerCase() ?? '';
      const hasOther = filters.caseMaterials.includes('Other');
      const named = filters.caseMaterials.filter(m => m !== 'Other');
      const matchNamed = named.some(m => mat.includes(m.toLowerCase()));
      const matchOther = hasOther && !STANDARD_CASE_KEYWORDS.some(k => mat.includes(k));
      if (!matchNamed && !matchOther) return false;
    }

    if (filters.movementTypes.length > 0) {
      const mov = (specs?.movement?.type as string | undefined)?.toLowerCase() ?? '';
      const hasOther = filters.movementTypes.includes('Other');
      const named = filters.movementTypes.filter(m => m !== 'Other');
      const matchNamed = named.some(m => (MOVEMENT_MATCH[m] ?? [m.toLowerCase()]).some(k => mov.includes(k)));
      const matchOther = hasOther && !STANDARD_MOVEMENT_KEYWORDS.some(k => mov.includes(k));
      if (!matchNamed && !matchOther) return false;
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

    return true;
  });
}

// ── Pill style helper ─────────────────────────────────────────────────────────

export function pillClass(active: boolean) {
  return `flex items-center gap-2 px-4 py-2.5 rounded-full border text-sm font-inter whitespace-nowrap transition-colors flex-shrink-0 ${
    active
      ? 'bg-[#f0e6d2]/15 border-[#f0e6d2]/40 text-[#f0e6d2]'
      : 'bg-transparent border-white/12 text-white/50 hover:border-white/25 hover:text-white/80'
  }`;
}

export function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      className={`w-3 h-3 opacity-50 flex-shrink-0 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
      fill="none" stroke="currentColor" viewBox="0 0 24 24"
    >
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
    </svg>
  );
}

export function CountBadge({ count }: { count: number }) {
  if (count === 0) return null;
  return (
    <span className="bg-[#f0e6d2]/20 text-[#f0e6d2] text-xs rounded-full w-5 h-5 flex items-center justify-center font-medium leading-none">
      {count}
    </span>
  );
}

// Generic multi-select dropdown for string options
export function FilterDropdown({
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

// Brand multi-select dropdown (works with Brand objects + numeric IDs)
export function BrandDropdown({
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

// Collection multi-select dropdown (works with Collection objects + numeric IDs)
export function CollectionDropdown({
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
