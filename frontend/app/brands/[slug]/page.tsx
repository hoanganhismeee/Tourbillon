// Brand page: logo hero → description → collection list → watches grid.
// Collections shown as text-only rows (no images) — cleaner than cards.
// Watches use the same tilt/shimmer card as the main watches page.
'use client';

import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useParams, useRouter } from 'next/navigation';
import { useNavigation } from '@/contexts/NavigationContext';
import { useQuery } from '@tanstack/react-query';
import { fetchBrandBySlug, fetchWatchesByBrandSlug, fetchCollectionsByBrandSlug, Collection, Brand } from '@/lib/api';
import { useScrollRestore } from '@/hooks/useScrollRestore';
import { imageTransformations } from '@/lib/cloudinary';
import Image from 'next/image';
import Link from 'next/link';
import ScrollFade from '../../scrollMotion/ScrollFade';
import { WatchCard } from '../../components/cards/WatchCard';

// Clean text-only row for a collection — no image needed.
const CollectionListItem = ({ collection }: { collection: Collection }) => (
  <Link
    href={`/collections/${collection.slug}`}
    className="group flex items-start justify-between gap-8 py-6 border-t border-white/10 transition-all duration-300 hover:pl-2"
  >
    <div className="flex-1 min-w-0">
      <h3 className="text-base font-playfair font-semibold text-[#f0e6d2] mb-1.5 group-hover:text-white transition-colors">
        {collection.name}
      </h3>
      {collection.description && (
        <p className="text-sm text-white/50 group-hover:text-white/70 font-light leading-relaxed line-clamp-2 transition-colors">
          {collection.description}
        </p>
      )}
    </div>
    <svg
      className="w-4 h-4 text-white/25 group-hover:text-white/60 mt-1 shrink-0 transition-all duration-300 group-hover:translate-x-1"
      fill="none" stroke="currentColor" viewBox="0 0 24 24"
    >
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5l7 7-7 7" />
    </svg>
  </Link>
);

