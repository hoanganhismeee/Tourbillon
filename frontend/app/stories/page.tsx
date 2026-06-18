// Stories page — Tourbillon's brand journal.
// A text-forward editorial in the house "we" voice: a cover, then three chapters
// (the spark, the craft we look for, why Tourbillon) and a closing CTA into the
// catalogue. Vacheron Constantin appears once as the origin spark, kept brief.
// Surfaces are deliberately borderless — left-accent blockquotes and hairline lists
// that sit in the page rather than boxed panels that read as stickers. The page adds
// no background of its own; it relies on the global warm gradient, gold glow, and
// grain from globals.css. No imagery; the docking pocket watch is the only decoration.
// Palette per the house style: Playfair, gold #bfa68a, cream #f0e6d2.
import Link from "next/link";
import ScrollFade from "../scrollMotion/ScrollFade";
import StoriesActions from "./StoriesActions";
import StoriesPocketWatch from "./StoriesPocketWatch";

// The qualities we weigh every piece against — rendered as a hairline list, not a box.
const CRAFT: [string, string][] = [
  ["Finishing", "Hand-work that continues where no one will ever look."],
  ["Proportion", "Restraint chosen over flash, on the wrist and off."],
  ["Longevity", "Made to outlast the trend that surrounded it."],
  ["Provenance", "A name prepared to stand behind it for decades."],
];

// Technical-drawing corner marks for the closing frame.
function CornerMarks() {
  const base = "pointer-events-none absolute h-3 w-3 border-[#bfa68a]/40";
  return (
    <>
      <span className={`${base} left-0 top-0 border-l border-t`} />
      <span className={`${base} right-0 top-0 border-r border-t`} />
      <span className={`${base} bottom-0 left-0 border-b border-l`} />
      <span className={`${base} bottom-0 right-0 border-b border-r`} />
    </>
  );
}

// Chapter header — a large ghost numeral gives each section weight and anchors
// the otherwise-empty left margin.
function ChapterHead({
  number,
  label,
  children,
}: {
  number: string;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="relative">
      <span
        aria-hidden
        className="pointer-events-none absolute -left-1 -top-12 z-0 select-none font-playfair font-light leading-none text-[#bfa68a]/[0.07] sm:-top-16"
        style={{ fontSize: "clamp(6rem, 13vw, 12rem)" }}
      >
        {number}
      </span>
      <div className="relative z-10">
        <p className="text-[10px] uppercase tracking-[0.45em] text-[#bfa68a]/80">{label}</p>
        <h2
          className="mt-5 max-w-3xl font-playfair font-light leading-[1.1] tracking-[-0.005em] text-[#f0e6d2]"
          style={{ fontSize: "clamp(2.1rem, 4.2vw, 3.4rem)" }}
        >
          {children}
        </h2>
      </div>
    </div>
  );
}

