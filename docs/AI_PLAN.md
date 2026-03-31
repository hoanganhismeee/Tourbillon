# Tourbillon — AI Plan

## 1. Objective

AI is used only for natural language understanding, ranking, explanation, and content generation.
All core logic — filtering, sorting, scoring, wrist-fit calculation, category taxonomy — is handled by the backend (SQL, .NET, deterministic code).

> AI enhances the system. It does not replace backend logic. It does not own ground truth.

---

## 2. Design Principle — Structured Truth + LLM Interpretation

The system separates **what is deterministically knowable** from **what requires language understanding**:

| Layer | Owns | Examples |
|---|---|---|
| **Database + backend** | Ground truth: specs, prices, brand/collection taxonomy, category labels, occasion metadata | `Collection.Style`, `InferCategory()`, `ParseQueryIntentAsync()` regex, SQL filters |
| **Embedding model** | Semantic similarity: which watches are close to a query in meaning-space | nomic-embed-text vectors in `WatchEmbeddings`, cosine distance ranking |
| **LLM (Haiku / Qwen)** | Interpretation: ambiguity resolution, ranking nuance, explanations, conversational synthesis | Reranker scores, on-demand explanations, chat responses, taste extraction |

**The LLM interprets and ranks on top of structured truth. It never owns the ground truth.**

Watch category labels (`dress watch`, `sport watch`, `diver's watch`, `chronograph`) are deterministic metadata derived from collection taxonomy and specs — not LLM output. This holds regardless of whether the LLM is Qwen 2.5 7B or Claude Haiku. The taxonomy is a stable retrieval feature, not a temporary crutch for a weak model.

---

## 3. Model Strategy

### Production

| Property | Value |
|---|---|
| Model | Claude Haiku 4.5 |
| Provider | Anthropic API |
| Input cost | $0.25 / 1M tokens |
| Output cost | $1.25 / 1M tokens |
| Cost per query | ~$0.001 |

Used for: intent parsing (fallback), reranking, on-demand explanation, chat responses, taste extraction.

### Local Development

| Property | Value |
|---|---|
| Model | Qwen 2.5 7B Instruct |
| Runtime | Ollama |
| Cost | $0 |

Used for: prompt testing, API simulation, offline development.

### Embedding Model (shared, both environments)

| Property | Value |
|---|---|
| Model | nomic-embed-text |
| Dimensions | 768 |
| Runtime | Ollama (same container as LLM) |
| Cost | $0 |

**Critical rule:** Same embedding model in dev and production. Vectors from different models are incompatible — different dimensions, different vector space. All pre-seeded embeddings remain valid in production because the model is identical.

### Environment Switch

Single env var, no code change:

```python
LLM_BASE_URL = os.getenv("LLM_BASE_URL", "http://localhost:11434/v1")
LLM_API_KEY  = os.getenv("LLM_API_KEY", "ollama")
LLM_MODEL    = os.getenv("LLM_MODEL", "qwen2.5:7b")
```

---

## 4. Retrieval Architecture

### Two-layer vector system

```
User query
  |
  v
[Layer 2] Embed query -> cosine similarity vs QueryCaches
  |-- hit (similarity >= 0.92) -> return stored result              <200ms, no LLM
  '-- miss
       |
       v
     [Layer 1] Cosine similarity vs WatchEmbeddings -> top 50 candidates
       |
       v
     Tier routing -> LLM rerank (if needed) -> top 15 results
       |
       v
     [Background] store result in QueryCaches for next time
```

| Layer | Table | What it stores | Purpose |
|---|---|---|---|
| Layer 1 | `WatchEmbeddings` | 4 chunks per watch (1,404 rows) | Semantic retrieval — finds watches SQL misses |
| Layer 2 | `QueryCaches` | Full result JSON per query | Speed layer — instant return for repeated queries |

### Hybrid filtering (Elasticsearch bool+kNN pattern)

Every query is split into two parallel tracks:

