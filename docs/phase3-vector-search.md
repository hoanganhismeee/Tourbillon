# Phase 3: Vector Search — Demand-Driven Embedding Strategy

**Phase 3A (infrastructure) — COMPLETE.** Watch embeddings generated and stored (100% coverage).
**Phase 3B (vector similarity retrieval) — COMPLETE.** SQL filter replaced with cosine similarity search.
**Query Cache — COMPLETE.** Persistent semantic query cache layers on top of Phase 3B.

Upgrade the watch finder candidate retrieval from SQL predicate filtering to vector similarity search, using a lazy embedding generation strategy that scales with usage.

---

## The Problem with SQL Filtering

The current Phase 2 pipeline filters candidates by matching parsed intent fields directly against database columns:

```
"elegant watch for a client dinner"
  → LLM extracts: style=dress, occasion=business, material=[gold]
  → SQL WHERE: style LIKE 'dress' AND occasion = 'business'
  → Misses watches that are clearly relevant but don't match the exact fields
```

SQL is blunt — it can only match what was explicitly extracted. Nuanced queries lose candidates that a human would consider obvious matches.

---

## The Solution: Vector Similarity Search

Pre-compute a semantic embedding for each watch (a float array representing its meaning in vector space). At query time, embed the query and find the closest watches by cosine similarity — no field matching needed.

```
"elegant watch for a client dinner"
  → Embed query → float[768]
  → Cosine similarity against all embedded watches
  → Returns watches semantically close to "elegant, business, formal, refined"
  → No explicit field parsing required
```

---

## Demand-Driven Query Cache (the key design decision)

Rather than pre-computing results for every possible query, the QueryCache grows organically with real usage. Every search that misses the cache runs the full pipeline and stores the result. Future queries with similar phrasing hit the cache and skip the LLM entirely.

```
Query 1: "dress watch for a wedding" → cache miss
  → embed query → vector search → LLM rerank → result
  → [Background] store result in QueryCaches

Query 2: "formal watch for a wedding ceremony"  (similarity 0.96 → HIT)
  → embed query → QueryCaches match → return stored result   (~55ms)

Query 3: "sporty dive watch under 10k" → cache miss
  → embed query → vector search → LLM rerank → result
  → [Background] store result in QueryCaches

Month 2: hundreds of diverse searches accumulated in QueryCaches
  → most real user queries hit the cache
  → sub-100ms responses, zero LLM cost on hits
```

The more diverse queries run (in dev or by real users), the higher the cache hit rate becomes. Common patterns — brand names, occasions, price bands, complications — get cached first, which are also the queries most likely to repeat.

**Watch chunk embeddings (WatchEmbeddings) work differently** — they are pre-computed from watch text and don't grow from queries. They are the semantic index that makes vector search work for *any* query, seen or unseen. QueryCaches is the speed layer on top.

---

## How Embedding Generation Works

Watch embeddings are generated in two ways:

**1. Admin bulk generation (preferred for seeding)**
```
POST /api/admin/embeddings/generate
  → loads all watches without a "full" chunk
  → sends 50 watches (200 texts) per HTTP call to /embed
  → upserts all vectors in one SaveChanges per batch
  → returns { generated, total, embedded, coveragePct }
```
Run this once before deploying. Current coverage: **100%** (351/351).

**2. Demand-driven (for new watches added via scraping)**

After every scrape, `WatchCacheService` fires a background `GenerateBulkAsync` for the newly inserted watch IDs. Already-embedded watches are skipped. New watches are embedded within seconds of being added.

---

## Production Deploy Workflow

Watch embeddings live in PostgreSQL alongside the watch data. Export and import them with the catalog:

```bash
# Dump watch data + embeddings together
pg_dump -t "Watches" -t "WatchEmbeddings" tourbillon > catalog_seeded.sql

# Import to production on first deploy
psql tourbillon < catalog_seeded.sql
```

Production starts with 100% vector coverage on day 1. No cold-start period.

QueryCaches self-populates from real traffic — no pre-seeding needed. The watch chunk embeddings in `WatchEmbeddings` are the semantic index; queries don't need to be pre-run to "teach" the system.

---

## Architecture (Phase 3B — current)

```
Query
  ↓
Embed query text → float[768]  (~50ms, nomic-embed-text)
  ↓
Check QueryCaches (cosine similarity ≥ 0.92)
  ├─ hit  → return stored result                              (~55ms total)
  └─ miss
       ↓
     Vector search: ORDER BY chunk embedding <=> query vector
     Best chunk per watch, top 30 returned                   (~50ms)
       ↓
     LLM rerank → top 8                                      (~2s Ollama / ~800ms Haiku)
       ↓
     [Background] store result in QueryCaches
     [Background] embed any new watch IDs (skips already-embedded)

Fallback (embed call fails):
  LLM parse → SQL filter → LLM rerank
```

