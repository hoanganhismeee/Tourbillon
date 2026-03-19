// Search page for Tourbillon.
// Shows brands, watches, and collections with client-side fetching and relevance scoring.
// Includes resilient image loading for watch thumbnails to avoid transient failures.
"use client";

import { useState, useEffect, Suspense, useCallback } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { imageTransformations, getOptimizedImageUrl } from '@/lib/cloudinary';
import Image from 'next/image';

interface Brand {
  id: number;
  name: string;
  image?: string;
  type: string;
  relevanceScore: number;
}

interface Watch {
  id: number;
  name: string;
  currentPrice?: number;
  image?: string;
  brand: { id: number; name: string };
  collection?: { id: number; name: string };
  type: string;
  relevanceScore: number;
}

interface Collection {
  id: number;
  name: string;
  image?: string;
  brand: { id: number; name: string };
  type: string;
  relevanceScore: number;
}

interface SearchResult {
  watches: Watch[];
  brands: Brand[];
  collections: Collection[];
  totalResults: number;
  suggestions: string[];
}

// Defined outside SearchContent to prevent recreation on every render
function SearchWatchCard({ watch }: { watch: Watch }) {
  const [src, setSrc] = useState<string>(imageTransformations.card(watch.image || ''));
  const [retry, setRetry] = useState(false);

  const handleImgError = () => {
    if (!retry && watch.image) {
      setRetry(true);
      setSrc(
        getOptimizedImageUrl(watch.image, {
          width: 400,
          height: 400,
          crop: 'fill',
          format: 'jpg',
          quality: 'auto',
        }) + `?r=${Date.now()}`
      );
    }
  };

  return (
    <Link
      href={`/watches/${watch.id}`}
      className="group block bg-gradient-to-br from-white/5 to-white/10 backdrop-blur-sm border border-white/20 rounded-2xl p-4 transition-all duration-500 hover:from-white/10 hover:to-white/15 hover:border-white/30 hover:scale-105 hover:shadow-2xl hover:shadow-white/10"
    >
      <div className="w-full aspect-square bg-gradient-to-br from-black/40 to-black/60 rounded-xl mb-4 flex items-center justify-center border border-white/10 overflow-hidden">
        {watch.image ? (
          <Image
            src={src}
            alt={watch.name}
            width={400}
            height={400}
            sizes="(min-width: 1280px) 25vw, (min-width: 768px) 33vw, 50vw"
            className="w-full h-full object-cover rounded-xl"
            placeholder="blur"
            onError={handleImgError}
            blurDataURL={getOptimizedImageUrl(watch.image, { width: 16, height: 16, crop: 'fill', format: 'jpg', quality: 1 })}
          />
        ) : (
          <span className="text-white/40 text-xs font-inter font-light text-center px-2">{watch.name}</span>
        )}
      </div>
      <div className="space-y-1">
        <p className="text-xs text-white/50 font-inter font-light uppercase tracking-wide">
          {watch.brand?.name || 'Unknown Brand'}
        </p>
        {watch.collection?.name && (
          <p className="text-xs text-white/40 font-inter font-light">
            {watch.collection.name}
          </p>
        )}
        <h3 className="text-sm font-inter font-medium text-white group-hover:text-[#f0e6d2] transition-colors truncate">
          {watch.name}
        </h3>
        <p className="text-base text-[#f0e6d2] font-inter font-semibold pt-1">
          {watch.currentPrice === 0 ? 'Price on Request' : `$${watch.currentPrice?.toLocaleString()}`}
        </p>
      </div>
    </Link>
  );
}

