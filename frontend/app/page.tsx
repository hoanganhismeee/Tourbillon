// This component renders the homepage, providing a welcoming introduction to the Tourbillon watch collection.
// It matches the styling theme of other pages for consistency.
export default function Home() {
  return (
    <div className="min-h-screen container mx-auto px-4 py-12">
      <div className="max-w-4xl mx-auto text-center">
        <h1 className="text-6xl font-playfair font-bold mb-8 tourbillon-text-color">
          Welcome to Tourbillon
        </h1>
        <p className="text-xl mb-12 tourbillon-text-color opacity-80 max-w-2xl mx-auto">
          Experience the precision and elegance of mechanical timepieces. Discover our curated collection of luxury watches from the world&apos;s finest manufacturers.
        </p>
        <div className="flex flex-col sm:flex-row gap-6 justify-center">
        </div>
      </div>
    </div>
  );
}