---

## Stack

| Component | Tool | Why |
|---|---|---|
| Embedding model | `nomic-embed-text` via Ollama | Free, 768-dim, good semantic quality, same container |
| Vector storage | pgvector (PostgreSQL extension) | Already have Postgres, no new service |
| EF Core package | `Pgvector.EntityFrameworkCore` 0.3.0 | `Vector` type, column type `vector(768)` |
| Similarity metric | Cosine similarity | Standard for text embeddings |
| Migration | `20260320120000_AddWatchEmbeddings.cs` | Creates `WatchEmbeddings` table + unique index |

**Critical rule: same embedding model in dev and production.** Embeddings from different models are incompatible — different dimensions, different vector space. Using `nomic-embed-text` in both environments ensures the seeded vectors are valid in production.

## Phase 3A Implementation (DONE)

### WatchEmbeddings table

```sql
CREATE TABLE "WatchEmbeddings" (
  "Id"        serial PRIMARY KEY,
  "WatchId"   integer NOT NULL REFERENCES "Watches"("Id") ON DELETE CASCADE,
  "ChunkType" text NOT NULL,   -- 'full' | 'brand_style' | 'specs' | 'use_case'
  "ChunkText" text NOT NULL,
  "Embedding" vector(768),
  "UpdatedAt" timestamptz NOT NULL
);
CREATE UNIQUE INDEX ON "WatchEmbeddings" ("WatchId", "ChunkType");
```

### Four chunk types per watch

| ChunkType | Content |
|---|---|
| `full` | Brand + name + collection + price + specs summary — holistic fallback |
| `brand_style` | Brand, collection identity, case material, dial color, strap |
| `specs` | All technical specs (diameter, thickness, water resistance, power reserve, functions) |
| `use_case` | Occasion inference (diving, formal, dress, everyday) + price |

### Key files

| File | Purpose |
|---|---|
| `backend/Models/WatchEmbedding.cs` | EF Core entity |
| `backend/Services/WatchEmbeddingService.cs` | Chunk builder + true-batch HTTP → ai-service `/embed` + upsert |
| `ai-service/app.py` → `POST /embed` | Calls nomic-embed-text (batched input), returns float[768][] |
| `ai-service/entrypoint.sh` | Pulls `nomic-embed-text` on container start |
| `backend/Controllers/AdminController.cs` | `POST /api/admin/embeddings/generate`, `GET /api/admin/embeddings/status` |

### Demand-driven embedding flow

1. User fires a search → `WatchFinderService` returns results
2. After returning, fire-and-forget `Task.Run` with new `IServiceScopeFactory` scope
3. `WatchEmbeddingService.GenerateBulkAsync` skips already-embedded watches, embeds new ones
4. Same trigger in `WatchCacheService` for newly scraped watches

### Admin bulk generation — scales to 1000+ watches

```
POST /api/admin/embeddings/generate   → embeds all watches with no "full" chunk, returns { generated, total, embedded, coveragePct }
GET  /api/admin/embeddings/status     → returns { total, embedded, coveragePct }
```

**True batch embedding:** `GenerateMissingAsync` loads all missing watches, accumulates all chunk texts, and sends 50 watches (200 texts) per HTTP call to `/embed`. One Ollama call per 200 texts instead of per-watch calls. Scales linearly — 1000 watches ≈ 20 HTTP calls ≈ 20 seconds.

### Watch embedding text format

Rich text per watch produces better similarity matches:

```
"Patek Philippe Calatrava 5196G — dress watch, white gold, 38mm,
manual-winding, ultra-thin, formal, no date, no complications,
alligator strap, classic round case, Swiss luxury"
```

More context = better matches for nuanced queries like "something a banker would wear to a client dinner."

---

## Persistent Query Cache (COMPLETE)

A second vector layer that caches full search results indexed by query embedding. Sits in front of the LLM pipeline — no LLM call on a cache hit.

### Why two vector layers?

| Layer | What it stores | What it solves |
|---|---|---|
| `WatchEmbeddings` | One vector per watch chunk | Semantic retrieval — finds watches SQL filtering misses |
| `QueryCaches` | One vector per query + full result JSON | Cold-start — returns instant results for anticipated queries |

