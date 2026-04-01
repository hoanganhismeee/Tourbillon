import PocketWatch from "../components/decorations/PocketWatch";
import { Mail, Phone, MapPin } from "lucide-react";

// Brand icons — not available in this version of lucide-react.
function LinkedInIcon({ size = 16, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
    </svg>
  );
}

function GitHubIcon({ size = 16, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M12 0C5.374 0 0 5.373 0 12c0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0 1 12 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z" />
    </svg>
  );
}

function GoogleDriveIcon({ size = 16, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 87.3 78" xmlns="http://www.w3.org/2000/svg" className={className}>
      <path d="m6.6 66.85 3.85 6.65c.8 1.4 1.95 2.5 3.3 3.3l13.75-23.8h-27.5c0 1.55.4 3.1 1.2 4.5z" fill="currentColor" />
      <path d="m43.65 25-13.75-23.8c-1.35.8-2.5 1.9-3.3 3.3l-25.4 44a9.06 9.06 0 0 0-1.2 4.5h27.5z" fill="currentColor" />
      <path d="m73.55 76.8c1.35-.8 2.5-1.9 3.3-3.3l1.6-2.75 7.65-13.25c.8-1.4 1.2-2.95 1.2-4.5h-27.5l5.85 11.5z" fill="currentColor" />
      <path d="m43.65 25 13.75-23.8c-1.35-.8-2.9-1.2-4.5-1.2h-18.5c-1.6 0-3.15.45-4.5 1.2z" fill="currentColor" />
      <path d="m59.8 53h-32.3l-13.75 23.8c1.35.8 2.9 1.2 4.5 1.2h50.8c1.6 0 3.15-.45 4.5-1.2z" fill="currentColor" />
      <path d="m73.4 26.35-12.7-22c-.8-1.4-1.95-2.5-3.3-3.3l-13.75 23.8 16.15 28h27.45c0-1.55-.4-3.1-1.2-4.5z" fill="currentColor" />
    </svg>
  );
}

const TECH_STACK = [
  { label: "ASP.NET Core (.NET 8)", category: "Backend" },
  { label: "Next.js 15 App Router", category: "Frontend" },
  { label: "PostgreSQL + pgvector", category: "Database" },
  { label: "Python Flask", category: "AI Service" },
  { label: "Redis", category: "Infrastructure" },
  { label: "Docker Compose", category: "Infrastructure" },
  { label: "Cloudinary", category: "Media" },
  { label: "Hangfire", category: "Backend" },
  { label: "Framer Motion", category: "Frontend" },
  { label: "Tailwind CSS v4", category: "Frontend" },
  { label: "nomic-embed-text", category: "AI" },
  { label: "Claude Haiku API", category: "AI" },
  { label: "Zustand", category: "Frontend" },
  { label: "GitHub Actions CI", category: "Infrastructure" },
];

const FEATURES_DONE = [
  "Watch catalogue — 13 brands, 50+ collections",
  "AI Watch Finder — NL query → intent parse → vector search → LLM rerank",
  "Persistent semantic query cache (cosine similarity, 0.92 threshold)",
  "Hybrid filtering — SQL pre-filters + pgvector cosine similarity",
  "4-chunk embeddings per watch (full, brand_style, specs, use_case)",
  "Story-first product pages — editorial seeded for 339/339 watches",
  "Watch DNA / Taste Profile — LLM extract once, rule-based score at browse time",
  "Chat concierge — floating widget, RAG pipeline, web search, brand knowledge",
  "Compare mode — side-by-side specs with AI wearability insights",
  "Wrist-fit recommender — pure arithmetic, no AI cost",
  "Favourites & named collections — optimistic UI with rollback",
  "Contact advisor / book appointment — dual-email notification via Hangfire",
  "Google OAuth + passwordless magic link (email OTP)",
  "Role-based access control — admin-gated scrape + editorial endpoints",
  "Cinematic homepage — full-screen video hero with GSAP scroll",
  "Advisor CRM — inquiry pipeline with Hangfire status auto-advance",
  "Observability — Serilog structured logging + ASP.NET health checks",
  "CI/CD — GitHub Actions, backend build + 25 tests, frontend tsc",
  "Redis — distributed cache, rate limiting, chat session storage",
];

