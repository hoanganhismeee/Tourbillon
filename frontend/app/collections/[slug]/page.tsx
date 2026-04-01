// Collection detail page — header (name + brand) → description → watch grid.
// Mirrors the brand page layout: left-aligned, lede sentence pulled out, new tilt WatchCard.
'use client';

import React, { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
import { fetchCollectionBySlug, fetchWatchesByCollectionSlug, fetchBrandById, Brand } from '@/lib/api';
import { useScrollRestore } from '@/hooks/useScrollRestore';
import { useNavigation } from '@/contexts/NavigationContext';
import ScrollFade from '../../scrollMotion/ScrollFade';
import { WatchCard } from '../../components/cards/WatchCard';

const CollectionPage = () => {
  const params = useParams();
  const slug = params.slug as string;
  const router = useRouter();
  const { navigationState } = useNavigation();

  const [descExpanded, setDescExpanded] = useState(false);

  const { data: collection, isLoading: collectionLoading, error } = useQuery({
    queryKey: ['collection', slug],
    queryFn: () => fetchCollectionBySlug(slug),
    enabled: !!slug,
  });

  const { data: watches = [], isLoading: watchesLoading } = useQuery({
    queryKey: ['watches', 'collection', slug],
    queryFn: () => fetchWatchesByCollectionSlug(slug),
    enabled: !!slug,
  });

  useScrollRestore(watches.length > 0 || !watchesLoading);

  const { data: brand } = useQuery({
    queryKey: ['brand', collection?.brandId],
    queryFn: () => fetchBrandById(collection!.brandId),
    enabled: !!collection?.brandId,
  });

  const handleBackClick = () => {
    if (navigationState) {
      document.body.style.transition = 'opacity 0.18s ease-in';
      document.body.style.opacity = '0';
      setTimeout(() => { document.body.style.transition = 'opacity 0.65s cubic-bezier(0.16, 1, 0.3, 1)'; document.body.style.opacity = '1'; }, 2000);
      setTimeout(() => { router.back(); }, 160);
    } else {
      router.push('/watches');
    }
  };

  if (collectionLoading) {
    return <div className="flex justify-center items-center min-h-screen text-white/80">Loading...</div>;
  }
  if (error) {
    return <div className="flex justify-center items-center min-h-screen text-red-500">Error loading collection.</div>;
  }
  if (!collection) {
    return <div className="flex justify-center items-center min-h-screen text-white/80">Collection not found.</div>;
  }

  // Same lede/body split as brand page
  const desc = collection.description || '';
  let lede = '';
  let bodyText = desc;
  if (desc) {
    const trimmed = desc.trimStart();
    if (trimmed.startsWith('\u201c') || trimmed.startsWith('"')) {
      const closeIdx = trimmed.search(/[\u201d"]/);
      if (closeIdx > 0 && closeIdx < 500) {
        lede = trimmed.slice(0, closeIdx + 1);
        bodyText = desc.slice(desc.indexOf(lede) + lede.length).trimStart();
      }
    }
    if (!lede) {
      const m = desc.match(/[A-Za-zÀ-ÿ]{4,}\. /);
      const stop = m?.index != null ? m.index + m[0].length - 2 : -1;
      if (stop > 0 && stop < 400) {
        lede = desc.slice(0, stop + 1);
        bodyText = desc.slice(stop + 2);
      }
    }
  }

  const rawParagraphs = bodyText.split('\n').map(p => p.trim()).filter(p => p.length > 0);
  const bodyParagraphs: string[] = rawParagraphs.length > 1
    ? rawParagraphs
    : (() => {
        const sentences = bodyText
          .split(/(?<=[A-Za-zÀ-ÿ0-9]{3,}[.!?])\s+(?=[A-Z"'])/)
          .map(s => s.trim()).filter(s => s.length > 0);
        const chunks: string[] = [];
        for (let i = 0; i < sentences.length; i += 3) {
          chunks.push(sentences.slice(i, i + 3).join(' '));
        }
        return chunks;
      })();

  const brandAsArray: Brand[] = brand ? [brand] : [];

  return (
    <div className="container mx-auto px-8 sm:px-12 lg:px-16 py-20 max-w-7xl">

      {/* Back + breadcrumb */}
      <div className="mb-10 flex items-center gap-6">
        <button
          onClick={handleBackClick}
          className="inline-flex items-center gap-2 text-white/50 hover:text-white/90 transition-colors duration-300 text-sm font-light tracking-wide shrink-0"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 19l-7-7 7-7" />
          </svg>
          {navigationState ? 'Back' : 'All Watches'}
        </button>
        <nav className="text-white/35 text-xs flex items-center gap-1.5">
          <Link href={brand ? `/watches?brand=${brand.slug}` : '/watches'} className="hover:text-white/60 transition-colors">Watches</Link>
          <span>/</span>
          {brand && <Link href={`/brands/${brand.slug}`} className="hover:text-white/60 transition-colors">{brand.name}</Link>}
          {brand && <span>/</span>}
          <span className="text-white/60">{collection.name}</span>
        </nav>
      </div>

      {/* ── Header ── */}
      <ScrollFade>
        <header className="mb-16">

          {/* Collection name + brand — centered hero */}
          <div className="text-center mb-10">
            <h1 className="text-5xl md:text-6xl font-playfair font-bold text-[#f0e6d2] mb-4">
              {collection.name}
            </h1>
            {brand && (
              <Link
                href={`/brands/${brand.slug}`}
                className="text-lg font-playfair font-light text-white/60 hover:text-white/90 italic transition-colors"
              >
                by {brand.name}
              </Link>
            )}
          </div>

          <div className="w-full border-t border-white/10 mb-10" />

          {/* Description */}
          {desc && (
            <div className="max-w-3xl">
              {lede && (
                <p className="text-base md:text-lg font-playfair font-light text-[#f0e6d2]/85 leading-8 mb-6 pb-6 border-b border-white/10">
                  {lede}
                </p>
              )}

              {bodyParagraphs.length > 0 && (
                <>
                  <div className="relative">
                    <motion.div
                      initial={{ height: '7rem' }}
                      animate={{ height: descExpanded ? 'auto' : '7rem' }}
                      transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
                      className="overflow-hidden"
                    >
                      {bodyParagraphs.map((p, i) => (
                        <p key={i} className="text-sm text-white/55 font-light leading-7 tracking-wide mb-5">{p}</p>
                      ))}
                    </motion.div>
                    {!descExpanded && (
                      <div className="absolute bottom-0 left-0 right-0 h-12 bg-gradient-to-t from-[#1a120d]/70 to-transparent pointer-events-none" />
                    )}
                  </div>
                  <button
                    onClick={() => setDescExpanded(v => !v)}
                    className="mt-4 flex items-center gap-1.5 text-xs tracking-widest uppercase text-[#bfa68a] hover:text-[#f0e6d2] transition-colors duration-300 font-light"
                  >
                    {descExpanded ? 'Read less' : 'Read more'}
                    <svg className={`w-3 h-3 transition-transform duration-300 ${descExpanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                </>
              )}
            </div>
          )}
        </header>
      </ScrollFade>

      <div className="w-full border-t border-white/10 mb-16" />

      {/* ── Watches ── */}
      <section>
        <ScrollFade>
          <h2 className="text-2xl font-playfair font-semibold text-[#f0e6d2] mb-12">
            Timepieces
          </h2>
        </ScrollFade>

        {watchesLoading ? (
          <div className="text-center py-16">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-white/40 mx-auto mb-4" />
            <p className="text-white/50 text-sm font-playfair">Loading watches...</p>
          </div>
        ) : watches.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-x-8 gap-y-16">
            {watches.map((watch, index) => (
              <WatchCard
                key={watch.id}
                watch={watch}
                brands={brandAsArray}
                collections={[collection]}
                isPriority={index < 4}
                currentPage={1}
              />
            ))}
          </div>
        ) : (
          <p className="text-white/50 text-sm font-playfair">No watches available in this collection yet.</p>
        )}
      </section>

    </div>
  );
};

export default CollectionPage;
