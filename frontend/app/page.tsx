// Portfolio hub — warm, expressive standalone landing. Deep brown canvas, cream-gold text,
// amber accent, engine-turned guilloche + grain, a kinetic tech marquee, and a bleeding
// wordmark footer. A professional personal portfolio: intro, experience, projects,
// education, skills. Chrome hidden via ChromeGate.
import type { Metadata } from "next";
import { Bricolage_Grotesque, Fraunces, Manrope, IBM_Plex_Mono } from "next/font/google";
import Image from "next/image";
import Link from "next/link";
import ScrollFade from "./scrollMotion/ScrollFade";
import { PortfolioCheckpoint } from "./projects/PortfolioBackNav";

// "Studio" typeface set for the portfolio landing (loaded inline since this is the root page).
const display = Bricolage_Grotesque({ variable: "--font-display", subsets: ["latin"], display: "swap" });
const serif = Fraunces({ variable: "--font-serif", subsets: ["latin"], display: "swap", style: ["normal", "italic"] });
const body = Manrope({ variable: "--font-body", subsets: ["latin"], display: "swap" });
const mono = IBM_Plex_Mono({ variable: "--font-mono-studio", subsets: ["latin"], display: "swap", weight: ["400", "500", "600"] });

export const metadata: Metadata = {
  title: "Hoang Anh Chu — Portfolio",
  description:
    "Hoang Anh Chu (Brandon) — full-stack software engineer with an AI focus. Selected work: Tourbillon and FuelUp.",
};

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

const marquee = [
  "Full-stack", "AI-driven", ".NET 8", "Next.js", "React Native", "RAG",
  "pgvector", "PostgreSQL", "Docker", "AWS", "Hangfire", "Redis",
];

const experience = [
  {
    company: "FPT Software",
    role: "Software Engineer Intern",
    dates: "Dec 2025 — May 2026",
    location: "Sydney CBD, NSW",
    points: [
      "Architected a RAG backend in Python — document ingestion, chunking, Hugging Face embeddings, and vector retrieval from SurrealDB, containerised with Docker.",
      "Built a company-authenticated AI document assistant supporting file upload, document preview, slide generation, and citation-backed answers from uploaded files.",
      "Worked in an Agile Scrum team across sprint planning, peer code reviews, and stakeholder demos.",
    ],
  },
  {
    company: "Sensear",
    role: "Software Engineer Intern",
    dates: "May 2025 — Aug 2025",
    location: "Botany, NSW",
    points: [
      "Built a Python test-automation suite validating IIoT headset firmware across device configurations, cutting manual regression effort per release and improving defect traceability.",
      "Translated reported hardware and firmware issues into repeatable test cases, working directly with mechanical engineers on the headset platform.",
    ],
  },
];

const projects = [
  {
    name: "Tourbillon",
    meta: "Oct 2025 — Apr 2026 · Full-stack web",
    blurb:
      "A luxury watch e-commerce platform with an AI concierge, plain-English smart search, side-by-side comparison, wrist-size visualization, and a Watch DNA taste profile built from browsing behavior. A .NET 8 API, a Next.js 15 frontend, and a Python AI service.",
    tags: ["Next.js 15", ".NET 8", "PostgreSQL", "pgvector", "Claude"],
    links: [
      { label: "Visit live site", href: "/tourbillon", external: false, newTab: true },
      { label: "Read case study", href: "/projects/tourbillon", external: false, newTab: false },
      { label: "GitHub", href: "https://github.com/hoanganhismeee/Tourbillon", external: true, newTab: false },
    ],
  },
  {
    name: "FuelUp",
    meta: "Aug 2025 — Nov 2025 · Mobile app",
    blurb:
      "A cross-platform fitness and nutrition companion with AI food and workout recommendations that gracefully fall back to rule-based logic. React Native (Expo) with a Node, Express, and PostgreSQL API.",
    tags: ["React Native", "Expo", "Node", "PostgreSQL", "OpenAI"],
    links: [
      { label: "Read case study", href: "/projects/fuelup", external: false, newTab: false },
      { label: "GitHub", href: "https://github.com/Scorpio-2410/FuelUp", external: true, newTab: false },
    ],
  },
];

