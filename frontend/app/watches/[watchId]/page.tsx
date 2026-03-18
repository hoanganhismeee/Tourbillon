// the detailed product page for a single watch.
// fetches watch data based on the dynamic ID from the URL and presents it in a two-column layout
// with an image, description, specifications, and purchasing options.

'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Watch, Brand, Collection, fetchWatchById, fetchBrands, fetchCollections } from '@/lib/api';
import { imageTransformations } from '@/lib/cloudinary';
import { useNavigation } from '@/contexts/NavigationContext';
import { useWatchesPage } from '@/contexts/WatchesPageContext';
import { parseStructuredSpecs, parseFlatSpecs, buildSpecSections } from '@/lib/specs';
import CompareToggle from '../../components/compare/CompareToggle';
import Image from 'next/image';



const WatchDetailPage = () => {
    const params = useParams();
    const router = useRouter();
    const watchId = params.watchId as string;
    const [watch, setWatch] = useState<Watch | null>(null);
    const [brands, setBrands] = useState<Brand[]>([]);
    const [collections, setCollections] = useState<Collection[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [imageError, setImageError] = useState(false);
    const [imageLoading, setImageLoading] = useState(true);
    const [imgSrc, setImgSrc] = useState<string | null>(null);
    const [retryCount, setRetryCount] = useState<number>(0);

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
                    const numericWatchId = parseInt(watchId, 10);
                    if (isNaN(numericWatchId)) {
                        setError('Invalid watch ID.');
                        return;
                    }
                    // Fetch watch, brands, and collections in parallel
                    const [data, brandsData, collectionsData] = await Promise.all([
                        fetchWatchById(numericWatchId),
                        fetchBrands(),
                        fetchCollections()
                    ]);
                    setWatch(data);
                    setBrands(brandsData || []);
                    setCollections(collectionsData || []);
                    if (data?.imageUrl) {
                        setImgSrc(data.imageUrl);
                    }
                } catch (err) {
                    setError('Failed to fetch watch details. Please try again later.');
                    console.error(err);
                }
            };
            getWatchDetails();
        }
    }, [watchId]);

    const handleImageError = () => {
        // One-time retry with explicit JPG and cache-busting to mitigate transient failures
        if (watch && retryCount < 1) {
            setRetryCount(1);
            const fallback = (watch.imageUrl || imageTransformations.detail(watch.image)) + `?r=${Date.now()}`;
            setImgSrc(fallback.replace('/f_auto', '/f_jpg')); // coarse switch to JPG if URL contains f_auto
            return;
        }
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

    const structuredSpecs = parseStructuredSpecs(watch.specs);
    const flatSpecRows = structuredSpecs ? null : parseFlatSpecs(watch.specs);
    const specSections = structuredSpecs ? buildSpecSections(structuredSpecs) : [];

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
                                    <Image
                                      src={imgSrc || watch.imageUrl || imageTransformations.detail(watch.image)}
                                      alt={watch.name}
                                      width={1200}
                                      height={1200}
                                      sizes="(min-width: 1024px) 600px, 90vw"
                                      className={`w-full h-full object-cover rounded-lg transition-opacity duration-300 ${imageLoading ? 'opacity-0' : 'opacity-100'}`}
                                      onError={handleImageError}
                                      onLoad={handleImageLoad}
                                      priority
                                      fetchPriority="high"
                                      unoptimized
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
                    {/* Brand and Collection breadcrumb */}
                    {(brands.length > 0 || collections.length > 0) && (
                        <div className="flex items-center gap-2 mb-3 text-sm">
                            {brands.find(b => b.id === watch.brandId) && (
                                <Link href={`/brands/${watch.brandId}`} className="text-white/50 hover:text-white/80 transition-colors font-inter">
                                    {brands.find(b => b.id === watch.brandId)?.name}
                                </Link>
                            )}
                            {watch.collectionId && collections.find(c => c.id === watch.collectionId) && (
                                <>
                                    <span className="text-white/30">·</span>
                                    <Link href={`/collections/${watch.collectionId}`} className="text-white/50 hover:text-white/80 transition-colors font-inter">
                                        {collections.find(c => c.id === watch.collectionId)?.name}
                                    </Link>
                                </>
                            )}
                        </div>
                    )}

                    <h1 className="text-4xl lg:text-5xl font-playfair font-bold text-[#f0e6d2] mb-2">
                        {watch.name || 'Unnamed Watch'}
                    </h1>
                    <p className="text-lg text-white/60 mb-8">
                        {watch.description || 'No description available.'}
                    </p>

                    <div className="mb-8">
                        <span className="text-7xl font-bold text-white">
                            {watch.currentPrice > 0 ? `$${watch.currentPrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : 'Price on request'}
                        </span>
                        <p className="text-sm text-white/50 mt-1">Price subject to market changes</p>
                        {/* Production status badge */}
                        {structuredSpecs?.productionStatus && (
                            <span className={`inline-block mt-2 px-3 py-1 text-xs font-medium rounded-full border ${
                                structuredSpecs.productionStatus === 'Discontinued'
                                    ? 'text-white/40 border-white/15 bg-white/5'
                                    : 'text-[#f0e6d2]/70 border-[#f0e6d2]/20 bg-[#f0e6d2]/5'
                            }`}>
                                {structuredSpecs.productionStatus}
                            </span>
                        )}
                    </div>

                    <div className="flex items-center gap-4 mb-10">
                        <button className="py-4 px-8 rounded-xl font-semibold bg-white/10 text-white hover:bg-white/20 transition">
                            Contact Advisor
                        </button>
                        <CompareToggle watch={watch} variant="button" />
                    </div>

                    {/* Specifications - Structured Format */}
                    {specSections.length > 0 && (
                        <div>
                            <h2 className="text-2xl font-playfair font-semibold border-b border-white/10 pb-3 mb-6">Specifications</h2>
                            <div className="space-y-6">
                                {specSections.map((section) => (
                                    <div key={section.title}>
                                        <h3 className="text-sm font-semibold uppercase tracking-widest text-white/40 mb-3">{section.title}</h3>
                                        <table className="w-full text-left">
                                            <tbody>
                                                {section.rows.map((row) => (
                                                    <tr key={row.label} className="border-b border-white/5">
                                                        <td className="py-2.5 pr-6 text-white/50 text-sm w-2/5">{row.label}</td>
                                                        <td className="py-2.5 text-white/90 font-medium text-sm">{row.value}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Specifications - Legacy Flat Format */}
                    {flatSpecRows && flatSpecRows.length > 0 && (
                        <div>
                            <h2 className="text-2xl font-playfair font-semibold border-b border-white/10 pb-3 mb-4">Specifications</h2>
                            <table className="w-full text-left">
                                <tbody>
                                    {flatSpecRows.map((spec) => (
                                        <tr key={spec.label} className="border-b border-white/5">
                                            <td className="py-2.5 pr-6 text-white/50 text-sm w-2/5">{spec.label}</td>
                                            <td className="py-2.5 text-white/90 font-medium text-sm">{spec.value}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default WatchDetailPage;
