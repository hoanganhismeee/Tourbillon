'use client';

import React, { useRef } from 'react';
import Link from 'next/link';
import { useQuery, useQueries } from '@tanstack/react-query';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { useGSAP } from '@gsap/react';
import { Brand, Watch, fetchWatchBySlug, fetchWatchesByBrand } from '@/lib/api';
import WatchCard from '../../watches/[slug]/WatchCard';
import ScrollFade from '../../scrollMotion/ScrollFade';
import WatchCardSkeleton from '../cards/WatchCardSkeleton';

gsap.registerPlugin(ScrollTrigger);

interface TrinityShowcaseProps {
    brand: Brand;
}

// Hardcoded watch slugs for the three Holy Trinity brands
const TRINITY_WATCH_SLUGS: Record<number, string[]> = {
    1: [
        'patek-philippe-calatrava-5227g-010-automatic-date',
        'patek-philippe-nautilus-5811-1g-blue-dial',
        'patek-philippe-grand-complications-5303r-minute-repeater-tourbillon',
    ],
    2: [
        'vacheron-constantin-patrimony-43175-000r-9687-perpetual-calendar',
        'vacheron-constantin-overseas-6000v-210t-h032-overseas-tourbillon',
        'vacheron-constantin-metiers-d-art-6007a-000g-h049-tribute-to-the-celestial-scorpio',
    ],
    3: [
        'audemars-piguet-royal-oak-16202st-oo-1240st-02-jumbo-extra-thin',
        'audemars-piguet-royal-oak-26585xt-oo-1220xt-01-perpetual-calendar-150th-anniversary',
        'audemars-piguet-royal-oak-concept-26620io-oo-d077ca-01-black-panther-flying-tourbillon',
    ],
};

const TrinityShowcase = ({ brand }: TrinityShowcaseProps) => {
    const gridRef = useRef<HTMLDivElement>(null);
    const isSpecificBrand = brand.id in TRINITY_WATCH_SLUGS;
    const specificSlugs = TRINITY_WATCH_SLUGS[brand.id] ?? [];

    // For trinity brands: fetch the 3 hardcoded watch slugs individually (cached per watch)
    const specificResults = useQueries({
        queries: specificSlugs.map(slug => ({
            queryKey: ['watch', 'slug', slug] as const,
            queryFn: () => fetchWatchBySlug(slug),
            enabled: isSpecificBrand,
        })),
    });

    // For other brands: fetch all watches and take the first 3
    const { data: brandWatchesData = [] } = useQuery({
        queryKey: ['watches', 'brand', brand.id],
        queryFn: () => fetchWatchesByBrand(brand.id),
        enabled: !isSpecificBrand,
    });

    const isLoading = isSpecificBrand
        ? specificResults.some(r => r.isLoading)
        : false;

    const watches: Watch[] = isSpecificBrand
        ? specificResults.flatMap(r => (r.data ? [r.data] : []))
        : brandWatchesData.slice(0, 3);

    // Parallax depth: left card slowest (0.8x), center normal (1x), right fastest (1.2x)
    useGSAP(() => {
        if (!gridRef.current) return;
        const cards = gridRef.current.querySelectorAll<HTMLElement>(':scope > *');
        if (cards.length < 3) return;

        const speeds = [0.8, 1.0, 1.2];
        cards.forEach((card, i) => {
            const offset = (1 - speeds[i]) * 60; // max 60px offset range
            gsap.to(card, {
                y: offset,
                ease: 'none',
                scrollTrigger: {
                    trigger: gridRef.current,
                    start: 'top bottom',
                    end: 'bottom top',
                    scrub: true,
                },
            });
        });
    }, { scope: gridRef, dependencies: [watches.length] });

    // Placeholder card shown when a watch slot has no data yet
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
                <p className="text-sm text-white/80 font-medium">Price on request</p>
            </div>
        </div>
    );

    return (
        <div className="mb-20 px-4">
            <ScrollFade>
                <div className="text-center mb-16">
                    <h2 className="text-3xl md:text-5xl font-playfair font-bold text-[#f0e6d2] mb-4">{brand.name}</h2>
                    <p className="text-xl md:text-2xl text-white/70 font-playfair font-light">{brand.summary}</p>
                </div>
            </ScrollFade>

            <div className="flex flex-col items-center mb-8">
                <div ref={gridRef} className="grid grid-cols-1 gap-8 md:grid-cols-3 md:gap-16 mb-8">
                    {isLoading ? (
                        [1, 2, 3].map((i) => (
                            <WatchCardSkeleton key={i} />
                        ))
                    ) : (
                        Array.from({ length: 3 }, (_, index) => {
                            const watch = watches[index];
                            if (watch) {
                                return <WatchCard key={watch.id} watch={watch} imageFit="cover" />;
                            } else {
                                return renderPlaceholderCard(index);
                            }
                        })
                    )}
                </div>

                <div className="flex items-center">
                    <Link
                        href={`/brands/${brand.slug}`}
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
