'use client';

// Homepage discovery section — 4 archetype tiles, each a full-width horizontal row.
// Left panel: index number, subLabel, archetype label, hover CTA.
// Right panel: horizontal watch strip loaded from collection slugs.
import Link from 'next/link';
import Image from 'next/image';
import { useQueries } from '@tanstack/react-query';
import { fetchWatchesByCollectionSlug, Watch } from '@/lib/api';
import { imageTransformations } from '@/lib/cloudinary';
import ScrollFade from '@/app/scrollMotion/ScrollFade';

interface Archetype {
  label: string;
  subLabel: string;
  collectionSlugs: string[];
}

const ARCHETYPES: Archetype[] = [
  {
    label: 'The Sport Watch',
    subLabel: 'Precision under pressure',
    collectionSlugs: [
      'audemars-piguet-royal-oak',
      'vacheron-constantin-overseas',
      'patek-philippe-nautilus',
      'omega-speedmaster',
      'rolex-submariner',
    ],
  },
  {
    label: 'The Dress Watch',
    subLabel: 'Restraint as a statement',
    collectionSlugs: [
      'patek-philippe-calatrava',
      'a-lange-sohne-lange-1',
      'jaeger-lecoultre-master-ultra-thin',
      'vacheron-constantin-patrimony',
    ],
  },
  {
    label: 'The Complication',
    subLabel: 'Every mechanism a poem',
    collectionSlugs: [
      'patek-philippe-grand-complications',
      'audemars-piguet-royal-oak-concept',
      'a-lange-sohne-datograph',
    ],
  },
  {
    label: "Métiers d'Art",
    subLabel: 'Horology as canvas',
    collectionSlugs: [
      'vacheron-constantin-metiers-d-art',
      'breguet-reine-de-naples',
      'greubel-forsey-collection',
    ],
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

// Loads first watch from each collection slug in a single parallel query batch
function useArchetypeWatches(slugs: string[]): Watch[] {
  const results = useQueries({
    queries: slugs.map(slug => ({
      queryKey: ['watches', 'collection-slug', slug],
      queryFn: () => fetchWatchesByCollectionSlug(slug),
      staleTime: 10 * 60 * 1000,
    })),
  });
  return results
    .map(r => r.data?.[0] ?? null)
    .filter((w): w is Watch => w !== null);
}

function ArchetypeTile({ archetype, index }: { archetype: Archetype; index: number }) {
  const watches = useArchetypeWatches(archetype.collectionSlugs);
  const displayWatches = watches.filter(w => getImageSrc(w)).slice(0, 6);
  const indexLabel = String(index + 1).padStart(2, '0');

  return (
    <Link
      href={buildHref(archetype.collectionSlugs)}
      className="group relative flex overflow-hidden h-[300px] bg-[#0d0b09] border-b border-[#1a1714]"
    >
      {/* Left: text panel */}
      <div className="relative z-10 flex flex-col justify-center shrink-0 w-[38%] px-10 md:px-14 lg:px-16">
        <p className="text-[9px] tracking-[0.35em] uppercase text-[#bfa68a]/50 mb-1 font-inter">
          {indexLabel}
        </p>
        <p className="text-[10px] tracking-[0.25em] uppercase text-[#bfa68a] mb-3 font-inter">
          {archetype.subLabel}
        </p>
        <h3 className="font-playfair font-light text-[#f0e6d2] text-2xl md:text-3xl lg:text-4xl leading-tight mb-6">
          {archetype.label}
        </h3>
        <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-500">
          <span className="text-[10px] tracking-[0.2em] uppercase text-[#bfa68a]/80 font-inter">Explore</span>
          <svg className="w-3 h-3 text-[#bfa68a]/80" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 8l4 4m0 0l-4 4m4-4H3" />
          </svg>
        </div>
      </div>

      {/* Vertical divider */}
      <div className="w-px bg-[#1a1714] shrink-0 self-stretch" />

      {/* Right: watch strip */}
      <div className="relative flex-1 flex items-center overflow-hidden">
        {displayWatches.length > 0 && (
          <div className="flex items-center gap-3 px-10 h-[65%] w-full">
            {displayWatches.map((watch, i) => {
              const src = getImageSrc(watch);
              if (!src) return null;
              return (
                <div key={i} className="relative flex-1 h-full min-w-0">
                  <Image
                    src={src}
                    alt={archetype.label}
                    fill
                    sizes="(max-width: 640px) 12vw, (max-width: 1024px) 9vw, 7vw"
                    className="object-contain opacity-[0.65] transition-all duration-700 group-hover:opacity-[0.85] group-hover:scale-[1.04]"
                  />
                </div>
              );
            })}
          </div>
        )}
        {/* Left fade — blends into the text panel */}
        <div className="absolute inset-0 bg-gradient-to-r from-[#0d0b09]/50 via-transparent to-transparent pointer-events-none" />
        {/* Right fade — softens the edge */}
        <div className="absolute inset-0 bg-gradient-to-l from-[#0d0b09]/70 via-transparent to-transparent pointer-events-none" />
      </div>

      {/* Bottom gold slide on hover */}
      <div className="absolute bottom-0 left-0 h-[1px] w-0 group-hover:w-full bg-[#bfa68a]/30 transition-all duration-700" />
    </Link>
  );
}

export default function StyleArchetypeGrid() {
  return (
    <section className="w-full bg-[#0d0b09]">
      <ScrollFade>
        <div className="px-8 sm:px-10 pt-12 pb-8">
          <p className="text-[10px] tracking-[0.3em] uppercase text-[#bfa68a] mb-2 font-inter">Discover</p>
          <h2 className="text-4xl font-playfair font-light text-[#f0e6d2]">Find Your Style</h2>
        </div>
      </ScrollFade>

      {/* Single-column rows — each archetype gets full width */}
      <div className="border-t border-[#1a1714]">
        {ARCHETYPES.map((archetype, index) => (
          <ArchetypeTile key={archetype.label} archetype={archetype} index={index} />
        ))}
      </div>
    </section>
  );
}
