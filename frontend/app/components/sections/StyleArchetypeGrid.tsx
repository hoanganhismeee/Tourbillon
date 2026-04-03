'use client';

// Homepage discovery section — 4 full-bleed archetype tiles in a 2x2 grid.
// Each tile uses a watch image as background and links to the watches page.
// Images are loaded from the first watch in a representative collection per archetype.
import Link from 'next/link';
import Image from 'next/image';
import { useQuery } from '@tanstack/react-query';
import { fetchWatchesByCollectionSlug } from '@/lib/api';
import { imageTransformations } from '@/lib/cloudinary';
import ScrollFade from '@/app/scrollMotion/ScrollFade';

interface Archetype {
  label: string;
  subLabel: string;
  href: string;
  collectionSlug: string; // collection whose first watch provides the background image
}

const ARCHETYPES: Archetype[] = [
  {
    label: 'The Sport Watch',
    subLabel: 'Precision under pressure',
    href: '/watches',
    collectionSlug: 'royal-oak',
  },
  {
    label: 'The Dress Watch',
    subLabel: 'Restraint as a statement',
    href: '/watches',
    collectionSlug: 'calatrava',
  },
  {
    label: 'The Grand Complication',
    subLabel: 'Every mechanism a masterpiece',
    href: '/watches',
    collectionSlug: 'grand-complications',
  },
  {
    label: 'The Independent Maker',
    subLabel: 'Outside the conglomerate',
    href: '/watches',
    collectionSlug: 'lange-1',
  },
];

function ArchetypeTile({ archetype }: { archetype: Archetype }) {
  const { data: watches = [] } = useQuery({
    queryKey: ['watches', 'collection-slug', archetype.collectionSlug],
    queryFn: () => fetchWatchesByCollectionSlug(archetype.collectionSlug),
    staleTime: 10 * 60 * 1000,
  });

  const watch = watches[0];
  const imgSrc = watch?.imageUrl || (watch?.image ? imageTransformations.detail(watch.image) : null);

  return (
    <Link
      href={archetype.href}
      className="group relative block overflow-hidden aspect-[4/3] bg-[#1a1210]"
    >
      {/* Background watch image */}
      {imgSrc && (
        <Image
          src={imgSrc}
          alt={archetype.label}
          fill
          sizes="(max-width: 768px) 100vw, 50vw"
          className="object-cover opacity-60 transition-transform duration-700 ease-out group-hover:scale-[1.04]"
        />
      )}

      {/* Dark gradient overlay — heavier at bottom for text legibility */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />

      {/* Text block — bottom left */}
      <div className="absolute bottom-0 left-0 p-8 md:p-10">
        <p className="text-[10px] tracking-[0.25em] uppercase text-[#bfa68a] mb-2 font-inter">
          {archetype.subLabel}
        </p>
        <h3 className="font-playfair font-light text-[#f0e6d2] text-2xl md:text-3xl leading-tight">
          {archetype.label}
        </h3>
        <div className="flex items-center gap-2 mt-4 opacity-0 group-hover:opacity-100 transition-opacity duration-500">
          <span className="text-xs tracking-[0.15em] uppercase text-white/60 font-inter">Explore</span>
          <svg className="w-3 h-3 text-white/60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 8l4 4m0 0l-4 4m4-4H3" />
          </svg>
        </div>
      </div>
    </Link>
  );
}

export default function StyleArchetypeGrid() {
  return (
    <section className="w-full">
      <ScrollFade>
        <div className="px-8 sm:px-12 lg:px-16 xl:px-20 max-w-7xl mx-auto mb-6">
          <p className="text-[10px] tracking-[0.3em] uppercase text-[#bfa68a] mb-2 font-inter">Discover</p>
          <h2 className="text-4xl font-playfair font-light text-[#f0e6d2]">Find Your Style</h2>
        </div>
      </ScrollFade>

      {/* 2×2 flush grid — no gap (Polène-style flat premium) */}
      <div className="grid grid-cols-1 sm:grid-cols-2">
        {ARCHETYPES.map((archetype) => (
          <ArchetypeTile key={archetype.collectionSlug} archetype={archetype} />
        ))}
      </div>
    </section>
  );
}