They serve different purposes and don't conflict. Watch embeddings power Phase 3B retrieval quality. Query cache powers Phase 3 response speed.

### Request flow with query cache

```
Query
  ↓
Embed query text → float[768]  (~50ms, nomic-embed-text, not LLM)
  ↓
Cosine similarity search → QueryCaches table
  ├─ hit (similarity ≥ 0.92) → return cached result              (~55ms total)
  └─ miss → full pipeline (parse → SQL/vector → rerank)          (~4s)
              ↓
            [Background] store result in QueryCaches
```

Similarity threshold 0.92 catches near-identical phrasings ("dress watch" vs "dress watches") while rejecting queries with genuinely different intent ("dress watch" vs "dive watch" ≈ 0.7).

### QueryCaches table

```sql
CREATE TABLE "QueryCaches" (
  "Id"             serial PRIMARY KEY,
  "QueryText"      text NOT NULL,
  "QueryEmbedding" vector(768) NOT NULL,
  "ResultJson"     text NOT NULL,        -- full WatchFinderResult as JSON
  "CreatedAt"      timestamptz NOT NULL
);
```

### Key files

| File | Purpose |
|---|---|
| `backend/Models/QueryCache.cs` | EF Core entity |
| `backend/Services/QueryCacheService.cs` | Lookup (cosine similarity) + store + clear |
| `backend/Services/WatchFinderService.cs` | Embed-first → cache check → pipeline if miss → background store |
| `backend/Controllers/AdminController.cs` | `POST /api/admin/query-cache/seed`, `GET /api/admin/query-cache/status`, `DELETE /api/admin/query-cache` |

### Pre-seeding (optional)

The cache self-populates from real traffic — every search that misses the cache stores its result automatically. No pre-seeding is required for correctness.

Pre-seeding is an optional cost/speed optimization: warm the cache before deploy so common queries skip the LLM rerank from day one.

```
POST /api/admin/query-cache/seed   → runs 115 built-in queries, caches results
```

With Phase 3B active, **watch chunk embeddings handle all queries semantically** regardless of whether QueryCaches has seen them before. QueryCaches only saves the LLM rerank step on repeated/similar queries.

### Clearing the cache

After a major catalog update (new brands, price changes), clear and re-seed:

```
DELETE /api/admin/query-cache   → clears all entries
POST   /api/admin/query-cache/seed → re-warms with 115 queries
```

### Scaling

At 1000+ watches, the `QueryCaches` table will have at most a few hundred rows — one per unique query fired. Linear scan is fast at this size. If query volume grows to tens of thousands, add an `ivfflat` index on `QueryEmbedding`:

```sql
CREATE INDEX ON "QueryCaches" USING ivfflat ("QueryEmbedding" vector_cosine_ops) WITH (lists = 10);
```

---

## Performance Targets

| Scenario | Phase 2 (current) | Phase 3 (vector) |
|---|---|---|
| Parse (LLM) | ~2s warm | ~2s (unchanged) |
| Candidate retrieval | ~10ms SQL | ~50ms vector |
| Rerank (LLM) | ~1.5s warm | ~1.5s (unchanged) |
| Total warm | ~4s | ~4s (marginal gain here) |
| Total — full coverage, cached query | ~5ms | ~5ms |
| Semantic accuracy | Medium (SQL field matching) | High (semantic similarity) |

The main gain from Phase 3 is **result quality**, not raw speed. Speed gain comes from the query result cache (unchanged) and from removing edge cases where SQL filtering misses relevant watches.

---

## Overlap with Watch DNA (Phase 3B)

The embeddings generated for search are the same vectors used for taste profile personalisation:

- Search: find watches close to the query vector
- Watch DNA: find watches close to the user's taste vector (average of vectors from watches they've interacted with)

Same infrastructure, two features. Build vector search first, taste profile comes for nearly free.

---

## Is This a Common Design Pattern?

The individual concepts are well-established:
- **Lazy/demand-driven generation** — known pattern in caching and ML systems
- **Offline pre-computation** — standard practice
- **Database seeding** — universal in dev/prod workflows
- **Hybrid SQL + vector search** — used in production search systems (Shopify, Elastic)

The **specific combination** — using your own dev queries to organically build the vector store, then exporting that state to seed production so real users never experience cold start — is a pragmatic engineering shortcut that borrows from all of the above. It is not a widely documented named pattern. Most tutorials show either full batch pre-generation or pure lazy generation, not the hybrid "absorb the build-up yourself in dev" approach.

It is a clever, practical decision arrived at independently.
