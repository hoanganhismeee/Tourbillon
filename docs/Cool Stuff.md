# Tourbillon — The Interesting Parts

*A portfolio project built to production standards. This is the stuff worth knowing.*

---

## Quick Revision — Key Concepts

Things to have clear in your head before talking about this project.

**What's an embedding?**
It's just a list of 768 numbers that represents the *meaning* of some text. You feed text into `nomic-embed-text`, it spits out numbers. Same text always gives the same numbers — the model doesn't learn or change from your usage.

```
"sport luxury watch, steel, 41mm"  →  [0.12, -0.33, 0.87, ...]   768 numbers
"sport watch steel bracelet"       →  [0.11, -0.31, 0.85, ...]   close to above
"formal dress watch gold"          →  [-0.22, 0.90, -0.14, ...]  far from both
```

Similar text → similar numbers. That's the whole idea.

**Cosine similarity / distance**
A measure of how close two vectors are in that 768-number space. It's how the system ranks results.

| Cosine similarity | What it means |
|---|---|
| 1.0 | Identical meaning |
| 0.8 | Very similar |
| 0.5 | Somewhat related |
| 0.0 | Completely unrelated |

Quick note: `WatchEmbeddings` uses cosine *distance* (lower = better match). `QueryCaches` uses cosine *similarity* (higher = better). They're the same thing, just flipped: `similarity = 1 − distance`.

**Semantic search vs keyword search**
Keyword search is dumb — "sport watch" only finds rows that literally contain those words. Semantic search finds meaning — it surfaces the Submariner, the Overseas, the Royal Oak even though none of them contain the phrase "sport watch", because the model learned those concepts belong in the same neighbourhood.

**What actually makes search good or bad**
The text you write when building each watch's chunks. That's the only lever. More user queries just grow the cache — they don't improve the embeddings. The model never learns from usage. If two watches have basically the same chunk text, their vectors are nearly identical and search can't tell them apart.

**WatchEmbeddings vs QueryCaches — they're not the same thing**

| | WatchEmbeddings | QueryCaches |
|---|---|---|
| What it stores | Pre-computed vectors for every watch | Full result JSON for past queries |
| Purpose | Find semantically relevant watches | Skip the full pipeline for repeated queries |
| Changes when | Admin re-embeds, or a new watch is scraped | A new query misses the cache |
| Affected by user queries | Never | Yes — cache grows with traffic |

QueryCaches is purely a speed thing. Delete it and you get identical results, just slower. It also goes stale when the catalogue changes, so clear it after any bulk update.

**HNSW index**
Without it, finding the nearest vector means comparing against every single entry — O(n). HNSW pre-builds a graph where each vector connects to its closest neighbours. Search jumps through layers from coarse to fine. Result: O(log n). Both `WatchEmbeddings` and `QueryCaches` use it.

**Tokens — two different things, easy to mix up**
Output tokens (`max_tokens=200`) control how long the model's reply can be. Input context tokens control how much data you can shove into the prompt. Bumping either one does nothing if the problem is happening *before* the AI gets called — which is usually where routing failures live.

**Why the AI doesn't need to be trained on watch data**
It already knows "PP" = Patek Philippe, "AP" = Audemars Piguet, what a tourbillon is, what an integrated bracelet looks like. What it *doesn't* know is which specific watches are in *this* catalogue, their slugs, their prices. So the backend fetches that from the database and injects it straight into the prompt at request time.

```
AI general knowledge:  "PP" = Patek Philippe, Nautilus = iconic sport watch
+
Injected context:      Watch "5711/1A-011", Price: $35,000, Slug: nautilus-5711-steel
=
Accurate, grounded, linked answer — no code patch needed for "PP"
```

**Code-first routing vs backend-orchestrated routing**
Code-first means you write a regex that looks for keywords before the AI gets involved. Every phrase pattern the regex misses needs a code patch. It never stops growing. Backend-orchestrated routing means the backend classifies intent, fetches the data, builds the actions — and only then hands things to the AI for wording. The AI never decides what happens. That's the current architecture.

**Quick reference table**

| Concept | Short version |
|---|---|
| Embedding | 768 numbers = meaning of text |
| Cosine similarity | How close two vectors are (1.0 = identical, 0.0 = nothing in common) |
| Semantic search | Find by meaning, not exact words |
| WatchEmbeddings | Pre-computed vectors per watch — the semantic index |
| QueryCaches | Cached results for past queries — the speed layer |
| Hybrid search | SQL hard filters first, then semantic ranking |
| Chunk | One of 4 text descriptions per watch, each targeting a different query style |
| HNSW | Fast vector index, O(log n) |
| Category taxonomy | dress/sport/diver/chrono — assigned by code, not AI |
| nomic-embed-text | Fixed embedding model — same input always gives same output |
| RAG | Retrieve from DB → augment prompt → generate grounded reply |
| Backend orchestration | Backend owns routing and data; AI owns wording only |

