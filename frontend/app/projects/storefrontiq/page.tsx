// StorefrontIQ portfolio case study — "Atelier" standalone design (matches /projects/tourbillon).
// Light ivory editorial layout (engine-turned guilloche, deep-ink serif, oxblood accent)
// presenting Hoang Anh Chu's multi-tenant retail analytics platform as a printed dossier.
// Deliberately NOT part of the Tourbillon site aesthetic; chrome is hidden via ChromeGate.
import ScrollFade from "../../scrollMotion/ScrollFade";
import { BackToPortfolio } from "../PortfolioBackNav";

// Subtle film-grain data URI, multiplied over the ivory paper for a printed texture.
const GRAIN =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='140' height='140'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")";

function LinkedInIcon({ size = 15 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
    </svg>
  );
}

function GitHubIcon({ size = 15 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M12 0C5.374 0 0 5.373 0 12c0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0 1 12 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z" />
    </svg>
  );
}

const features = [
  {
    title: "Unify three channels",
    text: "Brings Shopify, WooCommerce, and Square exports into one consistent shape, despite three formats that look nothing alike.",
  },
  {
    title: "Clean data honestly",
    text: "Handles inconsistent dates, currencies, refund conventions, duplicates, and missing fields, then reports exactly what it had to quarantine and why.",
  },
  {
    title: "Reconcile every run",
    text: "Asserts that no rows go missing — received equals loaded plus quarantined — and fails loudly if the numbers don't balance.",
  },
  {
    title: "Surface trends",
    text: "Track how revenue, orders, and each channel move over time, so the direction of the business is obvious rather than buried in a spreadsheet.",
  },
  {
    title: "Flag risks early",
    text: "Watch for days and channels drifting unusually far from a seasonality-aware baseline, turning quiet problems into risks you can see before they compound.",
  },
  {
    title: "Recommend next steps",
    text: "Turn the findings into a short list of suggested actions — grounded only in the numbers already computed, not in guesswork.",
  },
  {
    title: "Explain it in plain English",
    text: "An LLM writes the brief — the trends that matter, the risks worth watching, the recommendations — describing only figures the pipeline computed, never inventing them.",
  },
  {
    title: "Isolate every tenant",
    text: "Each tenant can only see their own data, enforced by PostgreSQL Row-Level Security rather than by hoping a query filtered correctly.",
  },
  {
    title: "Explore in a dashboard",
    text: "One clean analytics screen: unified totals, per-channel comparison, the risk feed, and the latest AI brief.",
  },
];

const stackGroups = [
  {
    title: "Pipeline & Backend",
    items: ["Python 3.12", "Pydantic v2", "FastAPI", "SQL window functions"],
  },
  {
    title: "Analytics & AI",
    items: ["PostgreSQL (z-score)", "Qwen2.5 3B-Instruct", "Ollama (local)"],
  },
  {
    title: "Frontend",
    items: ["Next.js 15", "React 19", "Tailwind CSS", "Recharts"],
  },
  {
    title: "Data & Infrastructure",
    items: ["PostgreSQL (Neon)", "Docker Compose", "Vercel", "GitHub Actions", "pytest"],
  },
];

