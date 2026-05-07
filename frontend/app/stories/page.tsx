import Image from "next/image";
import PocketWatch from "../components/decorations/PocketWatch";
import ScrollFade from "../scrollMotion/ScrollFade";

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

const features = [
  {
    title: "Explore the catalogue",
    text: "Users can browse luxury watches by brand, collection, price, material, movement, size, and complications.",
  },
  {
    title: "Search in plain English",
    text: "Smart Search lets users type requests like \"thin rose gold dress watch\" and receive relevant results.",
  },
  {
    title: "Compare with context",
    text: "The compare page shows specs side by side and adds AI-assisted notes to make the decision easier.",
  },
  {
    title: "Save personal picks",
    text: "Signed-in users can save favourites and organise watches into collections for later review.",
  },
  {
    title: "Build a Watch DNA profile",
    text: "Browsing activity helps the site understand a user's taste and support more personal recommendations.",
  },
  {
    title: "Ask the concierge",
    text: "The chatbot assistant can answer watch questions, compare options, and guide users through the catalogue.",
  },
  {
    title: "Contact an advisor",
    text: "Users can submit inquiries or book appointments for watches that need advisor support.",
  },
  {
    title: "Manage the platform",
    text: "The admin area supports watch data, images, editorial content, embeddings, and search maintenance.",
  },
];

const stackGroups = [
  {
    title: "Frontend",
    items: ["Next.js 15", "React 19", "Tailwind CSS", "Framer Motion", "GSAP", "TanStack Query", "Zustand"],
  },
  {
    title: "Backend",
    items: ["ASP.NET Core Web API", ".NET 8", "Entity Framework Core", "ASP.NET Identity", "Hangfire"],
  },
  {
    title: "AI and Search",
    items: ["Python Flask service", "Claude Haiku 4.5", "Ollama for local dev", "pgvector", "nomic embeddings"],
  },
  {
    title: "Data and Infrastructure",
    items: ["PostgreSQL (Neon)", "Redis (Upstash)", "S3 + CloudFront", "Railway", "Vercel", "Docker Compose", "GitHub Actions"],
  },
];

const architectureDiagram = `LOCAL DEVELOPMENT

 Browser
   |
   v
+---------------------------+
| Next.js 15 frontend       |
| React 19  •  localhost:3000 |
+-------------+-------------+
              |
              | /api/backend/* proxy
              v
+---------------------------+
| .NET 8 backend API        |
| localhost:5248            |
+------+------+------+------+
       |      |      |      
       |      |      +--------------------+
       |      |                           |
       v      v                           v
+-------------+         +---------------------------+
| PostgreSQL  |         | Flask AI service          |
| pgvector    |         | localhost:5000            |
+-------------+         +-------------+-------------+
                                          |
                                          v
                               +----------------------+
                               | Ollama               |
                               | qwen2.5:7b  (local)  |
                               +----------------------+

 Redis      -> auth codes, rate limits, chat sessions
 Hangfire   -> emails, embeddings, background jobs
 Storage    -> IStorageService -> S3 + CloudFront / Cloudinary


PRODUCTION

 Browser
   |
   v
+---------------------------+
| Vercel                    |
| Next.js 15 app            |
+-------------+-------------+
              |
              | same-origin /api/backend/*
              v
+---------------------------+         +---------------------------+
| Railway backend           |<------->| Railway ai-service        |
| .NET 8 API                |         | Flask + Haiku 4.5 (prod)  |
+------+------+------+------+
       |      |      |
       |      |      +--------------------+
       |      |                           |
       v      v                           v
+-------------+  +----------------+   +---------------------------+
| Neon        |  | Upstash Redis  |   | AWS S3 + CloudFront CDN   |
| PostgreSQL  |  | sessions / RL  |   | images and video delivery |
+-------------+  +----------------+   +---------------------------+

 GitHub Actions -> CI
 Vercel / Railway -> deployment hosting`;

function Section({
  label,
  title,
  children,
}: {
  label: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <ScrollFade>
      <section className="border-t border-[#bfa68a]/12 pt-10">
        <p className="text-[10px] uppercase tracking-[0.32em] text-[#bfa68a]/80">{label}</p>
        <h2 className="mt-4 max-w-3xl text-2xl font-semibold leading-tight text-[#f0e6d2] md:text-3xl">
          {title}
        </h2>
        <div className="mt-7">{children}</div>
      </section>
    </ScrollFade>
  );
}

