'use client';

// Cinematic interstitial — Phase 10 Sprint A2.
// Positioned between StyleArchetypeGrid and BrandShowcaseSection.
// Movement.mp4 loops as background; editorial text overlay left-aligned.
import Link from 'next/link';

export default function ProductVideoSection() {
  return (
    <section className="relative h-[70vh] overflow-hidden flex items-end pb-[18%]">
      <video
        className="absolute inset-0 w-full h-full object-cover"
        src="/Movement.mp4"
        autoPlay
        muted
        loop
        playsInline
      />
      {/* Gradient: dark left edge for text readability, fades to transparent right */}
      <div className="absolute inset-0 bg-gradient-to-r from-black/75 via-black/35 to-transparent" />
      {/* Bottom vignette */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />

      <div className="relative px-12 md:px-20 lg:px-28">
        <p className="text-[10px] tracking-[0.3em] uppercase text-[#bfa68a] mb-4 font-inter">
          The Craft
        </p>
        <h2 className="text-4xl md:text-5xl lg:text-6xl font-playfair font-light text-[#f0e6d2] mb-6 leading-tight">
          Precision. Heritage. Time.
        </h2>
        <Link
          href="/watches"
          className="text-[11px] tracking-[0.15em] uppercase text-white/50 hover:text-white/80 transition-colors duration-300 font-inter"
        >
          Explore the Collection →
        </Link>
      </div>
    </section>
  );
}
