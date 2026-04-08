# Phase 2: Watch Finder

AI-powered natural language watch search. Users describe what they want in plain English and get ranked product results with match explanations.

> **Scope:** The Watch Finder handles brand, collection, specs, and price queries — e.g. "Vacheron dress watch 39–40mm", "JLC Reverso under 50k", "sport watch under 100k".
> Occasion and lifestyle queries ("wedding watch", "watch for a banker") are Phase 5 scope — see `phase5-rag-chatbot.md`.

---

## How It Works (Simple Version)

A query goes through three stages:

1. **Understand** — figure out what the user wants (brand, price, style, features)
2. **Retrieve** — find watches that could match using vector similarity
3. **Rank** — score the candidates with the LLM and return the best ones

The key design question is: **who does the "understand" step?**

### Old approach (regex) — what we had and why it's bad

```
Query: "JLC Reverso, Rolex Daydate, Omega under 50k with good water resistance"

Regex scans the text:
  Finds "JLC"    → BrandId = JLC ✓
  Finds "Reverso" → CollectionId = Reverso ✓
  Finds "50k"    → MaxPrice = 50000 ✓
  "good water resistance" → no regex pattern → skipped ✗
  "Rolex", "Omega" → only first brand match kept → they disappear ✗

SQL WHERE locks it in BEFORE vector search:
  WHERE BrandId = JLC AND CollectionId = Reverso AND Price ≤ 50k
  → Rolex and Omega are now physically excluded from the candidate pool
  → LLM rerank never sees them, can't surface them

Vector search runs inside that locked pool.
LLM reranks what's left.
```

Problems:
- Regex decides relevance *before* the AI sees the query — gets it wrong on complex queries
- Multi-brand queries ("JLC + Rolex + Omega") collapse to just the first brand found
- Unrecognised phrasing ("good water resistance", "beach vacation") silently skips the filter
- Every new filter type needs new hardcoded regex — fragile, grows forever

### New approach (LLM-first) — what we're moving to

Run the LLM parse call **in parallel with the embed call** — same wall-clock latency, smarter output:

```
Query: "JLC Reverso, Rolex Daydate, Omega under 50k with good water resistance"

LLM parse (runs at same time as embed, ~200ms):
  Returns: {
    brands: ["Jaeger-LeCoultre", "Rolex", "Omega Watches"],
    maxPrice: 50000,
    waterResistanceBuckets: ["50m–120m", "150m–300m", "600m+"],
    style: null,
    complications: []
  }

Hard SQL pre-filters (only high-confidence explicit constraints):
  Price ≤ 50k   ← always hard, user stated it explicitly
  No brand lock ← 3 brands named = multi-brand query → let vector decide

Soft filters returned to frontend for pre-population:
  Water resistance checkboxes: 50m–120m ✓, 150m–300m ✓, 600m+ ✓
  Brand filter bar: JLC, Rolex, Omega pre-checked

Vector search runs on the loosely-filtered pool (price only).
LLM reranks top 15 → JLC Reverso, Rolex Daydate, Omega Seamaster all surface.
```

The LLM handles any phrasing naturally — "beach vacation" → sport + water-resistant, "dress watch for a wedding" → dress style + no complications — without any new code.

**Rule for hard SQL vs soft filters:**
- **Hard SQL** (physically excludes candidates): explicit price range, single brand if only one is named
- **Soft / client-side** (pre-populates filter bar, user can adjust): style, water resistance, complications, power reserve, material, movement, multi-brand queries

---

## Pipeline (Phase 3B — current implementation)

