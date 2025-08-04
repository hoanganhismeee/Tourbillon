// Clean and elegant search page for Tourbillon
// Displays search results with priority: brands first, then watches, then collections
"use client";

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { imageTransformations } from '@/lib/cloudinary';

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

export default function SearchPage() {
  const searchParams = useSearchParams();
  const query = searchParams.get('q') || '';
  
  const [searchResults, setSearchResults] = useState<SearchResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [searchInput, setSearchInput] = useState(query);

  // Load search results
  useEffect(() => {
    if (query) {
      performSearch();
    }
  }, [query]);

  const performSearch = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
      if (!response.ok) {
        throw new Error('Search failed');
      }
      const data = await response.json();
      
      // Ensure all arrays exist to prevent crashes
      setSearchResults({
        watches: data.watches || [],
        brands: data.brands || [],
        collections: data.collections || [],
        totalResults: data.totalResults || 0,
        suggestions: data.suggestions || []
      });
    } catch (error) {
      console.error('Search error:', error);
      setSearchResults({
        watches: [],
        brands: [],
        collections: [],
        totalResults: 0,
        suggestions: []
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchInput.trim()) {
      window.location.href = `/search?q=${encodeURIComponent(searchInput.trim())}`;
    }
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(price);
  };

  if (!query) {
    return (
      <div className="min-h-screen">
        <div className="container mx-auto px-4 py-8">
          <div className="max-w-2xl mx-auto text-center">
            <h1 className="text-4xl font-bold mb-8 font-playfair">Search Tourbillon</h1>
            <p className="text-gray-600 mb-8 text-lg">Discover luxury timepieces and heritage brands</p>
            
            {/* Search form */}
            <form onSubmit={handleSearch} className="relative max-w-md mx-auto">
              <input
                type="text"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Search watches, brands, collections..."
                className="w-full px-6 py-4 pl-12 pr-20 text-lg bg-white border border-gray-300 rounded-xl 
                         text-gray-900 placeholder-gray-500 focus:outline-none focus:border-[#bfa68a] 
                         focus:ring-2 focus:ring-[#bfa68a]/20 transition-all duration-300"
              />
              
              {/* Search Icon */}
              <div className="absolute left-4 top-1/2 transform -translate-y-1/2">
                <svg width="20" height="20" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M17.5 3.33333C15.241 3.33352 13.0148 3.87394 11.0071 4.90948C8.99941 5.94503 7.26848 7.44569 5.95872 9.28625C4.64896 11.1268 3.79834 13.2539 3.47784 15.4901C3.15734 17.7262 3.37624 20.0066 4.11629 22.141C4.85634 24.2753 6.09607 26.2018 7.73206 27.7595C9.36804 29.3173 11.3528 30.4613 13.5209 31.096C15.6889 31.7307 17.9772 31.8377 20.195 31.4082C22.4128 30.9786 24.4957 30.0249 26.27 28.6267L32.3567 34.7133C32.671 35.0169 33.092 35.1849 33.529 35.1811C33.966 35.1773 34.384 35.002 34.693 34.693C35.002 34.384 35.1773 33.966 35.1811 33.529C35.1849 33.092 35.0169 32.671 34.7133 32.3567L28.6267 26.27C30.2733 24.181 31.2986 21.6707 31.5852 19.0262C31.8717 16.3817 31.408 13.71 30.247 11.3168C29.0861 8.92361 27.2748 6.90559 25.0205 5.49371C22.7662 4.08184 20.1599 3.33315 17.5 3.33333ZM6.66666 17.5C6.66666 14.6268 7.80803 11.8713 9.83967 9.83967C11.8713 7.80803 14.6268 6.66666 17.5 6.66666C20.3732 6.66666 23.1287 7.80803 25.1603 9.83967C27.192 11.8713 28.3333 14.6268 28.3333 17.5C28.3333 20.3732 27.192 23.1287 25.1603 25.1603C23.1287 27.192 20.3732 28.3333 17.5 28.3333C14.6268 28.3333 11.8713 27.192 9.83967 25.1603C7.80803 23.1287 6.66666 20.3732 6.66666 17.5Z" fill="#bfa68a"/>
                </svg>
              </div>

              {/* Search Button */}
              <button 
                type="submit"
                className="absolute right-2 top-1/2 transform -translate-y-1/2 px-4 py-2 bg-[#bfa68a] 
                         text-white rounded-lg hover:bg-[#bfa68a]/80 transition-all duration-300 
                         font-medium text-sm"
              >
                Search
              </button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <div className="container mx-auto px-4 py-8">
        {/* Search Header */}
        <div className="mb-12 text-center">
          <h1 className="text-3xl font-bold mb-4 font-playfair">
            Search Results for &quot;{query}&quot;
          </h1>
          {searchResults && (
            <p className="text-gray-600 text-lg">
              {searchResults.totalResults} results found
            </p>
          )}
        </div>

        {isLoading ? (
          <div className="flex justify-center items-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#bfa68a]"></div>
          </div>
        ) : searchResults ? (
          <div className="space-y-12">
            {/* Brands Results (Highest Priority) */}
            {searchResults.brands && searchResults.brands.length > 0 && (
              <div>
                <h2 className="text-2xl font-semibold mb-6 font-playfair">Brands</h2>
                <div className="space-y-4">
                  {searchResults.brands.map((brand) => (
                    <Link
                      key={brand.id}
                      href={`/brands/${brand.id}`}
                      className="block group"
                    >
                      <div className="py-4 border-b border-gray-200 last:border-b-0">
                        <h3 className="text-xl font-semibold group-hover:text-[#bfa68a] transition-colors">
                          {brand.name}
                        </h3>
                        <p className="text-sm text-gray-600 mt-1">
                          Discover luxury timepieces from {brand.name}
                        </p>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {/* Watches Results (Second Priority) */}
            {searchResults.watches && searchResults.watches.length > 0 && (
              <div>
                <h2 className="text-2xl font-semibold mb-6 font-playfair">Watches</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                  {searchResults.watches.map((watch) => (
                    <Link
                      key={watch.id}
                      href={`/watches/${watch.id}`}
                      className="group block bg-gradient-to-br from-white/5 to-white/10 backdrop-blur-sm border border-white/20 rounded-2xl p-4 transition-all duration-500 hover:bg-gradient-to-br hover:from-white/10 hover:to-white/15 hover:border-white/30 hover:scale-105 hover:shadow-2xl hover:shadow-white/10"
                    >
                      {/* Watch image with Cloudinary optimization */}
                      <div className="w-full aspect-square bg-gradient-to-br from-black/40 to-black/60 rounded-xl mb-4 flex items-center justify-center border border-white/10 overflow-hidden">
                        {watch.image ? (
                          <img 
                            src={imageTransformations.card(watch.image)}
                            alt={watch.name}
                            className="w-full h-full object-cover rounded-xl"
                            loading="lazy"
                          />
                        ) : (
                          <span className="text-white/60 text-xs font-light">{watch.name}</span>
                        )}
                      </div>
                      {/* Watch information - brand, model, price */}
                      <div className="space-y-2">
                        <p className="text-xs text-white/60 font-inter font-light uppercase tracking-wide">
                          {watch.brand?.name || 'Unknown Brand'}
                        </p>
                        <p className="text-xs text-white/50 font-inter font-light">
                          {watch.collection?.name || ''}
                        </p>
                        <h3 className="text-sm font-inter font-medium text-white group-hover:text-[#f0e6d2] transition-colors truncate">
                          {watch.name}
                        </h3>
                        <p className="text-lg text-[#f0e6d2] font-inter font-semibold">
                          {watch.currentPrice ? formatPrice(watch.currentPrice) : 'Price on Request'}
                        </p>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {/* Collections Results (Third Priority) */}
            {searchResults.collections && searchResults.collections.length > 0 && (
              <div>
                <h2 className="text-2xl font-semibold mb-6 font-playfair">Collections</h2>
                <div className="space-y-4">
                  {searchResults.collections.map((collection) => (
                    <Link
                      key={collection.id}
                      href={`/collections/${collection.id}`}
                      className="block group"
                    >
                      <div className="py-4 border-b border-gray-200 last:border-b-0">
                        <h3 className="text-xl font-semibold group-hover:text-[#bfa68a] transition-colors">
                          {collection.name}
                        </h3>
                        <p className="text-sm text-gray-600 mt-1">
                          {collection.brand?.name || 'Unknown Brand'}
                        </p>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {/* No Results */}
            {(!searchResults.watches || searchResults.watches.length === 0) && 
             (!searchResults.brands || searchResults.brands.length === 0) && 
             (!searchResults.collections || searchResults.collections.length === 0) && (
              <div className="text-center py-12">
                <div className="text-6xl mb-4">🔍</div>
                <h3 className="text-xl font-semibold mb-2">No results found</h3>
                <p className="text-gray-600 mb-6">
                  We couldn&apos;t find any matches for &quot;{query}&quot;
                </p>
                <div className="space-y-2">
                  <p className="text-sm text-gray-500">Try:</p>
                  <ul className="text-sm text-gray-500 space-y-1">
                    <li>• Checking your spelling</li>
                    <li>• Using more general terms</li>
                    <li>• Searching for a specific brand or model</li>
                  </ul>
                </div>
              </div>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
} 