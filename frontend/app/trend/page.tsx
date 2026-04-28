import TrendSignInCta from './TrendSignInCta';
import TrendWatchDnaStudio from './TrendWatchDnaStudio';
import TrendStaffPicks from './TrendStaffPicks';
import TrendMostViewed from './TrendMostViewed';
import ScrollFade from '../scrollMotion/ScrollFade';

export default function TrendPage() {
  return (
    <main className="relative overflow-hidden pt-10">

      <section className="relative min-h-[calc(100svh-88px)] px-10 py-20 pt-20 lg:px-24">
        <div>
          <ScrollFade>
            <div className="max-w-5xl">
              <div className="w-10 h-px bg-[#bfa68a]/55 mb-10" />
              <h1 className="font-playfair font-light leading-[1.08] text-[#f0e6d2]" style={{ fontSize: 'clamp(3rem, 6.5vw, 5.5rem)' }}>
                Curated, trending,
                <br />
                <span className="text-[#f0e6d2]/55">and unmistakably yours.</span>
              </h1>
              <div className="mt-10 flex items-start gap-6 max-w-2xl">
                <div className="w-6 h-px bg-[#bfa68a]/45 flex-shrink-0 mt-[0.6em]" />
                <p className="text-[13px] leading-relaxed text-white/45 text-balance">
                  Staff picks from our editors, the pieces the room keeps returning to, and a personal Watch DNA built from how you browse.
                </p>
              </div>
            </div>
          </ScrollFade>

          <div className="mt-20">
            <TrendStaffPicks />
          </div>

          <div className="mt-20">
            <TrendMostViewed />
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
