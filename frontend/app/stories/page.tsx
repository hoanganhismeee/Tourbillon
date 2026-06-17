// Stories page — the personal story behind Tourbillon.
// Answers why the platform exists and how a fascination with fine watches,
// and Vacheron Constantin in particular, started it. The pocket watch is purely
// decorative: it lives large in the first section then docks to the top-right
// corner on scroll (see StoriesPocketWatch). The engineering story lives on
// /portfolio. Visual language: Playfair, gold #bfa68a, cream #f0e6d2, ScrollFade.
import Link from "next/link";
import ScrollFade from "../scrollMotion/ScrollFade";
import StoriesActions from "./StoriesActions";
import StoriesPocketWatch from "./StoriesPocketWatch";

// A few dates that matter to this story — the house, the namesake, and now.
const TIMELINE = [
  { year: "1755", text: "Vacheron Constantin is founded in Geneva, and never once stops." },
  {
    year: "1801",
    text: "Breguet patents the tourbillon — the complication this site borrows its name from.",
  },
  { year: "Now", text: "Tourbillon gathers pieces like these in one place, to study and to keep." },
];

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
      <span className="text-[10px] uppercase tracking-[0.28em] text-[#bfa68a]/60">{label}</span>
      <span className="h-px flex-1 translate-y-[-0.15em] border-b border-dotted border-[#bfa68a]/25" />
      <span className="text-[11px] font-light tracking-wide text-white/70">{value}</span>
    </div>
  );
}

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
    <main className="relative min-h-screen pt-10 text-white">
      {/* Decorative winding watch — fixed, docks to the corner on scroll */}
      <StoriesPocketWatch />

      <section className="relative z-10 px-6 py-20 pt-20 sm:px-10 lg:px-24">
        <div>
          {/* Hero — masthead */}
          <ScrollFade>
            <div className="max-w-4xl">
              <div className="flex flex-wrap items-center gap-4 text-[10px] uppercase tracking-[0.4em] text-[#bfa68a]/55">
                <span>Vol. I</span>
                <span className="h-px w-6 bg-[#bfa68a]/30" />
                <span className="text-[#bfa68a]/80">The Tourbillon Journal</span>
                <span className="h-px w-6 bg-[#bfa68a]/30" />
                <span>MMXXVI</span>
              </div>
              <h1
                className="mt-9 font-playfair font-light leading-[1.03] tracking-[-0.01em] text-[#f0e6d2]"
                style={{ fontSize: "clamp(2.6rem, 6.8vw, 5.75rem)" }}
              >
                Every watch
                <br />
                <span className="italic text-[#f0e6d2]/55">keeps a story.</span>
              </h1>
              <div className="mt-10 flex max-w-2xl items-start gap-6">
                <div className="mt-[0.7em] h-px w-6 flex-shrink-0 bg-[#bfa68a]/45" />
                <p className="font-light leading-relaxed tracking-wide text-white/50 text-balance">
                  How a fascination with one watchmaker turned into a place to browse, compare,
                  and understand fine watches — and why I built it.
                </p>
              </div>
              {/* Contents — masthead index of the chapters below */}
              <div className="mt-12 grid max-w-2xl grid-cols-2 gap-x-10 gap-y-3 border-t border-[#bfa68a]/12 pt-6 sm:grid-cols-3">
                {[
                  ["01", "The spark"],
                  ["02", "Vacheron Constantin"],
                  ["03", "Why Tourbillon"],
                ].map(([n, label]) => (
                  <div key={n} className="flex items-baseline gap-2">
                    <span className="font-playfair text-sm text-[#bfa68a]/50">{n}</span>
                    <span className="text-[11px] uppercase tracking-[0.2em] text-white/40">
                      {label}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </ScrollFade>

          {/* Chapter 01 — The spark. How the passion began. */}
          <section className="mt-28 border-t border-[#bfa68a]/12 pt-12">
            <ScrollFade>
              <ChapterMark number="01" label="The spark" />
            </ScrollFade>
            <ScrollFade>
              <h2
                className="mt-7 max-w-2xl font-playfair font-light leading-[1.12] tracking-[-0.005em] text-[#f0e6d2]"
                style={{ fontSize: "clamp(2rem, 4vw, 3.25rem)" }}
              >
                It started with{" "}
                <span className="italic text-[#f0e6d2]/70">a single movement.</span>
              </h2>
            </ScrollFade>
            <ScrollFade>
              <div className="mt-10 max-w-2xl">
                <p className="text-[19px] font-light leading-[1.85] text-white/70">
                  <span className="float-left mr-3.5 mt-2 font-playfair text-[68px] font-normal leading-[0.7] text-[#bfa68a]/85">
                    I
                  </span>
                  didn&apos;t grow up around watchmaking. What pulled me in was a single photograph
                  — a movement opened up, bridges chamfered by hand, every wheel placed with a logic
                  I didn&apos;t yet understand. I wanted to know how something so small could be made
                  so deliberately.
                </p>
                <p className="mt-7 text-[15.5px] font-light leading-[1.9] text-white/45">
                  The more I read, the less it felt like jewellery and the more it felt like
                  engineering you could wear. A good watch hides decades of decisions behind a quiet
                  dial — and that gap, between how simple it looks and how hard it is to make, is
                  what I fell for.
                </p>
              </div>
            </ScrollFade>
            <ScrollFade>
              <blockquote className="mt-12 max-w-2xl border-l border-[#bfa68a]/40 pl-7 font-playfair text-xl italic leading-relaxed text-[#f0e6d2]/85 md:text-2xl">
                How an object keeps time is a story worth telling well.
              </blockquote>
            </ScrollFade>
          </section>

          {/* Chapter 02 — Vacheron Constantin. Why this house in particular. */}
          <section className="mt-28 border-t border-[#bfa68a]/12 pt-12">
            <ScrollFade>
              <ChapterMark number="02" label="Vacheron Constantin" />
            </ScrollFade>
            <ScrollFade>
              <h2
                className="mt-7 max-w-3xl font-playfair font-light leading-[1.12] text-[#f0e6d2]"
                style={{ fontSize: "clamp(2rem, 4vw, 3.25rem)" }}
              >
                One house kept{" "}
                <span className="italic text-[#f0e6d2]/70">coming back to me.</span>
              </h2>
            </ScrollFade>

            <div className="mt-10 grid gap-x-16 gap-y-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,300px)] lg:items-start">
              <ScrollFade>
                <div className="max-w-2xl space-y-7">
                  <p className="text-[15.5px] font-light leading-[1.9] text-white/55">
                    Founded in Geneva in 1755 and never once interrupted, Vacheron Constantin is the
                    oldest watchmaker in continuous operation. But it wasn&apos;t the age that held
                    me — it was the restraint. Where others shout, Vacheron tends to whisper.
                  </p>
                  <p className="text-[15.5px] font-light leading-[1.9] text-white/45">
                    The finishing, the proportion, the Maltese cross stamped on a movement you may
                    never see — all of it reflects a belief that the parts no one notices still
                    deserve care. That idea quietly shaped how I wanted this whole project to feel.
                  </p>
                </div>
              </ScrollFade>

              {/* A small dossier of facts + the dates that matter */}
              <ScrollFade>
                <div className="relative border border-[#bfa68a]/15 p-7">
                  <CornerMarks />
                  <p className="text-[10px] uppercase tracking-[0.3em] text-[#bfa68a]/55">
                    The house
                  </p>
                  <div className="mt-5 space-y-3">
                    <SpecRow label="Founded" value="Geneva, 1755" />
                    <SpecRow label="Standing" value="Oldest, unbroken" />
                    <SpecRow label="Emblem" value="Maltese cross" />
                    <SpecRow label="What I admire" value="Restraint" />
                  </div>
                  <ol className="mt-7 space-y-5 border-t border-[#bfa68a]/12 pt-6">
                    {TIMELINE.map((m) => (
                      <li key={m.year} className="flex gap-4">
                        <span className="font-playfair text-lg font-light leading-none text-[#f0e6d2]/80">
                          {m.year}
                        </span>
                        <span className="text-[12.5px] font-light leading-relaxed text-white/45">
                          {m.text}
                        </span>
                      </li>
                    ))}
                  </ol>
                </div>
              </ScrollFade>
            </div>
          </section>

          {/* Chapter 03 — Why Tourbillon. Why the platform was created. */}
          <section className="mt-28 border-t border-[#bfa68a]/12 pt-12">
            <ScrollFade>
              <ChapterMark number="03" label="Why Tourbillon" />
            </ScrollFade>
            <ScrollFade>
              <h2
                className="mt-7 max-w-3xl font-playfair font-light leading-[1.12] text-[#f0e6d2]"
                style={{ fontSize: "clamp(2rem, 4vw, 3.25rem)" }}
              >
                A place with the{" "}
                <span className="italic text-[#f0e6d2]/70">patience of a boutique.</span>
              </h2>
            </ScrollFade>
            <ScrollFade>
              <div className="mt-10 max-w-2xl space-y-7">
                <p className="text-[15.5px] font-light leading-[1.9] text-white/55">
                  Shopping for watches online usually means a wall of thumbnails and a price filter.
                  Little of it helps you understand what you are looking at, or which piece actually
                  suits you. I wanted the opposite — somewhere unhurried, where a watch is allowed to
                  explain itself.
                </p>
                <p className="text-[15.5px] font-light leading-[1.9] text-white/45">
                  So I built one, end to end: search you can speak to in plain English, comparisons
                  with real context, a concierge that answers questions, and saved pieces you can
                  return to. It is a personal project, but I made it work like a real product.
                </p>
                <p className="text-[14px] font-light leading-relaxed text-white/40">
                  The engineering behind it — the stack, the architecture, the trade-offs — lives on
                  the{" "}
                  <Link
                    href="/portfolio"
                    className="text-[#bfa68a] underline decoration-[#bfa68a]/30 underline-offset-4 transition-colors hover:text-[#f0e6d2]"
                  >
                    portfolio
                  </Link>{" "}
                  page.
                </p>
              </div>
            </ScrollFade>
          </section>

          {/* Chapter 04 — What it's for. The story turns back into the platform. */}
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

          {/* Closing CTA — framed finale */}
          <section className="mt-28">
            <ScrollFade>
              <div className="relative border border-[#bfa68a]/15 px-6 py-16 text-center sm:px-16">
                <CornerMarks />
                <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_center,rgba(191,166,138,0.08),transparent_70%)]" />
                <p className="text-[10px] uppercase tracking-[0.5em] text-[#bfa68a]/60">Fin</p>
                <h2
                  className="mx-auto mt-6 max-w-2xl font-playfair font-light leading-[1.12] text-[#f0e6d2]"
                  style={{ fontSize: "clamp(1.9rem, 3.6vw, 3rem)" }}
                >
                  Find the one that&apos;s <span className="italic text-[#f0e6d2]/70">yours.</span>
                </h2>
                <p className="mx-auto mt-5 max-w-xl font-light leading-relaxed tracking-wide text-white/50">
                  The full collection is a few clicks away — filter by brand, complication, or feel,
                  and let it tell you its story.
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
