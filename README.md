# Tourbillon - Luxury Watch E-Commerce

Live: https://hoanganhchu.vercel.app/tourbillon

Tourbillon is a full-stack e-commerce platform for luxury watches: 13 maisons, 48 collections and
338 watches, served by a Next.js frontend, an ASP.NET Core API on PostgreSQL, and a small Python
service that owns every prompt and model call. Two things find watches for a visitor, and they
are built differently on purpose:

- **Smart Search** reads the constraints a query states ("a proper strong diver under 20k",
  "Rolex 40-42mm, not a chronograph"), compiles them to SQL, and ranks whatever is left with
  BM25F. It never calls a model, answers in under 30 ms, and keeps working when the AI service
  is down.
- **The concierge** is a chat assistant for briefs that name no filter: an occasion, a gift, a
  way of life. A model reads the brief only when the cheaper stages cannot, candidates come
  from BM25F and vector search fused by reciprocal rank fusion, and the backend decides every
  card and action shown. The model writes the wording and nothing else.

Both are measured on the same labelled benchmark (below), and every number on the portfolio
page comes from it.

## Features

- **Brand and collection pages** with heritage descriptions and editorial content generated
  once per collection and shared by its watches.
- **Watch pages** with spec tables (dial, case, movement, strap), a wrist-fit score computed
  from case dimensions, and side-by-side comparison with AI-written wearability notes.
- **Smart Search** with a filter bar the parser fills in: type "strong diver" and the
  water-resistance boxes tick themselves.
- **Chat concierge** on every page: watch cards, compare and navigate actions, follow-up memory,
  and a hand-off to Smart Search when a brief turns out to be a filter.
- **Favourites and personal collections.**
- **Watch DNA**: a taste profile built from browsing behaviour, used as an explicit sort mode on
  the watches grid rather than silent re-ordering.
- **Accounts** with passwordless email codes, appointments, and register-interest for watches
  that are price on request.

## How well it works

100 labelled queries, written before any result was seen and split by the part of the product
that answers them: 50 facet queries (brand aliases, water resistance, movement, size, dial,
complication, budget, exclusions, compounds) and 50 open-ended briefs (occasion, persona,
aesthetic, lifestyle, collector, fit). Labels are predicates over the catalogue, so a query has
every watch that satisfies it as its answer set. Each table compares systems on its own query
set with a paired bootstrap; a bold value is better than the BM25 baseline with 95% confidence,
the rest are within noise.

**Smart Search, 50 facet queries** (measured on the deterministic parser + BM25F, no model)

| Metric | Smart Search | BM25 alone | Old search bar |
|---|---|---|---|
| nDCG@10 | **0.73** | 0.57 | 0.44 |
| Precision@5 | **0.69** | 0.54 | 0.39 |
| Recall@10, share of ceiling | **76%** | 61% | 51% |
| MRR | 0.79 | 0.70 | 0.55 |
| Hit rate@10 | 84% | 84% | 78% |
| Latency, p95 | 29 ms | 7 ms | 159 ms |

The parser reads the constraints a query states with a slot F1 of 0.81; what it gets wrong, it
misses rather than misreads. Removing the LLM stages from this path moved no quality metric
significantly and took p95 from 2.8 s to 29 ms.

**Concierge, 50 open-ended briefs** (Claude Haiku 4.5)

| Metric | Concierge | BM25 alone |
|---|---|---|
| MRR | **0.50** | 0.32 |
| Precision@5 | 0.27 | 0.21 |
| nDCG@10 | 0.23 | 0.17 |
| Recall@10, share of ceiling | 18% | 12% |
| Hit rate@10 | 74% | 66% |
| Replies with a relevant action | 60% | - |
| Latency, p95 | 12.8 s | 5 ms |

On the 50 facet queries the concierge is level with Smart Search on every metric, so it can take
over search requests as well. The latency row was measured before a bug that re-ran nearly half
of all chat calls was fixed; it will be re-measured.

**Choosing the retriever** (each retriever run on its own)

| Retriever | nDCG@10, facet | Recall@50, facet | Recall@50, open-ended |
|---|---|---|---|
| BM25F | **0.57** | **0.62** | 0.15 |
| Vector search (cosine, all-mpnet-base-v2) | 0.27 | 0.41 | 0.21 |
| BM25F + vector, fused by RRF | 0.52 | **0.62** | **0.24** |

The same retriever does two jobs. Smart Search shows its ranking directly, so it uses BM25F
alone. The concierge hands a pool of 50 to a reranker, so it fuses both: the fused pool holds
the most right answers on both kinds of query. Switching the LLM reranker off saved 1.9 s per
reply with no significant change in quality.

The harness, query set, metric definitions and how to read the tables are in
[eval/README.md](eval/README.md) (English) and [eval/FRAMEWORK.md](eval/FRAMEWORK.md)
(Vietnamese). Labels are one person's judgement, and 50 queries per half detects large effects
rather than small ones.

## Tech stack

| Layer | Technology |
| :--- | :--- |
| Frontend | Next.js 15 (App Router), Tailwind CSS, TanStack Query, Zustand |
| Backend | ASP.NET Core Web API (.NET 8), Entity Framework Core, Hangfire on Redis |
| Database | PostgreSQL with pgvector (Neon) |
| AI service | Python Flask; Claude Haiku 4.5 in production, Qwen 2.5 7B via Ollama locally; all-mpnet-base-v2 embeddings in-process |
| Search | Deterministic parser, in-memory BM25F index, pgvector cosine, reciprocal rank fusion |
| Images | Cloudinary or S3 behind a storage abstraction, delivered through CloudFront |
| Auth | ASP.NET Identity, HttpOnly cookies, role-based access |
| Infrastructure | Docker, Railway, Neon, Upstash, S3 + CloudFront, Vercel, GitHub Actions |

## Running it

```bash
make up                      # docker stack: backend, ai-service (Ollama + embeddings), PostgreSQL, Redis
cd frontend && npm run dev   # frontend runs outside docker
node eval/run-eval.mjs --scope=spec --arms=bm25,smart   # the benchmark, no model calls
```

`CLAUDE.md` has the full command reference, `docs/architecture.md` the design, and
`docs/ROADMAP.md` what comes next.