const SearchIcon = ({ size = 20, opacity = '#bfa68a' }: { size?: number; opacity?: string }) => (
  <svg width={size} height={size} viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M17.5 3.33333C15.241 3.33352 13.0148 3.87394 11.0071 4.90948C8.99941 5.94503 7.26848 7.44569 5.95872 9.28625C4.64896 11.1268 3.79834 13.2539 3.47784 15.4901C3.15734 17.7262 3.37624 20.0066 4.11629 22.141C4.85634 24.2753 6.09607 26.2018 7.73206 27.7595C9.36804 29.3173 11.3528 30.4613 13.5209 31.096C15.6889 31.7307 17.9772 31.8377 20.195 31.4082C22.4128 30.9786 24.4957 30.0249 26.27 28.6267L32.3567 34.7133C32.671 35.0169 33.092 35.1849 33.529 35.1811C33.966 35.1773 34.384 35.002 34.693 34.693C35.002 34.384 35.1773 33.966 35.1811 33.529C35.1849 33.092 35.0169 32.671 34.7133 32.3567L28.6267 26.27C30.2733 24.181 31.2986 21.6707 31.5852 19.0262C31.8717 16.3817 31.408 13.71 30.247 11.3168C29.0861 8.92361 27.2748 6.90559 25.0205 5.49371C22.7662 4.08184 20.1599 3.33315 17.5 3.33333ZM6.66666 17.5C6.66666 14.6268 7.80803 11.8713 9.83967 9.83967C11.8713 7.80803 14.6268 6.66666 17.5 6.66666C20.3732 6.66666 23.1287 7.80803 25.1603 9.83967C27.192 11.8713 28.3333 14.6268 28.3333 17.5C28.3333 20.3732 27.192 23.1287 25.1603 25.1603C23.1287 27.192 20.3732 28.3333 17.5 28.3333C14.6268 28.3333 11.8713 27.192 9.83967 25.1603C7.80803 23.1287 6.66666 20.3732 6.66666 17.5Z" fill={opacity}/>
  </svg>
);

const ChevronRight = () => (
  <svg className="w-4 h-4 text-white/30 group-hover:text-white/60 flex-shrink-0 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5l7 7-7 7" />
  </svg>
);

function SearchContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const query = searchParams.get('q') || '';

  const [searchResults, setSearchResults] = useState<SearchResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [searchInput, setSearchInput] = useState(query);

  // Sync input field with URL param on back/forward navigation
  useEffect(() => {
    setSearchInput(query);
  }, [query]);

  const performSearch = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
      if (!response.ok) throw new Error('Search failed');
      const data = await response.json();
      setSearchResults({
        watches: data.watches || [],
        brands: data.brands || [],
        collections: data.collections || [],
        totalResults: data.totalResults || 0,
        suggestions: data.suggestions || []
      });
    } catch (error) {
      console.error('Search error:', error);
      setSearchResults({ watches: [], brands: [], collections: [], totalResults: 0, suggestions: [] });
    } finally {
      setIsLoading(false);
    }
  }, [query]);

  useEffect(() => {
    if (query) {
      performSearch();
    } else {
      setSearchResults(null);
    }
  }, [query, performSearch]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = searchInput.trim();
    if (trimmed) {
      router.push(`/search?q=${encodeURIComponent(trimmed)}`);
    }
  };

  // Empty state — no query in URL
  if (!query) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="max-w-xl w-full mx-auto px-4 text-center">
          <h1 className="text-4xl font-bold mb-3 font-playfair text-white">Search Tourbillon</h1>
          <p className="text-white/50 mb-8 text-base font-inter">Discover luxury timepieces and heritage brands</p>
          <form onSubmit={handleSearch} className="relative">
            <div className="absolute left-4 top-1/2 -translate-y-1/2">
              <SearchIcon size={18} />
            </div>
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search watches, brands, collections..."
              className="w-full px-6 py-4 pl-11 pr-24 bg-white/5 border border-white/20 rounded-xl
                       text-white placeholder-white/40 focus:outline-none focus:border-[#bfa68a]
                       focus:ring-1 focus:ring-[#bfa68a]/30 transition-all duration-300 font-inter text-sm"
            />
            <button
              type="submit"
              className="absolute right-2 top-1/2 -translate-y-1/2 px-4 py-2 bg-[#bfa68a]
                       text-white rounded-lg hover:bg-[#bfa68a]/80 transition-all duration-300
                       font-inter font-medium text-sm"
            >
              Search
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <div className="container mx-auto px-4 py-10">

        {/* Header with inline search bar for query refinement */}
        <div className="mb-10 text-center">
          <h1 className="text-3xl font-bold mb-2 font-playfair text-white">
            Search Results for &quot;{query}&quot;
          </h1>
          {searchResults && (
            <p className="text-white/40 text-sm mb-6 font-inter">
              {searchResults.totalResults} result{searchResults.totalResults !== 1 ? 's' : ''} found
            </p>
          )}
          <form onSubmit={handleSearch} className="relative max-w-lg mx-auto">
            <div className="absolute left-4 top-1/2 -translate-y-1/2">
              <SearchIcon size={16} />
            </div>
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Refine your search..."
              className="w-full px-5 py-3 pl-11 pr-24 bg-white/5 border border-white/15 rounded-xl
                       text-white placeholder-white/30 focus:outline-none focus:border-[#bfa68a]
                       focus:ring-1 focus:ring-[#bfa68a]/30 transition-all duration-300 font-inter text-sm"
            />
            <button
              type="submit"
              className="absolute right-2 top-1/2 -translate-y-1/2 px-4 py-1.5 bg-[#bfa68a]
                       text-white rounded-lg hover:bg-[#bfa68a]/80 transition-all duration-300
                       font-inter font-medium text-sm"
            >
              Search
            </button>
          </form>
        </div>

        {isLoading ? (
          <div className="flex justify-center items-center py-20">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#bfa68a]"></div>
          </div>
        ) : searchResults ? (
          <div className="space-y-12">

            {/* Brands */}
            {searchResults.brands.length > 0 && (
              <div>
                <h2 className="text-xl font-semibold mb-5 font-playfair text-white">Brands</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {searchResults.brands.map((brand) => (
                    <Link
                      key={brand.id}
                      href={`/brands/${brand.id}`}
                      className="group flex items-center gap-4 p-4 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 hover:border-white/20 transition-all duration-300"
                    >
                      <div className="flex-1 min-w-0">
                        <h3 className="text-white font-inter font-medium group-hover:text-[#f0e6d2] transition-colors truncate">
                          {brand.name}
                        </h3>
                        <p className="text-xs text-white/40 font-inter mt-0.5">Luxury timepieces</p>
                      </div>
                      <ChevronRight />
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {/* Watches */}
            {searchResults.watches.length > 0 && (
              <div>
                <h2 className="text-xl font-semibold mb-5 font-playfair text-white">Watches</h2>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                  {searchResults.watches.map((watch) => (
                    <SearchWatchCard key={watch.id} watch={watch} />
                  ))}
                </div>
              </div>
            )}

            {/* Collections */}
            {searchResults.collections.length > 0 && (
              <div>
                <h2 className="text-xl font-semibold mb-5 font-playfair text-white">Collections</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {searchResults.collections.map((collection) => (
                    <Link
                      key={collection.id}
                      href={`/collections/${collection.id}`}
                      className="group flex items-center gap-4 p-4 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 hover:border-white/20 transition-all duration-300"
                    >
                      <div className="flex-1 min-w-0">
                        <h3 className="text-white font-inter font-medium group-hover:text-[#f0e6d2] transition-colors truncate">
                          {collection.name}
                        </h3>
                        <p className="text-xs text-white/40 font-inter mt-0.5">
                          {collection.brand?.name}
                        </p>
                      </div>
                      <ChevronRight />
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {/* No results */}
            {searchResults.watches.length === 0 && searchResults.brands.length === 0 && searchResults.collections.length === 0 && (
              <div className="text-center py-20">
                <div className="flex justify-center mb-6 opacity-20">
                  <SearchIcon size={72} opacity="white" />
                </div>
                <h3 className="text-xl font-semibold mb-2 font-playfair text-white">No results found</h3>
                <p className="text-white/50 mb-8 font-inter text-sm">
                  We couldn&apos;t find any matches for &quot;{query}&quot;
                </p>
                {searchResults.suggestions.length > 0 && (
                  <div className="mb-8">
                    <p className="text-white/30 text-xs mb-3 font-inter uppercase tracking-widest">Did you mean?</p>
                    <div className="flex flex-wrap justify-center gap-2">
                      {searchResults.suggestions.map((s) => (
                        <button
                          key={s}
                          onClick={() => router.push(`/search?q=${encodeURIComponent(s)}`)}
                          className="px-4 py-1.5 rounded-full border border-white/15 text-white/60 text-sm font-inter hover:border-[#bfa68a] hover:text-[#f0e6d2] transition-all duration-200"
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                <p className="text-white/25 text-sm font-inter">
                  Try checking your spelling, using more general terms, or searching for a specific brand or model.
                </p>
              </div>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}

export default function SearchPage() {
  return (
    <Suspense fallback={
      <div className="flex justify-center items-center min-h-screen">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#bfa68a]"></div>
      </div>
    }>
      <SearchContent />
    </Suspense>
  );
}