---

## SOLID + Clean Architecture

Applied across both layers, not just said on the readme.

**Backend (ASP.NET Core)**
- 15 controllers, each does one thing
- 39 service files behind interfaces (`IWatchFinderService`, `IRedisService`, `IStorageService`, `IIntentClassifier`, `IActionPlanner`) — everything injected, nothing newed up directly
- `IStorageService` wraps both Cloudinary and S3+CloudFront behind one interface — swap providers with one env var, zero code change
- `IIntentClassifier` means tests can inject `FakeClassifier` while production uses the real ai-service

**Frontend (Next.js 15)**
- All backend calls go through `lib/api.ts` (100+ exported functions) — no scattered inline fetches anywhere
- `ChatContext`, `AuthContext`, `WatchesPageContext`, `CursorContext` each own exactly one domain of state
- Zustand stores use `skipHydration: true` for SSR safety; TanStack Query handles server state with localStorage persistence

---

## RAG — How the AI Actually Knows Anything

The LLM doesn't touch the database. The backend fetches everything and hands it over. This is the same pattern Perplexity, Notion AI, and Shopify's product search use.

```
User query
  → .NET backend figures out intent
  → PostgreSQL + pgvector fetches relevant watches
  → Backend formats results into prompt context
  → LLM writes a natural-language response based on what it was given
  → LLM literally cannot mention watches it wasn't given
```

If you just asked the LLM everything directly without this, it would hallucinate watch names, make up prices, be slow, and cost a lot. RAG keeps the AI as a writing layer — SQL and vectors stay as the source of truth.

---

## Hybrid SQL + Vector Search

Smart Search doesn't pick one or the other — it runs both, in order.

**Step 1 — SQL hard filters**
Anything structured in the query becomes a SQL constraint, applied before any vector work:
- "Patek Philippe" → `WHERE BrandId = 1`
- "under $20,000" → `WHERE CurrentPrice < 20000`
- "40mm" → `WHERE CaseSize = 40`
- "titanium" → `WHERE CaseMaterial LIKE '%titanium%'`

**Step 2 — Semantic ranking via pgvector**
Whatever meaning is left — "understated sport-luxury", "something for a board meeting" — doesn't map to a SQL column. The query gets embedded into a vector, and pgvector finds the watches closest in meaning space.

**Why you need both:** A semantic model might rank a $50k watch highly if it's a great style fit. But "under $20,000" isn't a preference — it's a hard limit. SQL enforces it; vectors can't.

Cache gets skipped the moment any hard filter is active (brand, collection, price, excluded brand), to avoid serving stale results.

---

## Watch Embeddings — 4 Chunks Per Watch

Each watch doesn't get a single vector. It gets **4 separate ones**, each capturing a different angle:

| Chunk | What it covers |
|---|---|
| `full` | Brand + name + collection + spec summary + price |
| `brand_style` | Dial colour, case material, strap, finish, indices, caseback |
| `specs` | Diameter, thickness, water resistance, movement type, power reserve |
| `use_case` | Category (dress/sport/diver/chrono) + occasions + price |

So "thin dress watch" hits `use_case`, "blue dial steel bracelet" hits `brand_style`, "self-winding 40mm" hits `specs`. One blended vector trying to represent everything would be worse at all of them.

**Demand-driven generation:** Watches aren't embedded upfront in a big batch. `GenerateBulkAsync()` runs in the background after each search result, filling in any watches that don't have vectors yet. The admin panel also has `GenerateMissingAsync()` and `RegenerateAllAsync()` for when you need to force it.

**Editorial chunk:** After `make seed-editorial` generates collection prose via `gemma2:9b`, a fifth `editorial` chunk is created — the narrative voice of the collection gets its own vector.

---

## Chat Concierge — Two-Phase Orchestration

The backend decides everything. The AI just writes the reply.

```
Message
  → rate limit check (Redis INCR, per IP per day)
  → abuse check (deterministic, runs before anything semantic)
  → cursor command handler (structural fast path)
  → entity resolution (brands, collections — fuzzy Levenshtein matching)
  → POST /classify (ai-service) → intent + confidence
      < 0.6 confidence → regex fallback, zero regression
  → dispatch by intent:
      discovery → POST /route → "simple_brand" | "descriptor_query"
          simple_brand → SQL catalogue sample (no LLM, no vector)
          descriptor_query → hybrid SQL + vector + optional rerank
      brand_info / collection_info → SQL cards + AI prose
      watch_compare → fetch both watches, build compare action
  → backend builds watchCards + primary actions
  → in parallel:
      POST /chat (ai-service) → wording only
      POST /plan-actions (ai-service) → suggested follow-up chips
  → backend validates chips; deterministic fallback if planner fails
```

