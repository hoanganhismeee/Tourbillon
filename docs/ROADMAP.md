# Tourbillon AI Feature Roadmap

## Status Overview

| Feature | Status | Phase |
|---|---|---|
| Compare Mode | Done | 1 |
| Wrist-fit Recommender | Done | 1 |
| AI Watch Finder — pipeline (parse + filter + rerank) | Done | 2 |
| AI Watch Finder — Smart Search page (horizontal filters, wrist fit pre-fill) | Done | 2 |
| AI Watch Finder — cold start UX (warmup + /ready polling) | Done | 2 |
| AI Watch Finder — scores-only rerank + on-demand explain | Done | 2 |
| Vector Embeddings Infrastructure (pgvector, nomic-embed-text, demand-driven) | Done | 3A |
| Persistent Query Cache (semantic result cache, pre-seeded, survives deploys) | Done | 3A |
| Vector Similarity Search + QueryIntent Hybrid Filtering | Done | 3B |
| Category-Aware Embeddings + Spec-Level Filter Pre-Selection | Done | 3B |
| Story-first Product Pages | Done | 2 |
| Watch DNA / Taste Profile | Done | 3C |
| Google OAuth + Email Magic Login (passwordless OTP) | Done | 3C |
| Role-Based Access Control (admin seeding, scrape page guard, nav link) | Done | 3.5 |
| AI Discovery Pages (GEO/SEO) | Done | 3 |
| Stripe Checkout (Test Mode) | Planned | 4 |
| Save / Build Collection | Planned | 4 |

## Model Strategy

| Environment | Model | Cost | Usage |
|---|---|---|---|
| Production | Claude Haiku 4.5 | $0.25/1M input · $1.25/1M output | Intent parsing, ranking explanation, content generation |
| Local dev | Qwen 2.5 7B (Ollama, inside ai-service container) | $0.00 | Prompt testing, API simulation, offline development |

**Why use a weaker model locally:** Developing on Qwen 2.5 7B exposes prompt edge cases that stronger models hide. Prompts that work on Qwen are robust in production.

**Environment switching — single env var, no code change:**

```
LLM_BASE_URL=http://localhost:11434/v1   # local
LLM_BASE_URL=https://api.anthropic.com  # production
LLM_MODEL=qwen2.5:7b                    # local
LLM_MODEL=claude-haiku-4-5             # production
```

---

## AI Usage by Feature

### Must use AI

- **Watch Finder + Concierge** — intent parsing (NL → structured filters) + result ranking + explanation
- **Story-first Product Pages** — editorial content generation per watch (generated once, stored in DB)
- **Discovery Pages** — editorial intro per theme (generated once, served as static)
- **Chat Assistant** — conversational responses, product-aware answers

### Should use AI

- **Compare Mode** — backend handles the spec diff (SQL); AI generates the wearability and brand-character explanation
- **Watch DNA / Taste Profile** — Phase A is rule-based (free); Phase B optionally uses local embeddings

### Never use AI

- Filtering and sorting (SQL)
- Wrist-fit calculation (pure arithmetic)
- Product queries and CRUD
- Authentication and session management

---

## Phase 2: Core AI Features

### AI Watch Finder + Concierge (merged)

Natural language watch discovery that returns ranked products — not just chat text.

**What it does:**
- User describes what they want: "rose gold dress watch, thin, under 20k"
- System returns ranked product cards with match explanations
- Implicit filtering by case material, size, movement type, complications, price band
- Conversational flow: "I have a wedding", "I already own a diver, what next?"
- Upgrades existing RAG chat from text-only to product-aware responses

**Tech approach:**
- Claude Haiku parses user intent into structured filters (material, price range, style, size)
- Backend queries PostgreSQL with parsed filters
- Claude ranks and explains matches from query results
- Cost: ~$0.002/query (two Haiku calls: parse + rank)

**Files involved:**
- Upgrade existing ai-service chat endpoint
- New backend endpoint for structured watch search with flexible filters
- Frontend: upgrade chat UI to render product cards inline
- Existing: `WatchController` search endpoints, `WatchSpecs` model

