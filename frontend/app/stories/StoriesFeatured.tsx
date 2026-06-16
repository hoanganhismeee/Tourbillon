// Featured pieces for the Stories page.
// Editorial full-width rows — one watch per row, image and copy alternating
// sides for magazine rhythm (mirrors the Trend staff-picks cadence).
'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { fetchFeaturedWatches, Watch } from '@/lib/api';
import { imageTransformations } from '@/lib/cloudinary';
import { withReturnTo } from '@/lib/returnNavigation';
import ScrollFade from '@/app/scrollMotion/ScrollFade';

const FEATURED_LIMIT = 4;

// Curatorial one-liners cycled across the rows so each piece reads editorially
// rather than as a bare catalogue entry.
const EDITORIAL_LINES = [
  'Proportion held in quiet tension — nothing added, nothing spare.',
  'A case that catches light the way still water does.',
  'Mechanics you feel on the wrist before you understand them.',
  'The kind of restraint that takes decades to earn.',
];

function RowSkeleton({ flip }: { flip: boolean }) {
  return (
    <div className={`flex animate-pulse flex-col lg:flex-row ${flip ? 'lg:flex-row-reverse' : ''}`}>
      <div className="min-h-[300px] w-full bg-white/[0.04] lg:w-3/5" />
      <div className="flex w-full flex-col justify-center gap-4 p-10 lg:w-2/5">
        <div className="h-2 w-1/4 rounded bg-white/6" />
        <div className="h-6 w-2/3 rounded bg-white/5" />
        <div className="h-2 w-full rounded bg-white/4" />
        <div className="h-2 w-1/5 rounded bg-white/4" />
      </div>
    </div>
  );
}

function FeaturedRow({ watch, index, flip }: { watch: Watch; index: number; flip: boolean }) {
  const brandLabel = watch.brandSlug?.replace(/-/g, ' ');
  // Price 0 is "Price on Request" — never render as free.
  const priceLabel =
    watch.currentPrice === 0 ? 'Price on Request' : `$${watch.currentPrice.toLocaleString()}`;
  const imageSrc = watch.imageUrl || imageTransformations.card(watch.image);
  const href = withReturnTo(`/watches/${watch.slug}`, '/stories');
  const line = EDITORIAL_LINES[index % EDITORIAL_LINES.length];

  return (
    <div
      className={`group flex flex-col border border-[#bfa68a]/10 lg:flex-row ${flip ? 'lg:flex-row-reverse' : ''}`}
    >
      <Link href={href} className="relative min-h-[320px] w-full overflow-hidden bg-black/30 lg:w-3/5">
        <Image
          src={imageSrc}
          alt={watch.name}
          fill
          sizes="(max-width: 1024px) 100vw, 60vw"
          className="object-contain p-10 transition-transform duration-700 group-hover:scale-105"
        />
        <span className="absolute left-6 top-6 font-playfair text-sm text-[#bfa68a]/40">
          {String(index + 1).padStart(2, '0')}
        </span>
      </Link>

      <div className="flex w-full flex-col justify-center gap-5 p-10 lg:w-2/5 lg:p-12">
        {brandLabel && (
          <p className="text-[10px] uppercase tracking-[0.42em] text-[#bfa68a]/70">{brandLabel}</p>
        )}
        <h3
          className="font-playfair font-light leading-tight text-[#f0e6d2]"
          style={{ fontSize: 'clamp(1.5rem, 2.4vw, 2.1rem)' }}
        >
          {watch.name}
        </h3>
        <p className="max-w-sm text-[13.5px] font-light italic leading-relaxed text-white/45">
          {line}
        </p>
        <p className="text-[11px] tracking-[0.12em] text-white/55">{priceLabel}</p>
        <Link
          href={href}
          className="group/cta mt-1 inline-flex w-fit items-center gap-2 text-[10px] uppercase tracking-[0.3em] text-[#bfa68a] transition-colors hover:text-[#f0e6d2]"
        >
          View the piece
          <span className="transition-transform duration-300 group-hover/cta:translate-x-1">→</span>
        </Link>
      </div>
    </div>
  );
}

export default function StoriesFeatured() {
  const { data, isLoading } = useQuery({
    queryKey: ['featured-watches'],
    queryFn: fetchFeaturedWatches,
    staleTime: 10 * 60 * 1000,
  });

  const watches = (data ?? []).slice(0, FEATURED_LIMIT);

  return (
    <div className="mt-12 flex flex-col gap-16">
      {isLoading
        ? Array.from({ length: 3 }).map((_, i) => <RowSkeleton key={i} flip={i % 2 === 1} />)
        : watches.map((watch, i) => (
            <ScrollFade key={watch.id}>
              <FeaturedRow watch={watch} index={i} flip={i % 2 === 1} />
            </ScrollFade>
          ))}
    </div>
  );
}
