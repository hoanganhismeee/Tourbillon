// Stories page — editorial brand storytelling for Tourbillon.
// Magazine structure: chapter markers, a pocket-watch craft centerpiece, and
// featured pieces as full-width alternating rows. Visual language matches the
// Trend page (Playfair, gold accents, ScrollFade).
import Link from "next/link";
import PocketWatch from "../components/decorations/PocketWatch";
import ScrollFade from "../scrollMotion/ScrollFade";
import StoriesFeatured from "./StoriesFeatured";

function ChapterMark({ number, label }: { number: string; label: string }) {
  return (
    <div className="flex items-baseline gap-5">
      <span className="font-playfair text-2xl font-light text-[#bfa68a]/45">{number}</span>
      <span className="h-px w-8 translate-y-[-0.35em] bg-[#bfa68a]/30" />
      <p className="text-[10px] uppercase tracking-[0.45em] text-[#bfa68a]/80">{label}</p>
    </div>
  );
}

export default function StoriesPage() {
  return (
    <main className="relative overflow-hidden pt-10 text-white">
      <section className="relative px-10 py-20 pt-20 lg:px-24">
        <div className="mx-auto max-w-5xl">
          {/* Hero */}
          <ScrollFade>
            <div className="max-w-4xl">
              <div className="mb-10 h-px w-10 bg-[#bfa68a]/55" />
              <p className="mb-6 text-[10px] uppercase tracking-[0.5em] text-[#bfa68a]/70">
                The Tourbillon Journal
              </p>
              <h1
                className="font-playfair font-light leading-[1.03] tracking-[-0.01em] text-[#f0e6d2]"
                style={{ fontSize: "clamp(3rem, 6.8vw, 5.75rem)" }}
              >
                Every watch
                <br />
                <span className="italic text-[#f0e6d2]/55">keeps a story.</span>
              </h1>
              <div className="mt-10 flex max-w-2xl items-start gap-6">
                <div className="mt-[0.7em] h-px w-6 flex-shrink-0 bg-[#bfa68a]/45" />
                <p className="font-light leading-relaxed tracking-wide text-white/50 text-balance">
                  Where Tourbillon began, the craft we keep returning to, and the pieces from
                  the catalogue worth slowing down for.
                </p>
              </div>
            </div>
          </ScrollFade>

          {/* Chapter 01 — Origin */}
          <section className="mt-28 border-t border-[#bfa68a]/12 pt-12">
            <ScrollFade>
              <ChapterMark number="01" label="Origin" />
            </ScrollFade>
            <ScrollFade>
              <h2
                className="mt-7 max-w-3xl font-playfair font-light leading-[1.12] tracking-[-0.005em] text-[#f0e6d2]"
                style={{ fontSize: "clamp(2rem, 4vw, 3.25rem)" }}
              >
                A quiet obsession with{" "}
                <span className="italic text-[#f0e6d2]/70">how time is kept.</span>
              </h2>
            </ScrollFade>
            <ScrollFade>
              <div className="mt-8 grid gap-8 md:grid-cols-2 md:gap-14">
                <p className="text-[15.5px] font-light leading-[1.9] text-white/55">
                  Tourbillon grew out of a long fascination with Vacheron Constantin — the
                  history, the restraint of the design, and the sheer density of mechanical
                  detail folded into something you can wear on a wrist. The more you look, the
                  more there is to see.
                </p>
                <p className="text-[15.5px] font-light leading-[1.9] text-white/55">
                  That fascination became a question: what would it take to build a place worthy
                  of pieces like these? Not a plain product list, but a platform with the
                  patience of a good boutique — somewhere to browse, compare, ask, and return to.
                </p>
              </div>
            </ScrollFade>
            <ScrollFade>
              <blockquote className="mt-12 max-w-3xl border-l border-[#bfa68a]/40 pl-7 font-playfair text-xl italic leading-relaxed text-[#f0e6d2]/85 md:text-2xl">
                How an object keeps time is a story worth telling well.
              </blockquote>
            </ScrollFade>
          </section>

          {/* Chapter 02 — Craft (pocket watch centerpiece) */}
          <section className="mt-28 border-t border-[#bfa68a]/12 pt-12">
            <ScrollFade>
              <ChapterMark number="02" label="Craft" />
            </ScrollFade>
            <div className="mt-7 grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
              <ScrollFade>
                <div className="max-w-md">
                  <h2
                    className="font-playfair font-light leading-[1.12] text-[#f0e6d2]"
                    style={{ fontSize: "clamp(2rem, 4vw, 3.25rem)" }}
                  >
                    Complication, <span className="italic text-[#f0e6d2]/70">by hand.</span>
                  </h2>
                  <p className="mt-7 text-[15.5px] font-light leading-[1.9] text-white/55">
                    A grand complication asks a movement to do several things at once — track the
                    date across leap years, follow the moon, mark the running seconds — and to do
                    them quietly, for a lifetime. That is the standard the catalogue is measured
                    against.
                  </p>
                  <p className="mt-5 font-playfair text-base italic text-[#f0e6d2]/80">
                    Perpetual calendar · moon phase · running seconds
                  </p>
                </div>
              </ScrollFade>
              <ScrollFade>
                <div className="flex justify-center lg:justify-end">
                  <PocketWatch size={300} variant="champagne" />
                </div>
              </ScrollFade>
            </div>
          </section>

          {/* Chapter 03 — The pieces */}
          <section className="mt-28 border-t border-[#bfa68a]/12 pt-12">
            <ScrollFade>
              <ChapterMark number="03" label="The pieces" />
            </ScrollFade>
            <ScrollFade>
              <h2
                className="mt-7 max-w-3xl font-playfair font-light leading-[1.12] text-[#f0e6d2]"
                style={{ fontSize: "clamp(2rem, 4vw, 3.25rem)" }}
              >
                A handful worth <span className="italic text-[#f0e6d2]/70">slowing down for.</span>
              </h2>
            </ScrollFade>
            <StoriesFeatured />
          </section>

          {/* Closing CTA */}
          <section className="mt-28 border-t border-[#bfa68a]/12 pt-12">
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
