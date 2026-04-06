'use client';

// Homepage discovery section — 4 archetype stages in alternating editorial layout.
// Text column anchored left/right per stage; watch arc on the opposing side.
// Each stage fires its own scroll-triggered performance: text ScrollFades, watches appear one by one.
import { useRef, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { motion, useInView } from 'framer-motion';
import { useQueries } from '@tanstack/react-query';
import { fetchWatchesByCollectionSlug, Watch } from '@/lib/api';
import { imageTransformations } from '@/lib/cloudinary';
import ScrollFade from '@/app/scrollMotion/ScrollFade';

// Page base color — used to blend the first and last stages into the surrounding warm-brown page
const PAGE_BASE = '#1e1512';

// Specific showcase hero watches to exclude (Nautilus 5811, Overseas blue ref, AP Concept)
const EXCLUDED_WATCH_IDS = new Set([2, 34, 59]);

// Spring-like expo-out ease for watch entrance
const EASE: [number, number, number, number] = [0.16, 1, 0.3, 1];

interface AnimConfig {
  stagger: number; // per-watch entrance stagger delay (seconds)
}

interface Archetype {
  label: string;
  subLabel: string;
  phrase: string;
  collectionSlugs: string[];
  gradient: string;
  accentColor: string;
  glowColor: string;
  animConfig: AnimConfig;
}

const ARCHETYPES: Archetype[] = [
  {
    label: 'The Complications',
    subLabel: 'Every mechanism a poem',
    phrase: 'Centuries of craft. One wrist.',
    collectionSlugs: [
      'patek-philippe-grand-complications',
      'audemars-piguet-royal-oak-concept',
      'a-lange-sohne-datograph',
    ],
    gradient: 'linear-gradient(180deg, #150d2e 0%, #150d2e 50%, #111738 100%)',
    accentColor: '#a68fd4',
    glowColor: 'rgba(139, 111, 190, 0.18)',
    animConfig: { stagger: 0.055 },
  },
  {
    label: 'Sport Watches',
    subLabel: 'Precision under pressure',
    phrase: 'Built for performance. Worn with conviction.',
    collectionSlugs: [
      'audemars-piguet-royal-oak',
      'vacheron-constantin-overseas',
      'patek-philippe-nautilus',
      'omega-speedmaster',
      'rolex-submariner',
    ],
    gradient: 'linear-gradient(180deg, #111738 0%, #0d2242 50%, #1e1f26 100%)',
    accentColor: '#6b9fd4',
    glowColor: 'rgba(74, 122, 181, 0.18)',
    animConfig: { stagger: 0.04 },
  },
  {
    label: 'Dress Watches',
    subLabel: 'Restraint as a statement',
    phrase: 'Nothing is more powerful than refinement.',
    collectionSlugs: [
      'patek-philippe-calatrava',
      'a-lange-sohne-lange-1',
      'jaeger-lecoultre-master-ultra-thin',
      'vacheron-constantin-patrimony',
      'alange-sohne-zeitwerk',
    ],
    gradient: 'linear-gradient(180deg, #1e1f26 0%, #2f1d0b 50%, #2d1805 100%)',
    accentColor: '#d4b47a',
    glowColor: 'rgba(200, 169, 110, 0.16)',
    animConfig: { stagger: 0.05 },
  },
  {
    label: "Métiers d'Arts",
    subLabel: 'Horology as canvas',
    phrase: 'Where the dial becomes a world.',
    collectionSlugs: [
      'vacheron-constantin-metiers-d-art',
      'breguet-reine-de-naples',
      'greubel-forsey-collection',
    ],
    gradient: 'linear-gradient(180deg, #2d1805 0%, #2b1300 50%, #2b1300 100%)',
    accentColor: '#d4924a',
    glowColor: 'rgba(200, 122, 48, 0.18)',
    animConfig: { stagger: 0.07 },
  },
];

function buildHref(slugs: string[]): string {
  const params = new URLSearchParams();
  slugs.forEach(s => params.append('collection', s));
  return `/watches?${params.toString()}`;
}

function getImageSrc(watch: Watch): string | null {
  if (watch.imageUrl) return watch.imageUrl;
  if (watch.image) return imageTransformations.detail(watch.image);
  return null;
}

function useArchetypeWatches(slugs: string[], perCollection = 6): Watch[] {
  const results = useQueries({
    queries: slugs.map(slug => ({
      queryKey: ['watches', 'collection-slug', slug],
      queryFn: () => fetchWatchesByCollectionSlug(slug),
      staleTime: 10 * 60 * 1000,
    })),
  });
  return results
    .flatMap(r => (r.data ?? []).slice(0, perCollection))
    .filter((w): w is Watch => w !== null && !EXCLUDED_WATCH_IDS.has(w.id));
}

// Horizontal arc of watches — flat by default, 3D fan on hover.
// Watches appear left-to-right one by one when the parent stage enters view.
function WatchRow({
  watches,
  isInView,
  delayBase,
  sizeClass,
  opacityRange,
  stagger,
}: {
  watches: Watch[];
  isInView: boolean;
  delayBase: number;
  sizeClass: string;
  opacityRange: [number, number];
  stagger: number;
}) {
  const center = (watches.length - 1) / 2;
  return (
    <div className="flex items-center justify-center gap-2 md:gap-3 lg:gap-5">
      {watches.map((watch, i) => {
        const src = getImageSrc(watch);
        if (!src) return null;
        const offset = i - center;
        const scale = 1 - Math.abs(offset) * 0.07;
        const wOpacity =
          opacityRange[0] +
          (1 - Math.abs(offset) / (center + 1)) * (opacityRange[1] - opacityRange[0]);

        return (
          <motion.div
            key={watch.id}
            initial={{ opacity: 0, y: 28 }}
            animate={isInView ? { opacity: wOpacity, y: 0 } : { opacity: 0, y: 28 }}
            transition={{ duration: 0.85, ease: EASE, delay: delayBase + i * stagger }}
            className="shrink-0"
          >
            <motion.div
              style={{ scale }}
              className={`relative ${sizeClass}`}
            >
              <Image
                src={src}
                alt={watch.description ?? 'watch'}
                fill
                sizes="(max-width: 768px) 100px, (max-width: 1024px) 130px, 160px"
                className="object-contain drop-shadow-[0_16px_40px_rgba(0,0,0,0.7)]"
              />
            </motion.div>
          </motion.div>
        );
      })}
    </div>
  );
}

function ArchetypeTile({ archetype, index }: { archetype: Archetype; index: number }) {
  const watches = useArchetypeWatches(archetype.collectionSlugs, 6);
  const displayWatches = watches.filter(w => getImageSrc(w)).slice(0, 6);
  const indexLabel = String(index + 1).padStart(2, '0');

  // Single scroll trigger per stage — fires the whole performance when the section enters view
  const sectionRef = useRef<HTMLElement>(null);
  const isInView = useInView(sectionRef, { once: false, amount: 0.2 });

  // Alternate: even index (0, 2) = text left; odd (1, 3) = text right
  const textLeft = index % 2 === 0;

  const textColumn = (
    <ScrollFade className={`flex flex-col justify-center py-20 px-4 md:px-0 z-10 ${textLeft ? 'md:-ml-8 lg:-ml-16 xl:-ml-20' : 'md:-mr-8 lg:-mr-16 xl:-mr-20'}`}>
      <div 
        className={`flex flex-col ${textLeft ? 'border-l-2 pl-6 lg:pl-8 items-start text-left' : 'border-r-2 pr-6 lg:pr-8 items-end text-right'}`} 
        style={{ borderColor: `${archetype.accentColor}35` }}
      >
        {/* Stage index */}
        <p
          className="text-[9px] tracking-[0.55em] uppercase font-inter mb-4"
          style={{ color: archetype.accentColor }}
        >
          {indexLabel}
        </p>

        {/* Category name */}
        <h3
          className="font-playfair font-light text-[#f0e6d2] leading-none mb-4"
          style={{ fontSize: 'clamp(2.6rem, 5.5vw, 5.5rem)' }}
        >
          {archetype.label}
        </h3>

        {/* Subtitle */}
        <p className="text-[10px] tracking-[0.38em] uppercase font-inter mb-5 text-white/60">
          {archetype.subLabel}
        </p>

        {/* Editorial phrase */}
        <p className="font-playfair font-light italic text-white/40 text-sm md:text-[15px] mb-10 max-w-[300px] leading-relaxed">
          {archetype.phrase}
        </p>

        {/* Explore CTA */}
        <Link
          href={buildHref(archetype.collectionSlugs)}
          className={`inline-flex items-center gap-3 text-[10px] tracking-[0.28em] uppercase font-inter text-white/60 border hover:text-[#f0e6d2] hover:border-opacity-80 px-6 py-3 transition-colors duration-300 ${textLeft ? '' : 'flex-row-reverse'}`}
          style={{ borderColor: `${archetype.accentColor}40` }}
        >
          Explore collection
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 8l4 4m0 0l-4 4m4-4H3" />
          </svg>
        </Link>
      </div>
    </ScrollFade>
  );

  const watchColumn = (
    <div className="flex items-center justify-center py-20">
      <WatchRow
        watches={displayWatches}
        isInView={isInView}
        delayBase={0.15}
        sizeClass="w-[clamp(100px,9vw,160px)] h-[clamp(128px,11.5vw,204px)]"
        opacityRange={[0.45, 0.72]}
        stagger={archetype.animConfig.stagger}
      />
    </div>
  );

  return (
    <section
      ref={sectionRef}
      className="relative min-h-[85vh] flex items-center overflow-hidden"
      style={{ background: archetype.gradient }}
    >
      {/* Centered radial glow matching the stage accent */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: `radial-gradient(ellipse 60% 45% at 50% 50%, ${archetype.glowColor} 0%, transparent 100%)`,
        }}
      />

      {/* Two-column editorial grid — mirrored pulling text toward its nearest edge symmetrically */}
      <div
        className={`relative z-20 w-full mx-auto grid grid-cols-1 gap-4 max-w-[1600px] px-8 sm:px-12 md:px-16 lg:px-24 xl:px-32 ${
          textLeft ? 'md:grid-cols-[3fr_5fr]' : 'md:grid-cols-[5fr_3fr]'
        }`}
      >
        {textLeft ? (
          <>
            {textColumn}
            {watchColumn}
          </>
        ) : (
          <>
            {watchColumn}
            {textColumn}
          </>
        )}
      </div>
    </section>
  );
}

export default function StyleArchetypeGrid() {
  return (
    <section 
      className="w-full relative"
      style={{
        maskImage: 'linear-gradient(180deg, transparent 0px, black 300px, black calc(100% - 300px), transparent 100%)',
        WebkitMaskImage: 'linear-gradient(180deg, transparent 0px, black 300px, black calc(100% - 300px), transparent 100%)'
      }}
    >
      {ARCHETYPES.map((archetype, index) => (
        <ArchetypeTile key={archetype.label} archetype={archetype} index={index} />
      ))}
    </section>
  );
}