const education = [
  {
    school: "University of Technology Sydney",
    degree: "Bachelor of Engineering (Honours), Software Engineering",
    dates: "Feb 2023 — Nov 2026 (Expected)",
    wam: "WAM 79.19",
  },
];

const skillGroups = [
  { title: "Languages", items: ["C#", "Python", "Java", "TypeScript", "JavaScript"] },
  { title: "Frameworks", items: ["ASP.NET Core (.NET 8)", "React", "Next.js", "Node.js", "Expo"] },
  {
    title: "Cloud & DevOps",
    items: ["Docker", "GitHub Actions", "AWS S3", "CloudFront", "Railway", "Vercel", "Neon", "Upstash"],
  },
  { title: "Databases", items: ["PostgreSQL", "SurrealDB", "pgvector", "Redis"] },
  { title: "Tools & Practices", items: ["Git", "Jira", "Confluence", "Cursor", "Agile Scrum", "SOLID"] },
];

// Plain grotesk section title.
function SectionHead({ title }: { title: string }) {
  return (
    <h2 className="stu-display text-[2rem] font-semibold tracking-[-0.015em] md:text-[2.6rem]">{title}</h2>
  );
}

export default function PortfolioHubPage() {
  return (
    <main className={`${display.variable} ${serif.variable} ${body.variable} ${mono.variable} stu-body stu-root relative min-h-screen w-full overflow-hidden text-[var(--stu-text)]`}>
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
            .stu-serif { font-family: var(--font-serif), Georgia, "Times New Roman", serif; }
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

            @keyframes stu-scroll { from { transform: translateX(0); } to { transform: translateX(-50%); } }
            .stu-marquee { animation: stu-scroll 40s linear infinite; }

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
              transform: translateY(-3px);
            }
            .stu-arrow { transition: transform 0.35s cubic-bezier(0.22,1,0.36,1); }
            .group:hover .stu-arrow { transform: translateX(4px); }
            @media (prefers-reduced-motion: reduce) {
              .stu-rise { animation: none; opacity: 1; }
              .stu-marquee { animation: none; }
            }
          `,
        }}
      />

      {/* Drops the in-app checkpoint so case studies know they can offer a back control */}
      <PortfolioCheckpoint />

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
          <span className="stu-mono hidden text-[11px] uppercase tracking-[0.22em] text-[var(--stu-faint)] sm:inline">
            Sydney, Australia
          </span>
        </header>

        {/* Hero */}
        <section className="grid grid-cols-1 items-center gap-12 pb-14 pt-14 md:pt-20 lg:grid-cols-12 lg:gap-12">
          <div className="lg:col-span-7">
            <p className="stu-rise stu-serif text-[1.15rem] italic text-[var(--stu-muted)]" style={{ animationDelay: "40ms" }}>
              Hello — I&rsquo;m
            </p>
            <h1
              className="stu-rise stu-display mt-3 text-[3.1rem] font-bold leading-[0.9] tracking-[-0.035em] sm:text-[4.4rem] lg:text-[5.2rem]"
              style={{ animationDelay: "110ms" }}
            >
              <span className="block">Hoang Anh</span>
              <span className="stu-serif block font-light italic text-[var(--stu-accent)]">Chu.</span>
            </h1>
            <p
              className="stu-rise mt-8 max-w-xl text-[1.05rem] leading-[1.75] text-[var(--stu-muted)]"
              style={{ animationDelay: "200ms" }}
            >
              Final-year Software Engineering (Honours) at UTS, graduating November 2026. I ship
              full-stack, AI-driven products — through internships at FPT Software and Sensear,
              and projects like Tourbillon and FuelUp.
            </p>

            <div className="stu-rise mt-9 flex flex-wrap items-center gap-3" style={{ animationDelay: "280ms" }}>
              <a
                href="https://drive.google.com/file/d/1wcWvvPld5kCtAiNABVGnVz-83J73nNUp/view?usp=sharing"
                className="group inline-flex items-center gap-2 rounded-md bg-[var(--stu-accent)] px-5 py-3 text-[13px] font-semibold tracking-[0.02em] text-[#211710] transition-colors hover:bg-[var(--stu-accent-hover)]"
              >
                My Resume
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
          </div>

          {/* Portrait */}
          <div className="stu-rise lg:col-span-5" style={{ animationDelay: "180ms" }}>
            <div className="relative mx-auto w-full max-w-[360px] lg:ml-auto">
              <div className="relative aspect-[4/5] overflow-hidden rounded-2xl border border-[var(--stu-line)] bg-[var(--stu-surface)] shadow-[0_40px_80px_-40px_rgba(0,0,0,0.75)]">
                <Image
                  src="/tao-profile.jpg"
                  alt="Hoang Anh Chu (Brandon)"
                  fill
                  priority
                  sizes="(max-width: 1024px) 80vw, 360px"
                  className="object-cover object-[50%_20%]"
                />
                <div
                  aria-hidden
                  className="absolute inset-0"
                  style={{ background: "linear-gradient(180deg, transparent 48%, rgba(30,21,18,0.55) 100%)" }}
                />
              </div>
            </div>
          </div>
        </section>

        {/* Kinetic tech marquee */}
        <div
          aria-hidden
          className="stu-rise relative overflow-hidden border-y border-[var(--stu-line)] py-4"
          style={{ animationDelay: "360ms" }}
        >
          <div className="stu-marquee flex w-max">
            {[0, 1].map((dup) => (
              <div key={dup} className="flex shrink-0 items-center">
                {marquee.map((item) => (
                  <span
                    key={`${dup}-${item}`}
                    className="stu-mono flex items-center gap-6 px-6 text-[12px] uppercase tracking-[0.28em] text-[var(--stu-muted)]"
                  >
                    {item}
                    <span className="text-[var(--stu-accent)]">&#10022;</span>
                  </span>
                ))}
              </div>
            ))}
          </div>
        </div>

        {/* Experience */}
        <ScrollFade triggerOnce className="mt-6 border-t border-[var(--stu-line)] py-20">
          <SectionHead title="Experience" />
          <div className="mt-12 space-y-12">
            {experience.map((role) => (
              <div key={role.company}>
                <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between">
                  <div>
                    <h3 className="stu-display text-[1.4rem] font-semibold leading-tight text-[var(--stu-text)]">
                      {role.company}
                    </h3>
                    <p className="stu-mono mt-1.5 text-[12px] uppercase tracking-[0.16em] text-[var(--stu-accent)]">
                      {role.role}
                    </p>
                  </div>
                  <div className="stu-mono shrink-0 text-[11px] uppercase tracking-[0.16em] text-[var(--stu-faint)] sm:text-right">
                    {role.dates} &middot; {role.location}
                  </div>
                </div>
                <ul className="mt-5 space-y-2.5">
                  {role.points.map((point) => (
                    <li key={point} className="flex gap-3 text-[0.97rem] leading-[1.7] text-[var(--stu-muted)]">
                      <span className="mt-[2px] text-[var(--stu-accent)]" aria-hidden>&ndash;</span>
                      <span>{point}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </ScrollFade>

        {/* Projects */}
        <ScrollFade triggerOnce className="border-t border-[var(--stu-line)] py-20">
          <SectionHead title="Projects" />
          <div className="mt-12 grid grid-cols-1 gap-6 lg:grid-cols-2">
            {projects.map((project) => (
              <article
                key={project.name}
                className="stu-card flex flex-col rounded-xl border border-[var(--stu-line)] bg-[var(--stu-surface)]/40 p-8"
              >
                <span className="stu-mono text-[11px] uppercase tracking-[0.22em] text-[var(--stu-faint)]">
                  {project.meta}
                </span>
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
                  {project.links.map((link) =>
                    link.external ? (
                      <a
                        key={link.label}
                        href={link.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="group stu-mono inline-flex items-center gap-2 text-[12px] uppercase tracking-[0.14em] text-[var(--stu-text)]"
                      >
                        <span className="stu-link">{link.label}</span>
                        <span className="stu-arrow text-[var(--stu-accent)]" aria-hidden>↗</span>
                      </a>
                    ) : (
                      <Link
                        key={link.label}
                        href={link.href}
                        target={link.newTab ? "_blank" : undefined}
                        rel={link.newTab ? "noopener noreferrer" : undefined}
                        className="group stu-mono inline-flex items-center gap-2 text-[12px] uppercase tracking-[0.14em] text-[var(--stu-text)]"
                      >
                        <span className="stu-link">{link.label}</span>
                        <span className="stu-arrow text-[var(--stu-accent)]" aria-hidden>{link.newTab ? "↗" : "→"}</span>
                      </Link>
                    ),
                  )}
                </div>
              </article>
            ))}
          </div>
        </ScrollFade>

        {/* Education */}
        <ScrollFade triggerOnce className="border-t border-[var(--stu-line)] py-20">
          <SectionHead title="Education" />
          <div className="mt-12 space-y-8">
            {education.map((e) => (
              <div
                key={e.school}
                className="flex flex-col gap-5 border-t border-[var(--stu-line-soft)] pt-6 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="flex items-center gap-5">
                  <div>
                    <h3 className="stu-display text-[1.4rem] font-semibold leading-tight text-[var(--stu-text)]">
                      {e.school}
                    </h3>
                    <p className="mt-1.5 text-[0.97rem] text-[var(--stu-muted)]">{e.degree}</p>
                    <p className="stu-mono mt-2 text-[11px] uppercase tracking-[0.16em] text-[var(--stu-accent)]">
                      {e.wam}
                    </p>
                  </div>
                </div>
                <span className="stu-mono shrink-0 text-[11px] uppercase tracking-[0.16em] text-[var(--stu-faint)] sm:text-right">
                  {e.dates}
                </span>
              </div>
            ))}
          </div>
        </ScrollFade>

        {/* Skills */}
        <ScrollFade triggerOnce className="border-t border-[var(--stu-line)] py-20">
          <SectionHead title="Skills" />
          <div className="mt-12 grid grid-cols-1 gap-x-12 gap-y-9 sm:grid-cols-2">
            {skillGroups.map((group) => (
              <div key={group.title} className="border-t border-[var(--stu-line-soft)] pt-5">
                <h3 className="stu-mono text-[11px] uppercase tracking-[0.24em] text-[var(--stu-accent)]">
                  {group.title}
                </h3>
                <div className="mt-4 flex flex-wrap gap-2">
                  {group.items.map((item) => (
                    <span
                      key={item}
                      className="stu-mono rounded-full border border-[var(--stu-line)] px-3 py-1 text-[10.5px] tracking-[0.04em] text-[var(--stu-muted)]"
                    >
                      {item}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </ScrollFade>

      </div>

      {/* Footer — contact links + bleeding wordmark */}
      <footer className="relative z-10 mt-12 border-t border-[var(--stu-line)]">
        <div className="mx-auto w-full max-w-[1140px] px-6 pt-10 sm:px-10 lg:px-14">
          <div className="flex flex-wrap items-center gap-x-8 gap-y-3">
            <a
              href="mailto:hoanganh31012005@gmail.com"
              className="group stu-mono inline-flex items-center gap-2 text-[12px] uppercase tracking-[0.16em] text-[var(--stu-text)]"
            >
              <span className="stu-link">Email</span>
              <span className="stu-arrow text-[var(--stu-accent)]" aria-hidden>→</span>
            </a>
            <a
              href="https://www.linkedin.com/in/hoanganhchu/"
              target="_blank"
              rel="noopener noreferrer"
              className="group stu-mono inline-flex items-center gap-2 text-[12px] uppercase tracking-[0.16em] text-[var(--stu-text)]"
            >
              <span className="stu-link">LinkedIn</span>
              <span className="stu-arrow text-[var(--stu-accent)]" aria-hidden>↗</span>
            </a>
            <a
              href="https://github.com/hoanganhismeee"
              target="_blank"
              rel="noopener noreferrer"
              className="group stu-mono inline-flex items-center gap-2 text-[12px] uppercase tracking-[0.16em] text-[var(--stu-text)]"
            >
              <span className="stu-link">GitHub</span>
              <span className="stu-arrow text-[var(--stu-accent)]" aria-hidden>↗</span>
            </a>
          </div>
        </div>
        <div aria-hidden className="overflow-hidden pt-8">
          <p className="stu-display whitespace-nowrap px-4 text-center text-[15vw] font-bold leading-[0.78] tracking-[-0.04em]" style={{ color: "rgba(240,230,210,0.05)" }}>
            HOANG ANH CHU
          </p>
        </div>
        <p className="stu-mono pb-6 text-center text-[10.5px] uppercase tracking-[0.24em] text-[var(--stu-faint)]">
          &copy; 2026 Hoang Anh Chu &middot; Sydney
        </p>
      </footer>
    </main>
  );
}
