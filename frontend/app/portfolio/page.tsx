// Portfolio hub — warm "vibey" standalone landing. Deep brown canvas, cream-gold text,
// amber accent, engine-turned guilloche + grain, in the same warm family as the Tourbillon
// site and the case studies. Introduces Hoang Anh Chu and routes out to the projects.
// Chrome hidden via ChromeGate.
import Link from "next/link";
import ScrollFade from "../scrollMotion/ScrollFade";

// Subtle film-grain data URI, layered over the brown for a tactile, atmospheric texture.
const GRAIN =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='140' height='140'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")";

function LinkedInIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
    </svg>
  );
}

function GitHubIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M12 0C5.374 0 0 5.373 0 12c0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0 1 12 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z" />
    </svg>
  );
}

const focusAreas = [
  {
    title: "Full-stack product engineering",
    text: "Frontend, backend, and data treated as one system — Next.js, .NET, React Native, and PostgreSQL.",
  },
  {
    title: "AI integration, done responsibly",
    text: "LLM features validated against a schema and paired with deterministic fallbacks, so they stay reliable.",
  },
  {
    title: "Shipping end to end",
    text: "Auth, background jobs, storage, search, CI/CD and deployment — not just the happy path.",
  },
  {
    title: "Considered interfaces",
    text: "Interfaces that feel intentional, fast, and accessible, with a clear point of view.",
  },
];

const projects = [
  {
    name: "Tourbillon",
    meta: "2025 — 2026 · Full-stack web",
    blurb:
      "A luxury watch e-commerce platform with an AI concierge, plain-English smart search, and a Watch DNA taste profile. A .NET 8 API, a Next.js 15 frontend, and a Python AI service.",
    tags: ["Next.js 15", ".NET 8", "PostgreSQL", "pgvector", "Claude"],
    links: [
      { label: "Visit live site", href: "/" },
      { label: "Read case study", href: "/portfolio/tourbillon" },
    ],
  },
  {
    name: "FuelUp",
    meta: "2025 · Mobile app",
    blurb:
      "A fitness and nutrition companion app with AI food and workout recommendations that gracefully fall back to rule-based logic. React Native (Expo) with a Node, Express, and PostgreSQL API.",
    tags: ["React Native", "Expo", "Node", "PostgreSQL", "OpenAI"],
    links: [{ label: "Read case study", href: "/portfolio/fuelup" }],
  },
];