const architectureDiagram = `LOCAL · DATA PLANE — runs offline, does the heavy lifting

┌───────────────────────────────┐
│ Olist public dataset          │
│ real, anonymized orders       │
└───────────────┬───────────────┘
                │
                ▼
┌───────────────────────────────┐
│ Export emulator               │
│ Square · Shopify · Woo        │
│ real formats, real quirks     │
└───────────────┬───────────────┘
                │
                ▼
┌───────────────────────────────┐
│ Python pipeline               │
│ adapt → Pydantic → normalize  │
│ reconcile → load              │
└───────────────┬───────────────┘
                │
                ▼
┌───────────────────────────────┐
│ PostgreSQL                    │
│ RLS by tenant_id              │
└───────────────┬───────────────┘
                │  analytics reads rows, writes results back
                ▼
┌───────────────────────────────┐
│ Analytics + AI digest         │
│ SQL z-score (seasonal)        │
│ qwen2.5:3b · Ollama (local)   │
└───────────────────────────────┘

check  → received = loaded + quarantined
digest → pre-generated once, stored as text


PRODUCTION · SERVING PLANE — thin, reads pre-computed rows

┌───────────────────────────────┐
│ Browser                       │
└───────────────┬───────────────┘
                │
                ▼
┌───────────────────────────────┐
│ Vercel · Next.js 15           │
│ route handler sets tenant     │
│ SET LOCAL app.current_tenant  │
└───────────────┬───────────────┘
                │
                ▼
┌───────────────────────────────┐
│ Neon PostgreSQL               │
│ RLS enforces isolation        │
└───────────────────────────────┘

no backend server · no LLM at request time
CI (GitHub Actions) runs the RLS isolation test`;

function SectionHead({ index, kicker, title }: { index: string; kicker: string; title: string }) {
  return (
    <div className="mb-12 flex items-end justify-between gap-6 border-b border-[var(--atl-rule)] pb-5">
      <div>
        <p className="atl-mono text-[11px] uppercase tracking-[0.34em] text-[var(--atl-oxblood)]">
          {kicker}
        </p>
        <h2 className="atl-display mt-3 text-[2rem] font-medium leading-[1.05] tracking-[-0.01em] text-[var(--atl-ink)] md:text-[2.75rem]">
          {title}
        </h2>
      </div>
      <span className="atl-mono shrink-0 text-[11px] tracking-[0.2em] text-[var(--atl-faint)]">{index}</span>
    </div>
  );
}

