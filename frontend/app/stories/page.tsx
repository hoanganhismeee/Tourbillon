// Stories page — editorial brand storytelling for Tourbillon.
// A four-chapter journal: Origin (with the winding pocket watch), In passing
// (aphorisms on time), The measure (how we curate), and What it's for (back
// into the platform). Visual language matches the Trend page (Playfair, gold
// accents, ScrollFade) but the structure is deliberately text-forward, not a feed.
import Link from "next/link";
import PocketWatch from "../components/decorations/PocketWatch";
import ScrollFade from "../scrollMotion/ScrollFade";
import StoriesActions from "./StoriesActions";

// Chapter 02 — sparse single lines, revealed one at a time on scroll.
const APHORISMS = [
  "Precision you wear, not something you check.",
  "The best complication is patience.",
  "A machine we forgive for repeating itself.",
  "Kept by hand. Worn for a life.",
];

// Chapter 03 — what we look for, condensed to a word and a short line.
const PRINCIPLES = [
  { index: "01", title: "Proportion", tagline: "Nothing added, nothing spare." },
  { index: "02", title: "Finish", tagline: "Light, handled with patience." },
  { index: "03", title: "Movement", tagline: "Felt before it is understood." },
  { index: "04", title: "Restraint", tagline: "Knowing when to stop." },
];

function ChapterMark({ number, label }: { number: string; label: string }) {
  return (
    <div className="flex items-baseline gap-5">
      <span className="font-playfair text-2xl font-light text-[#bfa68a]/45">{number}</span>
      <span className="h-px w-8 translate-y-[-0.35em] bg-[#bfa68a]/30" />
      <p className="text-[10px] uppercase tracking-[0.45em] text-[#bfa68a]/80">{label}</p>
    </div>
  );
}

// One aphorism — large Playfair italic, alignment alternating down the page so
// the eye drifts as the watch above keeps winding.
function Aphorism({ text, index }: { text: string; index: number }) {
  const right = index % 2 === 1;
  return (
    <div className={`flex ${right ? "justify-end text-right" : "justify-start text-left"}`}>
      <div className="max-w-xl">
        <span className={`mb-6 block h-px w-12 bg-[#bfa68a]/40 ${right ? "ml-auto" : ""}`} />
        <p
          className="font-playfair font-light italic leading-[1.18] text-[#f0e6d2]/85"
          style={{ fontSize: "clamp(1.6rem, 3.6vw, 3rem)" }}
        >
          {text}
        </p>
      </div>
    </div>
  );
}

// One curation principle — a word and a single short line. No paragraphs.
function Measure({ index, title, tagline }: { index: string; title: string; tagline: string }) {
  return (
    <div className="group border-t border-[#bfa68a]/12 pt-6">
      <span className="text-[10px] tracking-[0.3em] text-[#bfa68a]/45">{index}</span>
      <h3 className="mt-3 font-playfair text-2xl font-light text-[#f0e6d2] transition-colors duration-500 group-hover:text-white md:text-3xl">
        {title}
      </h3>
      <p className="mt-2 text-[14px] font-light italic leading-relaxed text-white/45">{tagline}</p>
    </div>
  );
}

