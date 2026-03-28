# AI Concepts — Tourbillon Reference

A plain-language reference for the AI concepts used in Tourbillon. Written so the developer can always return to this when the terminology gets dense.

---

## 1. Embedding — What It Actually Is

An embedding is a list of numbers (a vector) that represents the meaning of a piece of text. You get it by passing text through a neural network that has learned language.

```
"sport luxury watch, steel, 41mm"  ->  [0.12, -0.33, 0.87, ...]   (768 numbers)
```

The important property: **texts with similar meaning produce vectors that are close together in space.**

```
"sport watch steel bracelet"       ->  [0.11, -0.31, 0.85, ...]   (close to the one above)
"formal dress watch gold"          ->  [-0.22, 0.90, -0.14, ...]  (far from both)
```

The embedding model in Tourbillon is `nomic-embed-text`. It outputs 768 numbers per text. It runs inside the Ollama container in both dev and production.

**Key point:** The embedding model is fixed. It does not learn, adapt, or improve from being used. It is a function:

```
vector = EmbeddingModel(text)
```

Same text in, same vector out, every time. The model does not remember previous inputs.

---

## 2. Cosine Similarity and Distance

Two vectors are compared using cosine similarity — the angle between them in 768-dimensional space.

| Cosine similarity | Cosine distance | Meaning |
|---|---|---|
| 1.0 | 0.0 | Identical meaning |
| 0.8 | 0.2 | Very similar |
| 0.5 | 0.5 | Somewhat related |
| 0.0 | 1.0 | Unrelated |

Tourbillon uses **cosine distance** (lower = more similar) for WatchEmbeddings and **cosine similarity** (higher = more similar) for QueryCaches. They are the same metric inverted: `similarity = 1 - distance`.

---

## 3. Semantic Search vs Keyword Search

**Keyword search** matches exact text:
```
query: "sport watch"
-> only finds records containing the word "sport"
-> misses: diver watch, rubber strap watch, 150m water resistance watch
```

**Semantic search** matches meaning:
```
query: "sport watch"
-> embed query -> compare vectors -> sort by similarity
-> finds: Submariner (diver), Overseas (sport luxury), Royal Oak (sport-ish)
-> even though none of them contain the text "sport watch" literally
```

Semantic search works because the embedding model learned during training that "sport watch", "diver", "active lifestyle", "rubber strap" are related concepts.

---

## 4. Semantic Ordering

Not just finding, but **ranking by how close the meaning is**.

```
query: "sport watch"

1. Rolex Submariner    (distance 0.10 -- very close)
2. VC Overseas         (distance 0.15 -- close)
3. AP Royal Oak        (distance 0.18 -- close)
4. Patek Calatrava     (distance 0.45 -- far, dress watch)
```

This ordering is the semantic ranking. It is determined entirely by the cosine distance between the query vector and each watch's vector.

---

## 5. What Determines Semantic Quality

This is the most important concept. Semantic search quality depends on **how you describe your data**, not on how many queries you run.

### What controls quality

The text you pass to the embedding model when you embed each watch. In Tourbillon, this is the chunk text in `WatchEmbeddingService.BuildChunks()`.

If two watches have similar chunk text:
```
Watch A use_case: "sport luxury watch. Ideal for active lifestyle."
Watch B use_case: "sport luxury watch. Ideal for active lifestyle."
```
Their vectors will be nearly identical. Semantic search cannot distinguish them.

If chunk text includes watch-specific details:
```
Watch A use_case: "sport luxury, 41mm steel, 50m WR, integrated bracelet, Date."
Watch B use_case: "sport luxury, 40mm steel, 120m WR, Date, Sweep seconds."
```
Their vectors will be different. Semantic search can now rank one above the other.

### What does NOT control quality

- Number of queries run (more queries = more cache entries, not better embeddings)
- Query history or patterns
- Time passing
- Cache size

**One-line rule:** The system does not learn from queries. Meaning comes from how you describe your data.

---

## 6. The Two Layers in Tourbillon

### Layer 1: WatchEmbeddings (semantic index)

Pre-computed vectors for every watch. 4 chunks per watch, 351 watches = 1,404 rows.

**Purpose:** Find which watches are semantically relevant to a query.

**Created when:** Admin runs `POST /api/admin/embeddings/generate`, or automatically after a scrape inserts new watches.

**Changes when:** You change the chunk text templates in `BuildChunks()` and re-embed.

**Does NOT change when:** Users search. A million queries will not alter a single watch embedding.

### Layer 2: QueryCaches (speed layer)

Stores full search results keyed by query embedding. Threshold: cosine similarity >= 0.92.

**Purpose:** Skip the full pipeline for queries we have seen before (or very similar ones).

**Created when:** A search misses the cache. The result is stored in the background.

**Changes when:** New queries arrive (cache grows). Admin clears it after catalog changes.

**Important:** QueryCaches is a speed optimization. It does not affect semantic quality. If every cache entry were deleted, the system would produce the same results — just slower.

