// Smart Search page — AI watch finder results with a horizontal filter bar and page tabs.
// Top 20 best-match watches on page 1; remaining candidates on pages 2+ (20 per page).
// Page number lives in the URL so router.back() from the compare page restores the correct page.
// All filtering is client-side; no re-fetch after initial load.
'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
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
import { calculateFitScores } from '@/lib/wristfit';
import { useNavigation } from '@/contexts/NavigationContext';
import CompareToggle from '@/app/components/compare/CompareToggle';
import FavouriteToggle from '@/app/components/favourites/FavouriteToggle';
import {
  WatchFilters,
  EMPTY_WATCH_FILTERS,
  applyWatchFilters,
  WatchFilterBar,
  PRICE_BUCKETS,
  WATER_RESISTANCE_BUCKETS,
  COMPLICATION_LABELS,
  POWER_RESERVE_OPTIONS,
  parseDiameterMm,
  parseSpecs,
} from '@/app/components/filters/WatchFilterBar';

// ── Helpers ────────────────────────────────────────────────────────────────────

// Converts a QueryIntent (brand/collection/price from the backend) into a WatchFilters object
// so the filter bar is pre-populated to match what the query implied.
function buildFiltersFromIntent(intent: QueryIntent, collections: Collection[]): WatchFilters {
  const f = { ...EMPTY_WATCH_FILTERS };
  if (intent.brandId)       f.brandIds      = [intent.brandId];
  if (intent.collectionId)  f.collectionIds = [intent.collectionId];
  // Style → collection IDs: restrict results to collections tagged with that style in the DB.
  // This filters out keyword-exclusive watches from non-matching collections (e.g. Calatrava for "sport").
  if (intent.style && !intent.collectionId && collections.length > 0) {
    const styleIds = collections.filter(c => c.style === intent.style).map(c => c.id);
    if (styleIds.length > 0) f.collectionIds = styleIds;
  }
  if (intent.minDiameterMm !== null || intent.maxDiameterMm !== null) {
    const min = Math.floor(intent.minDiameterMm ?? 1);
    const max = Math.floor(intent.maxDiameterMm ?? 200);
    const labels: string[] = [];
    for (let mm = min; mm <= max; mm++) labels.push(`${mm}mm`);
    f.diameterBuckets = labels;
  }
  if (intent.maxPrice) {
    // Always include PoR — backend never excludes PoR from price-filtered searches,
    // so the client-side filter must match. PoR watches are sorted after priced ones.
    f.priceBuckets = PRICE_BUCKETS
      .filter(b => {
        if (b.label === 'Price on Request') return true;
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
  if (intent.complications && intent.complications.length > 0) {
    const validLabels = new Set(COMPLICATION_LABELS);
    f.complications = intent.complications.filter(c => validLabels.has(c));
  }
  if (intent.powerReserves && intent.powerReserves.length > 0) {
    const validLabels = new Set(POWER_RESERVE_OPTIONS);
    f.powerReserves = intent.powerReserves.filter(p => validLabels.has(p));
  }
  return f;
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
          <FavouriteToggle watchId={watch.id} />
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
  const [filters, setFilters] = useState<WatchFilters>(EMPTY_WATCH_FILTERS);
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
    setFilters(EMPTY_WATCH_FILTERS);

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
          if (cachedResult.queryIntent) setFilters(buildFiltersFromIntent(cachedResult.queryIntent, collections));
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
        if (res.queryIntent) setFilters(buildFiltersFromIntent(res.queryIntent, collections));
        setStatus('success');
        // Only cache non-empty results — empty results are often transient (threshold tuning, cold start)
        if (res.watches.length > 0 || res.otherCandidates.length > 0) {
          try {
            sessionStorage.setItem(cacheKey, JSON.stringify({ result: res, ts: Date.now() }));
          } catch {
            // ignore storage errors
          }
        }
      })
      .catch(() => setStatus('error'));
  // eslint-disable-next-line react-hooks/exhaustive-deps -- collections is read but must not re-trigger the search
  }, [query]);

  const setFilter = useCallback(<K extends keyof WatchFilters>(key: K, value: WatchFilters[K]) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  }, []);

  const clearFilters = () => { setFilters(EMPTY_WATCH_FILTERS); setWristFit(''); };

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
    const all = applyWatchFilters([...kwExclusive, ...result.watches, ...result.otherCandidates], filters, wristFit);
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
  // PoR watches (price = 0) are pushed after priced watches within each group —
  // priced watches answer the query directly, PoR is supplementary context.
  // When wrist fit is active, sort by fit score descending (best fit first).
  const allWatches = useMemo(() => {
    // Stable sort: priced watches first (preserving AI rank), then PoR (preserving AI rank)
    const priced = [...topWatches.filter(w => w.currentPrice > 0), ...otherWatches.filter(w => w.currentPrice > 0)];
    const por    = [...topWatches.filter(w => w.currentPrice === 0), ...otherWatches.filter(w => w.currentPrice === 0)];
    const combined = [...priced, ...por];
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
      <WatchFilterBar
        filters={filters}
        brands={brands}
        collections={collections}
        diameterOptions={diameterOptions}
        wristFit={wristFit}
        hasActiveFilters={hasActiveFilters}
        onChange={setFilter}
        onWristFitChange={setWristFit}
        onClear={clearFilters}
      />

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
        <>
          <div className="flex items-center gap-2 mb-6">
            <div className="w-3.5 h-3.5 rounded-full border-2 border-white/20 border-t-white/55 animate-spin flex-shrink-0" />
            <span className="text-xs font-inter text-white/35">AI analysis running…</span>
          </div>
          <SkeletonGrid count={20} />
        </>
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