export default function StoriesPage() {
  return (
    <main className="relative overflow-hidden pt-10 text-white">
      <section className="relative px-10 py-20 pt-20 lg:px-24">
        <div>
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
                  Where Tourbillon began, the way we read a watch, and what this quiet corner
                  of the web is for.
                </p>
              </div>
            </div>
          </ScrollFade>

          {/* Chapter 01 — Origin. The winding pocket watch lives inside the
              chapter, paired with the prose rather than floating between sections. */}
          <section className="mt-28 border-t border-[#bfa68a]/12 pt-12">
            <ScrollFade>
              <ChapterMark number="01" label="Origin" />
            </ScrollFade>

            <div className="mt-8 grid gap-x-20 gap-y-14 lg:grid-cols-[minmax(0,1fr)_minmax(0,340px)] lg:items-start">
              {/* The story */}
              <div>
                <ScrollFade>
                  <h2
                    className="max-w-2xl font-playfair font-light leading-[1.12] tracking-[-0.005em] text-[#f0e6d2]"
                    style={{ fontSize: "clamp(2rem, 4vw, 3.25rem)" }}
                  >
                    A quiet obsession with{" "}
                    <span className="italic text-[#f0e6d2]/70">how time is kept.</span>
                  </h2>
                </ScrollFade>
                <ScrollFade>
                  <div className="mt-10 max-w-2xl">
                    {/* Lede with a drop cap — breaks the flat run of body copy */}
                    <p className="text-[19px] font-light leading-[1.85] text-white/70">
                      <span className="float-left mr-3.5 mt-2 font-playfair text-[68px] font-normal leading-[0.7] text-[#bfa68a]/85">
                        T
                      </span>
                      ourbillon began as a fascination with Vacheron Constantin — the lineage,
                      the restraint of the design, and the sheer density of mechanical detail
                      folded into something you can wear on a wrist. The closer you look, the
                      more there is to find.
                    </p>
                    <p className="mt-7 text-[15.5px] font-light leading-[1.9] text-white/45">
                      That fascination turned into a question: what would it take to build a
                      place worthy of pieces like these? Not another product grid, but somewhere
                      with the patience of a good boutique — room to browse, compare, ask, and
                      come back when you are ready.
                    </p>
                  </div>
                </ScrollFade>
                <ScrollFade>
                  <blockquote className="mt-12 max-w-2xl border-l border-[#bfa68a]/40 pl-7 font-playfair text-xl italic leading-relaxed text-[#f0e6d2]/85 md:text-2xl">
                    How an object keeps time is a story worth telling well.
                  </blockquote>
                </ScrollFade>
              </div>

              {/* The winding watch — part of the chapter, sticky beside the prose */}
              <ScrollFade>
                <figure className="relative flex flex-col items-center lg:sticky lg:top-28">
                  <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(circle_at_center,rgba(191,166,138,0.12),transparent_68%)]" />
                  <PocketWatch size={300} variant="champagne" />
                  <figcaption className="mt-7 max-w-[16rem] text-center">
                    <p className="text-[10px] uppercase tracking-[0.42em] text-[#bfa68a]/75">
                      Grand Complication
                    </p>
                    <p className="mt-2.5 text-[12.5px] font-light italic leading-relaxed text-white/40">
                      Wound by the scroll — five hands turning as the story unfolds.
                    </p>
                  </figcaption>
                </figure>
              </ScrollFade>
            </div>
          </section>

          {/* Chapter 02 — In passing. Sparse aphorisms, all mood, no prose. */}
          <section className="mt-28 border-t border-[#bfa68a]/12 pt-12">
            <ScrollFade>
              <ChapterMark number="02" label="In passing" />
            </ScrollFade>
            <div className="mt-20 flex flex-col gap-28 md:gap-36">
              {APHORISMS.map((text, i) => (
                <ScrollFade key={text}>
                  <Aphorism text={text} index={i} />
                </ScrollFade>
              ))}
            </div>
          </section>

          {/* Chapter 03 — The measure. What we look for, condensed to a word each. */}
          <section className="mt-28 border-t border-[#bfa68a]/12 pt-12">
            <ScrollFade>
              <ChapterMark number="03" label="The measure" />
            </ScrollFade>
            <ScrollFade>
              <h2
                className="mt-7 max-w-3xl font-playfair font-light leading-[1.12] text-[#f0e6d2]"
                style={{ fontSize: "clamp(2rem, 4vw, 3.25rem)" }}
              >
                What we look for, <span className="italic text-[#f0e6d2]/70">before anything else.</span>
              </h2>
            </ScrollFade>
            <div className="mt-14 grid gap-x-16 gap-y-12 sm:grid-cols-2">
              {PRINCIPLES.map((principle) => (
                <ScrollFade key={principle.index}>
                  <Measure {...principle} />
                </ScrollFade>
              ))}
            </div>
          </section>

          {/* Chapter 04 — What it's for. The journal turns back into the platform. */}
          <section className="mt-28 border-t border-[#bfa68a]/12 pt-12">
            <ScrollFade>
              <ChapterMark number="04" label="What it's for" />
            </ScrollFade>
            <ScrollFade>
              <h2
                className="mt-7 max-w-3xl font-playfair font-light leading-[1.12] text-[#f0e6d2]"
                style={{ fontSize: "clamp(2rem, 4vw, 3.25rem)" }}
              >
                Three ways to <span className="italic text-[#f0e6d2]/70">begin.</span>
              </h2>
            </ScrollFade>
            <StoriesActions />
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
