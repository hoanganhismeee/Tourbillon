# Phase 3: Vector Search — Demand-Driven Embedding Strategy

**Phase 3A (infrastructure) — COMPLETE.** Embeddings are being generated and stored.
**Phase 3B (switch retrieval to vector similarity) — PENDING.** Activate once coverage > 80%.

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

## Demand-Driven Embedding (the key design decision)

Rather than embedding all watches upfront in a batch job, embeddings are generated lazily — only when a watch first appears in a search result. The vector store grows organically with usage.

```
Query 1: "dress watch" → 30 SQL candidates found, none embedded yet
  → SQL filter used for retrieval (current behaviour)
  → Response returned to user
  → [Background] embed all 30 candidates → store in DB

Query 2: "formal watch for dinner" → similar candidates
  → 28 of 30 already embedded → vector search used
  → 2 new candidates → SQL fallback
  → Response faster, semantically better

Week 2: ~280/300 watches embedded
  → Almost every query hits vector search
  → Near-instant retrieval, <500ms
```

Coverage reaches ~100% naturally because the most-searched watches are embedded first — which are also the most likely to appear in future searches.

---

## Dev-to-Production Pre-Seeding

**The build-up phase happens during development, not in production.**

Run searches yourself during dev — every query you fire generates embeddings in the background. Once coverage looks good, export the database state (including the embedding column) and import it to the production DB on first deploy.

```
Dev workflow:
  make reset → run 50+ varied searches → all 300 watches embedded
  pg_dump -t watches tourbillon > watches_seeded.sql

Production deploy:
  psql tourbillon < watches_seeded.sql
  → Production starts day 1 with full vector coverage
  → Zero cold start, zero gradual build-up for real users
```

You absorb the entire embedding generation cost yourself. Users never experience the slow phase.

---

## Architecture

```
Query
  ↓
Check embedded watches count
  ↓
  >= threshold → vector similarity search → top 30 candidates  (~50ms)
  < threshold  → SQL filter (current Phase 2 fallback)          (~10ms)
  ↓
LLM rerank (unchanged from Phase 2)
  ↓
[Background async] embed any unembedded watches from this result set → store
```

### Hybrid retrieval (mixed coverage)

When coverage is partial, both paths run in parallel and results are merged:

```
Vector search  → scored by similarity
SQL fallback   → catches watches not yet embedded
Merge → deduplicate → send to LLM rerank
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
| `backend/Services/WatchEmbeddingService.cs` | Chunk builder + HTTP → ai-service `/embed` + upsert |
| `ai-service/app.py` → `POST /embed` | Calls nomic-embed-text, returns float[768][] |
| `ai-service/entrypoint.sh` | Pulls `nomic-embed-text` on container start |
| `backend/Controllers/AdminController.cs` | `POST /api/admin/embeddings/generate`, `GET /api/admin/embeddings/status` |

### Demand-driven embedding flow

1. User fires a search → `WatchFinderService` returns results
2. After returning, fire-and-forget `Task.Run` with new `IServiceScopeFactory` scope
3. `WatchEmbeddingService.GenerateBulkAsync` embeds all returned watch IDs
4. Same trigger in `WatchCacheService` for newly scraped watches

### Admin bulk generation

```
POST /api/admin/embeddings/generate   → embeds all watches with no "full" chunk, returns { generated, total, embedded, coveragePct }
GET  /api/admin/embeddings/status     → returns { total, embedded, coveragePct }
```

Run the admin endpoint to fast-fill coverage instead of waiting for organic search traffic.

### Watch embedding text format

Rich text per watch produces better similarity matches:

```
"Patek Philippe Calatrava 5196G — dress watch, white gold, 38mm,
manual-winding, ultra-thin, formal, no date, no complications,
alligator strap, classic round case, Swiss luxury"
```

More context = better matches for nuanced queries like "something a banker would wear to a client dinner."

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
