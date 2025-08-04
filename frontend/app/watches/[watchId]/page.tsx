// the detailed product page for a single watch.
// fetches watch data based on the dynamic ID from the URL and presents it in a two-column layout
// with an image, description, specifications, and purchasing options.

'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Watch, fetchWatchById } from '@/lib/api';
import { imageTransformations } from '@/lib/cloudinary';
import { useNavigation } from '@/contexts/NavigationContext';
import { useWatchesPage } from '@/contexts/WatchesPageContext';


const WatchDetailPage = () => {
    const params = useParams();
    const router = useRouter();
    const watchId = params.watchId as string;
    const [watch, setWatch] = useState<Watch | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [imageError, setImageError] = useState(false);
    const [imageLoading, setImageLoading] = useState(true);
    
    // Get navigation context for back functionality
    const { navigationState, clearNavigationState } = useNavigation();
    // Get setCurrentPage from watches page context
    const { setCurrentPage } = useWatchesPage();

    // Handle back navigation with position restoration
    const handleBackClick = () => {
        if (navigationState) {
            // Navigate back to the saved path
            router.push(navigationState.path);
            
            // Use setTimeout to ensure navigation completes before restoring state
            setTimeout(() => {
                // Restore the page number
                setCurrentPage(navigationState.currentPage);
                
                // Restore scroll position
                window.scrollTo(0, navigationState.scrollPosition);
                
                // Clear the navigation state after successful restoration
                clearNavigationState();
            }, 100);
        } else {
            // Fallback: go back to watches page
            router.push('/watches');
        }
    };

    useEffect(() => {
        if (watchId) {
            const getWatchDetails = async () => {
                try {
                    // Convert the watchId from string to number before fetching
                    const numericWatchId = parseInt(watchId, 10);
                    if (isNaN(numericWatchId)) {
                        setError('Invalid watch ID.');
                        return;
                    }
                    const data = await fetchWatchById(numericWatchId);
                    setWatch(data);
                } catch (err) {
                    setError('Failed to fetch watch details. Please try again later.');
                    console.error(err);
                }
            };
            getWatchDetails();
        }
    }, [watchId]);

    const handleImageError = () => {
        setImageError(true);
        setImageLoading(false);
    };

    const handleImageLoad = () => {
        setImageLoading(false);
    };

    if (error) {
        return (
            <div className="flex justify-center items-center min-h-screen">
                <div className="text-center">
                    <div className="w-24 h-24 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
                        <svg className="w-12 h-12 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                        </svg>
                    </div>
                    <h2 className="text-2xl font-playfair font-bold text-red-400 mb-2">Error Loading Watch</h2>
                    <p className="text-white/60">{error}</p>
                </div>
            </div>
        );
    }

    if (!watch) {
        return (
            <div className="flex justify-center items-center min-h-screen">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-white/30 mx-auto mb-6"></div>
                    <p className="text-white/80 text-lg">Loading watch details...</p>
                </div>
            </div>
        );
    }

    // Parse specs from the database if available, otherwise use fallback specs
    const parseSpecifications = (specsString: string | null) => {
        if (!specsString) {
            // Fallback specs if no specs data is available
            return [
                { name: 'No watch specs available', value: 'No watch specs available' }
            ];
        }

        try {
            // Try to parse specs as JSON first
            const specs = JSON.parse(specsString);
            if (Array.isArray(specs)) {
                return specs.map(spec => ({
                    name: spec.name || spec.key || 'Specification',
                    value: spec.value || spec.val || 'N/A'
                }));
            }
        } catch {
            // If JSON parsing fails, try to parse as semicolon-separated key-value pairs
            const specs = specsString.split(';').map(spec => spec.trim()).filter(spec => spec);
            return specs.map(spec => {
                const colonIndex = spec.indexOf(':');
                if (colonIndex > 0) {
                    const name = spec.substring(0, colonIndex).trim();
                    const value = spec.substring(colonIndex + 1).trim();
                    return {
                        name: name || 'Specification',
                        value: value || spec
                    };
                } else {
                    return {
                        name: 'Specification',
                        value: spec
                    };
                }
            });
        }

        // If all parsing fails, return as single spec
        return [
            { name: 'Specifications', value: specsString }
        ];
    };

    const specifications = parseSpecifications(watch.specs);

    return (
        <div className="container mx-auto px-4 sm:px-8 py-24 pt-48 text-white">
            {/* Back Navigation Button */}
            <div className="mb-8">
                <button
                    onClick={handleBackClick}
                    className="inline-flex items-center text-white/60 hover:text-white transition-colors duration-300 text-lg font-playfair font-medium"
                >
                    <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                    Back
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-12 lg:gap-24">
                {/* Left Column: Watch Image */}
                <div className="flex justify-center items-start">
                    <div className="sticky top-32 w-full max-w-md bg-black/20 p-8 rounded-xl border border-white/10">
                        {/* Watch Image with Error Handling */}
                        <div className="aspect-square bg-white/5 flex items-center justify-center rounded-lg relative overflow-hidden">
                            {watch.image && !imageError ? (
                                <>
                                    {/* Loading state */}
                                    {imageLoading && (
                                        <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                                            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white/30"></div>
                                        </div>
                                    )}
                                    
                                                                        {/* Actual image with Cloudinary optimization */}
                                                                         <img 
                                       src={imageTransformations.detail(watch.image)}
                                       alt={watch.name} 
                                       className={`w-full h-full object-cover rounded-lg transition-opacity duration-300 ${imageLoading ? 'opacity-0' : 'opacity-100'}`}
                                       onError={handleImageError}
                                       onLoad={handleImageLoad}
                                     />
                                </>
                            ) : (
                                /* Fallback when no image or image failed to load */
                                <div className="flex flex-col items-center justify-center text-center p-8">
                                    <div className="w-20 h-20 bg-white/10 rounded-full flex items-center justify-center mb-4">
                                        <svg className="w-10 h-10 text-white/30" fill="none" stroke="currentColor" viewBox="0 0 24 24">                                        </svg>
                                    </div>
                                    <span className="text-white/40 text-lg font-medium">{watch.name}</span>
                                    <span className="text-white/20 text-sm mt-2">Image unavailable</span>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Right Column: Details & Actions */}
                <div className="pt-8">
                    <h1 className="text-4xl lg:text-5xl font-playfair font-bold text-[#f0e6d2] mb-4">
                        {watch.name || 'Unnamed Watch'}
                    </h1>
                    <p className="text-lg text-white/70 mb-8">
                        {watch.description || 'No description available.'}
                    </p>

                    <div className="mb-8">
                        <span className="text-7xl font-bold text-white">
                            {watch.currentPrice > 0 ? `$${watch.currentPrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : 'Price on request'}
                        </span>
                        <p className="text-sm text-white/50 mt-1">Price subject to market changes</p>
                    </div>

                    <div className="flex items-center gap-4 mb-10">
                        <button className="py-4 px-8 rounded-xl font-semibold bg-white/10 text-white hover:bg-white/20 transition">
                            Contact Advisor
                        </button>
                    </div>

                    {/* Specifications */}
                    <div>
                        <h2 className="text-2xl font-playfair font-semibold border-b border-white/10 pb-3 mb-4">Specifications</h2>
                        <table className="w-full text-left">
                            <tbody>
                                {specifications.map((spec) => (
                                    <tr key={spec.name} className="border-b border-white/5">
                                        <td className="py-3 pr-4 text-white/60">{spec.name}</td>
                                        <td className="py-3 text-white/90 font-medium">{spec.value}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default WatchDetailPage; 