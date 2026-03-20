# Phase 2: Watch Finder

AI-powered natural language watch search. Users describe what they want in plain English and get ranked product results with match explanations.

---

## Pipeline

```
User query (plain text)
  ↓
1. PARSE   — ai-service /watch-finder/parse
             NL query → structured JSON intent (price, material, style, complications, etc.)
  ↓
2. FILTER  — backend SQL (WatchFilterMapper)
             Apply parsed intent as predicates → up to 30 candidates (brand-spread)
  ↓
3. RERANK  — ai-service /watch-finder/rerank (scores only, no explanations)
             Score each candidate 0–100
  ↓
4. SPLIT   — backend
             Top matches: score ≥ 60, capped at 8 → top section
             All others (lower-scored + unscored) → "Also interested in"
  ↓
5. EMBED   — background fire-and-forget
             WatchEmbeddingService generates vectors for all returned watches
  ↓
Response to frontend → /smart-search?q=...
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
