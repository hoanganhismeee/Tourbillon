// Most Viewed section for the Trend page.
// Displays a ranked list of watches ordered by view count (hardcoded for now).
// Watch data is fetched by slug; silently omits any slug that fails to resolve.
'use client';

import Image from 'next/image';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { useQueries } from '@tanstack/react-query';
import { useInView } from 'react-intersection-observer';
import { fetchWatchBySlug, Watch } from '@/lib/api';
import { imageTransformations } from '@/lib/cloudinary';
import { EASE_ENTER, DUR } from '@/lib/motion';
import { MOST_VIEWED_SLUGS } from './trendData';

function RankedItemSkeleton() {
  return (
    <li className="flex items-center gap-5 py-4 border-b border-[#bfa68a]/8 animate-pulse">
      <div className="w-8 h-3 bg-white/6 rounded flex-shrink-0" />
      <div className="w-14 h-14 bg-white/5 flex-shrink-0" />
      <div className="flex-1 space-y-1.5">
        <div className="h-3 w-2/3 bg-white/6 rounded" />
        <div className="h-2 w-1/3 bg-white/4 rounded" />
      </div>
    </li>
  );
}

function RankedItem({ watch, rank, visible }: { watch: Watch; rank: number; visible: boolean }) {
  const priceLabel =
    watch.currentPrice === 0
      ? 'Price on Request'
      : `$${watch.currentPrice.toLocaleString()}`;
  const thumbnailSrc = watch.imageUrl || imageTransformations.thumbnail(watch.image);

  return (
    <motion.li
      initial={{ opacity: 0, x: -8 }}
      animate={visible ? { opacity: 1, x: 0 } : { opacity: 0, x: -8 }}
      transition={{ duration: DUR.mid, ease: EASE_ENTER, delay: rank * 0.04 }}
    >
      <Link
        href={`/watches/${watch.slug}`}
        className="group flex items-center gap-5 py-4 border-b border-[#bfa68a]/8 hover:border-[#bfa68a]/22 transition-colors duration-300"
      >
        {/* Rank number */}
        <span className="w-8 flex-shrink-0 text-[11px] font-playfair text-[#bfa68a]/35 group-hover:text-[#bfa68a]/65 transition-colors tabular-nums">
          {String(rank).padStart(2, '0')}
        </span>

        {/* Thumbnail */}
        <div className="w-14 h-14 flex-shrink-0 bg-black/30 relative overflow-hidden">
          <Image
            src={thumbnailSrc}
            alt={watch.name}
            fill
            sizes="56px"
            className="object-contain p-1"
          />
        </div>

        {/* Text */}
        <div className="min-w-0 flex-1">
          <p className="text-[12px] font-playfair text-[#f0e6d2] leading-snug truncate group-hover:text-white transition-colors">
            {watch.name}
          </p>
          <p className="mt-0.5 text-[10px] text-white/38 tracking-[0.1em]">{priceLabel}</p>
        </div>

        {/* Arrow hint */}
        <span className="text-[#bfa68a]/0 group-hover:text-[#bfa68a]/50 transition-colors duration-300 text-xs pr-2 flex-shrink-0">
          →
        </span>
      </Link>
    </motion.li>
  );
}

export default function TrendMostViewed() {
  const { ref, inView } = useInView({ triggerOnce: true, threshold: 0.1 });

  const results = useQueries({
    queries: MOST_VIEWED_SLUGS.map((slug) => ({
      queryKey: ['watch', 'slug', slug] as const,
      queryFn: () => fetchWatchBySlug(slug),
      staleTime: 10 * 60 * 1000,
      retry: false,
    })),
  });

  const isLoading = results.some((r) => r.isLoading);
  const watches: Watch[] = results.flatMap((r) => (r.data ? [r.data] : []));

  return (
    <section className="border-t border-[#bfa68a]/12 pt-12">
      {/* Header row */}
      <div className="flex items-end justify-between">
        <div>
          <p className="text-[10px] uppercase tracking-[0.45em] text-[#bfa68a]/80">
            Most Viewed
          </p>
          <h2
            className="mt-4 font-playfair font-light leading-tight text-[#f0e6d2]"
            style={{ fontSize: 'clamp(1.8rem, 3.5vw, 3rem)' }}
          >
            What the room is watching.
          </h2>
        </div>
        <span className="text-[9px] uppercase tracking-[0.35em] text-white/28 pb-1 flex-shrink-0 ml-4">
          Last 30 days
        </span>
      </div>

      {/* Ranked list */}
      <div className="mt-10 overflow-x-auto lg:overflow-x-visible" ref={ref}>
        <ol className="min-w-[320px] lg:min-w-0">
          {isLoading
            ? Array.from({ length: 6 }).map((_, i) => <RankedItemSkeleton key={i} />)
            : watches.map((watch, idx) => (
                <RankedItem key={watch.id} watch={watch} rank={idx + 1} visible={inView} />
              ))}
        </ol>
      </div>
    </section>
  );
}
