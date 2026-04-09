// AI-powered natural language watch search on the homepage.
// Navigates to /smart-search on submit. Editorial underline-style input — no boxy UI.
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

export const SUGGESTIONS = [
  'Vacheron Dress Watch 39 to 40mm Dial below 200k',
  'Omega and Rolex with good water resistance',
  'AP Royal Oak steel',
  'JLC Reverso under $50k',
  'Perpetual calendar watch',
  'Tourbillon watches',
];

export default function WatchFinderSearch() {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [isFocused, setIsFocused] = useState(false);

  // Typewriter state
  const [displayText, setDisplayText] = useState('');
  const [suggestionIndex, setSuggestionIndex] = useState(0);
  const [isTyping, setIsTyping] = useState(true);

  useEffect(() => {
    if (isFocused || query) return;

    let timeout: NodeJS.Timeout;
    const currentSuggestion = SUGGESTIONS[suggestionIndex];

    if (isTyping) {
      if (displayText.length < currentSuggestion.length) {
        timeout = setTimeout(() => {
          setDisplayText(currentSuggestion.slice(0, displayText.length + 1));
        }, 50);
      } else {
        timeout = setTimeout(() => {
          setIsTyping(false);
        }, 2000);
      }
    } else {
      if (displayText.length > 0) {
        timeout = setTimeout(() => {
          setDisplayText(displayText.slice(0, -1));
        }, 25);
      } else {
        setSuggestionIndex((prev) => (prev + 1) % SUGGESTIONS.length);
        setIsTyping(true);
      }
    }

    return () => clearTimeout(timeout);
  }, [displayText, isTyping, suggestionIndex, isFocused, query]);

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

        {/* Typewriter & Placeholder overlay */}
        {!query && (
          <div className="absolute left-0 bottom-[22px] pointer-events-none flex items-center pr-14 w-full">
            <span className={`font-inter text-lg transition-opacity duration-300 ${isFocused ? 'text-white/10' : 'text-white/30'}`}>
              {isFocused ? "Describe what you're looking for..." : displayText}
              {!isFocused && <span className="inline-block w-px h-[1.1em] bg-[#bfa68a]/40 ml-0.5 align-middle animate-pulse" />}
            </span>
          </div>
        )}

        <input
          type="text"
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSubmit(query)}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          placeholder=""
          disabled={loading}
          className="w-full bg-transparent border-0 border-b border-[#bfa68a]/25 pb-5 pt-2 pr-14 text-white/90 font-inter text-lg focus:outline-none focus:border-[#bfa68a]/70 transition-colors duration-500 disabled:opacity-40 relative z-10"
        />

        <button
          onClick={() => handleSubmit(query)}
          disabled={loading}
          className="absolute right-0 bottom-4 text-[#bfa68a]/60 hover:text-[#bfa68a] text-xl transition-all duration-300 hover:translate-x-1 disabled:opacity-40 disabled:cursor-not-allowed z-20"
        >
          {loading ? '·' : '→'}
        </button>
        {/* Animated focus underline */}
        <div className="absolute bottom-0 left-0 h-px w-0 bg-[#bfa68a]/50 transition-all duration-500 group-focus-within:w-full" />
      </div>

      {/* Suggestion chips (Rounded) */}
      {!loading && (
        <div className="flex flex-wrap gap-2.5">
          {SUGGESTIONS.map(s => (
            <button
              key={s}
              onClick={() => handleSubmit(s)}
              className="px-4 py-2 text-[10px] tracking-[0.08em] font-inter text-white/40 hover:text-[#bfa68a] border border-white/10 hover:border-[#bfa68a]/40 bg-white/[0.01] hover:bg-[#bfa68a]/[0.03] transition-all duration-300 rounded-full"
            >
              {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
