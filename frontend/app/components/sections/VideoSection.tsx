// Full-screen video hero for the homepage landing experience.
// Fills the entire viewport; scrolling down reveals the search section.
// Source: /public/tourbillon.mp4 (served as a static asset by Next.js).

export default function VideoSection() {
  return (
    <section
      className="relative w-full overflow-hidden"
      style={{ height: 'calc(100vh + 3rem + 50px)', marginTop: 'calc(-3rem - 50px)' }}
    >
      <video
        autoPlay
        muted
        loop
        playsInline
        className="absolute inset-0 w-full h-full object-cover"
      >
        <source src="/tourbillon.mp4" type="video/mp4" />
      </video>

      {/* Fade into page background so the search section below feels seamless */}
      <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-b from-transparent to-black" />

      {/* Scroll hint */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 text-white/40 text-xs tracking-[0.2em] uppercase animate-bounce select-none">
        scroll
      </div>
    </section>
  );
}
