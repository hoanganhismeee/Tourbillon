'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Brand, Watch, fetchWatchById, fetchWatchesByBrand } from '@/lib/api';
import WatchCard from './[watchId]/WatchCard';
import ScrollFade from '../scrollMotion/ScrollFade';

interface TrinityShowcaseProps {
    brand: Brand;
    tagline: string;
}

const TrinityShowcase = ({ brand, tagline }: TrinityShowcaseProps) => {
    const [watches, setWatches] = useState<Watch[]>([]);
    const [loading, setLoading] = useState(true);

    // Debug logging
    console.log(`TrinityShowcase rendering for brand: ${brand.name}`, { brand, tagline });

    useEffect(() => {
        const fetchWatches = async () => {
            try {
                if (brand.id === 1) {
                    // For Patek Philippe (brand.id === 1), fetch specific watch IDs: 2, 4, 11
                    const watchIds = [2, 4, 11];
                    const watchPromises = watchIds.map(id => fetchWatchById(id));
                    const watchResults = await Promise.allSettled(watchPromises);
                    
                    const successfulWatches = watchResults
                        .map((result, index) => {
                            if (result.status === 'fulfilled') {
                                return result.value;
                            } else {
                                console.error(`Error fetching watch ${watchIds[index]}:`, result.reason);
                                return null;
                            }
                        })
                        .filter((watch): watch is Watch => watch !== null);
                    
                    setWatches(successfulWatches);
                } else {
                    // For other brands, fetch watches by brand and take the first 3
                    const watchesData = await fetchWatchesByBrand(brand.id);
                    const firstThreeWatches = watchesData.slice(0, 3);
                    setWatches(firstThreeWatches);
                }
            } catch (error) {
                console.error(`Error fetching watches for brand ${brand.name}:`, error);
            } finally {
                setLoading(false);
            }
        };

        fetchWatches();
    }, [brand.id, brand.name]);

    // Create placeholder cards for when no watches are available
    const renderPlaceholderCard = (index: number) => (
        <div key={`placeholder-${index}`} className="group block bg-black/20 backdrop-blur-md border border-white/10 rounded-xl p-6 transition-all duration-300">
            <div className="w-full h-80 bg-black/30 rounded-lg mb-4 flex items-center justify-center">
                <div className="flex flex-col items-center justify-center text-center p-4">
                    <div className="w-16 h-16 bg-white/10 rounded-full flex items-center justify-center mb-3">
                        <svg className="w-8 h-8 text-white/30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                    </div>
                    <span className="text-white/40 text-sm font-medium">Coming soon</span>
                </div>
            </div>
            <div className="space-y-2">
                <h3 className="text-lg font-semibold text-[#f0e6d2] group-hover:text-white transition-colors">
                    {brand.name} Collection
                </h3>
                <p className="text-md text-white/60 group-hover:text-white/80 transition-colors">
                    New models arriving soon
                </p>
                <p className="text-sm text-white/80 font-medium">
                    Price on request
                </p>
            </div>
        </div>
    );

    return (
        <div className="mb-20 px-4">
            <ScrollFade>
                <div className="text-center mb-16">
                    <h2 className="text-5xl font-playfair font-bold text-[#f0e6d2] mb-4">{brand.name}</h2>
                    <p className="text-2xl text-white/70 font-playfair font-light">{tagline}</p>
                </div>
            </ScrollFade>
            
            <div className="flex flex-col items-center mb-8">
                {/* Watch cards - 3 watches in a grid */}
                <div className="grid grid-cols-3 gap-16 mb-8">
                    {loading ? (
                        // Loading placeholders
                        [1, 2, 3].map((i) => (
                            <div key={i} className="group block bg-black/20 backdrop-blur-md border border-white/10 rounded-xl p-6 transition-all duration-300">
                                <div className="w-full h-80 bg-black/30 rounded-lg mb-4 flex items-center justify-center">
                                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white/30"></div>
                                </div>
                                <div className="space-y-2">
                                    <div className="h-6 bg-white/10 rounded animate-pulse"></div>
                                    <div className="h-4 bg-white/5 rounded animate-pulse"></div>
                                    <div className="h-4 bg-white/10 rounded animate-pulse"></div>
                                </div>
                            </div>
                        ))
                    ) : (
                        // Actual watch cards or placeholders
                        Array.from({ length: 3 }, (_, index) => {
                            const watch = watches[index];
                            if (watch) {
                                return <WatchCard key={watch.id} watch={watch} />;
                            } else {
                                return renderPlaceholderCard(index);
                            }
                        })
                    )}
                </div>
                
                {/* Discovery button positioned below */}
                <div className="flex items-center">
                    <Link 
                        href={`/brands/${brand.id}`}
                        className="inline-flex items-center text-[#f0e6d2] hover:text-white transition-colors duration-500 text-2xl font-playfair font-medium hover:scale-105"
                    >
                        Explore More
                    </Link>
                </div>
            </div>
        </div>
    );
};

export default TrinityShowcase; 