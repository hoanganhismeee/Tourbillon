// Landing page: video hero → editorial intro → style discovery
//               → brand showcase → AI search → Watch DNA.
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
    </>
  );
}