**Structured track** — `ParseQueryIntentAsync` (no LLM, ~5ms):
- Brand alias map + full-name substring
- Collection scoped to matched brand
- Price regex (`under 50k`, `between 20k and 50k`)
- Applied as SQL WHERE clauses before cosine ranking

**Semantic track** — full query text embedded via nomic-embed-text, cosine-ranked within the filtered pool. Nuanced descriptors (dress, ultra-thin, moonphase) drive similarity ranking.

### Tier routing (cosine distance: 0 = identical, 1 = orthogonal)

| Tier | Condition | LLM called? | Notes |
|---|---|---|---|
| Cache hit | QueryCaches similarity >= 0.92 | No | Fastest path. Bypassed when hard filters detected |
| Tier 2 | best distance < 0.20 | No | Strong match — return by vector relevance order |
| Tier 3 | best distance 0.20-0.55 | Yes (top 15) | Ambiguous — LLM reranks candidates |
| Tier 4 | best distance > 0.55 | No | Nothing relevant — return empty |

### Four chunk types per watch

Each watch is embedded as four separate texts targeting different query styles:

| ChunkType | Content | Matches queries like |
|---|---|---|
| `full` | Brand + ref + collection + specs + price | "Patek Philippe 38mm white gold" |
| `brand_style` | Ref + collection + material + dial (finish, indices, hands) + strap + caliber + case back + production status | "rose gold sunburst dial alligator strap" |
| `specs` | All technical specs: diameter, thickness, WR, power reserve, functions | "thin watch under 8mm with power reserve" |
| `use_case` | Deterministic category + diameter + material + WR + movement + complications + occasions + price | "sport watch under 50k for active lifestyle" |

**Category taxonomy in chunks is deterministic.** `InferCategory()` maps watches to one of five labels (`diver's watch`, `chronograph`, `sport watch`, `dress watch`, `luxury watch`) via collection-name mapping and specs inspection. `InferOccasions()` gates occasion labels by category and material. Both are stable backend logic, not LLM output.

### Feature column — multi-feature embedding support

Both `WatchEmbeddings` and `QueryCaches` carry a `Feature` column so multiple features share the same table without cross-contamination:

| Table | Feature values | Scoping |
|---|---|---|
| `WatchEmbeddings` | `"watch_finder"`, `"editorial"` | WHERE Feature = X before cosine scan |
| `QueryCaches` | `"watch_finder"`, `"rag_chat"` | WHERE Feature = X before cosine scan |

Unique index on `(WatchId, ChunkType, Feature)` allows each feature to maintain independent chunk sets per watch.

---

## 5. AI Usage by Feature

### Must use AI

**Watch Finder (Smart Search)**
- `ParseQueryIntentAsync` extracts hard SQL filters (no LLM, regex + DB lookup)
- Embedding + vector search ranks candidates semantically
- LLM reranks ambiguous results (Tier 3 only)
- On-demand explanation per watch (cached)
- Cost: $0 for Tier 2 cache/vector hits; ~$0.002/query for Tier 3 (one Haiku call)

**Chat Concierge**
- Three query types: PRODUCT (direct DB fetch), BRAND (DB description + collection list), GENERAL (vector search top-5 as context)
- LLM generates conversational response with embedded watch/brand/collection links
- Rate limit: 5/day deployed, unlimited local
- Cost: ~$0.001/message

**Story-first Product Pages**
- Editorial content generated once per collection, stored in DB, served at zero cost
- Coverage: 339/339 watches
- Cost: one-time ~$0.50 total

### Should use AI

**Compare Mode** — backend handles spec diff (SQL); AI generates wearability explanation on demand

**Watch DNA / Taste Profile** — LLM extracts structured preferences once on save; rule-based scoring at browse time (zero AI cost)

### Never use AI

- Filtering and sorting (SQL)
- Wrist-fit calculation (pure arithmetic)
- Category/style classification (deterministic `InferCategory()`)
- Product queries and CRUD
- Authentication and session management

---

## 6. Usage Limits

