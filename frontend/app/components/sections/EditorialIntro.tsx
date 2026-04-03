'use client';

// Editorial introduction section — shown between the video hero and style discovery.
// Gives the user brand context before any interactive elements appear.
// Reuses HeroHeading for its existing GSAP word-by-word reveal animation.
import Link from 'next/link';
import HeroHeading from './HeroHeading';

export default function EditorialIntro() {
  return (
    <section className="container mx-auto px-8 pt-36 pb-24">
      <div className="max-w-3xl mx-auto text-center">
        <p className="text-[10px] tracking-[0.3em] uppercase text-[#bfa68a] mb-5 font-inter">
          The Art of Timekeeping
        </p>
        <h1 className="text-5xl md:text-6xl font-playfair font-light mb-6 tourbillon-text-color leading-tight">
          <HeroHeading />
        </h1>
        <p className="text-base mb-12 tourbillon-text-color opacity-60 max-w-xl mx-auto">
          Exceptional timepieces from the world&apos;s finest maisons, curated for the discerning collector.
        </p>
        <div className="flex gap-4 justify-center">
          <Link
            href="/watches"
            className="text-[11px] tracking-[0.12em] uppercase px-7 py-3.5 border border-[#bfa68a] text-[#bfa68a] hover:bg-[#bfa68a]/10 transition-colors duration-300 font-inter"
          >
            Explore Watches
          </Link>
          <Link
            href="/stories"
            className="text-[11px] tracking-[0.12em] uppercase px-7 py-3.5 border border-[#2a2018] text-[#706050] hover:border-[#3a3028] hover:text-[#a09080] transition-colors duration-300 font-inter"
          >
            Our Story
          </Link>
        </div>
      </div>
    </section>
  );
}
