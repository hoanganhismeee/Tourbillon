// Stories page — Tourbillon's brand journal.
// A text-forward editorial: a cover, a table of contents, three chapters, and a
// closing CTA into the catalogue. The voice blends a personal opening (the founder
// and the Vacheron Constantin movement that started it) with a refined house voice
// for the maison and the catalogue close. It shares the site's warm background
// (the global gradient, gold glow, and grain from globals.css) and lifts content
// with translucent gold-tinted surfaces — no imagery; the docking pocket watch
// (StoriesPocketWatch) is the only decoration.
// Palette + voice per the house style: Playfair, gold #bfa68a, cream #f0e6d2.
import Link from "next/link";
import ScrollFade from "../scrollMotion/ScrollFade";
import StoriesActions from "./StoriesActions";
import StoriesPocketWatch from "./StoriesPocketWatch";

// Chapters, used for the cover's table of contents.
const CONTENTS = [
  ["01", "The spark", "The one movement that started all of this."],
  ["02", "Vacheron Constantin", "The oldest name in watchmaking — and our north star."],
  ["03", "Why Tourbillon", "A calmer way to choose your next piece."],
];

// Three figures that frame the house — and the complication we took our name from.
const STATS = [
  { value: "1755", label: "Founded in Geneva" },
  { value: "271", label: "Years, never interrupted" },
  { value: "1801", label: "The tourbillon, patented" },
];

const PANEL =
  "relative border border-[#bfa68a]/15 bg-gradient-to-b from-white/[0.045] to-white/[0.01]";

// Technical-drawing corner marks for framed blocks.
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