**Why this matters (resume):**
- Semantic search, NLP-to-structured-query, retrieval-augmented generation
- Conversational commerce — major ecommerce trend

---

### Story-first Product Pages

AI-generated editorial content that transforms spec sheets into compelling narratives.

**What it does:**
- Adds sections to watch detail page: "Why This Watch Matters", "Collector Appeal", "Design Language", "Best For", "Similar Icons"
- Content generated from specs + brand context, not generic filler

**Tech approach:**
- Claude Haiku generates editorial content per watch (~$0.001/watch)
- Generated once, cached in DB (new column or separate table)
- Triggered manually via admin panel or batch job for all watches

**Files involved:**
- Backend: new model/column for editorial content, generation endpoint
- Frontend: new sections in `frontend/app/watches/[watchId]/page.tsx`
- Existing: `ClaudeApiService.cs` pattern for Haiku calls

---

## Phase 3A: Vector Embeddings + Query Cache (COMPLETE)

### Watch embeddings

pgvector + nomic-embed-text integrated. Embeddings are generated demand-driven (after every search) and stored in `WatchEmbeddings` (4 chunks per watch: `full`, `brand_style`, `specs`, `use_case`). Coverage: **100%** (351/351 watches).

- `WatchEmbedding` model + EF migration + pgvector extension
- `WatchEmbeddingService` — chunk builder + true-batch embedding (50 watches / 200 texts per HTTP call)
- `ai-service` — `POST /embed` endpoint using `nomic-embed-text` (768-dim, batched, same Ollama container, `threaded=True`)
- Fire-and-forget embed after every search result (`WatchFinderService`) and new scrape (`WatchCacheService`). Skips already-embedded watches.
- Admin endpoints: `POST /api/admin/embeddings/generate` (bulk missing), `GET /api/admin/embeddings/status`

### Persistent query cache

Semantic result cache stored in `QueryCaches` table. Every search embeds the query first (~50ms), checks for a similar cached result (cosine similarity ≥ 0.92), and returns instantly on hit. On miss, runs the full pipeline and stores the result for future similar queries.

- `QueryCache` model + EF migration
- `QueryCacheService` — cosine similarity lookup + store + clear
- `WatchFinderService` — embed-first → cache check → pipeline if miss → background cache store
- Admin endpoints: `POST /api/admin/query-cache/seed` (208 pre-defined queries), `GET /api/admin/query-cache/status`, `DELETE /api/admin/query-cache`

**Pre-deploy workflow:** run `POST /api/admin/query-cache/seed` in dev → `pg_dump` both `WatchEmbeddings` and `QueryCaches` → import to production. First user on prod hits a fully warm cache.

**Phase 3B (COMPLETE):** Vector similarity search active. `WatchFinderService` uses hybrid filtering — `ParseQueryIntentAsync` extracts brand/collection/price/diameter/material/movement/WR as hard SQL pre-filters and frontend filter pre-selections (no LLM), cosine similarity ranks within the filtered pool. `QueryIntent` returned to frontend to pre-populate the filter bar. 208 seed queries covering natural-language, spec-based, and complication queries. Category-aware embeddings: `InferCategory` classifies each watch as dress/chronograph/sport/diver from collection name + specs; `InferOccasions` uses category to gate occasion labels (gold chronograph no longer tagged "formal"). BrandSpread applied to vector search candidates for brand diversity. Rerank prompt enhanced with category-matching guidance and collection name. Cache skipped when QueryIntent has hard SQL filters to prevent stale cross-category hits. Result filter bar includes: Brand, Collection, Case Material, Diameter, Movement, Water Resistance, Power Reserve, Complications (12 types: chronograph, perpetual/annual calendar, moonphase, tourbillon, repeater, GMT, flyback, power reserve, alarm, retrograde, equation of time), Price, and Wrist Fit. Wrist fit value persists across back navigation via sessionStorage.

---

## Phase 3: Advanced AI

### Watch DNA / Taste Profile (COMPLETE — Phase 3C)

Registered users describe their watch preferences in plain text (≤50 words). The AI extracts structured signals; those signals drive rule-based scoring that floats preferred watches to the top of the All Watches grid.

