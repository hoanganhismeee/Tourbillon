'use client';

// Homepage discovery section — 4 archetype stages in alternating editorial layout.
// Text column anchored left/right per stage; watch arc on the opposing side.
// ScrollFade drives all entrance animations — section text fades as a block, watches pop in one by one.
import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { motion } from 'framer-motion';
import { useQueries } from '@tanstack/react-query';
import { fetchWatchesByCollectionSlug, Watch } from '@/lib/api';
import { imageTransformations } from '@/lib/cloudinary';
import ScrollFade from '@/app/scrollMotion/ScrollFade';

// Page base color — used to blend the first and last stages into the surrounding warm-brown page
const PAGE_BASE = '#1e1512';

// Specific showcase hero watches to exclude (Nautilus 5811, Overseas blue ref, AP Concept)
const EXCLUDED_WATCH_IDS = new Set([2, 34, 59]);

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
    gradient: 'linear-gradient(160deg, #07050f 0%, #110a26 50%, #19103e 100%)',
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
    gradient: 'linear-gradient(160deg, #050d1a 0%, #0a1f3d 50%, #0e2a52 100%)',
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
    gradient: 'linear-gradient(160deg, #1a1008 0%, #2e200d 50%, #3d2a12 100%)',
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
    gradient: 'linear-gradient(160deg, #130800 0%, #221100 50%, #321900 100%)',
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
// Each watch ScrollFades in with a staggered delay for the one-by-one pop effect.
function WatchRow({
  watches,
  sizeClass,
  opacityRange,
  stagger,
  isHovered,
}: {
  watches: Watch[];
  sizeClass: string;
  opacityRange: [number, number];
  stagger: number;
  isHovered: boolean;
}) {
  const center = (watches.length - 1) / 2;
  return (
    <div className="flex items-center justify-center gap-2 md:gap-3 lg:gap-4">
      {watches.map((watch, i) => {
        const src = getImageSrc(watch);
        if (!src) return null;
        const offset = i - center;
        const hoverRotateY = offset * 8;
        const scale = 1 - Math.abs(offset) * 0.07;
        const wOpacity =
          opacityRange[0] +
          (1 - Math.abs(offset) / (center + 1)) * (opacityRange[1] - opacityRange[0]);

        return (
          // ScrollFade drives entrance: opacity 0→1, y 50→0, staggered per watch
          <ScrollFade key={watch.id} delay={0.08 + i * stagger} triggerOnce className="shrink-0">
            {/* Inner motion.div: persistent arc opacity/scale + 3D hover fan */}
            <motion.div
              animate={{ rotateY: isHovered ? hoverRotateY : 0 }}
              transition={{ duration: 0.35, ease: 'easeOut' }}
              style={{ scale, opacity: wOpacity }}
              className={`relative ${sizeClass}`}
            >
              <Image
                src={src}
                alt={watch.description ?? 'watch'}
                fill
                sizes="(max-width: 768px) 72px, (max-width: 1024px) 88px, 100px"
                className="object-contain drop-shadow-[0_16px_40px_rgba(0,0,0,0.7)]"
              />
            </motion.div>
          </ScrollFade>
        );
      })}
    </div>
  );
}

function ArchetypeTile({ archetype, index }: { archetype: Archetype; index: number }) {
  const watches = useArchetypeWatches(archetype.collectionSlugs, 6);
  const displayWatches = watches.filter(w => getImageSrc(w)).slice(0, 6);
  const indexLabel = String(index + 1).padStart(2, '0');
  const [isHovered, setIsHovered] = useState(false);

  const isFirst = index === 0;
  const isLast = index === ARCHETYPES.length - 1;

  // Alternate: even index (0, 2) = text left; odd (1, 3) = text right
  const textLeft = index % 2 === 0;

  // Outer edges blend into the page warm-brown; inner edges use near-black for clean stage separation
  const topColor = isFirst ? PAGE_BASE : '#030303';
  const bottomColor = isLast ? PAGE_BASE : '#030303';
  const topH = isFirst ? 'h-[45vh]' : 'h-[28vh]';
  const bottomH = isLast ? 'h-[45vh]' : 'h-[28vh]';

  // Asymmetric padding: text side pulled toward the viewport edge for a more editorial feel
  const containerPadding = textLeft
    ? 'pl-3 sm:pl-5 lg:pl-8 xl:pl-12 pr-8 sm:pr-12 lg:pr-16 xl:pr-20'
    : 'pl-8 sm:pl-12 lg:pl-16 xl:pl-20 pr-3 sm:pr-5 lg:pr-8 xl:pr-12';

  const textColumn = (
    <ScrollFade className="flex flex-col justify-center py-20 px-4 md:px-0" triggerOnce>
      <div className="border-l-2 pl-8" style={{ borderColor: `${archetype.accentColor}35` }}>
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
          className="inline-flex items-center gap-3 text-[10px] tracking-[0.28em] uppercase font-inter text-white/60 border hover:text-[#f0e6d2] hover:border-opacity-80 px-6 py-3 transition-colors duration-300"
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

  // Watch column: no wrapper animation — per-watch ScrollFade creates the one-by-one stagger
  const watchColumn = (
    <div
      className="flex items-center justify-center py-20"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <WatchRow
        watches={displayWatches}
        sizeClass="w-[clamp(68px,6vw,98px)] h-[clamp(87px,7.7vw,125px)]"
        opacityRange={[0.45, 0.72]}
        stagger={archetype.animConfig.stagger}
        isHovered={isHovered}
      />
    </div>
  );

  return (
    <section
      className="relative min-h-[85vh] flex items-center overflow-hidden"
      style={{ background: archetype.gradient }}
    >
      {/* Centered radial glow matching the stage accent */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: `radial-gradient(ellipse 55% 60% at 50% 50%, ${archetype.glowColor} 0%, transparent 65%)`,
        }}
      />

      {/* Top blend — first stage dissolves from page warm-brown; others from near-black */}
      <div
        className={`absolute top-0 left-0 right-0 ${topH} pointer-events-none z-10`}
        style={{ background: `linear-gradient(to bottom, ${topColor}, transparent)` }}
      />

      {/* Bottom blend — last stage dissolves back to page warm-brown; others to near-black */}
      <div
        className={`absolute bottom-0 left-0 right-0 ${bottomH} pointer-events-none z-10`}
        style={{ background: `linear-gradient(to top, ${bottomColor}, transparent)` }}
      />

      {/* Two-column editorial grid — asymmetric padding pulls text toward its nearest edge */}
      <div
        className={`container mx-auto relative z-20 w-full grid grid-cols-1 gap-4 max-w-7xl ${containerPadding} ${
          textLeft ? 'md:grid-cols-[2fr_3fr]' : 'md:grid-cols-[3fr_2fr]'
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
    <section className="w-full">
      {ARCHETYPES.map((archetype, index) => (
        <ArchetypeTile key={archetype.label} archetype={archetype} index={index} />
      ))}
    </section>
  );
}
