'use client';

// Homepage discovery section — 4 archetype tiles in a 2×2 grid.
// Each tile links to /watches with multiple collection filters pre-applied.
// Background: 3 watch images side-by-side (collage) at reduced opacity.
// Slugs are brand-prefixed (e.g. audemars-piguet-royal-oak) — verified against DB.
import Link from 'next/link';
import Image from 'next/image';
import { useQuery } from '@tanstack/react-query';
import { fetchWatchesByCollectionSlug } from '@/lib/api';
import { imageTransformations } from '@/lib/cloudinary';
import ScrollFade from '@/app/scrollMotion/ScrollFade';

interface Archetype {
  label: string;
  subLabel: string;
  // Up to 3 slugs used for the background collage; all slugs used for the /watches link
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

// Build the /watches href with multiple collection params
function buildHref(slugs: string[]): string {
  const params = new URLSearchParams();
  slugs.forEach(s => params.append('collection', s));
  return `/watches?${params.toString()}`;
}

// Loads the first watch from a single collection slug — used for the collage background
function useCollectionWatch(slug: string) {
  const { data: watches = [] } = useQuery({
    queryKey: ['watches', 'collection-slug', slug],
    queryFn: () => fetchWatchesByCollectionSlug(slug),
    staleTime: 10 * 60 * 1000,
  });
  return watches[0] ?? null;
}

function ArchetypeTile({ archetype }: { archetype: Archetype }) {
  // Load the first watch from each of the first 3 slugs for the collage
  const w0 = useCollectionWatch(archetype.collectionSlugs[0]);
  const w1 = useCollectionWatch(archetype.collectionSlugs[1] ?? archetype.collectionSlugs[0]);
  const w2 = useCollectionWatch(archetype.collectionSlugs[2] ?? archetype.collectionSlugs[0]);

  const getImg = (w: ReturnType<typeof useCollectionWatch>) =>
    w ? (w.imageUrl || (w.image ? imageTransformations.detail(w.image) : null)) : null;

  const imgs = [getImg(w0), getImg(w1), getImg(w2)].filter(Boolean) as string[];

  return (
    <Link
      href={buildHref(archetype.collectionSlugs)}
      className="group relative block overflow-hidden aspect-[4/3] bg-[#0d0b08]"
    >
      {/* 3-watch collage — side-by-side at reduced opacity, fills the tile */}
      {imgs.length > 0 && (
        <div className="absolute inset-0 flex">
          {imgs.map((src, i) => (
            <div key={i} className="relative flex-1 overflow-hidden">
              <Image
                src={src}
                alt={archetype.label}
                fill
                sizes="(max-width: 768px) 50vw, 25vw"
                className="object-cover opacity-50 transition-transform duration-700 ease-out group-hover:scale-[1.04]"
              />
            </div>
          ))}
        </div>
      )}

      {/* Gradient overlay — heavier at bottom for text legibility */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/40 to-black/10" />

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

      {/* 2×2 flush grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2">
        {ARCHETYPES.map((archetype) => (
          <ArchetypeTile key={archetype.label} archetype={archetype} />
        ))}
      </div>
    </section>
  );
}
