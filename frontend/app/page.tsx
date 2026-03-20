// Landing page: hero text + AI Watch Finder search bar
import WatchFinderSearch from "./components/WatchFinderSearch";

export default function Home() {
  return (
    <div className="container mx-auto px-8 py-24 pt-32">
      <div className="max-w-4xl mx-auto text-center">
        <h1 className="text-6xl font-playfair font-bold mb-8 tourbillon-text-color">
          Welcome to Tourbillon
        </h1>
        <p className="text-xl mb-12 tourbillon-text-color opacity-80 max-w-2xl mx-auto">
          Experience the precision and elegance of mechanical timepieces. Discover our curated collection of luxury watches from the world&apos;s finest manufacturers.
        </p>
        <WatchFinderSearch />
      </div>
    </div>
  );
}
