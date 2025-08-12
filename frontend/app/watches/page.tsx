// Main entry point for browsing, displaying a list of all available watch brands, and some random watches
// From here, users can navigate to a specific brand's page.
// Features Holy Trinity showcase, Explore More Brands section, and All Watches with pagination
// Main Watches hub: brands overview + Trinity showcase + the full watches grid below.
// Data loads on the client for simplicity; animations add polish without blocking.
// Uses the shared watches section for optimized images and pagination.
'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { fetchBrands, Brand } from '@/lib/api';
import { useWatchesPage } from '@/contexts/WatchesPageContext';
import ScrollFade from '../scrollMotion/ScrollFade';
import TrinityShowcase from '../components/sections/TrinityShowcase';
import AllWatchesSection from '../components/sections/AllWatchesSection';

// A reusable component for displaying a single brand in a list format.
// Used in the "Explore More Brands" section to show brand name and summary
// Provides hover effects and links to individual brand pages
const BrandListItem = ({ brand }: { brand: Brand }) => {
    return (
        <Link
            href={`/brands/${brand.id}`}
            className="group block w-full px-8 py-6 border-t border-white/10 transition-colors duration-300 hover:bg-black/20"
        >
            <h2 className="text-2xl font-playfair font-semibold brand-name mb-3 transition-colors group-hover:text-white">
                {brand.name}
            </h2>
            <p className="text-sm text-white/70 transition-colors group-hover:text-white/90 font-playfair font-light tracking-wide leading-relaxed">
                {brand.summary}
            </p>
        </Link>
    );
};

// Main component for the watches page - handles brand showcase and delegates watches to AllWatchesSection
// Manages the overall layout, data fetching, and conditional rendering based on current page
const BrandListPage = () => {
  // State for data management
  const [brands, setBrands] = useState<Brand[]>([]); // All brands data from API
  
  // State for UI controls
  const [showAllBrands, setShowAllBrands] = useState(false); // Controls "Explore More Brands" expansion
  
  // Global state for pagination - managed by context
  const { currentPage } = useWatchesPage();

  // Fetch brands data on component mount
  // Only fetches brands data as watches are handled by AllWatchesSection
  useEffect(() => {
    const getData = async () => {
      try {
        console.log('Main page: Starting to fetch brands...');
        
        // Fetch brands data from API
        const brandsData = await fetchBrands();
        
        console.log('Main page: Brands fetched successfully:', brandsData?.length || 0);
        
        setBrands(brandsData || []);
      } catch (error) {
        console.error('Main page: Error fetching brands:', error);
        setBrands([]);
      }
    };

    getData();
  }, []); // Empty dependency array - only run on mount

  // Data processing for different sections
  
  // Holy Trinity brands (first 3 brands for showcase) - Patek Philippe, Vacheron Constantin, Audemars Piguet
  const trinityBrands = brands.slice(0, 3);
  const remainingBrands = brands.slice(3); // All other brands for "Explore More" section
  
  // "Explore More Brands" section - show 3 brands initially, expand to show all
  const displayedBrands = showAllBrands ? remainingBrands : remainingBrands.slice(0, 3);

  // Debug logging for development and troubleshooting
  console.log('Main page: Brands loaded:', brands.length);
  console.log('Main page: Trinity brands:', trinityBrands.map(b => b.name));

  return (
    <div className="container mx-auto px-8 sm:px-12 lg:px-16 xl:px-20 py-24 pt-30 max-w-7xl">
      {/* PAGE 1 CONTENT - Only show on first page */}
      {currentPage === 1 && (
        <>
          {/* Main page title with scroll animation */}
          <ScrollFade>
            <h1 className="text-5xl font-playfair font-bold text-center mb-15 mt-32 text-[#f0e6d2]">
              Explore Our Brands
            </h1>
          </ScrollFade>

          {/* White line separator for the Holy Trinity section */}
          <div className="w-full border-t border-white/10 mb-60"></div>

          {/* Holy Trinity Showcase - Features the top 3 luxury brands with individual showcases */}
          <section className="mb-20">
            <ScrollFade>
              <h2 className="text-5xl font-playfair font-bold text-center mb-20 text-[#f0e6d2]">
                The Holy Trinity - Haute Horlogerie
              </h2>
            </ScrollFade>
            
            {trinityBrands.length > 0 ? (
              <>
                {/* First Trinity brand (Patek Philippe) */}
                {trinityBrands[0] && (
                  <ScrollFade>
                    <TrinityShowcase brand={trinityBrands[0]} />
                  </ScrollFade>
                )}
                
                {/* Second Trinity brand (Vacheron Constantin) with separator */}
                {trinityBrands[1] && (
                  <>
                    {/* White line separator between Trinity brands */}
                    <div className="w-full border-t border-white/10 my-24"></div>
                    <ScrollFade>
                      <TrinityShowcase brand={trinityBrands[1]} />
                    </ScrollFade>
                  </>
                )}
                
                {/* Third Trinity brand (Audemars Piguet) with separator */}
                {trinityBrands[2] && (
                  <>
                    {/* White line separator between Trinity brands */}
                    <div className="w-full border-t border-white/10 my-24"></div>
                    <ScrollFade>
                      <TrinityShowcase brand={trinityBrands[2]} />
                    </ScrollFade>
                  </>
                )}
              </>
            ) : (
              // Loading state for Trinity showcase
              <div className="text-center py-16">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white/40 mx-auto mb-4"></div>
                <p className="text-white/60 font-playfair">Loading luxury brands...</p>
              </div>
            )}
          </section>

          {/* White line separator between sections */}
          <div className="w-full border-t border-white/10 my-25"></div>

          {/* Explore More Brands - Shows remaining brands with expand/collapse functionality */}
          <section>
            <ScrollFade>
              <h2 className="text-5xl font-playfair font-bold text-center mb-10 text-[#f0e6d2]">
                Explore More Brands
              </h2>
            </ScrollFade>
            
            <div className="max-w-2xl mx-auto">
              {/* Render brand list items with scroll animations */}
              {displayedBrands.map((brand) => (
                <ScrollFade key={brand.id}>
                  <BrandListItem brand={brand} />
                </ScrollFade>
              ))}
              
              {/* Show More/Less Button for brands - only show if more than 3 remaining brands */}
              {remainingBrands.length > 3 && (
                <div className="text-center mt-8">
                  <button
                    onClick={(e) => {
                      e.preventDefault(); // Prevent page refresh
                      setShowAllBrands(!showAllBrands);
                    }}
                    className="inline-flex items-center text-[#f0e6d2] hover:text-white transition-colors duration-500 text-xl font-playfair font-medium hover:scale-105"
                  >
                    {showAllBrands ? (
                      // Show Less state - displays stacked chevron up icons
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
                    ) : (
                      // Show More state - displays stacked chevron down icons
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
                    )}
                  </button>
                </div>
              )}
            </div>
          </section>

          {/* White line separator between sections */}
          <div className="w-full border-t border-white/10 my-25"></div>
        </>
      )}

      {/* All Watches Section - Delegated to separate component with pagination state */}
      {/* This section handles all watches display, pagination, and data management */}
      <AllWatchesSection 
        brands={brands} 
      />
    </div>
  );
};

export default BrandListPage; 