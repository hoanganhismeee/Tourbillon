// Featured watches strip for the Stories page.
// Pulls the server-curated featured set and renders a lightweight editorial grid;
// card pattern mirrors FeaturedWatchCard on the Trend page (only needs a Watch).
'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { fetchFeaturedWatches, Watch } from '@/lib/api';
import { imageTransformations } from '@/lib/cloudinary';
import { withReturnTo } from '@/lib/returnNavigation';
import ScrollFade from '@/app/scrollMotion/ScrollFade';

const FEATURED_LIMIT = 6;

function FeaturedCardSkeleton() {
  return (
    <div className="animate-pulse flex flex-col">
      <div className="min-h-[260px] bg-white/4" />
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
  // Price 0 is "Price on Request" — never render as free.
  const priceLabel =
    watch.currentPrice === 0
      ? 'Price on Request'
      : `$${watch.currentPrice.toLocaleString()}`;
  const imageSrc = watch.imageUrl || imageTransformations.card(watch.image);

  return (
    <Link
      href={withReturnTo(`/watches/${watch.slug}`, '/stories')}
      className="group flex flex-col border border-[#bfa68a]/10"
    >
      <div className="relative min-h-[260px] flex-1 overflow-hidden bg-black/30">
        <Image
          src={imageSrc}
          alt={watch.name}
          fill
          sizes="(max-width: 1024px) 100vw, 33vw"
          className="object-contain p-8 transition-transform duration-700 group-hover:scale-105"
        />
      </div>
      <div className="flex items-end justify-between gap-4 border-t border-[#bfa68a]/10 p-6">
        <div>
          {brandLabel && (
            <p className="text-[9px] uppercase tracking-[0.42em] text-[#bfa68a]/70">{brandLabel}</p>
          )}
          <p className="mt-1.5 font-playfair text-[16px] leading-snug text-[#f0e6d2]">{watch.name}</p>
          <p className="mt-2 text-[11px] tracking-[0.1em] text-white/45">{priceLabel}</p>
        </div>
        <span className="flex-shrink-0 pb-0.5 text-sm text-[#bfa68a]/30 transition-colors duration-300 group-hover:text-[#bfa68a]/70">
          →
        </span>
      </div>
    </Link>
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
    <section className="border-t border-[#bfa68a]/12 pt-12">
      <ScrollFade>
        <div>
          <p className="text-[10px] uppercase tracking-[0.45em] text-[#bfa68a]/80">Featured</p>
          <h2
            className="mt-4 font-playfair font-light leading-tight text-[#f0e6d2]"
            style={{ fontSize: 'clamp(1.8rem, 3.5vw, 3rem)' }}
          >
            Pieces worth the pause.
          </h2>
          <p className="mt-4 max-w-xl text-[13px] leading-relaxed text-white/45 text-balance">
            A rotating selection from the catalogue — the references we keep coming back to.
          </p>
        </div>
      </ScrollFade>

      <div className="mt-10 grid gap-x-8 gap-y-12 sm:grid-cols-2 lg:grid-cols-3">
        {isLoading
          ? Array.from({ length: FEATURED_LIMIT }).map((_, i) => <FeaturedCardSkeleton key={i} />)
          : watches.map((watch) => (
              <ScrollFade key={watch.id}>
                <FeaturedWatchCard watch={watch} />
              </ScrollFade>
            ))}
      </div>
    </section>
  );
}
