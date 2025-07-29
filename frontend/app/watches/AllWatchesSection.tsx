// AllWatchesSection component - handles watches display, pagination, and data management
'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { fetchWatches, fetchCollections, Watch, Collection, Brand } from '@/api/api';
import { useWatchesPage } from '@/contexts/WatchesPageContext';
import { useNavigation } from '@/contexts/NavigationContext';

// Individual watch card component for grid layout on Page 1
// Displays watch image placeholder, brand name, collection, model name, and price
const WatchCard = ({ watch, brands, collections }: { 
  watch: Watch; 
  brands: Brand[]; 
  collections: Collection[] 
}) => {
  // Get navigation context for saving back state
  const { saveNavigationState } = useNavigation();
  // Get current page from watches page context
  const { currentPage } = useWatchesPage();

  // Handle watch card click to save navigation state
  const handleWatchClick = () => {
    // Save current navigation state for back functionality
    const navigationState = {
      scrollPosition: window.scrollY, // Current scroll position
      currentPage: currentPage, // Current page number
      path: window.location.pathname, // Current path
      timestamp: Date.now(), // Timestamp for state management
    };
    saveNavigationState(navigationState);
  };

  return (
    <Link
      key={watch.id}
      href={`/watches/${watch.id}`}
      onClick={handleWatchClick} // Save navigation state when clicked
      className="group block bg-gradient-to-br from-white/5 to-white/10 backdrop-blur-sm border border-white/20 rounded-2xl p-4 transition-all duration-500 hover:bg-gradient-to-br hover:from-white/10 hover:to-white/15 hover:border-white/30 hover:scale-105 hover:shadow-2xl hover:shadow-white/10"
    >
      {/* Watch image placeholder - 1:1 aspect ratio */}
      <div className="w-full aspect-square bg-gradient-to-br from-black/40 to-black/60 rounded-xl mb-4 flex items-center justify-center border border-white/10">
        <span className="text-white/60 text-xs font-light">Watch Image</span>
      </div>
      {/* Watch information - brand, collection, model, price */}
      <div className="space-y-2">
        <p className="text-xs text-white/60 font-inter font-light uppercase tracking-wide">
          {brands.find(b => b.id === watch.brandId)?.name || 'Unknown Brand'}
        </p>
        <p className="text-xs text-white/50 font-inter font-light">
          {collections.find(c => c.id === watch.collectionId)?.name || ''}
        </p>
        <h3 className="text-sm font-inter font-medium text-white group-hover:text-[#f0e6d2] transition-colors truncate">
          {watch.name}
        </h3>
        <p className="text-lg text-[#f0e6d2] font-inter font-semibold">
          {watch.currentPrice === 0 ? 'Price on Request' : `$${watch.currentPrice.toLocaleString()}`}
        </p>
      </div>
    </Link>
  );
};

// Props interface for AllWatchesSection component
interface AllWatchesSectionProps {
  brands: Brand[]; // Passed from parent component for brand name lookup
}

