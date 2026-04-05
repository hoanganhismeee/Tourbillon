// AI-powered natural language watch search on the homepage.
// Navigates to /smart-search on submit. Editorial underline-style input — no boxy UI.
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export const SUGGESTIONS = [
  'Vacheron Dress Watch 39–40mm dial',
  'Perpetual Calendar watches',
  'Patek Calatrava',
  'Sport Watches under 100k',
  'AP Royal Oak',
  'Tourbillon Watches',
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

  return (
    <div className="w-full">
      {/* Editorial underline input — no boxy border frame */}
      <div className="relative mb-10 group">
        <input
          type="text"
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSubmit(query)}
          placeholder="Describe what you're looking for..."
          disabled={loading}
          className="w-full bg-transparent border-0 border-b border-[#bfa68a]/25 pb-5 pt-2 pr-14 text-white/75 placeholder-white/20 font-inter text-lg focus:outline-none focus:border-[#bfa68a]/70 transition-colors duration-500 disabled:opacity-40"
        />
        <button
          onClick={() => handleSubmit(query)}
          disabled={loading}
          className="absolute right-0 bottom-4 text-[#bfa68a]/60 hover:text-[#bfa68a] text-xl transition-all duration-300 hover:translate-x-1 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {loading ? '·' : '→'}
        </button>
        {/* Animated focus underline */}
        <div className="absolute bottom-0 left-0 h-px w-0 bg-[#bfa68a]/50 transition-all duration-500 group-focus-within:w-full" />
      </div>

      {/* Suggestion chips */}
      {!loading && (
        <div className="flex flex-wrap gap-2">
          {SUGGESTIONS.map(s => (
            <button
              key={s}
              onClick={() => handleSubmit(s)}
              className="px-3.5 py-1.5 text-[10px] tracking-[0.08em] font-inter text-white/30 hover:text-[#bfa68a] border border-white/8 hover:border-[#bfa68a]/30 bg-transparent hover:bg-[#bfa68a]/4 transition-all duration-300"
            >
              {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
