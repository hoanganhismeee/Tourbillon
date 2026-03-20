// AI-powered natural language watch search on the homepage.
// Polls AI service readiness on mount, then redirects to /smart-search on submit.
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

const SUGGESTIONS = [
  'Good watch for a wedding',
  'Thin dress watch under 20k',
  'Steel sport watch with date',
  'German watchmaker under 15k',
  'Thin automatic for daily wear',
  'Platinum dress watch, manual winding',
];

export default function WatchFinderSearch() {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<'idle' | 'warming' | 'loading'>('idle');

  // Poll /api/ai-ready on mount until the model is warm.
  // Only relevant for local Ollama — Claude API (production) returns ready immediately.
  useEffect(() => {
    let cancelled = false;
    let intervalId: ReturnType<typeof setInterval>;

    const check = async () => {
      try {
        const res = await fetch('/api/ai-ready', { cache: 'no-store' });
        if (cancelled) return;
        if (res.ok) {
          setStatus(prev => (prev === 'warming' ? 'idle' : prev));
          clearInterval(intervalId);
        } else {
          setStatus('warming');
        }
      } catch {
        // backend not up yet — stay idle, don't show warming
      }
    };

    check();
    intervalId = setInterval(check, 5000);

    return () => {
      cancelled = true;
      clearInterval(intervalId);
    };
  }, []);

  const handleSubmit = (q: string) => {
    const trimmed = q.trim();
    if (!trimmed || status === 'loading') return;
    setStatus('loading');
    router.push(`/smart-search?q=${encodeURIComponent(trimmed)}`);
  };

  const handleChipClick = (suggestion: string) => {
    setQuery(suggestion);
    handleSubmit(suggestion);
  };

  const isDisabled = status === 'loading' || status === 'warming';

  return (
    <div className="w-full max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <h2 className="text-2xl font-playfair font-bold tourbillon-text-color">Find Your Watch</h2>
        <span className="px-2 py-0.5 text-xs font-inter font-medium bg-white/10 border border-white/20 rounded-full text-white/70 uppercase tracking-wider">
          AI
        </span>
      </div>

      {/* Warming message */}
      {status === 'warming' && (
        <div className="mb-5 flex items-center gap-2.5 px-4 py-3 bg-white/5 border border-white/10 rounded-xl">
          <div className="w-1.5 h-1.5 rounded-full bg-amber-400/70 animate-pulse flex-shrink-0" />
          <p className="text-sm font-inter text-white/50">
            AI service warming up — ready in about 60 seconds. Retrying automatically.
          </p>
        </div>
      )}

      {/* Search input */}
      <div className="flex gap-3 mb-5">
        <input
          type="text"
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSubmit(query)}
          placeholder="Describe what you're looking for..."
          disabled={isDisabled}
          className="flex-1 bg-white/5 border border-white/20 rounded-xl px-5 py-3.5 text-white placeholder-white/40 font-inter text-sm focus:outline-none focus:border-white/40 transition-all disabled:opacity-50"
        />
        <button
          onClick={() => handleSubmit(query)}
          disabled={isDisabled}
          className="px-6 py-3.5 bg-white/10 hover:bg-white/20 border border-white/20 hover:border-white/30 rounded-xl text-white font-inter text-sm font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
        >
          {status === 'loading' ? 'Opening...' : 'Search'}
        </button>
      </div>

      {/* Suggestion chips */}
      {status !== 'loading' && (
        <div className="flex flex-wrap gap-2">
          {SUGGESTIONS.map(s => (
            <button
              key={s}
              onClick={() => handleChipClick(s)}
              disabled={isDisabled}
              className="px-3.5 py-1.5 text-xs font-inter text-white/60 hover:text-white border border-white/15 hover:border-white/30 rounded-full bg-white/5 hover:bg-white/10 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
