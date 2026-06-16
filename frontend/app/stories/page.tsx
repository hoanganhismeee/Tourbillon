// Stories page — editorial brand storytelling for Tourbillon.
// Founding story with a sticky pocket watch companion (its scroll-driven hands
// stay visible while reading), then a featured catalogue strip.
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
                className="font-playfair font-light leading-[1.04] tracking-[-0.01em] text-[#f0e6d2]"
                style={{ fontSize: "clamp(3rem, 6.8vw, 5.75rem)" }}
              >
                Every watch
                <br />
                <span className="italic text-[#f0e6d2]/55">keeps a story.</span>
              </h1>
              <div className="mt-10 flex max-w-2xl items-start gap-6">
                <div className="mt-[0.7em] h-px w-6 flex-shrink-0 bg-[#bfa68a]/45" />
                <p className="font-light leading-relaxed tracking-wide text-white/50 text-balance">
                  Where Tourbillon began, why mechanical horology still moves us, and the
                  pieces from the catalogue worth slowing down for.
                </p>
              </div>
            </div>
          </ScrollFade>

          {/* The founding story — prose left, sticky pocket watch right */}
          <section className="mt-24 border-t border-[#bfa68a]/12 pt-12">
            <div className="grid gap-14 lg:grid-cols-[minmax(0,1fr)_260px] lg:gap-16">
              <div className="min-w-0">
                <ScrollFade>
                  <div>
                    <p className="text-[10px] uppercase tracking-[0.45em] text-[#bfa68a]/80">
                      Where it started
                    </p>
                    <h2
                      className="mt-5 font-playfair font-light leading-[1.12] tracking-[-0.005em] text-[#f0e6d2]"
                      style={{ fontSize: "clamp(2rem, 4vw, 3.25rem)" }}
                    >
                      A quiet obsession with
                      <br className="hidden sm:block" />{" "}
                      <span className="italic text-[#f0e6d2]/70">how time is kept.</span>
                    </h2>
                  </div>
                </ScrollFade>
                <ScrollFade>
                  <div className="mt-8 max-w-2xl space-y-6 text-[15.5px] font-light leading-[1.9] text-white/55">
                    <p>
                      Tourbillon grew out of a long fascination with Vacheron Constantin — the
                      history, the restraint of the design, and the sheer density of mechanical
                      detail folded into something you can wear on a wrist. The more you look,
                      the more there is to see.
                    </p>
                    <p>
                      That fascination became a question: what would it take to build a place
                      worthy of pieces like these? Not a plain product list, but a platform with
                      the patience of a good boutique — somewhere to browse, compare, ask, and
                      return to.
                    </p>
                  </div>
                </ScrollFade>
                <ScrollFade>
                  <blockquote className="mt-10 max-w-2xl border-l border-[#bfa68a]/40 pl-7 font-playfair text-xl italic leading-relaxed text-[#f0e6d2]/85 md:text-2xl">
                    How an object keeps time is a story worth telling well.
                  </blockquote>
                </ScrollFade>
              </div>

              {/* Sticky watch — winds as you scroll the story */}
              <aside className="hidden lg:sticky lg:top-28 lg:flex lg:h-fit lg:flex-col lg:items-center lg:gap-4">
                <PocketWatch size={240} variant="champagne" />
                <div className="text-center">
                  <p className="font-playfair text-base italic text-[#f0e6d2]/90">
                    Grand Complication
                  </p>
                  <p className="mt-1.5 text-[11px] leading-6 tracking-wide text-white/40">
                    Perpetual calendar, moon phase, running seconds.
                  </p>
                </div>
              </aside>
            </div>
          </section>

          {/* Featured watches from the catalogue */}
          <div className="mt-24">
            <StoriesFeatured />
          </div>

          {/* Closing CTA */}
          <section className="mt-24 border-t border-[#bfa68a]/12 pt-12">
            <ScrollFade>
              <div className="max-w-2xl">
                <h2
                  className="font-playfair font-light leading-[1.12] text-[#f0e6d2]"
                  style={{ fontSize: "clamp(1.7rem, 3.2vw, 2.6rem)" }}
                >
                  Find the one that&apos;s <span className="italic text-[#f0e6d2]/70">yours.</span>
                </h2>
                <p className="mt-5 font-light leading-relaxed tracking-wide text-white/50">
                  The full collection is a few clicks away — filter by brand, complication, or
                  feel, and let it tell you its story.
                </p>
                <Link
                  href="/watches"
                  className="group relative mt-9 inline-flex items-center justify-center overflow-hidden border border-[#bfa68a]/25 px-12 py-4 text-[10px] uppercase tracking-[0.3em] text-[#bfa68a] transition-all duration-500 hover:border-[#bfa68a]/40 hover:bg-[#bfa68a]/8"
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
