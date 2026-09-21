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
  way of life. A model's reading of the brief is used only when the cheaper stages cannot answer,
  candidates come from BM25F and vector search fused by reciprocal rank fusion, and the backend
  decides every card and action shown. The model writes the wording and nothing else.

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

**Concierge, 50 open-ended briefs** (the same pipeline on two models)

| Metric | Claude Haiku 4.5 | Qwen 2.5 7B, local | BM25 alone |
|---|---|---|---|
| MRR | 0.46 | 0.30 | 0.32 |
| Precision@5 | 0.28 | 0.16 | 0.21 |
| nDCG@10 | 0.24 | 0.14 | 0.17 |
| Recall@10, share of ceiling | 21% | 14% | 12% |
| Hit rate@10 | 72% | 48% | 66% |
| Replies with a relevant action | 48% | 38% | - |
| Latency, p50 | 4.5 s | - | 6 ms |
| Latency, p95 | 10.8 s | - | 8 ms |

These are the concierge as it now ships, without the LLM rerank that used to reorder its fused
list. Each run, its date and the commit it measured are recorded in
[docs/eval-results.md](docs/eval-results.md); the Haiku column is from 2026-09-21. With the
rerank, Haiku beat BM25 on MRR, 0.50 against 0.32; without it the gap is 0.46 against 0.32, which
50 briefs cannot separate from noise, while the rerank itself cost 1.9 s per reply and moved no
metric significantly when switched off. On the 50 facet queries either model is level with Smart
Search on every metric (the rerank ran on 3 of those 50), so the concierge can take over search
requests as well.

The action row fell from 58% when a Smart Search chip was attached to every reply. It is now
offered only when Smart Search can read a filter from the message, because 21 of those 50 chips
opened a page with no results, which the metric does not see and a visitor does.

Swapping Haiku for Qwen 2.5 7B run locally (Ollama, RTX 3070 laptop) keeps the facet results but
not the open-ended ones: precision@5, MRR, nDCG@10, recall and hit rate all fall against
Haiku, most in the fit and persona briefs, and against BM25 it is lower on four of five metrics,
though no difference clears the interval. Half its first drafts failed the backend's grounding
check and were rewritten. Its latency is not reported because the laptop GPU throttled to a sixth
of its clock; on facet queries 17 of 50 requests timed out for the same reason, and that
comparison rests on the 33 that completed.

Timing each stage took the median reply from 6.4 s to 3.9 s with no significant change in
quality: the rerank is gone, a message is classified once instead of twice, and the brief is
parsed beside the classifier rather than after it. Letting a reply finish rather than cutting it
at 140 tokens then put the median back to 4.5 s, a trade worth making. The wording (3.1 s) and the
action planner (2.1 s) run in parallel and are what remains.

The model writes to whatever ceiling it is given: Haiku stopped at the token ceiling in 38 of 58
replies, and asking it for "two or three sentences" instead of "at most 60 words" changed nothing.
About 40 tokens of each reply went on a markdown URL the reader never sees, so the wording layer now
names a watch in plain words and the backend attaches the link from the slug it already resolved. A
re-measure on ten of the fifty briefs put the wording stage at 3.2 s against 3.1 s before, inside
the API's own variance, so the latency figures above stand as measured.

**Choosing the retriever** (each retriever run on its own)

| Retriever | nDCG@10, facet | Recall@50, facet | Recall@50, open-ended |
|---|---|---|---|
| BM25F | **0.57** | **0.62** | 0.15 |
| Vector search (cosine, all-mpnet-base-v2) | 0.27 | 0.41 | 0.21 |
| BM25F + vector, fused by RRF | 0.52 | **0.62** | **0.24** |

Smart Search shows its ranking directly, so it uses BM25F alone. The concierge fuses both,
because the fused pool holds the most right answers on both kinds of query; with the reranker
gone, it shows that fused order directly.

The harness, query set, metric definitions and how to read the tables are in
[eval/README.md](eval/README.md) (English) and [eval/FRAMEWORK.md](eval/FRAMEWORK.md)
(Vietnamese). Labels are one person's judgement, and 50 queries per half detects large effects
rather than small ones.

## System design

```
+----------------------------------------------------------------------------------+
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
 every push; Railway and Vercel deploy from main.
```

`docs/architecture.md` describes each tier, every connection and one request end to end.

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
