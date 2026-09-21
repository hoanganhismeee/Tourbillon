// Tourbillon portfolio case study — "Atelier" standalone design.
// A light ivory editorial layout (engine-turned guilloche, deep-ink serif, oxblood
// accent) presenting Hoang Anh Chu's full-stack watch platform as a printed dossier.
// Deliberately NOT part of the Tourbillon site aesthetic; chrome is hidden via ChromeGate.
import Link from "next/link";
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
    title: "Explore the catalogue",
    text: "Browse 338 watches from 13 maisons by brand, collection, price, material, movement, size, and complications.",
  },
  {
    title: "Search in plain English",
    text: "Smart Search reads “a proper strong diver under 20k” as filters — water resistance of 300 m or more, a price ceiling — and ticks them in the filter bar. It never calls a model, so results arrive in under 30 ms.",
  },
  {
    title: "Ask the concierge",
    text: "For open briefs like “what should I wear to my own wedding”, the concierge works out what the occasion calls for, finds candidates with keyword and semantic search, and replies with watch cards, comparisons, and links to the right pages.",
  },
  {
    title: "Compare with context",
    text: "Specs sit side by side with AI-assisted notes that make the decision easier.",
  },
  {
    title: "Save personal picks",
    text: "Signed-in users — by email or Google — save favourites and organise watches into collections for later.",
  },
  {
    title: "Build a Watch DNA profile",
    text: "Browsing activity is scored into a taste profile that shapes recommendations, with no model call on the page request.",
  },
  {
    title: "Contact an advisor",
    text: "Submit inquiries or book appointments for watches that need advisor support.",
  },
  {
    title: "Manage the platform",
    text: "An admin area, gated by role-based access, handles watch data, images, editorial, embeddings, and search upkeep.",
  },
];

const stackGroups = [
  {
    title: "Frontend",
    items: ["Next.js 15", "React 19", "Tailwind CSS", "Framer Motion", "GSAP", "TanStack Query", "Zustand"],
  },
  {
    title: "Backend",
    items: ["ASP.NET Core Web API", ".NET 8", "Entity Framework Core", "ASP.NET Identity", "Google OAuth", "Hangfire", "Serilog", "xUnit"],
  },
  {
    title: "AI & Search",
    items: ["Python Flask service", "Claude Haiku 4.5", "Ollama (local dev)", "BM25F", "all-mpnet-base-v2", "pgvector", "Reciprocal rank fusion"],
  },
  {
    title: "Data & Infrastructure",
    items: ["PostgreSQL (Neon)", "Redis (Upstash)", "S3 + CloudFront", "Railway", "Vercel", "Docker Compose", "GitHub Actions"],
  },
  {
    title: "Evaluation",
    items: ["Node.js benchmark harness", "Recall@K", "MRR", "nDCG", "Paired bootstrap", "pytest", "node:test"],
  },
];