```
User query (plain text)
  ↓
0a. PARSE INTENT  ← runs in parallel with 0b
    LLM-based: /watch-finder/parse → structured JSON
    (brand[], maxPrice, minPrice, style, waterResistance, complications, powerReserve, ...)
    Hard constraints: price (explicit), brandId (exactly 1 brand named)
    Soft constraints: all others → returned in QueryIntent for frontend
  ║
0b. EMBED QUERY  ← runs in parallel with 0a
    nomic-embed-text (~50ms) → float[]
  ↓ (both complete)
0c. CACHE CHECK — QueryCache cosine similarity ≥ 0.92
  ├─ hit  → attach QueryIntent → return immediately (~200ms)
  └─ miss
       ↓
1. VECTOR SEARCH — WatchEmbeddings cosine similarity < 0.55
                   Hard SQL pre-filters from QueryIntent (price, single brand if applicable)
                   Cosine ranking within loosely filtered pool → up to 50 candidates
  ↓
2. TIER ROUTING
   Tier 2: best distance < 0.20 → return top 15 by vector order (no LLM)
   Tier 3: best distance 0.20–0.55 → LLM rerank on top 15
   Tier 4: no candidates → return empty
  ↓
3. SPLIT   — backend
             Top matches: score ≥ 60, capped at 15 → top section
             All others → "Timepieces you may also be interested in"
  ↓
4. EMBED   — background fire-and-forget
             WatchEmbeddingService generates vectors for returned watches
  ↓
Response to frontend → /smart-search?q=...
  Includes QueryIntent (LLM-parsed brand/price/style/water resistance/complications)
  Frontend pre-populates filter bar from QueryIntent
  All further filtering is client-side on the full result set (no re-fetch)
```

**Fallback (both embed and parse calls fail):** return empty result with error state.

---

## Filter Architecture

### Hard filters (SQL WHERE — applied before vector search)

These physically remove candidates. Used only when the constraint is explicit and unambiguous:

| Constraint | Applied when |
|---|---|
| `MaxPrice` | User says "under X" or "below $X" |
| `MinPrice` | User says "over X" or "above $X" |
| `BrandId` | Exactly 1 brand named in query |

Everything else is soft. Hard filters should be minimal — the LLM reranker is better at relevance judgment than SQL.

### Soft filters (QueryIntent → frontend filter bar)

Returned alongside results and used to pre-populate the filter bar. The user sees the AI's interpretation and can adjust. All applied client-side on the full result set:

| Field | Frontend filter |
|---|---|
| `style` | Collection filter (resolved to collection IDs with matching style) |
| `waterResistanceBuckets` | Water Resistance checkboxes |
| `complications` | Complication checkboxes |
| `powerReserves` | Power Reserve checkboxes |
| `caseMaterial` | Case Material dropdown |
| `movementType` | Movement dropdown |
| `minDiameterMm / maxDiameterMm` | Diameter filter |

Multi-brand queries: brands are returned in `QueryIntent` for UI display but not applied as a SQL filter — the user can check/uncheck individual brands.

---

## Files

| Layer | File |
|---|---|
| AI service (parse + rerank + explain + embed) | `ai-service/app.py` |
| Model config | `ai-service/Modelfile` |
| Container startup | `ai-service/entrypoint.sh` |
| Backend orchestration | `backend/Services/WatchFinderService.cs` |
| SQL filter logic | `backend/Services/WatchFilterMapper.cs` |
| Embedding generation | `backend/Services/WatchEmbeddingService.cs` |
| API endpoints | `backend/Controllers/WatchController.cs` → `POST /api/watch/find`, `POST /api/watch/explain`, `GET /api/watch/filter-options` |
| Admin embedding endpoints | `backend/Controllers/AdminController.cs` → `POST /api/admin/embeddings/generate`, `GET /api/admin/embeddings/status` |
| Next.js proxy | `frontend/app/api/watch-finder/route.ts` |
| Explain proxy | `frontend/app/api/watch-finder-explain/route.ts` |
| AI ready proxy | `frontend/app/api/ai-ready/route.ts` |
| Homepage search (redirect-only) | `frontend/app/components/WatchFinderSearch.tsx` |
| Smart search page | `frontend/app/smart-search/SmartSearchClient.tsx` |
| API client types | `frontend/lib/api.ts` → `WatchFinderResult`, `FilterOptions`, `watchFinderExplain`, `fetchFilterOptions` |

