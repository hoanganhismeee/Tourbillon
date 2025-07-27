import ScrollFade from "../scrollMotion/ScrollFade";

// This component renders the Stories page, which will feature articles and content.
export default function StoriesPage() {
  return (
    <ScrollFade>
    <div className="container mx-auto px-8 py-24 pt-32">
      <h1 className="text-5xl font-playfair font-bold mb-8 tourbillon-text-color">Stories</h1>
      <p className="text-lg tourbillon-text-color opacity-80">Read inspiring stories from our watchmakers and collectors.</p>
    </div>
    </ScrollFade>
  );
} 