export default function StoriesPage() {
  return (
    <main className="px-6 pb-24 pt-20 text-white sm:px-10 lg:px-24">
      <div className="mx-auto max-w-7xl">
        <div className="grid gap-14 lg:grid-cols-[minmax(0,1fr)_260px] lg:items-start">
          <div className="min-w-0 space-y-16">
            <ScrollFade>
              <section className="border-b border-[#bfa68a]/12 pb-14">
                <div className="max-w-3xl">
                  <h1 className="mt-5 text-4xl font-semibold leading-tight text-[#f0e6d2] md:text-5xl">
                    Hi, my name is Brandon.
                  </h1>
                  <p className="mt-6 max-w-2xl text-base leading-8 text-white/55">
                    Tourbillon is my full-stack luxury watch e-commerce website. I built it to show
                    my skills in frontend development, backend systems, AI search, chat features,
                    and building a complete product.
                  </p>
                  <div className="mt-7 flex gap-3">
                    <a
                      href="https://www.linkedin.com/in/hoanganhchu/"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex h-10 w-10 items-center justify-center border border-white/16 text-white/45 transition hover:border-[#bfa68a]/45 hover:text-[#f0e6d2]"
                      title="LinkedIn"
                    >
                      <LinkedInIcon size={16} />
                    </a>
                    <a
                      href="https://github.com/hoanganhismeee"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex h-10 w-10 items-center justify-center border border-white/16 text-white/45 transition hover:border-[#bfa68a]/45 hover:text-[#f0e6d2]"
                      title="GitHub"
                    >
                      <GitHubIcon size={16} />
                    </a>
                  </div>
                </div>

                <div className="mt-10 max-w-[448px]">
                  <div className="relative h-[420px]   overflow-hidden border border-[#bfa68a]/14 bg-black/20">
                    <Image
                      src="/tao-profile.jpg"
                      alt="Brandon Chu"
                      fill
                      priority
                      sizes="(max-width: 768px) 100vw, 448px"
                      className="object-cover object-[50%_80%]"
                    />
                  </div>
                </div>
              </section>
            </ScrollFade>

            <Section label="About Me" title="Why watches, and why this project?">
              <div className="max-w-3xl space-y-5 text-[15px] leading-8 text-white/55">
                <p>
                  My name is Hoang Anh Chu, but I usually go by Brandon. I am a final yearsoftware
                  engineering student at University of Technology Sydney (UTS), I enjoy solving problem and building practical systems that people can
                  actually use.
                </p>
                <p>
                  I am a big fan of watches, especially Vacheron Constantin. I love the history,
                  the design, and the amount of mechanics detail that goes into a good watch.
                </p>
                <p>
                  That interest gave me the idea for Tourbillon. I wanted to create an e-commerce
                  website for luxury watches while also challenging myself to see how far I could
                  push my skills. Instead of building a simple product listing page, I built a full
                  platform with authentication, search, AI features, saved watches, contact flows,
                  admin tools, background jobs, and image storage.
                </p>
                <p>
                  The goal was not just to make something that looks good. I wanted to build
                  something that works like a real product and shows how I approach a larger software
                  project from end to end.
                </p>
              </div>
            </Section>

            <Section label="Project Features" title="What Tourbillon can do.">
              <div className="grid gap-4 md:grid-cols-2">
                {features.map((feature) => (
                  <div key={feature.title} className="border border-[#bfa68a]/12 bg-white/[0.015] p-5">
                    <h3 className="text-sm font-semibold text-[#f0e6d2]">{feature.title}</h3>
                    <p className="mt-3 text-sm leading-7 text-white/58">{feature.text}</p>
                  </div>
                ))}
              </div>
            </Section>

            <Section label="Tech Stack" title="The main tools behind the website.">
              <div className="grid gap-5 md:grid-cols-2">
                {stackGroups.map((group) => (
                  <div key={group.title} className="border border-[#bfa68a]/12 bg-black/10 p-5">
                    <h3 className="text-sm font-semibold text-[#f0e6d2]">{group.title}</h3>
                    <div className="mt-4 flex flex-wrap gap-2">
                      {group.items.map((item) => (
                        <span
                          key={item}
                          className="border border-white/12 px-3 py-1.5 text-[11px] text-white/55"
                        >
                          {item}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </Section>

            <Section label="Architecture" title="How the project is organised.">
              <div className="space-y-6">
                <p className="max-w-3xl text-[15px] leading-8 text-white/55">
                  The app is split into separate parts so each part has a clear job. The frontend is
                  responsible for the user experience. The backend controls the business logic and
                  data access. The AI service is separate, so prompts and model logic do not mix
                  with the .NET backend.
                </p>

                <div className="overflow-x-auto border border-[#bfa68a]/12 bg-white/[0.015] p-6">
                  <pre className="min-w-[620px] font-mono text-xs leading-relaxed text-white/50">
                    {architectureDiagram}
                  </pre>
                </div>

              </div>
            </Section>

            <Section label="What This Shows" title="What I wanted this project to demonstrate.">
              <div className="max-w-3xl space-y-5 text-[15px] leading-8 text-white/55">
                <p>
                  Tourbillon shows that I can work across frontend, backend, database, AI services,
                  authentication, deployment-style tooling, and user experience. It also shows that
                  I can take a personal idea and turn it into a complete working product.
                </p>
                <p>
                  I built it because I wanted a project that pushed me past basic CRUD work and made
                  me deal with real product problems: search quality, user state, background jobs,
                  image handling, performance, and clear UI design.
                </p>
              </div>
            </Section>
          </div>

          <aside className="hidden lg:sticky lg:top-24 lg:flex lg:h-fit lg:flex-col lg:items-center lg:gap-4">
            <PocketWatch size={260} variant="champagne" />
            <div className="text-center">
              <p className="font-playfair text-lg text-[#f0e6d2]">Grand Complication</p>
              <p className="mt-1 text-xs leading-6 text-white/45">
                Perpetual calendar, moon phase, running seconds.
                <br />
                Champagne dial with cream-gold indices.
              </p>
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
}