| Feature | Limit | Notes |
|---|---|---|
| Watch Finder | 5 searches / user / day | Cache hits are free, do not consume quota |
| Chat Concierge | 5 messages / user / day (deployed); unlimited (local) | Separate quota from Watch Finder |
| Compare Mode explanation | 10 / user / day | Raw comparison is unlimited |
| Watch DNA save | 1 LLM call per save | Rule-based scoring at browse time is free |
| Story Content | No runtime limit | Pre-generated, zero API cost |

---

## 7. Caching Strategy

### Semantic query cache (QueryCaches)

Cosine similarity >= 0.92 against stored query embeddings. A hit returns the full stored result — no LLM call, no vector search.

```
User query
    |
    v
Embed query (~50ms)
    |
    v
Cosine search vs QueryCaches (WHERE Feature = 'watch_finder')
    |-- hit (>= 0.92) -> return cached result          (~200ms total)
    '-- miss -> full pipeline -> [Background] store result
```

**Cache bypass:** When `ParseQueryIntentAsync` detects hard SQL filters (brand, collection, price), the cache is skipped to prevent stale cross-category hits.

**Pre-seeding:** `POST /api/admin/query-cache/seed` warms 65 built-in queries. Self-populates from real traffic thereafter.

**After catalog changes:** Clear (`DELETE /api/admin/query-cache`) and re-seed.

---

## 8. Cost Estimation

| Scenario | Monthly cost |
|---|---|
| 1,000 users x 5 searches, no cache | ~$5 |
| Same, with 50% cache hit rate | ~$2-3 |
| Chat Concierge (5 msg/user/day) | ~$1-2 |
| Story Content (one-time, all watches) | ~$0.50 total |
| Embeddings (nomic-embed-text, local) | $0.00 |
| **Total ongoing** | **< $5 / month** |

---

## 9. Infrastructure Cost (AWS)

| Service | Instance | Monthly |
|---|---|---|
| EC2 (backend + AI service) | t3.micro | $0 free tier / $7.59 after |
| RDS PostgreSQL | db.t3.micro | $0 free tier / $21.90 after |
| S3 (watch images, ~5GB) | Standard | ~$0.12 |
| CloudFront (CDN + SSL + WAF) | Free plan | $0 |
| Vercel (Next.js frontend) | Hobby | $0 |
| Claude Haiku API | — | ~$2-5 |
| Domain | — | ~$1 |
| **Total (free tier year)** | | **~$3-6 / month** |
| **Total (after free tier)** | | **~$40-45 / month** |

---

## 10. Response Parsing (defensive layer)

Both Haiku and Qwen can occasionally add conversational filler before JSON output. The AI service includes a cleaning and retry layer:

```python
def parse_llm_json(raw: str) -> dict:
    match = re.search(r'[\[{]', raw)
    if not match:
        raise ValueError("No JSON found in response")
    return json.loads(raw[match.start():])
```

On parse failure, retry once with a stricter prompt. On second failure, return structured error so the backend falls back to standard search.

---

## 11. Retrieval Quality Audit (March 2026)

A technical audit of the AI retrieval system identified and fixed five issues:

### Bugs fixed

| Issue | Severity | Fix |
|---|---|---|
| Chat GENERAL queries returned empty context — `FetchGeneralContextAsync` queried `Feature == "rag_chat"` but no rows existed with that value | High | Changed to `Feature == "watch_finder"` to reuse existing embeddings |
| `BrandSpread` destroyed vector relevance ordering — round-robin across brands applied after cosine-sorted results, undermining Tier 2 quality | High | Removed BrandSpread from vector search path; retained for Phase 2 SQL fallback only |
| Unique index `(WatchId, ChunkType)` blocked multi-feature embeddings | Medium | Expanded to `(WatchId, ChunkType, Feature)` via new EF migration |
| `use_case` and `brand_style` chunks near-identical within collections — `InferCategory()` produced same label for all watches in a collection, chunks lacked watch-specific specs | Medium | Enriched both chunk templates with watch-specific differentiators (6 new fields in brand_style, 5 in use_case) |

### Concerns evaluated and dismissed