// Main component that handles watches display, pagination, and data management
// Manages both grid layout (Page 1) and list layout (Pages 2+) with smart shuffling
const AllWatchesSection = ({ brands }: AllWatchesSectionProps) => {
  // Global state for pagination and shuffle tracking - managed by context
  const { currentPage, setCurrentPage, hasShuffledWatches, setHasShuffledWatches } = useWatchesPage();
  
  // State for data management
  const [watches, setWatches] = useState<Watch[]>([]); // Raw watches data from API
  const [collections, setCollections] = useState<Collection[]>([]); // Collections data for display
  const [shuffledWatches, setShuffledWatches] = useState<Watch[]>([]); // Processed watches (filtered + shuffled)
  
  // State for UI controls
  const [showAllWatches, setShowAllWatches] = useState(false); // Controls "Show More/Less" on Page 1
  const [watchesPerPage] = useState(20); // Number of watches displayed per page

  // Fetch watches and collections data from API on component mount
  // Handles filtering Trinity Showcase watches and smart shuffling logic
  useEffect(() => {
    const getData = async () => {
      try {
        console.log('AllWatchesSection: Starting to fetch data...');
        
        // Fetch watches and collections in parallel for better performance
        const [watchesData, collectionsData] = await Promise.all([
          fetchWatches(),
          fetchCollections()
        ]);
        
        console.log('AllWatchesSection: Data fetched successfully:', {
          watches: watchesData?.length || 0,
          collections: collectionsData?.length || 0
        });
        
        console.log('AllWatchesSection: Watches data sample:', watchesData?.slice(0, 2));
        
        setWatches(watchesData || []);
        setCollections(collectionsData || []);
        
        // Filter out Trinity Showcase watches and shuffle only if not already shuffled in this session
        if (watchesData && watchesData.length > 0) {
          const trinityWatchIds = [2, 4, 11, 13, 18, 24, 28, 30, 34]; // Patek, VC, AP specific showcase watches
          const filtered = watchesData.filter(watch => !trinityWatchIds.includes(watch.id));
          
          if (!hasShuffledWatches) {
            // Shuffle only if not already shuffled in this session (prevents re-shuffle on navbar navigation)
            const shuffled = [...filtered].sort(() => Math.random() - 0.5);
            console.log('AllWatchesSection: Watches filtered and shuffled successfully:', shuffled.length);
            setShuffledWatches(shuffled);
            setHasShuffledWatches(true); // Mark as shuffled for this session
          } else {
            // Use existing shuffled order or original order if no previous shuffle
            console.log('AllWatchesSection: Using existing watch order (no re-shuffle):', filtered.length);
            setShuffledWatches(filtered);
          }
        } else {
          console.log('AllWatchesSection: No watches data to process');
          setShuffledWatches([]);
        }
      } catch (error) {
        console.error('AllWatchesSection: Error fetching data:', error);
        // Set empty arrays to prevent infinite loading states
        setWatches([]);
        setCollections([]);
        setShuffledWatches([]);
      }
    };

    getData();
  }, []); // Empty dependency array - only run on mount

  // Scroll to top when page changes for better user experience
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [currentPage]);

  // Data processing for different layouts and pagination
  
  // Watch listing logic for Page 1 - uses shuffled order (consistent during session)
  const initialWatches = shuffledWatches.slice(0, 12); // First 4x3 grid (12 watches)
  const additionalWatches = shuffledWatches.slice(12, 20); // Next 8 watches (total 20)
  const displayedWatches = showAllWatches ? [...initialWatches, ...additionalWatches] : initialWatches;
  
  // Pagination logic for Pages 2+ - uses same shuffled order (consistent during session)
  const totalPages = Math.ceil(shuffledWatches.length / watchesPerPage);
  const startIndex = (currentPage - 1) * watchesPerPage;
  const endIndex = startIndex + watchesPerPage;
  const paginatedWatches = shuffledWatches.slice(startIndex, endIndex);

  // Debug logging for development and troubleshooting
  console.log('AllWatchesSection: Watches loaded:', watches.length);
  console.log('AllWatchesSection: Shuffled watches loaded:', shuffledWatches.length);
  console.log('AllWatchesSection: Displayed watches:', displayedWatches.length);

  return (
    <section>
      {/* Dynamic page title based on current page */}
      <h2 className="text-5xl font-playfair font-bold text-center mb-20 text-[#f0e6d2]">
        {currentPage === 1 ? 'All Watches' : `Watches - Page ${currentPage}`}
      </h2>
      
      {/* Loading state - shown when no data is available */}
      {shuffledWatches.length === 0 && watches.length === 0 ? (
        <div className="text-center py-16">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white/40 mx-auto mb-4"></div>
          <p className="text-white/60 font-playfair">Loading watches...</p>
        </div>
      ) : (
        <>
          {currentPage === 1 ? (
            // PAGE 1: Grid layout with Show More functionality (4x4 grid, expands to 5x4)
            <div className="max-w-7xl mx-auto">
              {/* Watch cards in 4-column grid layout */}
              <div className="grid grid-cols-4 gap-x-8 gap-y-20 mb-20">
                {displayedWatches.map((watch) => (
                  <WatchCard 
                    key={watch.id}
                    watch={watch} 
                    brands={brands} 
                    collections={collections} 
                  />
                ))}
              </div>
              
              {/* Show More/Less Button for Page 1 watches - only show if more than 16 watches available */}
              {currentPage === 1 && shuffledWatches.length > 16 && (
                <div className="text-center mt-8">
                  <button
                    onClick={(e) => {
                      e.preventDefault(); // Prevent page refresh
                      setShowAllWatches(!showAllWatches);
                    }}
                    className="inline-flex items-center text-[#f0e6d2] hover:text-white transition-colors duration-500 text-xl font-playfair font-medium hover:scale-105"
                  >
                    {!showAllWatches ? (
                      // Show More state - displays chevron down icons
                      <div className="flex flex-col items-center">
                        <span>Show More</span>
                        <div className="flex flex-col mt-0">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                          <svg className="w-4 h-4 -mt-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        </div>
                      </div>
                    ) : (
                      // Show Less state - displays chevron up icons
                      <div className="flex flex-col items-center">
                        <div className="flex flex-col mb-0">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                          </svg>
                          <svg className="w-4 h-4 -mt-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                          </svg>
                        </div>
                        <span>Show Less</span>
                      </div>
                    )}
                  </button>
                </div>
              )}
            </div>
          ) : (
            // PAGES 2+: Grid layout with cards (same as Page 1)
            <div className="max-w-7xl mx-auto">
              <div className="grid grid-cols-4 gap-x-8 gap-y-20 mb-20">
                {paginatedWatches.map((watch) => (
                  <WatchCard 
                    key={watch.id}
                    watch={watch} 
                    brands={brands} 
                    collections={collections} 
                  />
                ))}
              </div>
            </div>
          )}

          {/* Pagination Controls - Only show after "Show More" clicked or on Pages 2+ */}
          {totalPages > 1 && (showAllWatches || currentPage > 1) && (
            <div className="text-center mt-16">
              <div className="flex items-center justify-center gap-4">
                {/* Page number buttons - dynamically generated based on total pages */}
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                  <button
                    key={page}
                    onClick={(e) => {
                      e.preventDefault(); // Prevent page refresh
                      setCurrentPage(page);
                    }}
                    className={`px-4 py-2 rounded-lg transition-all duration-300 ${
                      currentPage === page
                        ? 'bg-[#f0e6d2] text-black font-semibold' // Active page styling
                        : 'text-[#f0e6d2] hover:text-white hover:bg-black/20' // Inactive page styling
                    }`}
                  >
                    {page}
                  </button>
                ))}
                {/* Next page button - only show if not on last page */}
                {currentPage < totalPages && (
                  <button
                    onClick={(e) => {
                      e.preventDefault(); // Prevent page refresh
                      setCurrentPage(currentPage + 1);
                    }}
                    className="text-[#f0e6d2] hover:text-white transition-colors duration-300 ml-4"
                  >
                    &gt;&gt;
                  </button>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </section>
  );
};

export default AllWatchesSection; 