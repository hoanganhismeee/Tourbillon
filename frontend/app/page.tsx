// Landing page: video hero → editorial intro → style discovery
//               → brand showcase → AI search → Watch DNA.
import Link from 'next/link';
import VideoSection from "./components/homepage/VideoSection";
import EditorialIntro from "./components/homepage/EditorialIntro";
import WatchFinderSearch from "./components/WatchFinderSearch";
import StyleArchetypeGrid from "./components/homepage/StyleArchetypeGrid";
import BrandShowcaseSection from "./components/homepage/BrandShowcaseSection";
import WatchDnaSpotlight from "./components/homepage/WatchDnaSpotlight";
import ScrollFade from "./scrollMotion/ScrollFade";

export default function Home() {
  return (
    <>
      <VideoSection />

      {/* Brand statement — gives context before any interactive element */}
      <ScrollFade>
        <EditorialIntro />
      </ScrollFade>

      {/* Archetype Introduction Header */}
      <section className="w-full flex flex-col items-center justify-center pt-20 pb-0 px-8 text-center bg-transparent z-10 relative pointer-events-none">
        <ScrollFade>
          <div className="flex flex-col items-center">
            <p className="text-[10px] tracking-[0.35em] uppercase text-[#bfa68a] mb-6 font-inter">
              Curated Collections
            </p>
            <h2 className="text-4xl md:text-5xl font-playfair font-light text-[#f0e6d2] mb-12">
              Discover Your Archetype
            </h2>
            <div className="w-[1px] h-32 bg-gradient-to-b from-[#bfa68a]/40 to-transparent relative z-20"></div>
          </div>
        </ScrollFade>
      </section>

      {/* Discover by style — 4 full-width archetype rows linking to filtered /watches */}
      <div className="-mt-32 relative z-0">
        <StyleArchetypeGrid />
      </div>

      {/* Brand showcase: Holy Trinity + more brands */}
      <BrandShowcaseSection />

      {/* Smart search — natural language watch finder */}
      <section className="relative py-28 px-8 md:px-16 border-y border-white/[0.06] overflow-hidden">
        {/* Ambient glow behind the input */}
        <div
          className="absolute inset-0 pointer-events-none mix-blend-screen"
          style={{ background: 'radial-gradient(ellipse 60% 60% at 50% 60%, rgba(191,166,138,0.08) 0%, transparent 70%)' }}
        />
        <div className="max-w-4xl mx-auto relative">
          <ScrollFade>
            <div className="mb-12 text-center relative">
              <p className="text-[10px] tracking-[0.3em] uppercase text-[#bfa68a]/70 mb-5 font-inter">
                Smart Search
              </p>
              <h2 className="font-playfair font-light text-[#f0e6d2] leading-tight"
                style={{ fontSize: 'clamp(2rem, 4vw, 3.25rem)' }}>
                Describe your ideal watch
              </h2>
            </div>
          </ScrollFade>
          <WatchFinderSearch />
        </div>
      </section>


      {/* Watch DNA — personalization closing hook */}
      <WatchDnaSpotlight />

      {/* Pre-footer editorial CTA — moved from footer */}
      <section className="py-20 px-8 md:px-16 text-center border-t border-white/[0.06]">
        <ScrollFade>
          <p className="text-[10px] tracking-[0.35em] uppercase text-[#bfa68a] mb-5 font-inter">
            Private Access
          </p>
          <h2
            className="font-playfair font-light text-[#f0e6d2] mb-4 leading-tight"
            style={{ fontSize: 'clamp(2rem, 4.5vw, 3.5rem)' }}
          >
            Begin your collection.
          </h2>
          <p className="text-sm text-white/35 font-inter mb-10 max-w-xs mx-auto">
            Private viewings available in London. By appointment only.
          </p>
          <Link
            href="/contact"
            className="relative inline-flex items-center justify-center text-[10px] uppercase tracking-[0.3em] text-[#bfa68a] border border-[#bfa68a]/25 px-12 py-4 hover:bg-[#bfa68a]/8 hover:border-[#bfa68a]/40 transition-all duration-500 group overflow-hidden mx-auto"
          >
            <span className="transform transition-transform duration-500 group-hover:-translate-x-3">
              Book a Private Viewing
            </span>
            <span className="absolute right-6 opacity-0 -translate-x-4 transition-all duration-500 group-hover:opacity-100 group-hover:translate-x-0 text-[14px]">
              →
            </span>
          </Link>
        </ScrollFade>
      </section>
    </>
  );
}