**What it does:**
- Free-text textarea on Edit Details page (≤50 words, live word count, hard-coded budget note)
- LLM extracts: preferred brands, materials, dial colors, case size bucket, price range
- Rule-based scoring: +3 brand · +2 material · +2 dial color · +1 case size · +1 price = 9 max
- Matched watches sorted DESC, unmatched tail keeps interleaved-by-brand shuffle
- "Personalized for you" badge in All Watches header when profile is active
- Anonymous visitors see CTA on homepage: "Sign in to personalise your watch feed"
- Zero AI cost at browse time — LLM only called when user saves their taste

**Tech approach:**
- `UserTasteProfile` EF Core entity (JSON arrays as text columns, unique per user)
- `POST /parse-taste` in ai-service — prompt + LLM extraction + JSON response
- `TasteProfileService.ScoreWatch()` pure static method — unit-testable, no DB
- TanStack Query cache invalidated on save → AllWatchesSection re-sorts immediately
- Full spec: `docs/phase3c-watch-dna.md`

---

### AI Discovery Pages (GEO/SEO)

Auto-generated curated pages optimized for both traditional SEO and AI search citation.

**What it does:**
- Pages like: "Best Salmon Dial Watches", "Best Watches for Small Wrists", "Quiet Luxury Dress Watches", "German Alternatives to Rolex"
- Each page: editorial intro + curated watch grid filtered from DB
- Optimized for GEO (Generative Engine Optimization) — structured to be cited by AI search engines

**Tech approach:**
- Define page themes as DB queries (e.g., salmon dial = `dial.color LIKE '%salmon%'`, small wrist = `diameter < 38mm`)
- Claude Haiku generates editorial content per theme (~$0.001/page)
- Next.js SSG (Static Site Generation) for performance and SEO
- Generate once, rebuild periodically or on data changes

**Files involved:**
- New Next.js pages under `frontend/app/discover/[slug]/`
- Backend endpoint to query watches by theme criteria
- Content generation via Claude Haiku
- Sitemap integration for SEO

**Why this matters (resume):**
- GEO is a new and growing trend in ecommerce
- Shows understanding of AI + SEO intersection, programmatic content generation

---

## Phase 4: Polish

### Stripe Checkout (Test Mode)

Full purchase flow using Stripe's test environment — real UX, no actual charges.

**What it does:**
- User proceeds from cart to a checkout page
- Stripe Elements renders the card input form (hosted, PCI-compliant)
- Payment intent created on the backend; confirmed in the browser
- On success: order confirmation page with order summary
- On failure: card error displayed inline, user can retry
- Stripe test cards (e.g. `4242 4242 4242 4242`) exercise the full flow without charging

**Tech approach:**
- Backend: `POST /api/orders` creates a Stripe PaymentIntent and returns `client_secret`
- Frontend: Stripe.js + `@stripe/react-stripe-js` renders `<CardElement>`, calls `stripe.confirmCardPayment(clientSecret)`
- Order saved to DB on webhook confirmation (`payment_intent.succeeded`) — never on client callback alone
- Stripe keys: `STRIPE_SECRET_KEY=sk_test_...` in .NET user-secrets; `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...` in frontend env

**Files involved:**
- Backend: `OrderController`, `StripeService`, new `Orders` and `OrderItems` tables
- Frontend: `app/checkout/page.tsx`, `app/checkout/confirmation/page.tsx`
- Webhook: `POST /api/orders/webhook` — verifies Stripe signature, finalises order

**Why this matters (resume):**
- Payment integration is a core e-commerce skill — Stripe is the industry standard
- Webhook-driven order confirmation demonstrates async event handling and idempotency
- Test mode shows the full flow without real credentials

---

### Save / Build Collection

User-curated watch collections with sharing.

**What it does:**
- Users create named collections: "Dress", "Daily", "Dream Watches", "Under $10k Shortlist"
- Add/remove watches from collections
- Shareable collection links with clean UI

**Tech approach:**
- Pure CRUD — no AI, no API cost
- New `UserCollections` and `CollectionWatches` junction tables
- Standard REST endpoints + frontend UI

