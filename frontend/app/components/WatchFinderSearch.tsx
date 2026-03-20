// AI-powered natural language watch search on the homepage.
// Navigates to /smart-search on submit. No readiness polling — Docker startup
// ensures the AI service is warm before the backend accepts traffic.
// If a search fires before the service is ready, the results page handles the error with a retry.
'use client';

import { useState } from 'react';
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
  const [loading, setLoading] = useState(false);

  const handleSubmit = (q: string) => {
    const trimmed = q.trim();
    if (!trimmed || loading) return;
    setLoading(true);
    router.push(`/smart-search?q=${encodeURIComponent(trimmed)}`);
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
          disabled={loading}
          className="flex-1 bg-white/5 border border-white/20 rounded-xl px-5 py-3.5 text-white placeholder-white/40 font-inter text-sm focus:outline-none focus:border-white/40 transition-all disabled:opacity-50"
        />
        <button
          onClick={() => handleSubmit(query)}
          disabled={loading}
          className="px-6 py-3.5 bg-white/10 hover:bg-white/20 border border-white/20 hover:border-white/30 rounded-xl text-white font-inter text-sm font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
        >
          {loading ? 'Opening...' : 'Search'}
        </button>
      </div>

      {/* Suggestion chips */}
      {!loading && (
        <div className="flex flex-wrap gap-2">
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
    </div>
  );
}