const BrandPage = () => {
  const params = useParams();
  const slug = params.slug as string;

  const router = useRouter();
  const { navigationState } = useNavigation();

  const [logoSrc, setLogoSrc] = useState<string>('');
  const [logoError, setLogoError] = useState(false);
  const [descExpanded, setDescExpanded] = useState(false);

  const handleBackClick = () => {
    if (navigationState) {
      document.body.style.transition = 'opacity 0.18s ease-in';
      document.body.style.opacity = '0';
      setTimeout(() => { document.body.style.transition = 'opacity 0.65s cubic-bezier(0.16, 1, 0.3, 1)'; document.body.style.opacity = '1'; }, 2000);
      setTimeout(() => { router.back(); }, 160);
    } else {
      router.push(brand?.slug ? `/watches?brand=${brand.slug}` : '/watches');
    }
  };

  const { data: brand, isLoading, error } = useQuery({
    queryKey: ['brand', slug],
    queryFn: () => fetchBrandBySlug(slug),
    enabled: !!slug,
  });

  const { data: watches = [], isLoading: watchesLoading } = useQuery({
    queryKey: ['watches', 'brand', slug],
    queryFn: () => fetchWatchesByBrandSlug(slug),
    enabled: !!slug,
  });

  const { data: collections = [] } = useQuery({
    queryKey: ['collections', 'brand', slug],
    queryFn: () => fetchCollectionsByBrandSlug(slug),
    enabled: !!slug,
  });

  useScrollRestore(watches.length > 0 || !watchesLoading);

  useEffect(() => {
    if (brand?.image) {
      setLogoSrc(imageTransformations.logo(brand.image));
    }
  }, [brand?.image]);

  if (isLoading) {
    return <div className="flex justify-center items-center min-h-screen text-white/80">Loading...</div>;
  }
  if (error) {
    return <div className="flex justify-center items-center min-h-screen text-red-500">Error loading brand.</div>;
  }
  if (!brand) {
    return <div className="flex justify-center items-center min-h-screen text-white/80">Brand not found.</div>;
  }

  // Split into lede + body. Two strategies:
  // 1. If the description opens with a quote (" or "), scan to the closing " or " — captures the full quoted passage.
  // 2. Otherwise, find the first sentence end after a real word (4+ chars) — skips initials like "A.".
  // Split into lede + body. Two strategies:
  // 1. If the description opens with a quote (" or "), scan to the closing " or " — captures the full quoted passage.
  // 2. Otherwise, find the first sentence end after a real word (4+ chars) — skips initials like "A.".
  let lede = '';
  let bodyText = brand.description;
  const trimmed = brand.description.trimStart();
  if (trimmed.startsWith('\u201c') || trimmed.startsWith('"')) {
    const closeIdx = trimmed.search(/[\u201d"]/);
    if (closeIdx > 0 && closeIdx < 500) {
      lede = trimmed.slice(0, closeIdx + 1);
      bodyText = brand.description.slice(brand.description.indexOf(lede) + lede.length).trimStart();
    }
  }
  if (!lede) {
    const sentenceMatch = brand.description.match(/[A-Za-zÀ-ÿ]{4,}\. /);
    const firstStop = sentenceMatch?.index != null ? sentenceMatch.index + sentenceMatch[0].length - 2 : -1;
    if (firstStop > 0 && firstStop < 400) {
      lede = brand.description.slice(0, firstStop + 1);
      bodyText = brand.description.slice(firstStop + 2);
    }
  }

  // If the DB already has newlines, respect them; otherwise split into ~3-sentence chunks.
  const rawParagraphs = bodyText.split('\n').map(p => p.trim()).filter(p => p.length > 0);
  const bodyParagraphs: string[] = rawParagraphs.length > 1
    ? rawParagraphs
    : (() => {
        // Split on sentence boundaries (real words only), then group every 3 sentences.
        const sentences = bodyText
          .split(/(?<=[A-Za-zÀ-ÿ0-9]{3,}[.!?])\s+(?=[A-Z"'])/)
          .map(s => s.trim())
          .filter(s => s.length > 0);
        const chunks: string[] = [];
        for (let i = 0; i < sentences.length; i += 3) {
          chunks.push(sentences.slice(i, i + 3).join(' '));
        }
        return chunks;
      })();

  const brandAsArray: Brand[] = [brand];

  return (
    <div className="container mx-auto px-8 sm:px-12 lg:px-16 py-20 max-w-7xl">

      {/* Back button */}
      <div className="mb-10">
        <button
          onClick={handleBackClick}
          className="inline-flex items-center gap-2 text-white/50 hover:text-white/90 transition-colors duration-300 text-sm font-light tracking-wide"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 19l-7-7 7-7" />
          </svg>
          {navigationState ? 'Back' : 'All Watches'}
        </button>
      </div>

      {/* ── Hero: logo + description ── */}
      <ScrollFade>
        <header className="mb-16">

          {/* Logo or brand name — left-aligned */}
          {brand.image && !logoError ? (
            <div className="mb-10">
              <Image
                src={logoSrc || imageTransformations.logo(brand.image)}
                alt={`${brand.name} logo`}
                width={800}
                height={200}
                sizes="(min-width: 1024px) 600px, 80vw"
                className="h-24 md:h-32 w-auto object-contain"
                priority
                onError={() => setLogoError(true)}
              />
            </div>
          ) : (
            <h1 className="text-5xl font-playfair font-light text-[#f0e6d2] mb-10">{brand.name}</h1>
          )}

          <div className="w-full border-t border-white/10 mb-12" />

          {/* Description — lede always visible; body collapses with fade + Read more */}
          <div className="max-w-3xl">
            {lede && (
              <p className="text-base md:text-lg font-playfair font-light text-[#f0e6d2]/85 leading-8 mb-6 pb-6 border-b border-white/10">
                {lede}
              </p>
            )}

            {bodyParagraphs.length > 0 && (
              <>
                {/* Collapsible body — fade is scoped inside so it never overlaps the button */}
                <div className="relative">
                  <motion.div
                    initial={{ height: '7rem' }}
                    animate={{ height: descExpanded ? 'auto' : '7rem' }}
                    transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
                    className="overflow-hidden"
                  >
                    {bodyParagraphs.map((paragraph, index) => (
                      <p key={index} className="text-sm text-white/55 font-light leading-7 tracking-wide mb-5">
                        {paragraph}
                      </p>
                    ))}
                  </motion.div>

                  {/* Fade gradient — contained within the text box only */}
                  {!descExpanded && (
                    <div className="absolute bottom-0 left-0 right-0 h-12 bg-gradient-to-t from-[#1a120d]/70 to-transparent pointer-events-none" />
                  )}
                </div>

                {/* Button sits below the text box, never covered by the fade */}
                <button
                  onClick={() => setDescExpanded(v => !v)}
                  className="mt-4 flex items-center gap-1.5 text-xs tracking-widest uppercase text-[#bfa68a] hover:text-[#f0e6d2] transition-colors duration-300 font-light"
                >
                  {descExpanded ? 'Read less' : 'Read more'}
                  <svg
                    className={`w-3 h-3 transition-transform duration-300 ${descExpanded ? 'rotate-180' : ''}`}
                    fill="none" stroke="currentColor" viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
              </>
            )}
          </div>

        </header>
      </ScrollFade>

      <div className="w-full border-t border-white/10 mb-16" />

      {/* ── Collections ── */}
      {collections.length > 0 && (
        <section className="mb-16">
          <ScrollFade>
            <h2 className="text-2xl font-playfair font-semibold text-[#f0e6d2] mb-0">Collections</h2>
          </ScrollFade>

          <div className="max-w-2xl">
            {collections.map(collection => (
              <ScrollFade key={collection.id}>
                <CollectionListItem collection={collection} />
              </ScrollFade>
            ))}
            {/* Close the list with a bottom border */}
            <div className="border-t border-white/10" />
          </div>
        </section>
      )}

      <div className="w-full border-t border-white/10 mb-16" />

      {/* ── Watches ── */}
      <section>
        <ScrollFade>
          <h2 className="text-2xl font-playfair font-semibold text-[#f0e6d2] mb-12">Timepieces</h2>
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
                collections={collections}
                isPriority={index < 4}
                currentPage={1}
              />
            ))}
          </div>
        ) : (
          <p className="text-white/50 text-sm font-playfair">No watches available for this brand yet.</p>
        )}
      </section>

    </div>
  );
};

export default BrandPage;