export default function StoriesPage() {
  return (
    <main className="relative min-h-screen overflow-hidden pt-10 text-white">
      {/* Decorative winding watch — fixed, eases into the upper-right on scroll */}
      <StoriesPocketWatch />

      <section className="relative z-10 px-6 py-20 pt-20 sm:px-10 lg:px-24">
        {/* Cover */}
        <ScrollFade>
          <div className="max-w-4xl">
            <div className="flex flex-wrap items-center gap-4 text-[10px] uppercase tracking-[0.4em] text-[#bfa68a]/60">
              <span>Vol. I</span>
              <span className="h-px w-6 bg-[#bfa68a]/30" />
              <span className="text-[#bfa68a]/85">The Tourbillon Journal</span>
              <span className="h-px w-6 bg-[#bfa68a]/30" />
              <span>MMXXVI</span>
            </div>
            <h1
              className="mt-9 font-playfair font-light leading-[1.02] tracking-[-0.01em] text-[#f0e6d2]"
              style={{ fontSize: "clamp(2.7rem, 6.8vw, 5.75rem)" }}
            >
              Every watch
              <br />
              <span className="italic text-[#f0e6d2]/55">keeps a story.</span>
            </h1>
            <div className="mt-10 flex max-w-2xl items-start gap-6">
              <div className="mt-[0.95em] h-px w-12 flex-shrink-0 bg-gradient-to-r from-[#bfa68a]/75 to-transparent" />
              <p className="text-[18px] font-light leading-[1.9] tracking-wide text-white/70 text-balance">
                It started with{" "}
                <span className="font-playfair text-[1.18em] italic text-[#f0e6d2]">
                  a single movement
                </span>{" "}
                and the urge to look closer. We built our platform as a calmer place to do exactly
                that — and to help you find the watch that{" "}
                <span className="text-[#f0e6d2]">becomes yours.</span>
              </p>
            </div>
          </div>
        </ScrollFade>

        {/* Chapter 01 — The spark */}
        <section className="relative mt-24 border-t border-[#bfa68a]/12 pt-14">
          <ScrollFade>
            <ChapterHead number="01" label="The spark">
              It began with <span className="italic text-[#f0e6d2]/70">a single movement.</span>
            </ChapterHead>
          </ScrollFade>

          <div className="mt-12 grid items-stretch gap-x-16 gap-y-12 lg:grid-cols-[1.15fr_0.85fr]">
            <ScrollFade>
              <div>
                <p className="text-[18px] font-light leading-[1.8] text-white/75">
                  <span className="float-left mr-3.5 mt-2 font-playfair text-[66px] font-normal leading-[0.7] text-[#bfa68a]/85">
                    T
                  </span>
                  he first time you really look at a fine watch movement — not the dial, the
                  mechanism — an afternoon can disappear. Bridges chamfered by hand, every wheel set
                  with a logic that rewards a closer look. A watch, it turns out, is engineering you
                  are allowed to wear.
                </p>
                <p className="mt-7 text-[16px] font-light leading-[1.85] text-white/60">
                  Tourbillon grew out of that fascination. We are not watchmakers — we are people who
                  fell hard for the craft and wanted a calmer place to get close to it. So we built
                  one, for everyone who feels the same pull and wants the room to follow it.
                </p>
              </div>
            </ScrollFade>

            <ScrollFade>
              <blockquote className="self-center border-l-2 border-[#bfa68a]/55 pl-6 py-1 lg:pl-7 lg:pr-16">
                <p className="font-playfair text-[1.5rem] font-light italic leading-relaxed text-[#f0e6d2] md:text-[1.7rem]">
                  &ldquo;Time is what we want most, but what we use worst.&rdquo;
                </p>
                <cite className="mt-4 block text-[9px] uppercase tracking-[0.28em] text-[#bfa68a]/70 not-italic">
                  William Penn
                </cite>
              </blockquote>
            </ScrollFade>
          </div>
        </section>

        {/* Chapter 02 — The craft (Vacheron kept to a brief factual mention) */}
        <section className="relative mt-24 border-t border-[#bfa68a]/12 pt-14">
          <ScrollFade>
            <ChapterHead number="02" label="The craft">
              The details <span className="italic text-[#f0e6d2]/70">no one sees.</span>
            </ChapterHead>
          </ScrollFade>

          <div className="mt-12 grid items-start gap-x-16 gap-y-12 lg:grid-cols-2">
            <ScrollFade>
              <div className="space-y-7">
                <p className="text-[16px] font-light leading-[1.85] text-white/70">
                  What we admire in a watch isn&apos;t spectacle — it&apos;s restraint. The finishing,
                  the proportion, the decades of decisions kept behind a calm dial. The maison we
                  return to most is Vacheron Constantin, founded in Geneva in 1755, but the catalogue
                  spans the great houses, and we hold each of them to the same measure.
                </p>
                <p className="text-[16px] font-light leading-[1.85] text-white/60">
                  The chamfered bridges, the hand-work a Geneva hallmark demands, the care given to
                  parts an owner will never see — that is the standard worth slowing down for, and the
                  one we point you toward.
                </p>
              </div>
            </ScrollFade>

            <ScrollFade>
              <div className="lg:pt-1 lg:pr-16">
                <p className="text-[10px] uppercase tracking-[0.32em] text-[#bfa68a]/60">
                  What we look for
                </p>
                <dl className="mt-6 border-t border-white/[0.08]">
                  {CRAFT.map(([term, desc]) => (
                    <div
                      key={term}
                      className="flex flex-col gap-1.5 border-b border-white/[0.08] py-5 sm:flex-row sm:items-baseline sm:gap-8"
                    >
                      <dt className="w-36 shrink-0 font-playfair text-[18px] font-light text-[#f0e6d2]">
                        {term}
                      </dt>
                      <dd className="text-[14px] font-light leading-[1.7] text-white/55">{desc}</dd>
                    </div>
                  ))}
                </dl>
                <p className="mt-6 text-[13.5px] font-light italic leading-relaxed text-white/45">
                  Get those right and a watch keeps giving back for decades — long after the trend
                  that surrounded it has moved on.
                </p>
              </div>
            </ScrollFade>
          </div>
        </section>

        {/* Chapter 03 — Why Tourbillon */}
        <section className="relative mt-24 border-t border-[#bfa68a]/12 pt-14">
          <ScrollFade>
            <ChapterHead number="03" label="Why Tourbillon">
              A calmer way to <span className="italic text-[#f0e6d2]/70">choose.</span>
            </ChapterHead>
          </ScrollFade>

          <div className="mt-12 grid items-start gap-x-16 gap-y-12 lg:grid-cols-2">
            <ScrollFade>
              <div className="space-y-7">
                <p className="text-[16px] font-light leading-[1.85] text-white/70">
                  Most watch sites hand you a wall of thumbnails and a price slider. We built
                  Tourbillon for the decision, not just the checkout — somewhere every piece is given
                  the room to explain itself, and you have the time to be sure.
                </p>
                <p className="text-[16px] font-light leading-[1.85] text-white/60">
                  Search in plain language, hold pieces side by side, save the ones worth returning
                  to, or ask our concierge when you would rather be guided. From first curiosity to
                  final choice, the catalogue is yours to explore at your own pace.
                </p>
              </div>
            </ScrollFade>

            <ScrollFade>
              <div className="lg:pr-16">
                <p className="mb-5 text-[10px] uppercase tracking-[0.3em] text-[#bfa68a]/60">
                  In the boutique
                </p>
                <StoriesActions />
              </div>
            </ScrollFade>
          </div>
        </section>

        {/* Closing CTA — framed finale */}
        <section className="mt-24">
          <ScrollFade>
            <div className="relative overflow-hidden border border-[#bfa68a]/20 bg-gradient-to-b from-white/[0.05] to-transparent px-6 py-20 text-center sm:px-16">
              <CornerMarks />
              <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_center,rgba(191,166,138,0.12),transparent_70%)]" />
              <p className="text-[10px] uppercase tracking-[0.5em] text-[#bfa68a]/65">Fin</p>
              <h2
                className="mx-auto mt-6 max-w-2xl font-playfair font-light leading-[1.1] text-[#f0e6d2]"
                style={{ fontSize: "clamp(2rem, 3.8vw, 3.2rem)" }}
              >
                Find the one that&apos;s <span className="italic text-[#f0e6d2]/70">yours.</span>
              </h2>
              <p className="mx-auto mt-5 max-w-xl text-[15px] font-light leading-relaxed tracking-wide text-white/60">
                Hundreds of references, one quiet place to explore them. Filter by brand,
                complication, or budget — and let each piece tell you its story.
              </p>
              <Link
                href="/watches"
                className="group relative mt-10 inline-flex items-center justify-center overflow-hidden border border-[#bfa68a]/30 px-12 py-4 text-[10px] uppercase tracking-[0.3em] text-[#bfa68a] transition-all duration-500 hover:border-[#bfa68a]/50 hover:bg-[#bfa68a]/10"
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
      </section>
    </main>
  );
}