---

## 7. Why Cache Can Go Stale

QueryCaches stores the full result JSON at the time the query was first run. If the catalog changes after that:

- New watches added -> not in cached results
- Prices updated -> cached results show old prices
- Watches removed -> cached results reference missing watches

**Current solution:** After catalog changes (new scrape, price update, re-embedding), clear and re-seed:
```
DELETE /api/admin/query-cache
POST   /api/admin/query-cache/seed
```

Cache self-populates from real traffic after clearing.

---

## 8. Hybrid Search — SQL + Semantic Together

Pure semantic search has a weakness: it might return a steel Submariner for "gold dress watch" because the embedding model thinks they are somewhat related (both are luxury watches).

Tourbillon solves this with hybrid search:

```
"gold dress watch under 30k"
  |
  v
[SQL filter] price < 30k, maybe material = gold
  |
  v
[Semantic search] within the filtered pool only
  |
  v
Results: only gold watches under 30k, ranked by semantic relevance
```

The structured track (`ParseQueryIntentAsync`) extracts brand, collection, price, material as SQL WHERE clauses. The semantic track embeds the full query and ranks within the filtered pool.

**Why this is best practice:** SQL handles what it is good at (exact constraints). Embeddings handle what SQL cannot (style, occasion, vibes). Same pattern used by Shopify, Elasticsearch, and other production search systems.

---

## 9. Tiered Routing — When the LLM Is Called

Not every query needs the LLM. Tourbillon routes based on how confident the vector match is:

```
query -> embed -> vector search -> measure best match distance
  |
  |-- distance < 0.20  (Tier 2: strong match)
  |     -> return results by vector order, no LLM
  |
  |-- distance 0.20-0.55  (Tier 3: ambiguous)
  |     -> send top 15 to LLM for reranking
  |
  |-- distance > 0.55  (Tier 4: nothing relevant)
        -> return empty
```

The LLM is a tiebreaker for ambiguous cases, not a mandatory step. Strong matches skip it entirely, saving cost and latency.

---

## 10. Chunks — Why 4 Per Watch

A single embedding cannot capture all the ways a user might describe a watch. Four specialized chunks cover different query styles:

| Chunk | Optimized for queries like |
|---|---|
| `full` | "Patek Philippe 38mm white gold" (specific reference) |
| `brand_style` | "rose gold sunburst dial alligator strap" (aesthetic) |
| `specs` | "thin watch under 8mm with power reserve" (technical) |
| `use_case` | "sport watch for active lifestyle" (functional) |

At search time, all four chunks are compared against the query. The best-matching chunk wins for each watch. A specs query finds the right watch through its `specs` chunk even if the `full` chunk is not the closest.

---

## 11. Category Taxonomy — Deterministic, Not AI

Watch categories (`dress watch`, `sport watch`, `diver's watch`, `chronograph`) are assigned by backend code (`InferCategory()`), not by the LLM.

The mapping is deterministic:
- Collection in `_diverCollections` set -> "diver's watch"
- Water resistance >= 200m -> "diver's watch"
- Chronograph in functions or name -> "chronograph"
- Collection in `_sportCollections` set -> "sport watch"
- Collection in `_dressCollections` set -> "dress watch"
- Default -> "luxury watch"

This taxonomy is embedded into chunk text as structured truth. The LLM uses it for ranking and explanation, but does not generate or override it.

**Design principle:** Structured truth lives in the database and deterministic code. The LLM interprets and ranks on top — it never owns the ground truth.

---

## 12. HNSW Index — Fast Vector Lookup

Finding the nearest vector by brute force means comparing against every row — O(n). Fine at 100 rows, slow at 100,000.

HNSW (Hierarchical Navigable Small World) is an approximate nearest-neighbor index. It pre-builds a graph where each vector is connected to its nearby neighbors. At query time, the search traverses the graph top-down: coarse layer first, then finer layers. Result: O(log n), not O(n).

The "small world" intuition: any two vectors are reachable in a small number of hops, like any two people on Earth connected through ~6 acquaintances.

Both `WatchEmbeddings` and `QueryCaches` have HNSW indexes on their vector columns.

---

## 13. Summary Table

| Concept | One-line definition |
|---|---|
| Embedding | A list of 768 numbers representing the meaning of text |
| Cosine similarity | How close two vectors are (1.0 = identical, 0.0 = unrelated) |
| Semantic search | Finding results by meaning, not exact text match |
| Semantic ordering | Ranking results by how close their meaning is to the query |
| WatchEmbeddings | Pre-computed vectors for every watch (the semantic index) |
| QueryCaches | Stored results for past queries (the speed layer) |
| Hybrid search | SQL filters + semantic ranking combined |
| Chunk | One of four text descriptions per watch, each targeting a different query style |
| HNSW | Fast approximate vector lookup index |
| Category taxonomy | Deterministic labels (dress/sport/diver/chrono) assigned by code, not AI |
| nomic-embed-text | The fixed embedding model — same input always produces same output |