---

## Models

| Environment | Model | Cost |
|---|---|---|
| Local dev | `qwen2.5:7b` via Ollama (inside ai-service container) | Free |
| Production | `claude-haiku-4-5` via Anthropic API | ~$0.002/query |

Switch is a single env var — no code change needed:
```
LLM_BASE_URL=http://localhost:11434/v1   # local
LLM_BASE_URL=https://api.anthropic.com  # production
LLM_MODEL=qwen2.5:7b                    # local
LLM_MODEL=claude-haiku-4-5             # production
```

---

## Response Time

### Local dev (Docker, GPU)

| Situation | Parse | Rerank | Why |
|---|---|---|---|
| Cold (first request after `make reset`) | 9–15s | — | Ollama loading model from disk into GPU VRAM |
| Warm (any request after cold) | ~2s | ~1.5s | Model resident in VRAM |
| Cache hit | ~5ms | ~5ms | Flask in-memory cache, GPU not touched |

LLM parse and embed run in parallel — total latency is `max(parse, embed)`, not `parse + embed`.

Cold start happens **once per container run** — every `make reset` or `docker compose restart ai-service` triggers it again. While the container stays up, the model stays warm.

Idle eviction: Ollama unloads the model from VRAM after 5 minutes of no requests by default. Set `OLLAMA_KEEP_ALIVE: -1` in `docker-compose.yml` to keep it loaded permanently.

### Production (24/7 server)

| Situation | Parse | Rerank |
|---|---|---|
| After deploy (first request) | ~1s | ~0.5s | Claude Haiku API, no local loading |
| All subsequent requests | ~1s | ~0.5s | Stateless API, consistent |
| Cache hit | ~5ms | ~5ms | Flask cache same as local |

No cold start problem in production — Haiku is a remote API call, always ready.

**Warmup tip for local dev:** `entrypoint.sh` can fire a dummy parse request right after Flask starts so the first real user never sees the cold delay:
```bash
curl -sf -X POST http://localhost:5000/watch-finder/parse \
  -H "Content-Type: application/json" \
  -d '{"query":"dress watch"}' > /dev/null 2>&1 &
```

---

## Caching

- Query cache keyed by embedding (cosine similarity ≥ 0.92 = cache hit)
- In-memory (Flask process), cleared on container restart
- Cache hits do not count against the AI usage quota

---

## Candidate Selection

1. Vector search returns up to **50 candidates** (deduplicated by watch, best chunk distance kept)
2. Top 15 sent to LLM rerank — scores only, `max_tokens` 600
3. **Top section**: score ≥ 60, capped at 15. If < 3 qualify, relax threshold and take top 15 regardless
4. **"Also interested in" section**: remaining candidates ordered by score descending

## Cold Start UX

`_model_ready` flag in `app.py` gates `/parse` and `/rerank` — both return 503 until the warmup LLM call completes (~60s on first start). Frontend polls `GET /api/ai-ready` every 5s and shows "AI service warming up" while waiting.

## Smart Search Page (`/smart-search`)

Search from homepage redirects to `/smart-search?q=...` instead of showing inline results. The page:
- Fetches AI results + brands + filter options in parallel on load
- Shows a **horizontal accordion filter bar** (multi-select checkboxes per filter category)
- Filters: Brand, Collection (cascades from brand), Case Material, Diameter, Movement, Dial Color, Water Resistance, Power Reserve, Complication, Price — all multi-select
- Filter bar is pre-populated from `QueryIntent` returned by the backend (LLM-parsed intent)
- **Wrist Fit input**: number → appended as `?wristFit=17` to all watch card links → pre-fills `WristFitWidget` on the detail page
- All filtering is client-side (`useMemo`) on the full AI result set — no re-fetch
- Results show in full-width 4-column grid with divider between top/other sections