const systemDiagram = `+----------------------------------------------------------------------------------+
| Client: browser                                                                  |
|   runtime       React 19 client components                                       |
|   state         TanStack Query cache persisted to localStorage, Zustand stores   |
+-----------------------------------------+----------------------------------------+
                                          |
                                          |  HTTPS
                                          v
+----------------------------------------------------------------------------------+
| Frontend: Next.js 15 App Router, on Vercel                                       |
|   rendering     React Server Components; static assets on the Vercel CDN         |
|   interface     Tailwind CSS, shadcn, Framer Motion, GSAP, Lenis                 |
|   API access    typed client; route handlers proxy /api/backend/* to the API     |
+-----------------------------------------+----------------------------------------+
                                          |
                                          |  HTTPS, REST + JSON, session cookie
                                          v
+----------------------------------------------------------------------------------+
| Backend: ASP.NET Core Web API, .NET 8, on Railway                                |
|   identity      ASP.NET Identity, Google OAuth, role-based authorisation         |
|   data          EF Core + Npgsql, pgvector; BM25F index held in memory           |
|   jobs          Hangfire workers, queued in Redis                                |
|   operations    Serilog, health checks, Swagger                                  |
+-------+----------------+----------------+----------------+----------------+------+
        |                |                |                |                |
    SQL, TLS      Redis protocol       S3 API            SMTP          HTTP + JSON
     EF Core         over TLS          AWS SDK          MailKit      private network
        |                |                |                |                |
        v                v                v                v                v
+--------------+ +--------------+ +--------------+ +--------------+ +--------------+
| Neon         | | Upstash      | | Amazon S3    | | SMTP relay   | | AI service   |
| PostgreSQL   | | Redis        | | + CloudFront | |              | | Python,      |
| + pgvector   | |              | |              | |              | | Flask        |
|              | |              | |              | |              | |              |
| relational   | | sessions,    | | media store; | | outbound     | | prompts,     |
| data and     | | counters,    | | the browser  | | email        | | model calls, |
| 768-dim      | | caches,      | | loads images | |              | | embeddings   |
| vectors      | | job queue    | | from the CDN | |              | | (all-mpnet)  |
+--------------+ +--------------+ +--------------+ +--------------+ +-------+------+
                                                                            |
                                                       HTTPS, Messages API  |
                                                                            v
                                                                    +--------------+
                                                                    | Anthropic    |
                                                                    | Claude Haiku |
                                                                    | 4.5          |
                                                                    +--------------+

 Local: Docker Compose runs the backend, the AI service, PostgreSQL and Redis,
 with Ollama (qwen2.5) on the GPU in place of Anthropic.
 Delivery: GitHub Actions runs the backend tests and a frontend type-check on
 every push; Railway and Vercel deploy from main.`;

const smartSearchDiagram = ` "a proper strong diver under 20k"
        |
        v
 +------------------------------+
 | deterministic parser         |
 |  water resistance >= 300 m   |--> ticks the
 |  price <= $20,000            |    filter bar
 +--------------+---------------+
                |
   +------------+-------------+-------------------+
   |                          |                   |
   v                          v                   v
 constraints read       words left over     no watch words
 -> SQL over the        -> BM25F inside     -> no results
    catalogue              the filters
   |                          |
   +------------+-------------+
                |
                v
 ranked results, no model call`;

const conciergeDiagram = ` "what should I wear to my own wedding"
        |
        v
 +--------------------------------+
 | intent classifier (LLM), with  |--> brand info, compare,
 | the LLM reading of the brief   |    follow-ups
 | started beside it              |
 +---------------+----------------+
                 |
                 | advice or discovery
                 v
 deterministic parser -> SQL ......... 30% end here
                 |
 LLM reading of the brief -> SQL ..... 32% end here
                 |
                 | still unresolved
                 v
     BM25F ---+
              +---> RRF .............. 36% end here
    vector ---+
                 |
                 v
 +--------------------------------+
 | backend builds watch cards and |
 | compare / page / search        |
 | actions                        |
 +---------------+----------------+
                 |
                 v
 LLM writes the reply; it never
 triggers an action itself`;

// Two halves of the benchmark, named by what the queries ask for.
const querySet = [
  {
    heading: "50 facet queries",
    owner: "Answered by Smart Search",
    text: "Exact reference numbers, brand nicknames and misspellings (“AP”, “patek philipe”), collections, budgets said in words (“nothing over twenty grand”), sizes, case materials, dial colours, complications in plain language (“something that can time a lap”), water resistance and power reserve stated as uses, negations (“anything but Rolex”), and briefs that combine several of these.",
  },
  {
    heading: "50 open-ended briefs",
    owner: "Answered by the concierge",
    text: "Occasions (a wedding, a job interview, a black-tie gala), gifts (a graduation, an anniversary), taste (understated, colourful, jewellery-like), lifestyle (hiking, sailing, the gym), collecting (an heirloom, independent watchmaking), fit (a 15 cm wrist, under a shirt cuff), and a budget with a mood attached.",
  },
];

const method = [
  "Each label states what a right answer is — “a dress watch, 40 mm or smaller, in a precious metal” — rather than listing watches, and was written from the query before any result was seen.",
  "Every system is compared with BM25, the standard keyword ranking, on the same queries.",
  "Differences are tested with a paired bootstrap. Only a 95% interval that stays clear of zero counts as a result.",
  "Recall is read against its ceiling: when 76 watches fit a brief, a list of ten can hold at most 13% of them, however good the ranking.",
];

