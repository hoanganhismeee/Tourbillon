// Staff Picks section for the Trend page.
// Renders each editor-selected watch paired with its video; videos alternate sides for editorial rhythm.
'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useQueries } from '@tanstack/react-query';
import { fetchWatchBySlug, Watch } from '@/lib/api';
import { imageTransformations } from '@/lib/cloudinary';
import { STAFF_PICKS, StaffPick } from './trendData';
import ScrollFade from '@/app/scrollMotion/ScrollFade';

function FeaturedCardSkeleton() {
  return (
    <div className="animate-pulse flex flex-col h-full">
      <div className="flex-1 min-h-[260px] bg-white/4" />
      <div className="p-6 border-t border-[#bfa68a]/10 space-y-3">
        <div className="h-2 w-1/4 bg-white/6 rounded" />
        <div className="h-4 w-2/3 bg-white/5 rounded" />
        <div className="h-2 w-1/5 bg-white/4 rounded" />
      </div>
    </div>
  );
}

function FeaturedWatchCard({ watch }: { watch: Watch }) {
  const brandLabel = watch.brandSlug?.replace(/-/g, ' ');
  const priceLabel =
    watch.currentPrice === 0
      ? 'Price on Request'
      : `$${watch.currentPrice.toLocaleString()}`;
  const imageSrc = watch.imageUrl || imageTransformations.card(watch.image);

  return (
    <Link href={`/watches/${watch.slug}`} className="group flex flex-col h-full">
      <div className="relative flex-1 min-h-[260px] bg-black/30 overflow-hidden">
        <Image
          src={imageSrc}
          alt={watch.name}
          fill
          sizes="(max-width: 1024px) 100vw, 50vw"
          className="object-contain p-8 transition-transform duration-700 group-hover:scale-105"
        />
      </div>
      <div className="p-6 border-t border-[#bfa68a]/10 flex items-end justify-between gap-4">
        <div>
          {brandLabel && (
            <p className="text-[9px] uppercase tracking-[0.42em] text-[#bfa68a]/70">
              {brandLabel}
            </p>
          )}
          <p className="mt-1.5 font-playfair text-[#f0e6d2] text-[16px] leading-snug">
            {watch.name}
          </p>
          <p className="mt-2 text-[11px] tracking-[0.1em] text-white/45">{priceLabel}</p>
        </div>
        <span className="text-[#bfa68a]/30 group-hover:text-[#bfa68a]/70 transition-colors duration-300 text-sm flex-shrink-0 pb-0.5">
          →
        </span>
      </div>
    </Link>
  );
}

function StaffPickPair({
  pick,
  watch,
  isLoading,
}: {
  pick: StaffPick;
  watch: Watch | undefined;
  isLoading: boolean;
}) {
  const featuredVisualSrc = watch?.imageUrl || (watch?.image ? imageTransformations.detail(watch.image) : null);

  return (
    <div className="flex flex-col lg:flex-row min-h-[420px] lg:min-h-[520px]">
      {/* Video — always left */}
      <div className="w-full lg:w-3/5 min-h-[280px] lg:min-h-0 relative overflow-hidden">
        {pick.video ? (
          <video autoPlay muted loop playsInline className="absolute inset-0 w-full h-full object-cover">
            <source src={pick.video} type="video/mp4" />
          </video>
        ) : featuredVisualSrc ? (
          <Image
            src={featuredVisualSrc}
            alt={watch?.name ?? 'Featured watch'}
            fill
            sizes="(max-width: 1024px) 100vw, 60vw"
            className="object-cover"
            priority
          />
        ) : (
          <div className="absolute inset-0 bg-black/30" />
        )}
        <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-b from-transparent to-[#1e1512]" />
      </div>

      {/* Watch card — always right */}
      <div className="w-full lg:w-2/5 border border-[#bfa68a]/10 lg:border-l-0 flex flex-col">
        {isLoading ? <FeaturedCardSkeleton /> : watch ? <FeaturedWatchCard watch={watch} /> : null}
      </div>
    </div>
  );
}

export default function TrendStaffPicks() {
  const results = useQueries({
    queries: STAFF_PICKS.map(({ slug }) => ({
      queryKey: ['watch', 'slug', slug] as const,
      queryFn: () => fetchWatchBySlug(slug),
      staleTime: 10 * 60 * 1000,
      retry: false,
    })),
  });

  return (
    <section className="border-t border-[#bfa68a]/12 pt-12">
      <ScrollFade>
      <div>
        <p className="text-[10px] uppercase tracking-[0.45em] text-[#bfa68a]/80">
          Staff Picks
        </p>
        <h2
          className="mt-4 font-playfair font-light leading-tight text-[#f0e6d2]"
          style={{ fontSize: 'clamp(1.8rem, 3.5vw, 3rem)' }}
        >
          Hand-selected by our editors.
        </h2>
        <p className="mt-4 max-w-xl text-[13px] leading-relaxed text-white/45 text-balance">
          Pieces that stopped us — chosen for form, precision, and the quiet confidence
          they carry.
        </p>
      </div>
      </ScrollFade>

      <div className="mt-10 flex flex-col gap-20">
        {STAFF_PICKS.map((pick, idx) => (
          <ScrollFade key={pick.slug}>
            <StaffPickPair
              pick={pick}
              watch={results[idx]?.data}
              isLoading={results[idx]?.isLoading ?? true}
            />
          </ScrollFade>
        ))}
      </div>
    </section>
  );
}