export default function StorefrontIQPortfolioPage() {
  return (
    <main className="atl-body atl-root relative min-h-screen w-full overflow-hidden text-[var(--atl-ink)]">
      <style
        dangerouslySetInnerHTML={{
          __html: `
            .atl-root {
              --atl-paper: #efe7d8;
              --atl-paper-2: #f5efe4;
              --atl-ink: #1f1a15;
              --atl-soft: #5c554c;
              --atl-faint: #978d80;
              --atl-oxblood: #7c2d2d;
              --atl-oxblood-deep: #5e2020;
              --atl-gold: #9a7b3f;
              --atl-rule: rgba(31,26,21,0.16);
              --atl-rule-soft: rgba(31,26,21,0.09);
              background:
                radial-gradient(120% 70% at 50% -10%, rgba(154,123,63,0.10) 0%, transparent 55%),
                linear-gradient(180deg, #f3ecdf 0%, #efe7d8 38%, #ece2d1 100%);
            }
            .atl-display { font-family: var(--font-fraunces), Georgia, "Times New Roman", serif; }
            .atl-body { font-family: var(--font-hanken), ui-sans-serif, system-ui, sans-serif; }
            .atl-mono { font-family: var(--font-mono-atelier), ui-monospace, "SFMono-Regular", monospace; }
            .atl-italic { font-family: var(--font-fraunces), Georgia, serif; font-style: italic; }

            .atl-guilloche {
              background-image:
                repeating-linear-gradient(45deg, rgba(31,26,21,0.030) 0 1px, transparent 1px 9px),
                repeating-linear-gradient(-45deg, rgba(154,123,63,0.026) 0 1px, transparent 1px 9px);
            }
            .atl-rosette {
              background-image:
                repeating-conic-gradient(from 0deg at 50% 50%, rgba(31,26,21,0.055) 0deg 0.55deg, transparent 0.55deg 3deg),
                repeating-radial-gradient(circle at 50% 50%, rgba(124,45,45,0.10) 0 0.6px, transparent 0.6px 7px);
              -webkit-mask-image: radial-gradient(circle at 50% 50%, #000 0%, #000 52%, transparent 73%);
              mask-image: radial-gradient(circle at 50% 50%, #000 0%, #000 52%, transparent 73%);
            }
            .atl-grain {
              background-image: ${GRAIN};
              background-size: 200px 200px;
              opacity: 0.05;
              mix-blend-mode: multiply;
            }
            @keyframes atl-rise {
              from { opacity: 0; transform: translateY(22px); }
              to   { opacity: 1; transform: translateY(0); }
            }
            .atl-rise { opacity: 0; animation: atl-rise 0.9s cubic-bezier(0.22,1,0.36,1) forwards; }
            .atl-tag {
              border: 1px solid var(--atl-rule);
              background: linear-gradient(180deg, rgba(255,255,255,0.35), rgba(255,255,255,0));
            }
            .atl-tag:hover { border-color: rgba(124,45,45,0.45); color: var(--atl-oxblood); }
            @media (prefers-reduced-motion: reduce) {
              .atl-rise { animation: none; opacity: 1; }
            }
          `,
        }}
      />

      <div aria-hidden className="atl-guilloche pointer-events-none fixed inset-0 z-0" />
      <div aria-hidden className="atl-grain pointer-events-none fixed inset-0 z-0" />

      <div className="relative z-10 mx-auto w-full max-w-[1180px] px-6 sm:px-10 lg:px-16">
        <header className="atl-rise flex items-center justify-between gap-4 border-b border-[var(--atl-rule)] py-6">
          <div className="flex items-center gap-3">
            <span className="atl-display flex h-9 w-9 items-center justify-center rounded-full border border-[var(--atl-rule)] text-[15px] font-semibold text-[var(--atl-oxblood)]">
              HC
            </span>
            <span className="atl-mono text-[11px] uppercase tracking-[0.28em] text-[var(--atl-soft)]">
              Hoang Anh Chu
            </span>
          </div>
          <span className="atl-mono hidden text-[11px] uppercase tracking-[0.28em] text-[var(--atl-faint)] sm:block">
            Portfolio &middot; Case Study N&deg; 03 &mdash; StorefrontIQ
          </span>
        </header>

        <BackToPortfolio />

        {/* Hero */}
        <section className="pb-20 pt-8 md:pt-10">
          <p className="atl-rise atl-mono text-[12px] uppercase tracking-[0.36em] text-[var(--atl-oxblood)]" style={{ animationDelay: "80ms" }}>
            Case Study &middot; Multi-channel sales analytics
          </p>
          <h1
            className="atl-rise atl-display mt-6 text-[3.8rem] font-medium leading-[0.92] tracking-[-0.02em] text-[var(--atl-ink)] sm:text-[5.4rem] lg:text-[6.4rem]"
            style={{ animationDelay: "160ms" }}
          >
            Storefront<span className="text-[var(--atl-oxblood)]">IQ.</span>
          </h1>
          <p className="atl-rise mt-7 max-w-2xl text-[1.1rem] leading-[1.7] text-[var(--atl-soft)]" style={{ animationDelay: "240ms" }}>
            A retail analytics platform I&rsquo;m building to take the same sales &mdash;
            recorded three different ways by Shopify, WooCommerce, and Square &mdash; and turn
            them into insight you can act on: trends worth noticing, risks worth watching, and
            a recommendation or two, on top of numbers cleaned and reconciled so you can trust
            them.
          </p>

          <div className="atl-rise mt-8 flex flex-wrap items-center gap-3" style={{ animationDelay: "320ms" }}>
            <a
              href="https://github.com/hoanganhismeee/StorefrontIQ"
              target="_blank"
              rel="noopener noreferrer"
              className="atl-tag group inline-flex items-center gap-2 px-4 py-2.5 text-[12px] uppercase tracking-[0.18em] text-[var(--atl-ink)] transition-colors"
            >
              <GitHubIcon /> GitHub
            </a>
          </div>

          <dl className="atl-rise mt-12 grid max-w-lg grid-cols-3 gap-6 border-t border-[var(--atl-rule)] pt-7" style={{ animationDelay: "400ms" }}>
            {[
              { k: "Stack", v: "Python · Next.js · PostgreSQL" },
              { k: "Status", v: "In design" },
              { k: "Role", v: "Full-stack" },
            ].map((item) => (
              <div key={item.k}>
                <dt className="atl-mono text-[10px] uppercase tracking-[0.24em] text-[var(--atl-faint)]">{item.k}</dt>
                <dd className="atl-display mt-2 text-[1.15rem] text-[var(--atl-ink)]">{item.v}</dd>
              </div>
            ))}
          </dl>
        </section>

        {/* About */}
        <ScrollFade triggerOnce className="py-20">
          <SectionHead index="01 / 05" kicker="About" title="Why I built this one." />
          <div className="grid grid-cols-1 gap-10 lg:grid-cols-12">
            <p className="atl-display lg:col-span-5 text-[1.5rem] font-light leading-[1.4] text-[var(--atl-ink)]">
              <span className="atl-display float-left mr-3 mt-1 text-[4.4rem] font-medium leading-[0.7] text-[var(--atl-oxblood)]">
                M
              </span>
              y earlier projects were product-shaped &mdash; features, screens, things
              people click. StorefrontIQ was a deliberate step in another direction: a
              project to get genuinely better at working with data.
            </p>
            <div className="lg:col-span-7 space-y-5 text-[1.02rem] leading-[1.8] text-[var(--atl-soft)]">
              <p>
                My main stack is full-stack web app development, 
                and StorefrontIQ was about widening that: I wanted to
                expand into data analytics and data engineering, which is a genuinely
                different kind of problem from the apps I usually build. The fastest way to
                actually learn it, rather than just read about it, was to pick something that
                left me no choice but to do it end to end.
              </p>
              <p>
                Retail sales turned out to be a good one. Square, Shopify, and WooCommerce
                each record the same sale differently, so before you can analyse anything you
                first have to reconcile three exports that disagree on dates, currencies,
                refunds, and what even counts as an order. Most of the real work lives there,
                well before the first chart.
              </p>
              <p>
                So this was never meant to be a flashy interface. It&rsquo;s where I taught
                myself to take messy, real-world data, clean it without quietly losing or
                corrupting anything, prove that I hadn&rsquo;t, and pull out signal I can
                actually defend.
              </p>
            </div>
          </div>
        </ScrollFade>

        {/* Features */}
        <ScrollFade triggerOnce className="py-20">
          <SectionHead index="02 / 05" kicker="Planned scope" title="What I'm building it to do." />
          <div className="grid grid-cols-1 gap-x-12 md:grid-cols-2">
            {features.map((feature, i) => (
              <div
                key={feature.title}
                className="flex gap-5 border-b border-[var(--atl-rule-soft)] py-6"
              >
                <span className="atl-mono mt-1 text-[12px] tracking-[0.1em] text-[var(--atl-oxblood)]">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <div>
                  <h3 className="atl-display text-[1.3rem] font-medium leading-snug text-[var(--atl-ink)]">
                    {feature.title}
                  </h3>
                  <p className="mt-2 text-[0.96rem] leading-[1.65] text-[var(--atl-soft)]">{feature.text}</p>
                </div>
              </div>
            ))}
          </div>
        </ScrollFade>

        {/* Tech stack */}
        <ScrollFade triggerOnce className="py-20">
          <SectionHead index="03 / 05" kicker="Toolkit" title="The stack behind the build." />
          <div className="grid grid-cols-1 gap-x-12 gap-y-10 sm:grid-cols-2">
            {stackGroups.map((group) => (
              <div key={group.title} className="border-t border-[var(--atl-rule)] pt-6">
                <h3 className="atl-mono text-[11px] uppercase tracking-[0.26em] text-[var(--atl-oxblood)]">
                  {group.title}
                </h3>
                <div className="mt-5 flex flex-wrap gap-2.5">
                  {group.items.map((item) => (
                    <span
                      key={item}
                      className="atl-tag atl-mono px-3 py-1.5 text-[11px] tracking-[0.04em] text-[var(--atl-soft)] transition-colors"
                    >
                      {item}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </ScrollFade>

        {/* Architecture */}
        <ScrollFade triggerOnce className="py-20">
          <SectionHead index="04 / 05" kicker="Architecture" title="How the system is organised." />
          <p className="mb-8 max-w-2xl text-[1.02rem] leading-[1.8] text-[var(--atl-soft)]">
            I&rsquo;ve designed it as two planes, each with one clear job. A local data
            pipeline does the heavy lifting offline &mdash; reshaping, cleaning, reconciling,
            analysing, and writing the AI brief &mdash; then stores its results in Postgres. A
            thin serving layer just reads those pre-computed rows.
          </p>
          <div className="border border-[var(--atl-rule)] bg-[var(--atl-paper-2)]/70">
            <div className="flex items-center justify-between gap-4 border-b border-[var(--atl-rule)] px-5 py-3">
              <span className="atl-mono text-[11px] uppercase tracking-[0.24em] text-[var(--atl-ink)]">
                Fig. 01 &mdash; System Architecture
              </span>
              <span className="atl-mono text-[10px] uppercase tracking-[0.24em] text-[var(--atl-faint)]">
                Local / Production
              </span>
            </div>
            <div className="overflow-x-auto px-5 py-6">
              <pre className="atl-mono min-w-[640px] text-[12px] leading-relaxed text-[var(--atl-soft)]">
                {architectureDiagram}
              </pre>
            </div>
          </div>
        </ScrollFade>

        {/* Closing */}
        <ScrollFade triggerOnce className="py-20">
          <SectionHead index="05 / 05" kicker="Intent" title="What I want it to prove." />
          <blockquote className="atl-italic max-w-3xl text-[2rem] font-light leading-[1.32] text-[var(--atl-ink)] md:text-[2.6rem]">
            &ldquo;I wanted to get good at the part of software most demos skip &mdash;
            making messy data trustworthy.&rdquo;
          </blockquote>
          <div className="mt-10 grid grid-cols-1 gap-10 lg:grid-cols-2">
            <p className="text-[1.02rem] leading-[1.8] text-[var(--atl-soft)]">
              StorefrontIQ is where I&rsquo;m learning to design a multi-tenant data model,
              enforce isolation at the database itself, clean and reconcile real-world data
              without losing a row, and turn the result into analysis I can stand behind.
            </p>
            <p className="text-[1.02rem] leading-[1.8] text-[var(--atl-soft)]">
              More than that, it&rsquo;s the project where I&rsquo;m moving into data analytics
              and data engineering on purpose &mdash; territory my earlier work hasn&rsquo;t
              touched. The questions driving it are new for me: what is this data really
              saying, where is it lying, and how do I prove my answer holds up?
            </p>
          </div>
        </ScrollFade>

        {/* Footer */}
        <footer className="mt-10 border-t border-[var(--atl-rule)] py-10">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
            <div className="flex flex-wrap items-center gap-3">
              <a
                href="https://www.linkedin.com/in/hoanganhchu/"
                target="_blank"
                rel="noopener noreferrer"
                className="atl-tag inline-flex items-center gap-2 px-4 py-2.5 text-[12px] uppercase tracking-[0.18em] text-[var(--atl-ink)] transition-colors"
              >
                <LinkedInIcon /> LinkedIn
              </a>
              <a
                href="https://github.com/hoanganhismeee"
                target="_blank"
                rel="noopener noreferrer"
                className="atl-tag inline-flex items-center gap-2 px-4 py-2.5 text-[12px] uppercase tracking-[0.18em] text-[var(--atl-ink)] transition-colors"
              >
                <GitHubIcon /> GitHub
              </a>
            </div>
            <div className="sm:text-right">
              <p className="atl-mono text-[10px] uppercase tracking-[0.24em] text-[var(--atl-faint)]">
                &copy; 2026 Hoang Anh Chu &mdash; portfolio &amp; demonstration use only
              </p>
            </div>
          </div>
        </footer>
      </div>
    </main>
  );
}
