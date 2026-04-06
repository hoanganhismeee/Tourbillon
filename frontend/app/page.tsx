// Landing page: video hero → editorial intro → style discovery
//               → brand showcase → AI search → Watch DNA.
import VideoSection from "./components/sections/VideoSection";
import EditorialIntro from "./components/sections/EditorialIntro";
import WatchFinderSearch from "./components/WatchFinderSearch";
import TasteCTA from "./components/TasteCTA";
import StyleArchetypeGrid from "./components/sections/StyleArchetypeGrid";
import BrandShowcaseSection from "./components/sections/BrandShowcaseSection";
import WatchDnaSpotlight from "./components/sections/WatchDnaSpotlight";
import ScrollFade from "./scrollMotion/ScrollFade";

export default function Home() {
  return (
    <>
      <VideoSection />

      {/* Brand statement — gives context before any interactive element */}
      <ScrollFade>
        <EditorialIntro />
      </ScrollFade>

      {/* Discover by style — 4 full-width archetype rows linking to filtered /watches */}
      <StyleArchetypeGrid />

      {/* Brand showcase: Holy Trinity + more brands */}
      <BrandShowcaseSection />

      {/* AI search — positioned after browsing context as a discovery fallback */}
      <section className="py-24 px-8 md:px-16 border-y border-white/10">
        <div className="max-w-4xl mx-auto">
          <ScrollFade>
            <div className="mb-10">
              <p className="text-[10px] tracking-[0.35em] uppercase text-[#bfa68a] mb-4 font-inter">
                AI-Powered Discovery
              </p>
              <h2 className="font-playfair font-light text-[#f0e6d2] leading-tight mb-2"
                style={{ fontSize: 'clamp(2rem, 4vw, 3.25rem)' }}>
                Describe your ideal watch
              </h2>
              <p className="text-sm text-white/35 font-inter max-w-md">
                Our AI reads intent, not keywords — tell it what you want.
              </p>
            </div>
          </ScrollFade>
          <WatchFinderSearch />
          <TasteCTA />
        </div>
      </section>

      {/* Watch DNA — personalization closing hook */}
      <WatchDnaSpotlight />
    </>
  );
}
