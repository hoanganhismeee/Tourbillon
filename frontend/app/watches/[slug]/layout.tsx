// Server-side metadata + JSON-LD wrapper for the watch detail route.
// The page itself stays a client component (interactive panels, scroll, motion);
// this layout adds per-watch <title>, description, Open Graph image, canonical
// URL, and a Product JSON-LD block so search engines can index each watch.

import type { Metadata } from 'next';
import type { ReactNode } from 'react';

interface ServerWatch {
  id: number;
  name: string;
  slug: string;
  description?: string | null;
  imageUrl?: string | null;
  currentPrice: number;
  brandSlug?: string | null;
  collectionSlug?: string | null;
}

const BACKEND_URL = process.env.BACKEND_INTERNAL_URL || 'http://localhost:5248/api';
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://tourbillon.example.com';
// Bail out fast on prefetch — when the dev backend is slow, Next.js's internal
// undici timeout would otherwise log a noisy TimeoutError DOMException for every
// hovered WatchCard. 2.5s is generous for a single Watch row, well under the
// noise threshold.
const FETCH_TIMEOUT_MS = 2500;

async function fetchWatch(slug: string): Promise<ServerWatch | null> {
  try {
    const res = await fetch(`${BACKEND_URL}/watch/by-slug/${encodeURIComponent(slug)}`, {
      next: { revalidate: 3600, tags: [`watch:${slug}`] },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!res.ok) return null;
    return (await res.json()) as ServerWatch;
  } catch {
    // Backend slow or unreachable — render the page without metadata rather
    // than failing the prefetch. Production cache will warm up after the first
    // successful fetch (revalidate: 3600).
    return null;
  }
}

function buildBrandLabel(slug: string | null | undefined): string | null {
  if (!slug) return null;
  return slug
    .split('-')
    .map(part => part.length === 0 ? part : part[0].toUpperCase() + part.slice(1))
    .join(' ');
}

export async function generateMetadata(
  { params }: { params: Promise<{ slug: string }> },
): Promise<Metadata> {
  const { slug } = await params;
  const watch = await fetchWatch(slug);
  if (!watch) {
    return { title: 'Watch — Tourbillon' };
  }

  const brandLabel = buildBrandLabel(watch.brandSlug);
  const title = brandLabel ? `${brandLabel} ${watch.name} — Tourbillon` : `${watch.name} — Tourbillon`;
  const rawDescription = (watch.description ?? '').replace(/\s+/g, ' ').trim();
  const description = rawDescription.length > 0
    ? rawDescription.slice(0, 200)
    : `Discover the ${watch.name} on Tourbillon — specifications, pricing, and editorial context for luxury watch collectors.`;
  const canonical = `${SITE_URL}/watches/${watch.slug}`;
  const image = watch.imageUrl ?? undefined;

  return {
    title,
    description,
    alternates: { canonical },
    openGraph: {
      title,
      description,
      url: canonical,
      type: 'website',
      images: image ? [{ url: image, alt: watch.name }] : undefined,
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: image ? [image] : undefined,
    },
  };
}

export default async function WatchDetailLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const watch = await fetchWatch(slug);

  const jsonLd = watch
    ? {
        '@context': 'https://schema.org',
        '@type': 'Product',
        name: watch.name,
        sku: watch.slug,
        image: watch.imageUrl ?? undefined,
        description: (watch.description ?? '').replace(/\s+/g, ' ').trim() || undefined,
        brand: buildBrandLabel(watch.brandSlug)
          ? { '@type': 'Brand', name: buildBrandLabel(watch.brandSlug) }
          : undefined,
        url: `${SITE_URL}/watches/${watch.slug}`,
        offers: {
          '@type': 'Offer',
          url: `${SITE_URL}/watches/${watch.slug}`,
          priceCurrency: 'USD',
          // Price 0 = Price on Request; omit price entirely so Google doesn't see "$0".
          price: watch.currentPrice > 0 ? watch.currentPrice : undefined,
          availability: 'https://schema.org/InStock',
        },
      }
    : null;

  return (
    <>
      {jsonLd ? (
        <script
          type="application/ld+json"
          // Inline JSON-LD: must be raw JSON in a <script>, dangerouslySetInnerHTML is the standard pattern.
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      ) : null}
      {children}
    </>
  );
}
