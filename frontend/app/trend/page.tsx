import TrendSignInCta from './TrendSignInCta';
import TrendWatchDnaStudio from './TrendWatchDnaStudio';

export default function TrendPage() {
  return (
    <main className="relative overflow-hidden pt-10">

      <section className="relative min-h-[calc(100svh-88px)] px-6 py-20 pt-20 md:px-10 lg:px-24">
        <div className="mx-auto max-w-7xl">
          <div className="max-w-3xl border-l border-[#bfa68a]/35 pl-7 md:pl-10">
            <p className="text-[10px] uppercase tracking-[0.45em] text-[#bfa68a]/80">
              Trend
            </p>
            <h1 className="mt-5 font-playfair font-light leading-tight text-[#f0e6d2]" style={{ fontSize: 'clamp(2.5rem, 5vw, 4rem)' }}>
              Watch DNA, moved into the flow of discovery.
            </h1>
            <p className="mt-6 max-w-xl text-[13.5px] leading-relaxed text-white/50 text-balance">
              Recent browsing now sharpens your first rows automatically. The wider catalogue stays stable, so the feed feels guided rather than re-written.
            </p>
          </div>

          <div className="mt-20">
            <TrendWatchDnaStudio />
            <TrendSignInCta />
          </div>
        </div>
      </section>
    </main>
  );
}