// Horology data readout — label, dotted leader, value.
function SpecRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline gap-3">
      <span className="text-[10px] uppercase tracking-[0.26em] text-[#bfa68a]/65">{label}</span>
      <span className="h-px flex-1 translate-y-[-0.15em] border-b border-dotted border-[#bfa68a]/25" />
      <span className="text-[12px] font-light tracking-wide text-white/75">{value}</span>
    </div>
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
      {/* Atmosphere — soft gold glows give the dark canvas depth */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 z-0 h-[75vh] bg-[radial-gradient(ellipse_at_74%_26%,rgba(191,166,138,0.13),transparent_60%)]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-0 z-0 h-[55vh] bg-[radial-gradient(ellipse_at_18%_92%,rgba(191,166,138,0.06),transparent_58%)]"
      />

      {/* Decorative winding watch — fixed, docks to the corner on scroll */}
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
              <div className="mt-[0.7em] h-px w-6 flex-shrink-0 bg-[#bfa68a]/45" />
              <p className="text-[16px] font-light leading-relaxed tracking-wide text-white/65 text-balance">
                One movement changed how I look at time. This is the house that taught me to slow
                down — and the quieter place I built so you could do the same.
              </p>
            </div>
          </div>
        </ScrollFade>

        {/* In this issue — a proper table of contents */}
        <ScrollFade>
          <div className="mt-16 border-t border-[#bfa68a]/15 pt-6">
            <p className="text-[10px] uppercase tracking-[0.4em] text-[#bfa68a]/55">In this issue</p>
            <div className="mt-7 grid gap-px overflow-hidden border border-[#bfa68a]/15 bg-[#bfa68a]/12 sm:grid-cols-3">
              {CONTENTS.map(([n, title, desc]) => (
                <div
                  key={n}
                  className="group flex flex-col gap-3 bg-gradient-to-b from-white/[0.045] to-white/[0.01] p-6 transition-colors duration-500 hover:from-white/[0.08] hover:to-white/[0.02]"
                >
                  <span className="font-playfair text-3xl font-light text-[#bfa68a]/45 transition-colors duration-500 group-hover:text-[#bfa68a]/75">
                    {n}
                  </span>
                  <span className="font-playfair text-lg font-light text-[#f0e6d2]">{title}</span>
                  <span className="text-[13px] font-light leading-relaxed text-white/50">{desc}</span>
                </div>
              ))}
            </div>
          </div>
        </ScrollFade>

        {/* Chapter 01 — The spark (personal, first person) */}
        <section className="relative mt-24 border-t border-[#bfa68a]/12 pt-14">
          <ScrollFade>
            <ChapterHead number="01" label="The spark">
              It began with <span className="italic text-[#f0e6d2]/70">a single movement.</span>
            </ChapterHead>
          </ScrollFade>

          <div className="mt-12 grid items-stretch gap-x-14 gap-y-10 lg:grid-cols-[1.1fr_0.9fr]">
            <ScrollFade>
              <div>
                <p className="text-[18px] font-light leading-[1.8] text-white/75">
                  <span className="float-left mr-3.5 mt-2 font-playfair text-[66px] font-normal leading-[0.7] text-[#bfa68a]/85">
                    T
                  </span>
                  he first time I really looked at a Vacheron Constantin — not the dial, the
                  movement — I lost an afternoon to it. Bridges chamfered by hand, every wheel set
                  with a logic that rewarded a closer look. A watch, it turned out, is engineering
                  you are allowed to wear, and I have not looked at time the same way since.
                </p>
                <p className="mt-7 text-[16px] font-light leading-[1.85] text-white/60">
                  Tourbillon grew out of that afternoon. I am not a watchmaker — I am someone who
                  fell hard for the craft and wanted a calmer place to get close to it. So I built
                  one, for the people who feel that same pull and want the room to follow it.
                </p>
              </div>
            </ScrollFade>

            <ScrollFade>
              <figure className={`${PANEL} flex flex-col justify-center p-9 lg:p-10`}>
                <CornerMarks />
                <span className="font-playfair text-5xl leading-none text-[#bfa68a]/35">&ldquo;</span>
                <p className="mt-2 font-playfair text-2xl font-light italic leading-relaxed text-[#f0e6d2]/90 md:text-[26px]">
                  A fine watch is engineering you are allowed to wear.
                </p>
                <figcaption className="mt-6 text-[10px] uppercase tracking-[0.3em] text-[#bfa68a]/60">
                  Brandon — founder of Tourbillon
                </figcaption>
              </figure>
            </ScrollFade>
          </div>
        </section>

        {/* Chapter 02 — Vacheron Constantin (house voice) */}
        <section className="relative mt-24 border-t border-[#bfa68a]/12 pt-14">
          <ScrollFade>
            <ChapterHead number="02" label="Vacheron Constantin">
              The house that <span className="italic text-[#f0e6d2]/70">set our standard.</span>
            </ChapterHead>
          </ScrollFade>

          <div className="mt-12 grid items-stretch gap-x-14 gap-y-10 lg:grid-cols-2">
            <ScrollFade>
              <div className="flex flex-col justify-center space-y-7">
                <p className="text-[16px] font-light leading-[1.85] text-white/70">
                  Founded in Geneva in 1755 and never once interrupted, Vacheron Constantin is the
                  oldest watchmaker in continuous operation. What sets it apart isn&apos;t the age —
                  it&apos;s the restraint. Where others reach for spectacle, Vacheron keeps its voice
                  low and lets the finishing speak.
                </p>
                <p className="text-[16px] font-light leading-[1.85] text-white/60">
                  The chamfered bridges, the Maltese cross on a caseback few will ever open, the
                  hand-work the Hallmark of Geneva demands — proof that the details no one sees still
                  deserve care. Its founders left one instruction that still runs the place:{" "}
                  <span className="text-white/80">do better if possible, and that is always possible.</span>{" "}
                  It is the measure we hold every piece in this catalogue against.
                </p>
              </div>
            </ScrollFade>

            <ScrollFade>
              <div className={`${PANEL} p-7 lg:p-9`}>
                <CornerMarks />
                <p className="text-[10px] uppercase tracking-[0.3em] text-[#bfa68a]/60">The house</p>
                <div className="mt-5 space-y-3.5">
                  <SpecRow label="Founded" value="Geneva, 1755" />
                  <SpecRow label="Standing" value="Oldest, unbroken" />
                  <SpecRow label="Emblem" value="Maltese cross" />
                  <SpecRow label="Credo" value="Do better, always" />
                </div>
                <figure className="mt-7 border-t border-[#bfa68a]/15 pt-6">
                  <blockquote className="border-l-2 border-[#bfa68a]/60 pl-5">
                    <p className="font-playfair text-[1.15rem] font-light italic leading-relaxed text-[#f0e6d2]">
                      Do better if possible, and that is always possible.
                    </p>
                  </blockquote>
                  <figcaption className="mt-3 text-[9px] uppercase tracking-[0.28em] text-[#bfa68a]/70">
                    François Constantin, 1819
                  </figcaption>
                </figure>
              </div>
            </ScrollFade>
          </div>

          {/* Stats band — large figures give the chapter visual weight */}
          <ScrollFade>
            <div className="mt-14 grid grid-cols-3 gap-px overflow-hidden border-y border-[#bfa68a]/15 bg-[#bfa68a]/12">
              {STATS.map((s) => (
                <div
                  key={s.value}
                  className="flex flex-col items-center gap-3 bg-gradient-to-b from-white/[0.035] to-white/[0.005] px-3 py-9 text-center"
                >
                  <span
                    className="font-playfair font-light leading-none text-[#f0e6d2]"
                    style={{ fontSize: "clamp(2.2rem, 5vw, 3.6rem)" }}
                  >
                    {s.value}
                  </span>
                  <span className="text-[8.5px] uppercase tracking-[0.32em] text-[#bfa68a]/70">
                    {s.label}
                  </span>
                </div>
              ))}
            </div>
          </ScrollFade>
        </section>

        {/* Chapter 03 — Why Tourbillon (house voice, blended close) */}
        <section className="relative mt-24 border-t border-[#bfa68a]/12 pt-14">
          <ScrollFade>
            <ChapterHead number="03" label="Why Tourbillon">
              A calmer way to <span className="italic text-[#f0e6d2]/70">choose.</span>
            </ChapterHead>
          </ScrollFade>

          <div className="mt-12 grid items-start gap-x-14 gap-y-10 lg:grid-cols-2">
            <ScrollFade>
              <div className="space-y-7">
                <p className="text-[16px] font-light leading-[1.85] text-white/70">
                  Most watch sites hand you a wall of thumbnails and a price slider. Tourbillon is
                  built for the decision, not just the checkout — somewhere every piece is given the
                  room to explain itself, and you have the time to be sure.
                </p>
                <p className="text-[16px] font-light leading-[1.85] text-white/60">
                  Search in plain language, hold pieces side by side, save the ones worth returning
                  to, or ask the concierge when you would rather be guided. From first curiosity to
                  final choice, the catalogue is yours to explore at your own pace.
                </p>
              </div>
            </ScrollFade>

            <ScrollFade>
              <div>
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