type Mark = "win" | "noise";
// `mark` sits on the table's markColumn; `marks` sets one per column when several systems are
// each tested against the baseline.
type ResultRow = { label: string; values: string[]; emphasis?: number[]; mark?: Mark; marks?: (Mark | undefined)[] };

const smartSearchRows: ResultRow[] = [
  { label: "nDCG@10", values: ["0.73", "0.57", "0.44"], emphasis: [0], mark: "win" },
  { label: "Precision@5", values: ["0.69", "0.54", "0.39"], emphasis: [0], mark: "win" },
  { label: "Recall@10, share of ceiling", values: ["76%", "61%", "51%"], emphasis: [0], mark: "win" },
  { label: "MRR", values: ["0.79", "0.70", "0.55"], emphasis: [0], mark: "noise" },
  { label: "Hit rate@10", values: ["84%", "84%", "78%"], emphasis: [0], mark: "noise" },
  { label: "Latency, p95", values: ["29 ms", "7 ms", "159 ms"], emphasis: [0] },
];

// The same pipeline on two models, each tested against BM25 on the same briefs, measured 21 Sep
// 2026. The local model's latency is left out: the laptop GPU throttled during its run, so the
// figure would describe the cooling, not the model.
const conciergeRows: ResultRow[] = [
  { label: "MRR", values: ["0.46", "0.30", "0.32"], emphasis: [0], marks: ["noise", "noise"] },
  { label: "Precision@5", values: ["0.28", "0.16", "0.21"], emphasis: [0], marks: ["noise", "noise"] },
  { label: "nDCG@10", values: ["0.24", "0.14", "0.17"], emphasis: [0], marks: ["noise", "noise"] },
  { label: "Recall@10, share of ceiling", values: ["21%", "14%", "12%"], emphasis: [0], marks: ["noise", "noise"] },
  { label: "Hit rate@10", values: ["72%", "48%", "66%"], emphasis: [0], marks: ["noise", "noise"] },
  { label: "Latency, p50", values: ["4.5 s", "—", "6 ms"], emphasis: [0] },
  { label: "Latency, p95", values: ["10.8 s", "—", "8 ms"], emphasis: [0] },
  { label: "Replies with a relevant action", values: ["48%", "38%", "—"], emphasis: [0] },
];

// The strongest value in each column is emphasised; this table explains a choice, not a winner.
const retrieverRows: ResultRow[] = [
  { label: "BM25F", values: ["0.57", "0.62", "0.15"], emphasis: [0, 1] },
  { label: "Vector search (cosine)", values: ["0.27", "0.41", "0.21"] },
  { label: "BM25F + vector, fused by RRF", values: ["0.52", "0.62", "0.24"], emphasis: [1, 2] },
];

const findings = [
  {
    term: "Smart Search dropped every model call.",
    text: "With the LLM stages removed, no quality metric moved significantly and p95 latency fell from 2.8 s to 29 ms. It also keeps working when the AI service is down.",
  },
  {
    term: "Vector search lives only in the concierge.",
    text: "Shown directly, it ranked facet queries worse than BM25F. Fused with BM25F it finds more right answers than either retriever alone, which is why the concierge answers from the fused list.",
  },
  {
    term: "The LLM reranker was removed.",
    text: "Switching it off saved 1.9 s per reply and moved no metric significantly. It also took the concierge's one clear win over BM25 with it: MRR was 0.50 against 0.32 with the reranker and is 0.46 without, a gap 50 briefs cannot separate from noise.",
  },
  {
    term: "A local 7B model is not a drop-in for Haiku.",
    text: "Qwen 2.5 7B matches it on facet queries, where SQL does the work. On open-ended briefs precision@5 fell from 0.28 to 0.16, MRR from 0.46 to 0.30 and hit rate from 72% to 48%, and half its first drafts failed the backend's grounding check. It exercises the pipeline for free; it does not score it.",
  },
  {
    term: "Timing each stage cut the wait from 6.4 s to 3.9 s.",
    text: "Every reply now reports its stages in a Server-Timing header. It showed briefs with no watch vocabulary being classified twice, so the second call now reuses the first answer; with the reranker gone and the brief read beside the classifier, the median reply fell from 6.4 s to 3.9 s, with no significant change in quality. Letting a reply finish rather than cutting it mid-sentence put the median back to 4.5 s: the wording takes 3.1 s and the action planner 2.1 s, side by side.",
  },
  {
    term: "The model writes to whatever ceiling it is given.",
    text: "Haiku ignored every instruction about length and stopped at the token ceiling in 38 of 58 replies, spending about 40 tokens of each on a markdown URL the reader never sees. The reply now names a watch in plain words and the backend attaches the link from the slug it already resolved, so the budget buys sentences instead of addresses. The ceiling, not the wording, is the control.",
  },
  {
    term: "The benchmark caught bugs review had missed.",
    text: "A 500 on every site search, a dependency upgrade that made the classifier refuse one query in ten, and a significance check that reported clear regressions as noise.",
  },
];

