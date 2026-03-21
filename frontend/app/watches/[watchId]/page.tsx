// the detailed product page for a single watch.
// fetches watch data based on the dynamic ID from the URL and presents it in a two-column layout
// with an image, description, specifications, and purchasing options.

'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { fetchWatchById, fetchBrands, fetchCollections } from '@/lib/api';
import { imageTransformations } from '@/lib/cloudinary';
import { useNavigation } from '@/contexts/NavigationContext';
import { parseStructuredSpecs, parseFlatSpecs, buildSpecSections } from '@/lib/specs';
import CompareToggle from '../../components/compare/CompareToggle';
import WristFitWidget from '../../components/wristfit/WristFitWidget';
import Image from 'next/image';



const WatchDetailPage = () => {
    const params = useParams();
    const router = useRouter();
    const searchParams = useSearchParams();
    const watchId = params.watchId as string;
    const numericWatchId = watchId ? parseInt(watchId, 10) : NaN;

    const [imageError, setImageError] = useState(false);
    const [imageLoading, setImageLoading] = useState(true);
    const [imgSrc, setImgSrc] = useState<string | null>(null);
    const [retryCount, setRetryCount] = useState<number>(0);

    const { navigationState } = useNavigation();

    const { data: watch, isLoading, error } = useQuery({
        queryKey: ['watch', numericWatchId],
        queryFn: () => fetchWatchById(numericWatchId),
        enabled: !isNaN(numericWatchId),
    });

    const { data: brands = [] } = useQuery({
        queryKey: ['brands'],
        queryFn: fetchBrands,
    });

    const { data: collections = [] } = useQuery({
        queryKey: ['collections'],
        queryFn: fetchCollections,
    });

    // Sync image source when watch data arrives (or changes)
    useEffect(() => {
        if (watch?.imageUrl) setImgSrc(watch.imageUrl);
    }, [watch?.imageUrl]);

    // Handle back navigation with position restoration
    const handleBackClick = () => {
        if (navigationState) {
            // Brief fade-out makes the departure feel intentional rather than abrupt.
            // Navigate after the fade so the listing page renders while invisible.
            document.body.style.transition = 'opacity 0.18s ease-in';
            document.body.style.opacity = '0';
            // Safety: always restore visibility after 2 s in case restoration fails
            setTimeout(() => {
                document.body.style.transition = 'opacity 0.65s cubic-bezier(0.16, 1, 0.3, 1)';
                document.body.style.opacity = '1';
            }, 2000);
            // Use router.back() so we unwind the real history entry instead of
            // pushing a new one — prevents history pollution when the originating
            // page is /compare, /brands, /collections, etc.
            setTimeout(() => {
                router.back();
            }, 160);
        } else {
            router.push('/watches');
        }
    };

    const handleImageError = () => {
        // One-time retry with explicit JPG and cache-busting to mitigate transient failures
        if (watch && retryCount < 1) {
            setRetryCount(1);
            const fallback = (watch.imageUrl || imageTransformations.detail(watch.image)) + `?r=${Date.now()}`;
            setImgSrc(fallback.replace('/f_auto', '/f_jpg'));
            return;
        }
        setImageError(true);
        setImageLoading(false);
    };

    const handleImageLoad = () => {
        setImageLoading(false);
    };

    if (isNaN(numericWatchId)) {
        return (
            <div className="flex justify-center items-center min-h-screen">
                <div className="text-center">
                    <h2 className="text-2xl font-playfair font-bold text-red-400 mb-2">Invalid Watch</h2>
                    <p className="text-white/60">The watch ID in the URL is not valid.</p>
                </div>
            </div>
        );
    }

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
                    <p className="text-white/60">Failed to fetch watch details. Please try again later.</p>
                </div>
            </div>
        );
    }

    if (isLoading || !watch) {
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
        <div className="container mx-auto px-4 sm:px-8 py-8 pt-28 pb-28 text-white">
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
                        <div className="aspect-square bg-white/5 flex items-center justify-center rounded-lg relative overflow-hidden">
                            {watch.image && !imageError ? (
                                <>
                                    {imageLoading && (
                                        <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                                            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white/30"></div>
                                        </div>
                                    )}
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

                    <WristFitWidget
                        caseSpecs={structuredSpecs?.case as Record<string, unknown> | undefined}
                        initialValue={searchParams.get('wristFit') ?? undefined}
                    />
                </div>
            </div>

            {/* Story-first editorial sections — pre-generated, served from DB */}
            {watch.editorialContent && (
                <div className="mt-20 border-t border-white/10 pt-14 max-w-3xl">
                    <h2 className="text-3xl font-playfair font-semibold text-[#f0e6d2] mb-12">The Story</h2>
                    <div className="space-y-10">
                        <div>
                            <h3 className="text-xs font-semibold uppercase tracking-widest text-white/40 mb-3">Why This Watch Matters</h3>
                            <p className="text-white/80 leading-relaxed font-inter">{watch.editorialContent.whyItMatters}</p>
                        </div>
                        <div>
                            <h3 className="text-xs font-semibold uppercase tracking-widest text-white/40 mb-3">Collector Appeal</h3>
                            <p className="text-white/80 leading-relaxed font-inter">{watch.editorialContent.collectorAppeal}</p>
                        </div>
                        <div>
                            <h3 className="text-xs font-semibold uppercase tracking-widest text-white/40 mb-3">Design Language</h3>
                            <p className="text-white/80 leading-relaxed font-inter">{watch.editorialContent.designLanguage}</p>
                        </div>
                        <div>
                            <h3 className="text-xs font-semibold uppercase tracking-widest text-white/40 mb-3">Best For</h3>
                            <p className="text-white/80 leading-relaxed font-inter">{watch.editorialContent.bestFor}</p>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default WatchDetailPage;