13 intent classes: `watch_compare`, `collection_compare`, `brand_decision`, `affirmative_followup`, `expansion_request`, `revision_request`, `contextual_followup`, `brand_info`, `collection_info`, `brand_history`, `discovery`, `non_watch`, `unclear`.

The AI system prompt explicitly **forbids action emission** — it can't trigger searches, comparisons, or navigation. Only the backend does that. This stops the AI from hallucinating feature triggers.

---

## Watch DNA — Taste Profiling

Anonymous browsing is tracked from the first page view, held in localStorage (up to 100 events), then flushed and merged when the user logs in.

**The merge is intentionally careful:**
- Fresh accounts start blank — anonymous history doesn't attach automatically
- Only existing-account sign-ins can pull in that session's history
- Prevents one person's browsing contaminating another's profile

**How the taste profile gets generated:** Once there are at least 3 behaviour events, `GenerateFromBehaviorAsync()` sends a summary to the ai-service. The model figures out preferred brands, materials, dial colours, price range, and occasions. That gets saved to `UserTasteProfile` and shows up on the Trend page.

**Personalisation is an explicit sort mode, not forced re-ordering.** The watches listing applies capped boosts via `WatchOrderingService` — enough to surface relevant things, not enough to turn the feed into a single-brand wall.

---

## Password Security

- `RequestSanitizationMiddleware` strips password fields from all structured logs — they never appear anywhere, even as hashes
- `PasswordChangeRateLimitService` — 5 attempts per 15-minute window, auto-resets
- Users have to prove they know their current password before changing it
- ASP.NET Identity enforces complexity at the framework level
- Error messages are deliberately vague — the API never confirms whether an email exists (prevents enumeration)

---

## Background Jobs — Hangfire

All async work goes through Hangfire. No `Task.Run` fire-and-forget anywhere in the codebase.

What runs through it:
- Watch embedding generation (triggered after admin edits)
- Editorial content seeding
- Inquiry status auto-advancement (advisor CRM)
- Email dispatch

The dashboard at `/hangfire` shows job history, retry counts, and failure reasons. Jobs survive server restarts because state lives in PostgreSQL.

---

## Redis — Three Things It Does

`IRedisService` wraps all three patterns behind one interface:

| Use | Pattern | Example |
|---|---|---|
| Chat sessions | Hash + TTL | Session history per `sessionId`, 1-hour TTL |
| Rate limiting | INCR + TTL | `ai_quota:chat:{ip}` increments per request |
| Auth codes | KV + TTL | Magic login OTP, 10-minute expiry, single use |

INCR for rate limiting is atomic — no race conditions when requests come in at the same time. Upstash Redis in production uses TLS (`rediss://`) and doesn't need persistent connection management.

---

## Production Infrastructure

| Layer | Service | Notes |
|---|---|---|
| Frontend | Vercel | Auto-deploy on push to `main` |
| Backend (.NET 8) | Railway | Dockerfile build, root dir `backend/` |
| AI service (Flask) | Railway | Separate service, root dir `ai-service/` |
| Database | Neon (PostgreSQL) | Managed, ap-southeast-2, pgvector extension |
| Cache / sessions | Upstash (Redis) | Managed, TLS, ap-southeast-2 |
| Assets | S3 + CloudFront | `d2lauyid2w6u9c.cloudfront.net` |
| CI | GitHub Actions | `dotnet test` + `npx tsc --noEmit` on every push |

Switching between local Ollama and production Claude is one env var change — `LLM_BASE_URL` and `LLM_MODEL`. No code changes.

**AI cost:** Claude Haiku at $0.25/1M input · $1.25/1M output. Editorial content is generated once and stored — zero AI cost at runtime for product pages. Total estimated cost: under $5/month.

---

## Storage Abstraction

`IStorageService` is one interface used everywhere. Two implementations sit behind it:

- `CloudinaryStorageService` — legacy, uses the Cloudinary SDK
- `S3StorageService` — production, uses AWS SDK + pre-signed upload URLs

The frontend never builds asset URLs itself — it passes a `publicId` to `lib/cloudinary.ts` (misnamed, but it handles both providers). `GetPublicUrl()` on the backend builds the right CDN URL regardless of which provider is active.

Pre-signed uploads mean the browser uploads directly to S3 — the file never passes through the .NET server, which avoids memory pressure on large images.