// Section heading with a numbered "title block" — mono index, hairline rule, serif title.
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

// Framed plate shared by every figure: a caption bar over the drawing or table.
function Plate({ caption, note, children }: { caption: string; note: string; children: React.ReactNode }) {
  return (
    <figure className="border border-[var(--atl-rule)] bg-[var(--atl-paper-2)]/70">
      <figcaption className="flex items-center justify-between gap-4 border-b border-[var(--atl-rule)] px-5 py-3">
        <span className="atl-mono text-[11px] uppercase tracking-[0.24em] text-[var(--atl-ink)]">{caption}</span>
        <span className="atl-mono text-right text-[10px] uppercase tracking-[0.2em] text-[var(--atl-faint)]">{note}</span>
      </figcaption>
      {children}
    </figure>
  );
}

// One way to find a watch: what it is, how a query flows through it, and how well it did.
function Subsystem({
  name,
  summary,
  flow,
  results,
}: {
  name: string;
  summary: string;
  flow: React.ReactNode;
  results: React.ReactNode;
}) {
  return (
    <div className="mt-16 border-t border-[var(--atl-rule)] pt-10">
      <div className="mb-8 max-w-3xl">
        <h3 className="atl-display text-[1.75rem] font-medium leading-tight text-[var(--atl-ink)]">{name}</h3>
        <p className="mt-3 text-[1.02rem] leading-[1.8] text-[var(--atl-soft)]">{summary}</p>
      </div>
      <div className="grid grid-cols-1 items-start gap-8 lg:grid-cols-2">
        {flow}
        {results}
      </div>
    </div>
  );
}

// A filled mark for a result that clears the 95% interval, a hollow one for a difference within noise.
function SignificanceMark({ mark }: { mark?: Mark }) {
  return (
    <span className="inline-block w-5 text-left">
      {mark === "win" && (
        <>
          <span aria-hidden className="pl-1.5 text-[0.7em] text-[var(--atl-oxblood)]">●</span>
          <span className="sr-only">, better than BM25 with 95% confidence</span>
        </>
      )}
      {mark === "noise" && (
        <>
          <span aria-hidden className="pl-1.5 text-[0.7em] text-[var(--atl-faint)]">○</span>
          <span className="sr-only">, difference within noise</span>
        </>
      )}
    </span>
  );
}

