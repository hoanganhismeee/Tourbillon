// AI-powered natural language watch search for the homepage.
// Users describe what they want; LLM parses intent, backend filters, LLM reranks.
'use client';

import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { watchFinderSearch, WatchFinderResult, Watch } from '@/lib/api';
import { imageTransformations, getOptimizedImageUrl } from '@/lib/cloudinary';

const SUGGESTIONS = [
  'Good watch for a wedding',
  'Thin dress watch under 20k',
  'Steel sport watch with date',
  'German watchmaker under 15k',
  'Thin automatic for daily wear',
  'Platinum dress watch, manual winding',
];

export default function WatchFinderSearch() {
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [result, setResult] = useState<WatchFinderResult | null>(null);

  const handleSubmit = async (q: string) => {
    const trimmed = q.trim();
    if (!trimmed || status === 'loading') return;
    setQuery(trimmed);
    setStatus('loading');
    try {
      const data = await watchFinderSearch(trimmed);
      setResult(data);
      setStatus('success');
    } catch {
      setStatus('error');
    }
  };

  const handleChipClick = (suggestion: string) => {
    setQuery(suggestion);
    handleSubmit(suggestion);
  };

  return (
    <div className="w-full max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <h2 className="text-2xl font-playfair font-bold tourbillon-text-color">Find Your Watch</h2>
        <span className="px-2 py-0.5 text-xs font-inter font-medium bg-white/10 border border-white/20 rounded-full text-white/70 uppercase tracking-wider">
          AI
        </span>
      </div>

      {/* Search input */}
      <div className="flex gap-3 mb-5">
        <input
          type="text"
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSubmit(query)}
          placeholder="Describe what you're looking for..."
          className="flex-1 bg-white/5 border border-white/20 rounded-xl px-5 py-3.5 text-white placeholder-white/40 font-inter text-sm focus:outline-none focus:border-white/40 transition-all"
        />
        <button
          onClick={() => handleSubmit(query)}
          disabled={status === 'loading'}
          className="px-6 py-3.5 bg-white/10 hover:bg-white/20 border border-white/20 hover:border-white/30 rounded-xl text-white font-inter text-sm font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
        >
          {status === 'loading' ? 'Searching...' : 'Search'}
        </button>
      </div>

      {/* Suggestion chips — shown when not loading */}
      {status !== 'loading' && (
        <div className="flex flex-wrap gap-2 mb-2">
          {SUGGESTIONS.map(s => (
            <button
              key={s}
              onClick={() => handleChipClick(s)}
              className="px-3.5 py-1.5 text-xs font-inter text-white/60 hover:text-white border border-white/15 hover:border-white/30 rounded-full bg-white/5 hover:bg-white/10 transition-all"
            >
              {s}
            </button>
          ))}
        </div>
      )}

      {/* Loading skeleton */}
      {status === 'loading' && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mt-8">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="bg-white/5 border border-white/10 rounded-2xl p-4 animate-pulse">
              <div className="w-full aspect-square bg-white/10 rounded-xl mb-4" />
              <div className="h-2.5 bg-white/10 rounded mb-2 w-3/4" />
              <div className="h-2.5 bg-white/10 rounded mb-3 w-1/2" />
              <div className="h-3 bg-white/10 rounded w-2/3" />
            </div>
          ))}
        </div>
      )}

      {/* Error state */}
      {status === 'error' && (
        <p className="mt-6 text-sm font-inter text-white/50">
          Something went wrong — try a different search.
        </p>
      )}

      {/* Results */}
      {status === 'success' && result && (
        <div className="mt-8">
          {result.watches.length === 0 ? (
            <p className="text-sm font-inter text-white/50">
              No matches found — try a broader description.
            </p>
          ) : (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                {result.watches.map(watch => (
                  <FinderWatchCard
                    key={watch.id}
                    watch={watch}
                    explanation={result.matchDetails[watch.id]?.explanation}
                  />
                ))}
              </div>

              {result.otherCandidates.length > 0 && (
                <div className="mt-10">
                  <div className="flex items-center gap-4 mb-5">
                    <div className="flex-1 h-px bg-white/10" />
                    <p className="text-xs font-inter text-white/35 uppercase tracking-widest whitespace-nowrap">
                      You may also be interested in
                    </p>
                    <div className="flex-1 h-px bg-white/10" />
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                    {result.otherCandidates.map(watch => (
                      <FinderWatchCard key={watch.id} watch={watch} />
                    ))}
                  </div>
                </div>
              )}

              <div className="mt-6 text-right">
                <Link
                  href={`/search?q=${encodeURIComponent(query)}`}
                  className="text-sm font-inter text-white/50 hover:text-white/80 transition-colors"
                >
                  See all results →
                </Link>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

// Compact watch card for finder results — image, description, name, price, AI explanation
function FinderWatchCard({ watch, explanation }: { watch: Watch; explanation?: string }) {
  const [src, setSrc] = useState<string>(
    watch.imageUrl || imageTransformations.card(watch.image)
  );
  const [retried, setRetried] = useState(false);

  const handleImgError = () => {
    if (!retried) {
      setRetried(true);
      setSrc(
        getOptimizedImageUrl(watch.image, { width: 400, height: 400, crop: 'fill', quality: 'auto', format: 'jpg' }) +
          `?r=${Date.now()}`
      );
    }
  };

  return (
    <div className="group bg-gradient-to-br from-white/5 to-white/10 border border-white/20 rounded-2xl p-4 transition-all duration-300 hover:border-white/30 hover:scale-[1.02] hover:shadow-xl hover:shadow-white/5">
      <Link href={`/watches/${watch.id}`}>
        <div className="w-full aspect-square bg-gradient-to-br from-black/40 to-black/60 rounded-xl flex items-center justify-center border border-white/10 overflow-hidden mb-4">
          {watch.image ? (
            <Image
              src={src}
              alt={watch.name}
              width={400}
              height={400}
              className="w-full h-full object-cover rounded-xl"
              onError={handleImgError}
            />
          ) : (
            <span className="text-white/40 text-xs">{watch.name}</span>
          )}
        </div>
      </Link>

      <div className="space-y-1.5">
        {watch.description && (
          <p className="text-xs text-white/60 font-inter font-light uppercase tracking-wide truncate">
            {watch.description}
          </p>
        )}
        <Link href={`/watches/${watch.id}`}>
          <h3 className="text-sm font-inter font-medium text-white group-hover:text-[#f0e6d2] transition-colors truncate">
            {watch.name}
          </h3>
        </Link>
        <p className="text-base text-[#f0e6d2] font-inter font-semibold">
          {watch.currentPrice === 0
            ? 'Price on Request'
            : `$${watch.currentPrice.toLocaleString()}`}
        </p>
        {explanation && (
          <p className="text-xs text-white/50 font-inter leading-relaxed pt-1.5 border-t border-white/10">
            {explanation}
          </p>
        )}
      </div>
    </div>
  );
}
