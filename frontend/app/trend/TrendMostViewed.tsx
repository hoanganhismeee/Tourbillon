// Most Viewed section for the Trend page.
// Local-dev version: seeded random catalogue cards across three time windows.
'use client';

import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
import { fetchBrands, fetchCollections, fetchWatches, Watch } from '@/lib/api';
import { WatchCard } from '@/app/components/cards/WatchCard';
import ScrollFade from '@/app/scrollMotion/ScrollFade';
import { DUR, EASE_ENTER } from '@/lib/motion';

type TimeRange = 'today' | '7d' | '30d';

const RANGE_LABELS: Record<TimeRange, string> = {
  today: 'Today',
  '7d': 'Last 7 Days',
  '30d': 'Last 30 Days',
};

const CARD_COUNT = 20;

function shuffleWatches<T>(items: T[]): T[] {
  const shuffled = [...items];

  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }

  return shuffled;
}

function pickWatchesForRange(watches: Watch[]): Watch[] {
  return shuffleWatches(watches).slice(0, Math.min(CARD_COUNT, watches.length));
}

function RangeButton({
  label,
  isActive,
  onClick,
}: {
  label: string;
  isActive: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`relative px-4 py-3 text-[10px] uppercase tracking-[0.28em] transition-all duration-300 ${
        isActive
          ? 'text-[#1e1512]'
          : 'text-[#bfa68a]/72 hover:bg-[#bfa68a]/8 hover:text-[#f0e6d2]'
      }`}
    >
      {isActive && (
        <span aria-hidden="true" className="absolute inset-0 rounded-full bg-[#bfa68a]" />
      )}
      <span className="relative z-10">{label}</span>
    </button>
  );
}

function CardSkeleton() {
  return (
    <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-white/4 to-white/8 p-4 animate-pulse">
      <div className="aspect-square rounded-xl bg-white/6" />
      <div className="mt-4 h-3 w-1/3 rounded bg-white/8" />
      <div className="mt-3 h-4 w-3/4 rounded bg-white/10" />
      <div className="mt-3 h-4 w-2/5 rounded bg-white/8" />
    </div>
  );
}

export default function TrendMostViewed() {
  const [activeRange, setActiveRange] = useState<TimeRange>('30d');

  const { data: watches = [], isLoading: watchesLoading } = useQuery({
    queryKey: ['watches'],
    queryFn: fetchWatches,
    staleTime: 10 * 60 * 1000,
  });

  const { data: brands = [], isLoading: brandsLoading } = useQuery({
    queryKey: ['brands'],
    queryFn: fetchBrands,
    staleTime: 10 * 60 * 1000,
  });

  const { data: collections = [], isLoading: collectionsLoading } = useQuery({
    queryKey: ['collections'],
    queryFn: fetchCollections,
    staleTime: 10 * 60 * 1000,
  });

  const rangeSelections = useMemo<Record<TimeRange, Watch[]>>(() => {
    return {
      today: pickWatchesForRange(watches),
      '7d': pickWatchesForRange(watches),
      '30d': pickWatchesForRange(watches),
    };
  }, [watches]);

  const activeWatches = rangeSelections[activeRange];
  const isLoading = watchesLoading || brandsLoading || collectionsLoading;

  return (
    <section className="border-t border-[#bfa68a]/12 pt-12">
      <ScrollFade>
        <div className="flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
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

          <p className="max-w-xl text-[13px] leading-relaxed text-white/45 text-balance lg:text-right">
            Three rolling windows across the catalogue, presented as a calmer product edit with the
            same visual rhythm as the watches grid.
          </p>
        </div>
      </ScrollFade>

      <div className="mt-12 inline-flex flex-wrap items-center gap-3 rounded-full border border-[#bfa68a]/15 bg-black/20 p-2">
        {(Object.entries(RANGE_LABELS) as Array<[TimeRange, string]>).map(([range, label]) => (
          <RangeButton
            key={range}
            label={label}
            isActive={activeRange === range}
            onClick={() => setActiveRange(range)}
          />
        ))}
      </div>

      <div className="mt-7 flex items-center justify-between border-b border-[#bfa68a]/10 pb-5">
        <p className="text-[10px] uppercase tracking-[0.3em] text-white/30">
          Selected Window
        </p>
        <p className="text-[10px] uppercase tracking-[0.32em] text-[#bfa68a]/72">
          {RANGE_LABELS[activeRange]}
        </p>
      </div>

      <motion.div
        key={activeRange}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: DUR.mid, ease: EASE_ENTER }}
        className="mt-12"
      >
        {isLoading ? (
          <div className="grid grid-cols-1 gap-x-8 gap-y-12 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
            {Array.from({ length: CARD_COUNT }).map((_, index) => (
              <CardSkeleton key={index} />
            ))}
          </div>
        ) : activeWatches.length > 0 ? (
          <div className="grid grid-cols-1 gap-x-8 gap-y-12 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
            {activeWatches.map((watch, index) => (
              <WatchCard
                key={`${activeRange}-${watch.id}`}
                watch={watch}
                brands={brands}
                collections={collections}
                currentPage={1}
                isPriority={index < 5}
              />
            ))}
          </div>
        ) : (
          <div className="rounded-3xl border border-[#bfa68a]/12 bg-white/[0.02] px-6 py-12 text-center">
            <p className="font-playfair text-[1.35rem] text-[#f0e6d2]">
              No watches available for this edit yet.
            </p>
            <p className="mt-3 text-[12px] leading-relaxed text-white/40">
              Once the catalogue is populated, this section will rotate through a seeded set of
              product cards for each time window.
            </p>
          </div>
        )}
      </motion.div>
    </section>
  );
}