function ResultTable({ columns, rows, markColumn }: { columns: string[]; rows: ResultRow[]; markColumn?: number }) {
  return (
    <div className="overflow-x-auto">
      {/* Two value columns fit a phone; wider tables keep a floor and scroll inside their plate. */}
      <table className={`w-full border-collapse text-left ${columns.length > 2 ? "min-w-[360px]" : ""}`}>
        <thead>
          <tr className="border-b border-[var(--atl-rule)]">
            <th scope="col" className="pb-3 font-normal">
              <span className="sr-only">Measure</span>
            </th>
            {columns.map((column) => (
              <th
                key={column}
                scope="col"
                className="pb-3 pl-4 text-right align-bottom text-[0.8rem] font-normal leading-snug text-[var(--atl-faint)]"
              >
                {column}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.label} className="border-b border-[var(--atl-rule-soft)] last:border-b-0">
              <th scope="row" className="py-3 pr-4 text-left text-[0.95rem] font-normal text-[var(--atl-soft)]">
                {row.label}
              </th>
              {row.values.map((value, i) => {
                const strong = row.emphasis?.includes(i);
                const mark = row.marks ? row.marks[i] : markColumn === i ? row.mark : undefined;
                return (
                  <td
                    key={`${row.label}-${i}`}
                    className={`atl-display atl-num whitespace-nowrap py-3 pl-4 text-right text-[1.1rem] ${
                      strong ? "font-medium text-[var(--atl-ink)]" : "text-[var(--atl-faint)]"
                    }`}
                  >
                    {value}
                    {mark && <SignificanceMark mark={mark} />}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function TourbillonPortfolioPage() {
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
            .atl-num { font-variant-numeric: lining-nums tabular-nums; }

            /* Engine-turned guilloche cross-hatch — faint ink + gold emboss on paper */
            .atl-guilloche {
              background-image:
                repeating-linear-gradient(45deg, rgba(31,26,21,0.030) 0 1px, transparent 1px 9px),
                repeating-linear-gradient(-45deg, rgba(154,123,63,0.026) 0 1px, transparent 1px 9px);
            }
            /* Concentric rosette — sunburst + rings, masked to a soft disc */
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
            .atl-root a:focus-visible { outline: 2px solid var(--atl-oxblood); outline-offset: 3px; }
            @media (prefers-reduced-motion: reduce) {
              .atl-rise { animation: none; opacity: 1; }
            }
          `,
        }}
      />

      {/* Fixed paper texture planes — consistent tone regardless of scroll length */}
      <div aria-hidden className="atl-guilloche pointer-events-none fixed inset-0 z-0" />
      <div aria-hidden className="atl-grain pointer-events-none fixed inset-0 z-0" />

      <div className="relative z-10 mx-auto w-full max-w-[1180px] px-6 sm:px-10 lg:px-16">
        {/* Masthead — establishes a standalone dossier, not the site nav */}
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
            Portfolio &middot; Case Study N&deg; 01 &mdash; Tourbillon
          </span>
        </header>

        {/* Checkpoint-gated back control — between the masthead and the case-study text */}
        <BackToPortfolio />

        {/* Hero */}
        <section className="pb-20 pt-8 md:pt-10">
          <p className="atl-rise atl-mono text-[12px] uppercase tracking-[0.36em] text-[var(--atl-oxblood)]" style={{ animationDelay: "80ms" }}>
            Case Study &middot; Luxury watch e-commerce
          </p>
          <h1
            className="atl-rise atl-display mt-6 text-[3.8rem] font-medium leading-[0.92] tracking-[-0.02em] text-[var(--atl-ink)] sm:text-[5.4rem] lg:text-[6.4rem]"
            style={{ animationDelay: "160ms" }}
          >
            Tourbillon<span className="text-[var(--atl-oxblood)]">.</span>
          </h1>
          <p className="atl-rise mt-7 max-w-2xl text-[1.1rem] leading-[1.7] text-[var(--atl-soft)]" style={{ animationDelay: "240ms" }}>
            A full-stack luxury watch platform with two ways to find a watch: a Smart Search
            that turns plain English into catalogue filters without calling a model, and an AI
            concierge that advises on occasions and taste. Both are measured against a
            100-query benchmark.
          </p>

          <div className="atl-rise mt-8 flex flex-wrap items-center gap-3" style={{ animationDelay: "320ms" }}>
            <Link
              href="/tourbillon"
              className="atl-tag group inline-flex items-center gap-2 px-4 py-2.5 text-[12px] uppercase tracking-[0.18em] text-[var(--atl-ink)] transition-colors"
            >
              Visit live site <span aria-hidden>&rarr;</span>
            </Link>
            <a
              href="https://github.com/hoanganhismeee/Tourbillon"
              target="_blank"
              rel="noopener noreferrer"
              className="atl-tag group inline-flex items-center gap-2 px-4 py-2.5 text-[12px] uppercase tracking-[0.18em] text-[var(--atl-ink)] transition-colors"
            >
              <GitHubIcon /> GitHub
            </a>
          </div>

          <dl className="atl-rise mt-12 grid max-w-2xl grid-cols-1 gap-6 border-t border-[var(--atl-rule)] pt-7 sm:grid-cols-3" style={{ animationDelay: "400ms" }}>
            {[
              { k: "Stack", v: ".NET · Next.js · Python AI" },
              { k: "Catalogue", v: "13 maisons, 48 collections, 338 watches" },
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
          <SectionHead index="01 / 06" kicker="About" title="Why watches, and why this project?" />
          <div className="grid grid-cols-1 gap-10 lg:grid-cols-12">
            <p className="atl-display lg:col-span-5 text-[1.5rem] font-light leading-[1.4] text-[var(--atl-ink)]">
              <span className="atl-display float-left mr-3 mt-1 text-[4.4rem] font-medium leading-[0.7] text-[var(--atl-oxblood)]">
                W
              </span>
              atches have fascinated me for years &mdash; especially Vacheron Constantin: the
              history, the design, and the sheer mechanical detail in a truly fine piece.
            </p>
            <div className="lg:col-span-7 space-y-5 text-[1.02rem] leading-[1.8] text-[var(--atl-soft)]">
              <p>
                That fascination became Tourbillon. Rather than a simple product listing, I
                built a full platform: authentication, search, AI features, saved watches,
                contact flows, admin tools, background jobs, and image storage.
              </p>
              <p>
                The goal was never just to look good. I wanted something that behaves like a
                real product, and I wanted to be able to prove how well its search works
                rather than say so.
              </p>
            </div>
          </div>
        </ScrollFade>

        {/* Features */}
        <ScrollFade triggerOnce className="py-20">
          <SectionHead index="02 / 06" kicker="Capabilities" title="What Tourbillon can do." />
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
          <SectionHead index="03 / 06" kicker="Toolkit" title="The stack behind the build." />
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

        {/* Architecture — the whole system, then each way to find a watch with its results.
            Taller than five phone screens, so it reveals on first sight rather than at the default
            20% visibility, which such a section can never reach. */}
        <ScrollFade triggerOnce threshold={0} className="py-20">
          <SectionHead index="04 / 06" kicker="Architecture" title="How the system is organised." />
          <div className="mb-10 grid grid-cols-1 gap-8 text-[1.02rem] leading-[1.8] text-[var(--atl-soft)] lg:grid-cols-2">
            <p>
              Three services, each with one job. The Next.js frontend owns the experience. The
              .NET API owns data, accounts, and every decision about what a visitor sees,
              including which watches appear and which actions are offered. The Python AI
              service owns prompts and models, and only ever returns words or structured data.
            </p>
            <p>
              Hangfire runs slow work such as emails and embeddings on Redis, Serilog and health
              checks keep the running system observable, and GitHub Actions runs the backend
              tests and a frontend type-check on every push while Railway and Vercel deploy from
              main. Smart Search and the concierge, drawn below, are two features on this system:
              they share one catalogue but take different routes through it.
            </p>
          </div>
          <Plate caption="Fig. 01 — System design" note="Production">
            <div className="overflow-x-auto px-5 py-6">
              <pre className="atl-mono min-w-[640px] text-[12px] leading-relaxed text-[var(--atl-soft)]">
                {systemDiagram}
              </pre>
            </div>
          </Plate>

          <Subsystem
            name="Smart Search"
            summary="Typed into the search bar. It reads the constraints a shopper states, including everyday wording such as “a proper strong diver”, compiles them to SQL, and ranks whatever it could not read with BM25F. No step calls a model."
            flow={
              <Plate caption="Fig. 02 — Smart Search flow" note="No model call">
                <div className="overflow-x-auto px-5 py-6">
                  <pre className="atl-mono min-w-[440px] text-[12px] leading-relaxed text-[var(--atl-soft)]">
                    {smartSearchDiagram}
                  </pre>
                </div>
              </Plate>
            }
            results={
              <Plate caption="Fig. 03 — Smart Search results" note="50 facet queries">
                <div className="px-5 py-5">
                  <ResultTable columns={["Smart Search", "BM25", "Old search bar"]} rows={smartSearchRows} markColumn={0} />
                  <p className="mt-4 border-t border-[var(--atl-rule-soft)] pt-4 text-[0.9rem] leading-[1.6] text-[var(--atl-soft)]">
                    The parser reads the constraints a query states with a slot F1 of 0.81, and
                    almost never reads one wrongly: what it gets wrong, it misses.
                  </p>
                </div>
              </Plate>
            }
          />

          <Subsystem
            name="Concierge"
            summary="A chat assistant for briefs that name no filter: an occasion, a gift, a way of life. A model's reading of the brief is used only when the cheaper stages cannot answer, candidates come from keyword and semantic search fused together, and the backend decides every card and action shown."
            flow={
              <Plate caption="Fig. 04 — Concierge flow" note="Claude Haiku 4.5">
                <div className="overflow-x-auto px-5 py-6">
                  <pre className="atl-mono min-w-[440px] text-[12px] leading-relaxed text-[var(--atl-soft)]">
                    {conciergeDiagram}
                  </pre>
                </div>
                <p className="mx-5 mb-5 border-t border-[var(--atl-rule-soft)] pt-4 text-[0.9rem] leading-[1.6] text-[var(--atl-soft)]">
                  An LLM rerank of the fused list used to follow RRF. Switching it off moved no
                  metric significantly on the 50 open-ended briefs and saved 1.9 s per reply, so
                  it was removed to make replies faster.
                </p>
              </Plate>
            }
            results={
              <Plate caption="Fig. 05 — Concierge results" note="50 open-ended briefs">
                <div className="px-5 py-5">
                  <ResultTable columns={["Haiku 4.5", "Qwen 7B, local", "BM25"]} rows={conciergeRows} />
                  <p className="mt-4 border-t border-[var(--atl-rule-soft)] pt-4 text-[0.9rem] leading-[1.6] text-[var(--atl-soft)]">
                    Without the reranker neither model clears BM25 on open-ended briefs, and
                    the 7B model, run on a laptop, falls below it on four of five measures. On
                    the 50 facet queries either model is level with Smart Search, so the
                    concierge can take over search requests as well. The local model&rsquo;s
                    latency is not shown because the GPU throttled during its run. Measured
                    21 September 2026; the action row was 58% when every reply carried a Smart
                    Search chip, and 21 of those chips opened a page with no results.
                  </p>
                </div>
              </Plate>
            }
          />

          <p className="mt-6 flex flex-wrap gap-x-6 gap-y-1 text-[0.86rem] text-[var(--atl-faint)]">
            <span><span aria-hidden className="text-[var(--atl-oxblood)]">●</span> better than BM25 with 95% confidence</span>
            <span><span aria-hidden>○</span> difference within noise</span>
            <span>Each table compares systems on its own query set; how those were built is below.</span>
          </p>
        </ScrollFade>

        {/* Evaluation — how the numbers above were produced, and what they decided. Also tall on
            phones, so it uses the same first-sight reveal. */}
        <ScrollFade triggerOnce threshold={0} className="py-20">
          <SectionHead index="05 / 06" kicker="Evaluation" title="How the numbers were produced." />
          <div className="grid grid-cols-1 gap-10 lg:grid-cols-12">
            <div className="space-y-5 text-[1.02rem] leading-[1.8] text-[var(--atl-soft)] lg:col-span-5">
              <p>
                Search quality is easy to claim and hard to show, so every figure above comes
                from one benchmark: 100 labelled queries, split by the part of the product that
                answers them.
              </p>
              <ul className="space-y-4 border-t border-[var(--atl-rule)] pt-5">
                {method.map((line) => (
                  <li key={line} className="flex gap-3 text-[0.96rem] leading-[1.7]">
                    <span aria-hidden className="mt-[0.7em] h-px w-3 shrink-0 bg-[var(--atl-oxblood)]" />
                    <span>{line}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="lg:col-span-7">
              <Plate caption="Fig. 06 — The query set" note="100 labelled queries">
                <div className="grid grid-cols-1 divide-y divide-[var(--atl-rule-soft)] sm:grid-cols-2 sm:divide-x sm:divide-y-0">
                  {querySet.map((half) => (
                    <div key={half.heading} className="px-5 py-6">
                      <h3 className="atl-display text-[1.35rem] font-medium leading-snug text-[var(--atl-ink)]">
                        {half.heading}
                      </h3>
                      <p className="mt-1 text-[0.88rem] text-[var(--atl-oxblood)]">{half.owner}</p>
                      <p className="mt-4 text-[0.94rem] leading-[1.7] text-[var(--atl-soft)]">{half.text}</p>
                    </div>
                  ))}
                </div>
              </Plate>
            </div>
          </div>

          <div className="mt-10">
            <Plate caption="Fig. 07 — Choosing the retriever" note="Each retriever run on its own">
              <div className="px-5 py-5">
                <ResultTable
                  columns={[
                    "Results shown directly: nDCG@10, facet",
                    "Candidate pool: recall@50, facet",
                    "Recall@50, open-ended",
                  ]}
                  rows={retrieverRows}
                />
                <p className="mt-4 border-t border-[var(--atl-rule-soft)] pt-4 text-[0.9rem] leading-[1.6] text-[var(--atl-soft)]">
                  Smart Search shows its ranking directly, so it uses BM25F alone. The
                  concierge fuses both, because the fused pool holds the most right answers on
                  both kinds of query; with the reranker gone, it now shows that fused order
                  directly.
                </p>
              </div>
            </Plate>
          </div>

          <dl className="mt-14 grid grid-cols-1 gap-x-12 md:grid-cols-2">
            {findings.map((finding) => (
              <div key={finding.term} className="border-t border-[var(--atl-rule)] py-6">
                <dt className="atl-display text-[1.25rem] font-medium leading-snug text-[var(--atl-ink)]">
                  {finding.term}
                </dt>
                <dd className="mt-2 text-[0.96rem] leading-[1.65] text-[var(--atl-soft)]">{finding.text}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-6 max-w-3xl text-[0.9rem] leading-[1.7] text-[var(--atl-faint)]">
            The labels are my own judgement, and 50 queries per half detects large effects
            rather than small ones. The numbers compare designs against a baseline; they do
            not promise how shoppers would respond.
          </p>
        </ScrollFade>

        {/* Closing */}
        <ScrollFade triggerOnce className="py-20">
          <SectionHead index="06 / 06" kicker="Intent" title="What this project demonstrates." />
          <blockquote className="atl-italic max-w-3xl text-[2rem] font-light leading-[1.32] text-[var(--atl-ink)] md:text-[2.6rem]">
            &ldquo;I wanted to take a personal idea and turn it into a complete, working
            product &mdash; not another CRUD demo.&rdquo;
          </blockquote>
          <div className="mt-10 grid grid-cols-1 gap-10 lg:grid-cols-2">
            <p className="text-[1.02rem] leading-[1.8] text-[var(--atl-soft)]">
              Tourbillon shows I can work across frontend, backend, database, AI services,
              authentication, deployment and CI, and user experience &mdash; and carry a
              personal idea through to a finished product.
            </p>
            <p className="text-[1.02rem] leading-[1.8] text-[var(--atl-soft)]">
              It also shows how I make technical decisions: by measuring the alternatives on
              the same test and keeping what the numbers support, including removing the
              parts that did not earn their cost.
            </p>
          </div>
        </ScrollFade>

        {/* Colophon footer (page-local) */}
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
              <p className="atl-mono mt-2 text-[10px] uppercase tracking-[0.24em] text-[var(--atl-faint)]">
                &copy; 2026 Hoang Anh Chu &mdash; portfolio &amp; demonstration use only
              </p>
            </div>
          </div>
        </footer>
      </div>
    </main>
  );
}
