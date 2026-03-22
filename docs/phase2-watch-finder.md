# Phase 2: Watch Finder

AI-powered natural language watch search. Users describe what they want in plain English and get ranked product results with match explanations.

> **Scope:** The Watch Finder handles brand, collection, specs, and price queries — e.g. "Vacheron dress watch 39–40mm", "JLC Reverso under 50k", "sport watch under 100k".
> Occasion and lifestyle queries ("wedding watch", "watch for a banker") are Phase 5 scope — see `phase5-rag-chatbot.md`.

---

## Pipeline (Phase 3B — current)

```
User query (plain text)
  ↓
0a. PARSE INTENT — ParseQueryIntentAsync (no LLM)
                   regex + DB name lookup → brand, collection, price hard constraints
  ↓
0b. EMBED QUERY — nomic-embed-text (~50ms)
  ↓
0c. CACHE CHECK — QueryCaches cosine similarity ≥ 0.92
  ├─ hit  → attach QueryIntent → return immediately (~200ms)
  └─ miss
       ↓
1. VECTOR SEARCH — WatchEmbeddings cosine similarity < 0.55
                   Hard SQL pre-filters from QueryIntent applied first
                   (brand WHERE, collection WHERE, price WHERE)
                   Cosine ranking within filtered pool → up to 50 candidates
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
Response to frontend → /smart-search?q=... (includes QueryIntent)
```

**Fallback (embed call fails):** LLM parse → SQL filter → LLM rerank

---

## Hybrid Filtering (Elasticsearch bool+kNN pattern)

Every query is split into two parallel processing tracks:

**Structured track** — `ParseQueryIntentAsync` extracts hard constraints using regex + DB name matching (no LLM):
- Brand: alias map (`JLC` → Jaeger-LeCoultre, `AP` → Audemars Piguet) + full-name substring
- Collection: scoped to matched brand first, then all collections
- Price: regex patterns (`under 50k`, `below $50,000`, `between 20k and 50k`)

These constraints become SQL `WHERE` clauses applied to the `WatchEmbeddings` join with `Watches` before cosine distance is calculated. Non-matching watches are physically excluded — they never appear in results regardless of vector similarity.

**Semantic track** — the full query text is embedded as-is and cosine-ranked within the filtered pool. Nuanced descriptors (`dress`, `ultra-thin`, `moonphase`) that aren't hard constraints still drive the similarity ranking.

**Result:** `QueryIntent` is returned to the frontend alongside watch results. The Smart Search page reads it and pre-populates the filter bar (Brand, Collection, Price buckets) to match what the query implied.

Example — "JLC Reverso under 50k":
```
Structured → Brand=Jaeger-LeCoultre (4), Collection=Reverso (13), MaxPrice=50000
             Applied as SQL WHERE before cosine sort
Semantic   → "JLC Reverso under 50k" embedded → cosine sort within JLC Reverso pool
Frontend   → Brand filter pre-selected: Jaeger-LeCoultre
             Collection filter pre-selected: Reverso
             Price filter pre-selected: Under $10k, $10k–$25k, $25k–$50k
```

**On-demand explain:** `POST /api/watch/explain` → ai-service `/watch-finder/explain` — called only when user requests "Why this watch?" Single-sentence explanation, cached.

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

Cold start happens **once per container run** — every `make reset` or `docker compose restart ai-service` triggers it again. While the container stays up, the model stays warm.

Idle eviction: Ollama unloads the model from VRAM after 5 minutes of no requests by default. Set `OLLAMA_KEEP_ALIVE: -1` in `docker-compose.yml` to keep it loaded permanently.

### Production (24/7 server)

| Situation | Parse | Rerank |
|---|---|---|
| After deploy (first request) | ~1s | ~0.5s | Claude Haiku API, no local loading |
| All subsequent requests | ~1s | ~0.5s | Stateless API, consistent |
| Cache hit | ~5ms | ~5ms | Flask cache same as local |

No cold start problem in production — Haiku is a remote API call, always ready. The only warm-up concern is on the local model during development.

**Warmup tip for local dev:** `entrypoint.sh` can fire a dummy parse request right after Flask starts so the first real user never sees the cold delay:
```bash
curl -sf -X POST http://localhost:5000/watch-finder/parse \
  -H "Content-Type: application/json" \
  -d '{"query":"dress watch"}' > /dev/null 2>&1 &
```

---

## Caching

- Keyed by normalised query string (lowercase, stripped punctuation, collapsed whitespace)
- Separate keys for parse and rerank endpoints
- In-memory (Flask process), cleared on container restart
- Cache hits do not count against the AI usage quota (5 searches/user/day)

---

## Candidate Selection

1. SQL filter returns up to **30 candidates** using a brand-spread algorithm (round-robin across brands for variety)
2. All 30 sent to rerank — scores only (no explanations), `max_tokens` 600
3. **Top section**: score ≥ 60, capped at 8 watches. If < 3 qualify, relax threshold and take top 8 regardless of score
4. **"Also interested in" section**: all remaining candidates (lower-scored + unscored), ordered by score descending

## Cold Start UX

`_model_ready` flag in `app.py` gates `/parse` and `/rerank` — both return 503 until the warmup LLM call completes (~60s on first start). Frontend polls `GET /api/ai-ready` every 5s and shows "AI service warming up" while waiting.

## Smart Search Page (`/smart-search`)

Search from homepage redirects to `/smart-search?q=...` instead of showing inline results. The page:
- Fetches AI results + brands + filter options in parallel on load
- Shows a **horizontal accordion filter bar** (multi-select checkboxes per filter category)
- Filters: Brand, Collection (cascades from brand), Case Material, Diameter, Movement, Dial Color, Water Resistance, Power Reserve, Complication, Price — all multi-select
- **Wrist Fit input**: number → appended as `?wristFit=17` to all watch card links → pre-fills `WristFitWidget` on the detail page
- All filtering is client-side (`useMemo`) on the full AI result set — no re-fetch
- Results show in full-width 4-column grid with divider between top/other sections
