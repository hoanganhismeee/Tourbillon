// Stories page — editorial brand storytelling for Tourbillon.
// Founding story, a pocket-watch craft centerpiece, and a featured catalogue strip.
// Visual language matches the Trend page (Playfair, gold accents, ScrollFade).
import Link from "next/link";
import PocketWatch from "../components/decorations/PocketWatch";
import ScrollFade from "../scrollMotion/ScrollFade";
import StoriesFeatured from "./StoriesFeatured";

export default function StoriesPage() {
  return (
    <main className="relative overflow-hidden pt-10 text-white">
      <section className="relative px-10 py-20 pt-20 lg:px-24">
        <div className="mx-auto max-w-5xl">
          {/* Hero */}
          <ScrollFade>
            <div className="max-w-4xl">
              <div className="mb-10 h-px w-10 bg-[#bfa68a]/55" />
              <h1
                className="font-playfair font-light leading-[1.08] text-[#f0e6d2]"
                style={{ fontSize: "clamp(3rem, 6.5vw, 5.5rem)" }}
              >
                Every watch
                <br />
                <span className="text-[#f0e6d2]/55">keeps a story.</span>
              </h1>
              <div className="mt-10 flex max-w-2xl items-start gap-6">
                <div className="mt-[0.6em] h-px w-6 flex-shrink-0 bg-[#bfa68a]/45" />
                <p className="text-[13px] leading-relaxed text-white/45 text-balance">
                  Where Tourbillon began, why mechanical horology still moves us, and the
                  pieces from the catalogue worth slowing down for.
                </p>
              </div>
            </div>
          </ScrollFade>

          {/* The founding story */}
          <section className="mt-20 border-t border-[#bfa68a]/12 pt-12">
            <ScrollFade>
              <div>
                <p className="text-[10px] uppercase tracking-[0.45em] text-[#bfa68a]/80">
                  Where it started
                </p>
                <h2
                  className="mt-4 font-playfair font-light leading-tight text-[#f0e6d2]"
                  style={{ fontSize: "clamp(1.8rem, 3.5vw, 3rem)" }}
                >
                  A quiet obsession with how time is kept.
                </h2>
              </div>
            </ScrollFade>
            <ScrollFade>
              <div className="mt-7 max-w-2xl space-y-5 text-[15px] leading-8 text-white/55">
                <p>
                  Tourbillon grew out of a long fascination with Vacheron Constantin — the
                  history, the restraint of the design, and the sheer density of mechanical
                  detail folded into something you can wear on a wrist. The more you look, the
                  more there is to see.
                </p>
                <p>
                  That fascination became a question: what would it take to build a place
                  worthy of pieces like these? Not a plain product list, but a platform with
                  the patience of a good boutique — somewhere to browse, compare, ask, and
                  return to.
                </p>
                <p>
                  So we built one. Tourbillon is that platform: a considered home for luxury
                  watches, shaped by the belief that how an object keeps time is a story worth
                  telling well.
                </p>
              </div>
            </ScrollFade>
          </section>

          {/* The movement — pocket watch centerpiece */}
          <section className="mt-20 border-t border-[#bfa68a]/12 pt-12">
            <ScrollFade>
              <div>
                <p className="text-[10px] uppercase tracking-[0.45em] text-[#bfa68a]/80">
                  The movement
                </p>
                <h2
                  className="mt-4 font-playfair font-light leading-tight text-[#f0e6d2]"
                  style={{ fontSize: "clamp(1.8rem, 3.5vw, 3rem)" }}
                >
                  Complication, by hand.
                </h2>
              </div>
            </ScrollFade>
            <ScrollFade>
              <div className="mt-12 flex flex-col items-center gap-6">
                <PocketWatch size={300} variant="champagne" />
                <div className="max-w-md text-center">
                  <p className="font-playfair text-lg text-[#f0e6d2]">Grand Complication</p>
                  <p className="mt-2 text-[13px] leading-7 text-white/45">
                    Perpetual calendar, moon phase, running seconds. A champagne dial with
                    cream-gold indices — the kind of quiet mechanical theatre that started all
                    of this.
                  </p>
                </div>
              </div>
            </ScrollFade>
          </section>

          {/* Featured watches from the catalogue */}
          <div className="mt-20">
            <StoriesFeatured />
          </div>

          {/* Closing CTA */}
          <section className="mt-20 border-t border-[#bfa68a]/12 pt-12">
            <ScrollFade>
              <div className="max-w-2xl">
                <h2
                  className="font-playfair font-light leading-tight text-[#f0e6d2]"
                  style={{ fontSize: "clamp(1.6rem, 3vw, 2.4rem)" }}
                >
                  Find the one that&apos;s yours.
                </h2>
                <p className="mt-4 text-[13px] leading-relaxed text-white/45">
                  The full collection is a few clicks away — filter by brand, complication, or
                  feel, and let it tell you its story.
                </p>
                <Link
                  href="/watches"
                  className="group relative mt-8 inline-flex items-center justify-center overflow-hidden border border-[#bfa68a]/25 px-12 py-4 text-[10px] uppercase tracking-[0.3em] text-[#bfa68a] transition-all duration-500 hover:border-[#bfa68a]/40 hover:bg-[#bfa68a]/8"
                >
                  <span className="transform transition-transform duration-500 group-hover:-translate-x-3">
                    Explore the catalogue
                  </span>
                  <span className="absolute right-6 -translate-x-4 text-[14px] opacity-0 transition-all duration-500 group-hover:translate-x-0 group-hover:opacity-100">
                    →
                  </span>
                </Link>
              </div>
            </ScrollFade>
          </section>
        </div>
      </section>
    </main>
  );
}
