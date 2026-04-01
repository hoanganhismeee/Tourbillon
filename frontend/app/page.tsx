// Landing page: full-screen video hero + AI search bar below the fold.
import VideoSection from "./components/sections/VideoSection";
import HeroHeading from "./components/sections/HeroHeading";
import WatchFinderSearch from "./components/WatchFinderSearch";
import TasteCTA from "./components/TasteCTA";

export default function Home() {
  return (
    <>
      <VideoSection />
      <div className="container mx-auto px-8 pt-36 pb-32">
        <div className="max-w-3xl mx-auto text-center">
          <h1 className="text-6xl font-playfair font-light mb-5 tourbillon-text-color leading-tight">
            <HeroHeading />
          </h1>
          <p className="text-base mb-12 tourbillon-text-color opacity-60 max-w-xl mx-auto">
            Exceptional timepieces from the world&apos;s finest maisons, curated for the discerning collector.
          </p>
          <WatchFinderSearch />
          <TasteCTA />
        </div>
      </div>
    </>
  );
}