export default function PortfolioHubPage() {
  return (
    <main className="stu-body stu-root relative min-h-screen w-full overflow-hidden text-[var(--stu-text)]">
      <style
        dangerouslySetInnerHTML={{
          __html: `
            .stu-root {
              --stu-bg: #1e1512;
              --stu-surface: #271c16;
              --stu-text: #f0e6d2;
              --stu-muted: #b8a78f;
              --stu-faint: #80705d;
              --stu-accent: #d8b27a;
              --stu-accent-hover: #ecca97;
              --stu-line: rgba(240,230,210,0.12);
              --stu-line-soft: rgba(240,230,210,0.06);
              background:
                radial-gradient(58% 42% at 50% -6%, rgba(216,178,122,0.22) 0%, transparent 70%),
                radial-gradient(50% 50% at 90% 8%, rgba(191,166,138,0.10) 0%, transparent 60%),
                linear-gradient(180deg, #241a14 0%, #1e1512 44%, #2a1f17 100%);
            }
            .stu-display { font-family: var(--font-display), "Segoe UI", system-ui, sans-serif; }
            .stu-body { font-family: var(--font-body), ui-sans-serif, system-ui, sans-serif; }
            .stu-mono { font-family: var(--font-mono-studio), ui-monospace, "SFMono-Regular", monospace; }

            /* Warm engine-turned guilloche cross-hatch, fading out below the hero */
            .stu-grid {
              background-image:
                repeating-linear-gradient(45deg, rgba(240,230,210,0.028) 0 1px, transparent 1px 9px),
                repeating-linear-gradient(-45deg, rgba(216,178,122,0.026) 0 1px, transparent 1px 9px);
              -webkit-mask-image: linear-gradient(180deg, #000 0%, #000 22%, transparent 66%);
              mask-image: linear-gradient(180deg, #000 0%, #000 22%, transparent 66%);
            }
            .stu-grain {
              background-image: ${GRAIN};
              background-size: 200px 200px;
              opacity: 0.06;
              mix-blend-mode: soft-light;
            }
            @keyframes stu-rise {
              from { opacity: 0; transform: translateY(20px); }
              to   { opacity: 1; transform: translateY(0); }
            }
            .stu-rise { opacity: 0; animation: stu-rise 0.85s cubic-bezier(0.22,1,0.36,1) forwards; }

            .stu-link { position: relative; }
            .stu-link::after {
              content: ''; position: absolute; left: 0; bottom: -2px; height: 1px; width: 100%;
              background: var(--stu-accent); transform: scaleX(0); transform-origin: left;
              transition: transform 0.35s cubic-bezier(0.22,1,0.36,1);
            }
            .stu-link:hover::after { transform: scaleX(1); }
            .stu-card { transition: border-color 0.4s ease, background-color 0.4s ease, transform 0.4s ease; }
            .stu-card:hover {
              border-color: rgba(216,178,122,0.55);
              background-color: rgba(216,178,122,0.05);
            }
            .stu-arrow { transition: transform 0.35s cubic-bezier(0.22,1,0.36,1); }
            .group:hover .stu-arrow { transform: translateX(4px); }
            @media (prefers-reduced-motion: reduce) {
              .stu-rise { animation: none; opacity: 1; }
            }
          `,
        }}
      />

      {/* Fixed atmosphere planes */}
      <div aria-hidden className="stu-grid pointer-events-none fixed inset-0 z-0" />
      <div aria-hidden className="stu-grain pointer-events-none fixed inset-0 z-0" />

      <div className="relative z-10 mx-auto w-full max-w-[1140px] px-6 sm:px-10 lg:px-14">
        {/* Top bar */}
        <header className="stu-rise flex items-center justify-between gap-4 py-6">
          <div className="flex items-center gap-3">
            <span className="stu-display flex h-9 w-9 items-center justify-center rounded-md border border-[var(--stu-accent)]/55 text-[14px] font-bold text-[var(--stu-accent)]">
              HC
            </span>
            <span className="stu-mono text-[11px] uppercase tracking-[0.26em] text-[var(--stu-muted)]">
              Hoang Anh Chu
            </span>
          </div>
          <span className="stu-mono hidden items-center gap-2 text-[11px] uppercase tracking-[0.2em] text-[var(--stu-muted)] sm:inline-flex">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-[#7fc99a]" />
            Open to grad / intern roles
          </span>
        </header>

        {/* Hero */}
        <section className="pb-24 pt-16 md:pt-24">
          <h1
            className="stu-rise stu-display mt-2 text-[3.2rem] font-bold leading-[0.98] tracking-[-0.03em] sm:text-[4.4rem] lg:text-[5rem]"
            style={{ animationDelay: "60ms" }}
          >
            Hoang Anh Chu
          </h1>
          <p
            className="stu-rise stu-display mt-6 max-w-3xl text-[1.7rem] font-semibold leading-[1.18] tracking-[-0.01em] text-[var(--stu-text)] sm:text-[2.2rem] lg:text-[2.6rem]"
            style={{ animationDelay: "140ms" }}
          >
            I build full-stack products{" "}
            <span className="text-[var(--stu-accent)]">with AI at the core</span> — from the
            data model to the interface.
          </p>
          <p
            className="stu-rise mt-7 max-w-xl text-[1.02rem] leading-[1.75] text-[var(--stu-muted)]"
            style={{ animationDelay: "220ms" }}
          >
            Final-year Software Engineering at UTS. I like turning ideas into real, shipped
            products — search, AI features, authentication, background jobs, and deployment,
            across the whole stack.
          </p>

          <div className="stu-rise mt-9 flex flex-wrap items-center gap-3" style={{ animationDelay: "300ms" }}>
            <a
              href="mailto:hoanganh31012005@gmail.com"
              className="group inline-flex items-center gap-2 rounded-md bg-[var(--stu-accent)] px-5 py-3 text-[13px] font-semibold tracking-[0.02em] text-[#211710] transition-colors hover:bg-[var(--stu-accent-hover)]"
            >
              Email me
              <span className="stu-arrow" aria-hidden>&rarr;</span>
            </a>
            <a
              href="https://www.linkedin.com/in/hoanganhchu/"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="LinkedIn"
              className="inline-flex h-[46px] w-[46px] items-center justify-center rounded-md border border-[var(--stu-line)] text-[var(--stu-muted)] transition-colors hover:border-[var(--stu-accent)]/55 hover:text-[var(--stu-text)]"
            >
              <LinkedInIcon />
            </a>
            <a
              href="https://github.com/hoanganhismeee"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="GitHub"
              className="inline-flex h-[46px] w-[46px] items-center justify-center rounded-md border border-[var(--stu-line)] text-[var(--stu-muted)] transition-colors hover:border-[var(--stu-accent)]/55 hover:text-[var(--stu-text)]"
            >
              <GitHubIcon />
            </a>
          </div>
        </section>

        {/* Focus */}
        <ScrollFade triggerOnce className="border-t border-[var(--stu-line)] py-20">
          <div className="flex items-baseline justify-between gap-6">
            <h2 className="stu-display text-[1.7rem] font-semibold tracking-[-0.01em] md:text-[2.1rem]">
              What I work on
            </h2>
            <span className="stu-mono text-[11px] uppercase tracking-[0.26em] text-[var(--stu-faint)]">
              Focus / 01
            </span>
          </div>
          <div className="mt-12 grid grid-cols-1 gap-x-12 gap-y-10 sm:grid-cols-2">
            {focusAreas.map((area, i) => (
              <div key={area.title} className="flex gap-5 border-t border-[var(--stu-line-soft)] pt-6">
                <span className="stu-mono mt-1 text-[12px] tracking-[0.1em] text-[var(--stu-accent)]">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <div>
                  <h3 className="stu-display text-[1.2rem] font-semibold leading-snug text-[var(--stu-text)]">
                    {area.title}
                  </h3>
                  <p className="mt-2.5 text-[0.97rem] leading-[1.7] text-[var(--stu-muted)]">{area.text}</p>
                </div>
              </div>
            ))}
          </div>
        </ScrollFade>

        {/* Projects */}
        <ScrollFade triggerOnce className="border-t border-[var(--stu-line)] py-20">
          <div className="flex items-baseline justify-between gap-6">
            <h2 className="stu-display text-[1.7rem] font-semibold tracking-[-0.01em] md:text-[2.1rem]">
              Projects
            </h2>
            <span className="stu-mono text-[11px] uppercase tracking-[0.26em] text-[var(--stu-faint)]">
              Work / 02
            </span>
          </div>

          <div className="mt-12 grid grid-cols-1 gap-6 lg:grid-cols-2">
            {projects.map((project) => (
              <article
                key={project.name}
                className="stu-card flex flex-col rounded-xl border border-[var(--stu-line)] bg-[var(--stu-surface)]/40 p-8"
              >
                <div className="flex items-center justify-between gap-4">
                  <span className="stu-mono text-[11px] uppercase tracking-[0.22em] text-[var(--stu-faint)]">
                    {project.meta}
                  </span>
                </div>
                <h3 className="stu-display mt-5 text-[2.2rem] font-bold leading-none tracking-[-0.02em]">
                  {project.name}
                </h3>
                <p className="mt-4 text-[0.98rem] leading-[1.7] text-[var(--stu-muted)]">{project.blurb}</p>

                <div className="mt-6 flex flex-wrap gap-2">
                  {project.tags.map((tag) => (
                    <span
                      key={tag}
                      className="stu-mono rounded-full border border-[var(--stu-line)] px-3 py-1 text-[10.5px] tracking-[0.04em] text-[var(--stu-muted)]"
                    >
                      {tag}
                    </span>
                  ))}
                </div>

                <div className="mt-auto flex flex-wrap gap-x-7 gap-y-3 pt-8">
                  {project.links.map((link) => (
                    <Link
                      key={link.label}
                      href={link.href}
                      className="group stu-mono inline-flex items-center gap-2 text-[12px] uppercase tracking-[0.14em] text-[var(--stu-text)]"
                    >
                      <span className="stu-link">{link.label}</span>
                      <span className="stu-arrow text-[var(--stu-accent)]" aria-hidden>&rarr;</span>
                    </Link>
                  ))}
                </div>
              </article>
            ))}
          </div>
        </ScrollFade>

        {/* Contact / footer */}
        <ScrollFade triggerOnce className="border-t border-[var(--stu-line)] py-20">
          <span className="stu-mono text-[11px] uppercase tracking-[0.26em] text-[var(--stu-faint)]">
            Contact / 03
          </span>
          <h2 className="stu-display mt-5 max-w-2xl text-[2.2rem] font-bold leading-[1.05] tracking-[-0.02em] md:text-[3rem]">
            Let&rsquo;s build something.
          </h2>
          <p className="mt-5 max-w-lg text-[1.02rem] leading-[1.7] text-[var(--stu-muted)]">
            The fastest way to reach me is email. I am happy to walk through any project in
            detail, code and decisions included.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <a
              href="mailto:hoanganh31012005@gmail.com"
              className="group inline-flex items-center gap-2 rounded-md bg-[var(--stu-accent)] px-5 py-3 text-[13px] font-semibold tracking-[0.02em] text-[#211710] transition-colors hover:bg-[var(--stu-accent-hover)]"
            >
              hoanganh31012005@gmail.com
              <span className="stu-arrow" aria-hidden>&rarr;</span>
            </a>
            <a
              href="https://www.linkedin.com/in/hoanganhchu/"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-md border border-[var(--stu-line)] px-5 py-3 text-[13px] text-[var(--stu-text)] transition-colors hover:border-[var(--stu-accent)]/55"
            >
              <LinkedInIcon size={15} /> LinkedIn
            </a>
            <a
              href="https://github.com/hoanganhismeee"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-md border border-[var(--stu-line)] px-5 py-3 text-[13px] text-[var(--stu-text)] transition-colors hover:border-[var(--stu-accent)]/55"
            >
              <GitHubIcon size={15} /> GitHub
            </a>
          </div>

          <div className="mt-16 flex flex-col gap-2 border-t border-[var(--stu-line-soft)] pt-6 sm:flex-row sm:items-center sm:justify-between">
            <p className="stu-mono text-[10.5px] uppercase tracking-[0.24em] text-[var(--stu-faint)]">
              Hoang Anh Chu &middot; Sydney &middot; 2026
            </p>
            <p className="stu-mono text-[10.5px] uppercase tracking-[0.24em] text-[var(--stu-faint)]">
              Set in Bricolage Grotesque &amp; Manrope &middot; Built with Next.js
            </p>
          </div>
        </ScrollFade>
      </div>
    </main>
  );
}