**Files involved:**
- New EF Core migration for collection tables
- New controller and service
- Frontend: collection management UI, share page

---

## AI Usage Limits

| Feature | Limit | Notes |
|---|---|---|
| Watch Finder | 5 searches / user / day | Cache hits are free and do not consume quota |
| Watch DNA save | 1 LLM call per save | Rule-based scoring at browse time is free |
| Compare Mode explanation | 10 / user / day | Raw comparison is unlimited |
| Chat Assistant | 20 messages / user / day | Optional feature |
| Story Content | No runtime limit | Pre-generated — zero API cost |
| Discovery Pages | No runtime limit | Static generation — zero API cost |

## Request Flow

```
User request
  ↓
Check cache (key = normalised query string)
  ↓
  HIT  → return cached result       (quota not consumed)
  MISS → check quota
           ↓
         Allowed → call Claude Haiku
                     ↓
                   store in cache
                   consume 1 quota unit
         Denied  → fallback to standard search
```

**Cache key normalisation:**
- Lowercase, strip punctuation, collapse whitespace
- Synonym mapping: RG → rose gold, chrono → chronograph
- Strong normalisation means 100 similar queries may produce 1 API call

---

## Cost Summary

### AI API costs

| Scenario | Queries / month | Est. cost |
|---|---|---|
| 1,000 users × 5 searches | 5,000 | ~$5.00 |
| With 50% cache hit rate | 2,500 API calls | ~$2.50 |
| With 70% cache hit rate | 1,500 API calls | ~$1.50 |
| Story content — one-time, 500 watches | 500 calls | ~$0.50 total |
| Discovery pages — one-time, 30 pages | 30 calls | ~$0.03 total |
| Embeddings (if used) | Local model | $0.00 |

### Infrastructure costs

| Service | Spec | Monthly |
|---|---|---|
| Vercel Hobby | Next.js frontend, CDN, SSL | $0.00 |
| EC2 t3.micro (year 1, free tier) | 2 vCPU 1GB — .NET + Flask | $0.00 |
| EC2 t3.micro (after free tier) | same | ~$7.59 |
| EC2 t3.small (upgrade if needed) | 2 vCPU 2GB | ~$15.00 |
| RDS db.t3.micro (free tier, year 1) | PostgreSQL 20GB Single-AZ | $0.00 |
| RDS db.t3.micro (after free tier) | Same spec on-demand | ~$22.00 |
| S3 Standard | ~5GB watch images | ~$0.12 |
| CloudFront Free plan | 100GB/mo egress, WAF, SSL | $0.00 |
| Domain | .com annualised | ~$1.00 |

**Year 1 (free tier active): ~$3–6/month** · **After free tier: ~$40–45/month**

Cost reduction option: run PostgreSQL directly on EC2 instead of RDS. Drops post-free-tier cost to ~$18/month.

**EC2 t3.micro memory:** Without Selenium (scraping complete), idle footprint is ~560MB, leaving ~440MB headroom on the 1GB instance. Rate-limited AI features protect against concurrent-request spikes. If memory consistently exceeds 800MB under real traffic, upgrade to t3.small (~$15/month).

## Pre-generation Jobs

Story Content and Discovery Pages are generated offline — never triggered at runtime by user requests.

```bash
# Run locally or as a one-time admin job
# Results stored in PostgreSQL, served as static data
python generate_story_content.py    # ~$0.50 total for all watches
python generate_discovery_pages.py  # ~$0.02 total for all themes
```

**Do not run batch generation jobs on the production EC2 t3.micro instance.** This is the primary scenario that would push the instance past safe memory limits. Run generation locally or trigger via a scheduled job outside of peak traffic.

---

## Resume Keywords Covered

AI/LLM integration, semantic search, recommendation systems, personalization engine, conversational commerce, retrieval-augmented generation (RAG), GEO/SEO optimization, programmatic content generation, full-stack implementation, rule-based scoring systems, NLP-to-SQL query pipeline, cost engineering (quota limits, cache strategy, pre-generation).