const FEATURES_PLANNED = [
  "Slug-based URLs + Cloudinary public ID sync (in progress)",
  "Search & recommendation analytics dashboard",
  "Phase 10 design upgrade — Lenis smooth scroll, GSAP cinematic scroll, near-3D watch card tilt",
  "Storage abstraction — S3 + CloudFront migration",
  "Kubernetes orchestration — HPA, rolling deployments",
];

const RESUME_SKILLS: Record<string, string[]> = {
  Languages: ["C#", "Python", "Java", "TypeScript", "JavaScript"],
  Frameworks: ["ASP.NET Core (.NET 8)", "React", "Next.js", "Node.js", "Expo"],
  Tools: ["Docker", "Git", "Jira", "AWS EC2", "Confluence", "Visual Studio"],
  Databases: ["PostgreSQL", "SurrealDB"],
  Practices: ["Agile Scrum", "SOLID", "RAG", "Vector Embeddings"],
};

// About page — personal portfolio introduction with architecture showcase for hiring managers.
export default function StoriesPage() {
  return (
    <div>
      <div className="container mx-auto px-8 pt-16 pb-24">

        {/* 70 / 30 layout: content left, sticky pocket watch right */}
        <div className="flex gap-14 items-start">

          {/* ── Left: scrollable content (70%) ── */}
          <div className="flex-1 min-w-0">

            {/* Page heading */}
            <div className="mb-16">
              <h1 className="text-5xl font-playfair font-bold tourbillon-text-color mb-4">The Maker</h1>
              <p className="text-lg tourbillon-text-color opacity-60 leading-relaxed max-w-3xl">
                Welcome. This is where Tourbillon begins — not with the watches, but with the person who built it.
              </p>
            </div>

            <div className="space-y-20 pb-40">

              {/* ── About Me ── */}
              <div className="border-t border-white/10 pt-12">
                <p className="text-xs tracking-[0.2em] uppercase tourbillon-text-color opacity-30 mb-3">Profile</p>
                <h2 className="font-playfair text-3xl tourbillon-text-color mb-6">About Me</h2>
                <div className="space-y-5">
                  <p className="text-base tourbillon-text-color opacity-60 leading-relaxed">
                    My name is Hoang Anh — Brandon to most. I am a software engineer with a deep passion for watches,
                    and a particular admiration for Vacheron Constantin. What draws me to VC is not the prestige —
                    it is the philosophy. A manufacture that has been finishing the invisible surfaces of its
                    movements since 1755, not because collectors demand it, but because leaving any surface
                    unconsidered would be a failure of craft. That standard of invisible rigour is the one
                    I apply to my own work.
                  </p>
                  <p className="text-base tourbillon-text-color opacity-60 leading-relaxed">
                    The tourbillon itself is the clearest expression of that idea in engineering: a mechanism
                    that exists solely to neutralise the effects of gravity on a balance wheel, rotating once
                    per minute inside a cage of sometimes fewer than seventy components. It is a solution to
                    a problem that barely exists in modern life — and yet it exists, because precision was
                    worth pursuing for its own sake. That disposition — building things properly even where
                    no one will look — is what I bring to systems and code.
                  </p>
                  <p className="text-base tourbillon-text-color opacity-60 leading-relaxed">
                    I build full-stack and AI-driven applications with a particular interest in search and
                    discovery: systems that understand what a user actually wants, not just what they typed.
                    I am currently seeking a graduate or entry-level software engineering role where precision
                    and intentional design are valued. If that sounds like where you work, I would be glad to talk.
                  </p>
                </div>
              </div>

              {/* ── What Tourbillon Is ── */}
              <div className="border-t border-white/10 pt-12">
                <p className="text-xs tracking-[0.2em] uppercase tourbillon-text-color opacity-30 mb-3">The Project</p>
                <h2 className="font-playfair text-3xl tourbillon-text-color mb-6">What Tourbillon Is</h2>
                <div className="max-w-prose space-y-5 mb-10">
                  <p className="text-base tourbillon-text-color opacity-60 leading-relaxed">
                    Tourbillon is a full-stack luxury watch e-commerce platform — a deliberate portfolio piece built
                    to production standard. It catalogues 13 brands across 50+ collections and surfaces them through
                    an AI-powered discovery layer: natural language search, a taste profile engine, editorial content
                    per watch, and a RAG-based chat concierge. The name is not decorative — every architectural
                    decision reflects the same principle as the mechanism: complexity in service of precision,
                    with nothing left unfinished.
                  </p>
                  <p className="text-base tourbillon-text-color opacity-60 leading-relaxed">
                    The AI service is cleanly isolated in Python so prompt logic never bleeds into C#. The vector
                    search uses a two-layer cache — semantic query cache first, watch embeddings second — so the
                    LLM is called only when necessary. Taste profiles are extracted by AI once on save, then scored
                    deterministically at browse time at zero AI cost. This is not a tutorial project reassembled
                    into a portfolio. It is the kind of work I would ship to real users, held to that standard
                    throughout.
                  </p>
                </div>

                {/* Architecture diagram */}
                <p className="text-xs tracking-[0.2em] uppercase tourbillon-text-color opacity-30 mb-4">Architecture</p>
                <div className="border border-white/10 bg-white/[0.02] p-6 font-mono text-xs tourbillon-text-color opacity-50 leading-relaxed overflow-x-auto mb-10">
                  <pre>{`              ┌──────────────────────┐
              │  Next.js 15 Frontend  │
              │      :3000 (HMR)      │
              └──────────┬────────────┘
                         │  HTTP / proxy routes
              ┌──────────▼────────────┐
              │   .NET 8 Web API       │
              │   14 controllers       │
              │   25 services          │
              │      :5248             │
              └───┬──────┬────────┬───┘
                  │      │        │
       ┌──────────▼─┐ ┌──▼────┐ ┌▼───────────┐
       │ PostgreSQL  │ │ Flask │ │ Cloudinary  │
       │  pgvector   │ │  AI   │ │  (images)   │
       │   :5432     │ │ :5000 │ └────────────┘
       └────────────┘ └──┬────┘
                         │
                  ┌──────▼───────┐
                  │ Claude Haiku │
                  │   (prod) /   │
                  │ Qwen 2.5 7B  │
                  │   (local)    │
                  └──────────────┘

  Redis :6379              Hangfire (PostgreSQL)
  ├─ chat sessions          ├─ email dispatch
  ├─ rate limits            ├─ embedding jobs
  └─ auth codes             └─ inquiry pipeline`}</pre>
                </div>

                {/* Tech stack */}
                <p className="text-xs tracking-[0.2em] uppercase tourbillon-text-color opacity-30 mb-4">Tech Stack</p>
                <div className="flex flex-wrap gap-2 mb-10">
                  {TECH_STACK.map((t) => (
                    <div key={t.label} className="flex items-center gap-2 px-3 py-1.5 border border-white/15">
                      <span className="text-xs tourbillon-text-color opacity-25 tracking-wider uppercase">{t.category}</span>
                      <span className="w-px h-3 bg-white/10" />
                      <span className="text-xs tourbillon-text-color opacity-55">{t.label}</span>
                    </div>
                  ))}
                </div>

                {/* Features — done */}
                <p className="text-xs tracking-[0.2em] uppercase tourbillon-text-color opacity-30 mb-4">Features Built</p>
                <div className="grid grid-cols-2 gap-x-8 gap-y-2 mb-8">
                  {FEATURES_DONE.map((f) => (
                    <div key={f} className="flex items-start gap-3">
                      <span className="text-xs tourbillon-text-color opacity-30 mt-0.5 shrink-0">✓</span>
                      <span className="text-sm tourbillon-text-color opacity-55 leading-relaxed">{f}</span>
                    </div>
                  ))}
                </div>

                {/* Features — planned */}
                <p className="text-xs tracking-[0.2em] uppercase tourbillon-text-color opacity-20 mb-3">In Progress / Planned</p>
                <div className="grid grid-cols-2 gap-x-8 gap-y-2">
                  {FEATURES_PLANNED.map((f) => (
                    <div key={f} className="flex items-start gap-3">
                      <span className="text-xs tourbillon-text-color opacity-20 mt-0.5 shrink-0">◦</span>
                      <span className="text-sm tourbillon-text-color opacity-35 leading-relaxed">{f}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* ── Resume ── */}
              <div className="border-t border-white/10 pt-12">
                <p className="text-xs tracking-[0.2em] uppercase tourbillon-text-color opacity-30 mb-8">Resume</p>

                {/* Social links — icons only */}
                <div className="flex gap-3 mb-12">
                  <a
                    href="mailto:hoanganh31012005@gmail.com"
                    className="p-2.5 border border-white/20 tourbillon-text-color opacity-50 hover:opacity-100 hover:border-white/40 transition-all"
                    title="Email"
                  >
                    <Mail size={15} />
                  </a>
                  <a
                    href="tel:+61406062737"
                    className="p-2.5 border border-white/20 tourbillon-text-color opacity-50 hover:opacity-100 hover:border-white/40 transition-all"
                    title="Phone"
                  >
                    <Phone size={15} />
                  </a>
                  <span
                    className="p-2.5 border border-white/20 tourbillon-text-color opacity-50"
                    title="Bexley North, Sydney NSW"
                  >
                    <MapPin size={15} />
                  </span>
                  <a
                    href="YOUR_LINKEDIN_URL"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2.5 border border-white/20 tourbillon-text-color opacity-50 hover:opacity-100 hover:border-white/40 transition-all"
                    title="LinkedIn"
                  >
                    <LinkedInIcon size={15} />
                  </a>
                  <a
                    href="YOUR_GITHUB_URL"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2.5 border border-white/20 tourbillon-text-color opacity-50 hover:opacity-100 hover:border-white/40 transition-all"
                    title="GitHub"
                  >
                    <GitHubIcon size={15} />
                  </a>
                  <a
                    href="YOUR_GOOGLE_DRIVE_URL"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2.5 border border-white/20 tourbillon-text-color opacity-50 hover:opacity-100 hover:border-white/40 transition-all"
                    title="Resume (Google Drive)"
                  >
                    <GoogleDriveIcon size={15} />
                  </a>
                </div>

                {/* Profile summary */}
                <div className="mb-14">
                  <p className="text-xs tracking-[0.2em] uppercase tourbillon-text-color opacity-30 mb-5">Profile</p>
                  <div className="space-y-4">
                    <p className="text-base tourbillon-text-color opacity-60 leading-relaxed">
                      Software Engineering student at the University of Technology Sydney, graduating December 2026.
                      Hands-on experience building full-stack and AI-driven applications through internships and
                      personal projects — including an internal RAG document assistant at FPT Software and
                      Tourbillon, a production-grade AI-powered watch discovery platform.
                    </p>
                    <p className="text-base tourbillon-text-color opacity-60 leading-relaxed">
                      Strong interest in building practical systems that improve how users search, decide, and
                      interact with products. Seeking a graduate or entry-level software engineering role to
                      contribute to real-world systems and work on products with clear user impact.
                    </p>
                  </div>
                </div>

                {/* Experience */}
                <div className="mb-14">
                  <p className="text-xs tracking-[0.2em] uppercase tourbillon-text-color opacity-30 mb-8">Experience</p>

                  <div className="mb-10">
                    <div className="flex items-start justify-between gap-4 mb-1">
                      <h3 className="font-playfair text-xl tourbillon-text-color">FPT Software</h3>
                      <span className="text-xs tourbillon-text-color opacity-40 shrink-0 pt-1">Dec 2025 – Apr 2026</span>
                    </div>
                    <p className="text-xs tourbillon-text-color opacity-35 mb-5 tracking-[0.1em] uppercase">
                      Software Engineer Intern · Sydney CBD, NSW
                    </p>
                    <ul className="space-y-3">
                      {[
                        "Designed and delivered a company-authenticated AI document assistant — similar to NotebookLM — for internal knowledge retrieval, improving how engineers access and use internal documentation.",
                        "Built using Python, Next.js, SurrealDB, Docker, and AWS EC2 with open-source Hugging Face models; implemented a Retrieval-Augmented Generation (RAG) pipeline with embedding retrieval and contextual chat responses.",
                        "Collaborated with engineers and team leads in an Agile Scrum environment across sprint planning, daily stand-ups, and sprint reviews.",
                      ].map((point, i) => (
                        <li key={i} className="flex gap-4 text-sm tourbillon-text-color opacity-60 leading-relaxed">
                          <span className="opacity-30 shrink-0 mt-0.5">—</span>
                          {point}
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div>
                    <div className="flex items-start justify-between gap-4 mb-1">
                      <h3 className="font-playfair text-xl tourbillon-text-color">Sensear</h3>
                      <span className="text-xs tourbillon-text-color opacity-40 shrink-0 pt-1">May 2025 – Aug 2025</span>
                    </div>
                    <p className="text-xs tourbillon-text-color opacity-35 mb-5 tracking-[0.1em] uppercase">
                      Software Engineer Intern · Botany, Sydney NSW
                    </p>
                    <ul className="space-y-3">
                      {[
                        "Developed automated Python testing workflows to improve firmware validation reliability and reduce manual testing effort for IIoT headset systems.",
                        "Worked closely with mechanical engineers to translate software issues into practical testing improvements, and presented technical updates to clients in clear, accessible language.",
                        "Gained hands-on exposure to IIoT device behaviour, headset firmware responses, and hardware–software interactions.",
                      ].map((point, i) => (
                        <li key={i} className="flex gap-4 text-sm tourbillon-text-color opacity-60 leading-relaxed">
                          <span className="opacity-30 shrink-0 mt-0.5">—</span>
                          {point}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                {/* Education */}
                <div className="mb-14">
                  <p className="text-xs tracking-[0.2em] uppercase tourbillon-text-color opacity-30 mb-6">Education</p>
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h3 className="font-playfair text-xl tourbillon-text-color mb-1">
                        University of Technology Sydney
                      </h3>
                      <p className="text-sm tourbillon-text-color opacity-60">
                        Bachelor of Engineering (Honours) — Software Engineering
                      </p>
                    </div>
                    <span className="text-xs tourbillon-text-color opacity-40 shrink-0 pt-1">Feb 2023 – Dec 2026</span>
                  </div>
                </div>

                {/* Skills */}
                <div>
                  <p className="text-xs tracking-[0.2em] uppercase tourbillon-text-color opacity-30 mb-6">Skills</p>
                  <div className="space-y-4">
                    {Object.entries(RESUME_SKILLS).map(([category, items]) => (
                      <div key={category} className="flex gap-6 items-start">
                        <span className="text-xs tourbillon-text-color opacity-30 w-20 shrink-0 pt-1 tracking-[0.1em] uppercase">
                          {category}
                        </span>
                        <div className="flex flex-wrap gap-2">
                          {items.map((skill) => (
                            <span
                              key={skill}
                              className="px-3 py-1 border border-white/15 text-xs tourbillon-text-color opacity-55 tracking-wide"
                            >
                              {skill}
                            </span>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

              </div>
            </div>
          </div>

          {/* ── Right: sticky pocket watch — desktop only ── */}
          <div className="hidden lg:flex flex-col items-center gap-4 sticky top-24 flex-shrink-0 w-72">
            <PocketWatch size={260} variant="champagne" />
            <div className="text-center">
              <p className="font-playfair text-lg tourbillon-text-color">Grand Complication</p>
              <p className="text-xs tourbillon-text-color opacity-50 mt-1">
                Perpetual calendar, moon phase, running seconds.<br />
                Champagne dial with cream-gold indices.
              </p>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
