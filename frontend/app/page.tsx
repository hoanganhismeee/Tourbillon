// This component renders the homepage, providing a welcoming introduction to the Tourbillon watch collection.
// It matches the styling theme of other pages for consistency.
import ScrollFade from "./scrollMotion/ScrollFade";
// import StaggeredFade from "./scrollMotion/StaggeredFade";
// use ScrollFade for independent animations (from bottom to top)
// use StaggeredFade for animations that require a delay between items (from top to bottom)

export default function Home() {
  return (
    <div className="container mx-auto px-8 py-24 pt-32">
      <div className="max-w-4xl mx-auto text-center">
        <ScrollFade>
          <h1 className="text-6xl font-playfair font-bold mb-8 tourbillon-text-color">
            Welcome to Tourbillon
          </h1>
        </ScrollFade>
        <ScrollFade>
          <p className="text-xl mb-12 tourbillon-text-color opacity-80 max-w-2xl mx-auto">
            Experience the precision and elegance of mechanical timepieces. Discover our curated collection of luxury watches from the world&apos;s finest manufacturers.
          </p>
        </ScrollFade>
        <ScrollFade>
          <div className="flex flex-col sm:flex-row gap-6 justify-center">
          </div>
        </ScrollFade>
      </div>
    </div>
  );
}
