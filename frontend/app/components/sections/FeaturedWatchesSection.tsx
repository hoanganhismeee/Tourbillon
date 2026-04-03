'use client';

// Homepage featured watches — 6 curated references across different brands.
// Each card shows brand, name, an editorial snippet (whyItMatters), and price.
// Data from GET /api/watch/featured (one watch per iconic collection).
import Link from 'next/link';
import Image from 'next/image';
import { useQuery } from '@tanstack/react-query';
import { fetchFeaturedWatches, Watch } from '@/lib/api';
import { imageTransformations } from '@/lib/cloudinary';
import ScrollFade from '@/app/scrollMotion/ScrollFade';

function formatPrice(price: number): string {
  if (price === 0) return 'Price on Request';
  return new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD', maximumFractionDigits: 0 }).format(price);
}

function FeaturedWatchCard({ watch }: { watch: Watch }) {
  const imgSrc = watch.imageUrl || (watch.image ? imageTransformations.card(watch.image) : null);
  const snippet = watch.editorialContent?.whyItMatters?.slice(0, 120) ?? '';

  return (
    <Link
      href={`/watches/${watch.slug}`}
      className="group flex flex-col"
    >
      {/* Image area — portrait aspect, dark bg */}
      <div className="relative aspect-[3/4] bg-[#110d0b] overflow-hidden mb-4">
        {imgSrc ? (
          <Image
            src={imgSrc}
            alt={watch.description || watch.name}
            fill
            sizes="(max-width: 768px) 100vw, 33vw"
            className="object-contain p-6 transition-transform duration-700 ease-out group-hover:scale-[1.03]"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center">
              <svg className="w-6 h-6 text-white/20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>
        )}
      </div>

      {/* Text block */}
      <div className="flex flex-col gap-1.5">
        <p className="text-[10px] tracking-[0.2em] uppercase text-[#bfa68a] font-inter">
          {watch.description?.split(' ').slice(0, 2).join(' ') || 'Fine Watchmaking'}
        </p>
        <h3 className="font-playfair font-light text-[#f0e6d2] text-base leading-snug group-hover:text-white transition-colors duration-300">
          {watch.name}
        </h3>
        {snippet && (
          <p className="text-[11px] text-white/40 font-inter leading-relaxed line-clamp-2">
            {snippet}{snippet.length >= 120 ? '…' : ''}
          </p>
        )}
        <p className="text-xs text-white/60 font-inter mt-1">
          {formatPrice(watch.currentPrice)}
        </p>
      </div>
    </Link>
  );
}

function FeaturedWatchSkeleton() {
  return (
    <div className="flex flex-col animate-pulse">
      <div className="aspect-[3/4] bg-white/5 mb-4" />
      <div className="h-2 w-16 bg-white/10 rounded mb-2" />
      <div className="h-4 w-3/4 bg-white/8 rounded mb-1.5" />
      <div className="h-3 w-full bg-white/5 rounded mb-1" />
      <div className="h-3 w-2/3 bg-white/5 rounded mb-2" />
      <div className="h-3 w-1/4 bg-white/8 rounded" />
    </div>
  );
}

export default function FeaturedWatchesSection() {
  const { data: watches = [], isLoading } = useQuery({
    queryKey: ['watches', 'featured'],
    queryFn: fetchFeaturedWatches,
    staleTime: 5 * 60 * 1000,
  });

  return (
    <section className="container mx-auto px-8 sm:px-12 lg:px-16 xl:px-20 max-w-7xl py-24">
      <ScrollFade>
        <div className="mb-14">
          <p className="text-[10px] tracking-[0.3em] uppercase text-[#bfa68a] mb-3 font-inter">Selected References</p>
          <h2 className="text-4xl font-playfair font-light text-[#f0e6d2]">Exceptional Timepieces</h2>
        </div>
      </ScrollFade>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-x-8 gap-y-16">
        {isLoading
          ? Array.from({ length: 6 }).map((_, i) => <FeaturedWatchSkeleton key={i} />)
          : watches.map((watch) => (
              <ScrollFade key={watch.id}>
                <FeaturedWatchCard watch={watch} />
              </ScrollFade>
            ))
        }
      </div>

      <ScrollFade>
        <div className="mt-16 border-t border-white/10 pt-8">
          <Link
            href="/watches"
            className="text-sm tracking-[0.15em] uppercase text-[#f0e6d2]/60 hover:text-[#f0e6d2] transition-colors duration-300 font-inter inline-flex items-center gap-3"
          >
            View All Watches
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 8l4 4m0 0l-4 4m4-4H3" />
            </svg>
          </Link>
        </div>
      </ScrollFade>
    </section>
  );
}
