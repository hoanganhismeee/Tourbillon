// Landing page: video hero → editorial intro → style discovery → collection band
//               → brand showcase → AI search → Watch DNA.
import Link from 'next/link';
import VideoSection from "./components/sections/VideoSection";
import EditorialIntro from "./components/sections/EditorialIntro";
import WatchFinderSearch from "./components/WatchFinderSearch";
import TasteCTA from "./components/TasteCTA";
import StyleArchetypeGrid from "./components/sections/StyleArchetypeGrid";
import BrandShowcaseSection from "./components/sections/BrandShowcaseSection";
import WatchDnaSpotlight from "./components/sections/WatchDnaSpotlight";

export default function Home() {
  return (
    <>
      <VideoSection />

      {/* Brand statement — gives context before any interactive element */}
      <EditorialIntro />

      {/* Discover by style — 4 full-width archetype rows linking to filtered /watches */}
      <StyleArchetypeGrid />

      {/* Collection bridge — factual statement replacing the vague "Craft" video section */}
      <section className="py-24 px-8 md:px-16 border-y border-[#1a1714] bg-[#080706]">
        <div className="max-w-4xl">
          <p className="text-[10px] tracking-[0.3em] uppercase text-[#bfa68a] mb-6 font-inter">
            The Collection
          </p>
          <p className="font-playfair font-light text-[#f0e6d2] text-3xl md:text-4xl leading-relaxed mb-10">
            Thirteen of the world&apos;s most significant horological maisons,
            curated without compromise.
          </p>
          <Link
            href="/watches"
            className="text-[11px] tracking-[0.2em] uppercase text-[#bfa68a]/60 hover:text-[#bfa68a] transition-colors duration-300 font-inter"
          >
            Browse the full collection →
          </Link>
        </div>
      </section>

      {/* Brand showcase: Holy Trinity + more brands */}
      <BrandShowcaseSection />

      {/* AI search — positioned after browsing context as a discovery fallback */}
      <section className="py-20 px-8">
        <div className="max-w-2xl mx-auto text-center">
          <p className="text-[10px] tracking-[0.2em] uppercase text-[#bfa68a] mb-3 font-inter">
            AI-Powered Discovery
          </p>
          <h2 className="text-3xl font-playfair font-light text-[#f0e6d2] mb-3">
            Can&apos;t find what you&apos;re after?
          </h2>
          <p className="text-sm text-[#706050] italic mb-10">
            Describe your ideal watch — our AI will find it.
          </p>
          <WatchFinderSearch />
          <TasteCTA />
        </div>
      </section>

      {/* Watch DNA — personalization closing hook */}
      <WatchDnaSpotlight />
    </>
  );
}