| Concern | Verdict | Evidence |
|---|---|---|
| 0.92 threshold confused between WatchEmbeddings and QueryCaches | Invalid | 0.92 is only in `QueryCacheService`. WatchEmbeddings uses separate distance thresholds (0.20/0.35/0.55) |
| Embeddings degrading Watch DNA / Taste Profile | Invalid | Watch DNA is 100% rule-based scoring — no embeddings involved at any point |

### Architecture principles confirmed

- Deterministic category taxonomy (`InferCategory`, `InferOccasions`, `Collection.Style`) is permanent structured metadata, not a temporary crutch
- The LLM handles ambiguity, ranking nuance, explanations, and conversational synthesis
- Structured truth does not depend on the LLM getting smarter later
- After chunk text changes, a full re-embed (`POST /api/admin/embeddings/generate`) + cache clear (`DELETE /api/admin/query-cache`) is required

### Post-fix re-embedding checklist

1. Apply EF migration: `dotnet ef database update`
2. Re-embed all watches: `POST /api/admin/embeddings/generate`
3. Verify coverage: `GET /api/admin/embeddings/status` (expect 351/351)
4. Clear stale cache: `DELETE /api/admin/query-cache`
5. Re-seed cache: `POST /api/admin/query-cache/seed`
6. Test Smart Search: "Patek Nautilus" should return Nautilus watches ordered by relevance
7. Test Chat: general query should return response citing specific catalogue watches

---

## 12. Chat Concierge Hardening (March 2026)

### System prompt rewrite

The `CHAT_SYSTEM_PROMPT` was rewritten to add five hardening layers beyond the original tone/style guidance:

| Layer | Purpose | Enforcement |
|---|---|---|
| Scope | Restrict to watches, horology, Tourbillon topics | Prompt instruction + polite redirect text |
| Grounding | Prioritise provided DB context over training data | Prompt: "base answers on provided context" |
| Anti-hallucination | Never invent specs/prices/availability | Prompt + empty-context fallback (backend) |
| Safety | Ignore prompt injection, refuse harassment | Prompt: ignore role-change, single redirect for abuse |
| Consistency | "Tourbillon" naming, spec-based reasoning | Prompt: no "we/our", cite specific specs |

**Design intent:** Not a knowledge prison. The AI leads with Tourbillon catalogue data and navigable links, then supplements with interesting external facts (via web search on brand queries). The grounding constraint prevents hallucination about inventory — not general horological knowledge.

### Editorial content in chat context

Previously, `ChatService` sent only watch specs + descriptions to the AI. Now it also includes `WatchEditorialContent.WhyItMatters` and `WatchEditorialContent.BestFor` for watches in the context. This gives the AI access to rich horological narrative (5-7 sentences each, specific names/dates/history) without any additional AI cost — the content was already generated and stored during editorial seeding.

Affected methods:
- `FetchProductContextAsync` — loads editorial for all watches in the result set
- `FetchBrandContextAsync` — loads editorial from up to 3 sample watches for the brand

### Empty-context fallback

When `FetchGeneralContextAsync` returns an empty list (no vector matches), a sentinel context string is injected: `"No matching watches found in the Tourbillon catalogue for this query."` This triggers the grounding instruction to admit lack of data rather than hallucinate from training knowledge.

### Collection.Style in context

`Collection.Style` ("sport", "dress", "diver", etc.) is now appended to collection context strings. This feeds the deterministic category labels from section 2 (Structured Truth + LLM Interpretation) directly into the chat pipeline.

### Slug-based links in chat context

Context strings now provide slugs instead of numeric IDs: `Brand "Patek Philippe" (Slug: patek-philippe)` instead of `(ID: 1)`. The `CHAT_SYSTEM_PROMPT` instructs the AI to use slug-based links: `[Brand Name](/brands/{slug})`. The `_inject_entity_links` function in `ai-service/app.py` parses slugs from context and injects markdown links for bare entity mentions. `ExtractWatchCardsAsync` in `ChatService.cs` matches slug patterns in AI responses to extract watch cards.
