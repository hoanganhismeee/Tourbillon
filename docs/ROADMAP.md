# Tourbillon AI Feature Roadmap

## Status Overview

| Feature | Status | Phase |
|---|---|---|
| Products | Done | 1 |
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
| Story-first Product Pages (editorial seeded 174/174, admin inline editor) | Done | 2 |
| Watch DNA / Taste Profile (manual text input) | Done | 3C |
| Watch DNA — Behavioural Tracking (anonymous + authenticated, AI generation, account-boundary merge rules) | Done | 3C |
| Google OAuth + Email Magic Login (passwordless OTP) | Done | 3C |
| Post-login redirect — magic link and Google OAuth paths | Done | 3C |
| Role-Based Access Control (admin seeding, scrape page guard, nav link) | Done | 3.5 |
| AI Discovery Pages (GEO/SEO) | Removed | — |
| Homepage Cinematic Video Hero | Done | 3.5 |
| Stripe Checkout (Test Mode) | Removed | — |
| Contact Advisor/ Book an Appointment (PoR Inquiry) | Done | 4 |
| Chat Concierge — floating widget + product comparison RAG | Done | 5 |
| Chat Concierge — limited web enrichment + brand knowledge answers | Done | 5 |
| Brand & Collection Embeddings | Removed | — |
| Retrieval Quality Audit (chunk enrichment, vector ordering, index fix) | Done | 5 |
| Favourites & Collections | Done | 6 |
| CI/CD Pipeline (GitHub Actions, automated quality gates) | Done | 7 |
| Durable Background Jobs (Hangfire, retry, monitoring dashboard) | Done | 7.5 |
| Redis (distributed cache, rate limiting, session storage) | Done | 7.5 |
| Observability (Serilog structured logging, ASP.NET health checks) | Done | 8 |
| Advisor CRM + Inquiry Pipeline (user inquiry page, Hangfire status auto-advance) | Done | 8.5 |
| Chat Concierge — grounding, safety & editorial enrichment | Done | 9 |
| Slug-based URLs + Cloudinary public ID sync | In Progress | 9 |
| 10A Smooth Scroll (Lenis) | Done | 10 |
| 10B shadcn/ui Integration | Done | 10 |
| 10C Homepage Cinematic Scroll (GSAP) | Done | 10 |
| 10D Watch Card Near-3D Tilt + Shimmer | Done | 10 |
| 10E Watch Detail: Video Gallery + Spec Reveal | Planned | 10 |
| 10F Nav Scroll-Response + Transitions + Grain | Done | 10 |
| 11 Smart Search (AI Watch Finder) refinement | Done | 11 |
| 11 User (Auth/Anonymous Taste Profile logic improvement) | Done | 11 |
| 12 Trend Page Enhancements (product trends, staff pick, most viewed over 7/14/30 days, user DNA) | Done | 12 |
| 13 Chat Concierge integration with core product features (Compare, Cursor, grounded actions) | Done | 13 |
| Chat Concierge Reliability Refactor (backend orchestration + typed compose contract) | Done | 13.5 |
| AI Intent Classifier (POST /classify replaces 9 regex routing predicates; "unclear" falls back to regex) | Done | 14 |
| Storage Abstraction + S3 + CloudFront Migration | Planned | 15 |
| Kubernetes (container orchestration, HPA, rolling deployments) | Planned | ? |

## Model Strategy

| Environment | Model | Cost | Usage |
|---|---|---|---|
| Production | Claude Haiku 4.5-20251001 | $0.25/1M input · $1.25/1M output | Intent parsing, ranking explanation, content generation |
| Local dev (default) | Qwen 2.5 7B (Ollama, inside ai-service container) | $0.00 | Prompt testing, API simulation, offline development |
| Editorial seeding only | gemma2:9b | $0.00 | One-time editorial content generation (`make seed-editorial`) |

**Why Qwen locally:** Free and runs fully offline — adequate for testing pipeline plumbing and API contracts. Qwen lacks watch domain knowledge, so style-ambiguous queries ("ladies watch", "pilot aesthetic") return weaker results locally. This is expected. `ParseQueryIntentAsync` handles all explicit terms (brand, price, material, complications) via regex + DB lookups — no model involved, same result regardless of LLM. Haiku in production handles remaining style/occasion ambiguity without prompt-level category definitions.

**Editorial seeding:** `make seed-editorial` temporarily swaps the ai-service container to gemma2:9b (better long-form generation at 1200 tokens), seeds all collections, then restores qwen2.5:7b. Run once before deploy; results are stored in DB and served at zero AI cost at runtime.

**Environment switching — single env var, no code change:**

```
LLM_BASE_URL=http://localhost:11434/v1   # local
LLM_BASE_URL=https://api.anthropic.com/v1  # production
LLM_MODEL=qwen2.5:7b                       # local
LLM_MODEL=claude-haiku-4-5-20251001        # production
```

**Production activation — docker-compose env vars (ai-service only, no code changes required):**
```yaml
ai-service:
  environment:
    LLM_BASE_URL: https://api.anthropic.com/v1
    LLM_MODEL: claude-haiku-4-5-20251001
    LLM_API_KEY: ${ANTHROPIC_API_KEY}
```
The warmup in `app.py` auto-detects non-Ollama URLs and skips model pull. No other changes needed.

**When switching to Haiku — one prompt cleanup:**
`ai-service/app.py` lines 171–175 contain hardcoded dress/sport/diver/chronograph narrative guidance for the reranker. These become redundant once Haiku handles them natively — remove after confirming correct scores in staging. Keep all scoring thresholds (`score 80+`). Do NOT remove `PARSE_SYSTEM_PROMPT` category lists (occasion, material, strap, etc.) — they constrain structured JSON output format and are model-agnostic.

**Chat concierge prompt (`CHAT_SYSTEM_PROMPT`) — written for Haiku:**
Style rules, word cap (130 words), and link format are expressed as plain instructions that Claude follows natively — no hardcoded narrative, no model-specific training. A server-side `_truncate_chat_response()` in `/chat` enforces the cap as a safety net for any model that overshoots. Do not add enumeration-heavy guidance; prose instructions are intentional and model-agnostic.

**`Collection.Style` DB column:** SQL pre-filter for query speed — not a knowledge proxy. Keep regardless of model.

**Scraping dead code:** `backend/Services/ClaudeApiService.cs` was unused — scraping complete. Deleted. The ai-service `LLM_API_KEY` is independent and must be provisioned at deploy time.

---

## AI Usage by Feature

### Must use AI

- **Watch Finder + Concierge** — intent parsing (NL → structured filters) + result ranking + explanation
- **Story-first Product Pages** — editorial content generation per watch (generated once, stored in DB)
- **Story-first Product Pages** — editorial content per collection (generated once, stored in DB, served at zero cost)
- **Chat Assistant** — conversational responses, product-aware answers

### Should use AI

- **Compare Mode** — backend handles the spec diff (SQL); AI generates the wearability and brand-character explanation
- **Watch DNA / Taste Profile** — LLM synthesises browsing events into structured preferences + summary once on generate; rule-based scoring at browse time (zero AI cost)

### Never use AI

- Filtering and sorting (SQL)
- Wrist-fit calculation (pure arithmetic)
- Category/style classification (deterministic `InferCategory()`)
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
- Local Ollama (gemma2:9b) generates editorial per collection — one record shared by all watches in that collection via `WatchEditorialLink`
- Generated once via `make seed-editorial`, stored in `WatchEditorialContent` table, zero AI cost at runtime
- Admin can manually override any watch's editorial inline from the scrape page (`PUT /api/admin/editorial/{watchId}`)
- Coverage: 339/339 watches seeded

**Files involved:**
- Backend: `WatchEditorialContent`, `WatchEditorialLink` models; `WatchEditorialService`; `PUT /api/admin/editorial/{watchId}`
- Frontend: editorial sections in `frontend/app/watches/[watchId]/page.tsx`; inline editor in `frontend/app/scrape/page.tsx`
- Seeding: `make seed-editorial` (swaps to gemma2:9b, seeds, restores qwen)

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

**Phase 3B (COMPLETE):** Vector similarity search active. `WatchFinderService` uses hybrid filtering — `ParseQueryIntentAsync` extracts brand/collection/price/diameter/material/movement/WR as hard SQL pre-filters and frontend filter pre-selections (no LLM), cosine similarity ranks within the filtered pool. `QueryIntent` returned to frontend to pre-populate the filter bar. 208 seed queries covering natural-language, spec-based, and complication queries. Category-aware embeddings: `InferCategory` classifies each watch as dress/chronograph/sport/diver from collection name + specs; `InferOccasions` uses category to gate occasion labels (gold chronograph no longer tagged "formal"). Vector results preserve cosine-distance relevance ordering (BrandSpread removed from vector path — retained only for Phase 2 SQL fallback). Chunk text enriched with watch-specific differentiators: `brand_style` includes dial finish, indices, hands, caliber, case back, production status; `use_case` includes diameter, material, WR, movement type, and non-trivial complications. Unique index expanded to `(WatchId, ChunkType, Feature)` for multi-feature support. Rerank prompt enhanced with category-matching guidance and collection name. Cache skipped when QueryIntent has hard SQL filters to prevent stale cross-category hits. Result filter bar includes: Brand, Collection, Case Material, Diameter, Movement, Water Resistance, Power Reserve, Complications (12 types: chronograph, perpetual/annual calendar, moonphase, tourbillon, repeater, GMT, flyback, power reserve, alarm, retrograde, equation of time), Price, and Wrist Fit. Wrist fit value persists across back navigation via sessionStorage.

---

## Phase 3: Advanced AI

### Watch DNA / Taste Profile (COMPLETE — Phase 3C)

A long-term taste fingerprint built silently from browsing behaviour. Distinct from Smart Search (explicit one-time intent); Watch DNA is implicit and accumulates over time.

**What it does:**
- Tracks watch views, brand/collection page visits, and smart searches — anonymously from the very first page view
- Existing-account sign-ins merge the current anonymous browser history into that same account; newly created accounts start with a clean Watch DNA
- AI synthesises ≥ 3 events into structured preferences + a plain-English summary sentence
- Edit Details page shows the AI-generated summary + preference chips (brands, materials, dial colours, price range, case size)
- "Regenerate" button triggers fresh AI generation; "Edit manually" falls back to the original textarea override
- Rule-based scoring floats preferred watches to the top of every listing: +3 brand · +2 material · +2 dial color · +1 case size · +1 price = 9 max
- "Personalized for you" badge in All Watches header when profile is active
- Zero AI cost at browse time — LLM called only on generate/save

**Tech approach:**
- Client: `frontend/lib/behaviorTracker.ts` — rolling 100-event buffer in `tourbillon-behavior` localStorage, persistent `tourbillon-anon-id` UUID, SSR-safe (all access in try/catch). Existing-account sign-ins flush + merge through `AuthContext`; new-account completions and logout reset anonymous tracking instead.
- Backend: `UserBrowsingEvent` model + `BehaviorService` (flush with time-window dedup, merge, query). `BehaviorController`: `POST /api/behavior/events` (no auth), `POST /api/behavior/merge` ([Authorize]).
- AI: `POST /generate-dna-from-behavior` in ai-service — infers taste from event frequency (most-viewed brand = stronger signal). Returns same structure as `/parse-taste` plus `summary` field.
- `TasteProfileService.GenerateFromBehaviorAsync` — requires ≥ 3 events, returns existing profile if insufficient.
- `TasteProfileService.ScoreWatch()` pure static method — unit-testable, no DB.
- Automated coverage validates thresholds, cooldowns, payload shape, auth-boundary rules, and persistence. It does not certify that the final AI-written summary is semantically correct for every real browsing pattern.
- TanStack Query cache invalidated on generate/save → AllWatchesSection re-sorts immediately.
- Full original spec: `docs/phase3c-watch-dna.md`

---

### AI Discovery Pages (GEO/SEO) — REMOVED

Removed in favour of a cinematic video hero homepage. The discovery theme approach was redundant with the existing smart search + watch listing page.

---

### Homepage Cinematic Video Hero (COMPLETE)

Full-screen `tourbillon.mp4` fills the first viewport on the homepage. Scrolling down reveals the existing headline + AI search bar. Provides a strong brand statement for new visitors without blocking returning users.

**Files involved:**
- `frontend/app/components/sections/VideoSection.tsx` — full-screen video component with bottom gradient fade and scroll hint
- `frontend/app/page.tsx` — VideoSection above existing hero+search section

---

## Phase 4: Commerce + Contact (COMPLETE)

### Stripe Checkout — Test Mode

Full purchase flow using Stripe's test environment — real UX, no actual charges. Supports both **authenticated** and **guest** checkout.

**What it does:**
- "Add to Cart" button on priced watches (`CurrentPrice > 0`); PoR watches excluded
- Zustand cart store persisted to localStorage (survives reloads, SSR-safe via `skipHydration`)
- Cart page with Framer Motion add/remove animations, order summary sidebar
- Two-phase checkout: (1) shipping form (pre-filled from profile for signed-in users, manual entry for guests) → (2) Stripe `CardElement` payment
- Webhook-driven order confirmation — order status set by server on `payment_intent.succeeded`, never by client callback
- Confirmation page polls order status every 2s until webhook confirms; animated checkmark on success
- Cart badge on NavBar with live item count

**Tech approach:**
- Backend: `POST /api/order` creates `Order` entity (Pending) + Stripe `PaymentIntent`, returns `clientSecret`
- Frontend: `@stripe/react-stripe-js` `<CardElement>` calls `stripe.confirmCardPayment(clientSecret)`
- Webhook: `POST /api/order/webhook` — verifies Stripe signature, handles 3 events:
  - `payment_intent.succeeded` → order confirmed (idempotent)
  - `payment_intent.payment_failed` → order marked failed
  - `payment_intent.canceled` → order marked failed
- `Order.UserId` is nullable — guest checkout creates orders without a user account
- Watch prices and details snapshotted into `OrderItem` at purchase time (immune to later price changes or watch edits)
- Shipping address snapshotted into `Order` (not FK to user profile)
- Stripe keys: `Stripe:SecretKey` + `Stripe:WebhookSecret` in .NET user-secrets; `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` in frontend env

**Files involved:**
- Backend: `Order.cs`, `OrderItem.cs`, `OrderStatus.cs` (models); `StripeService`, `OrderService` (services); `OrderController`; EF Core migration
- Frontend: `stores/cartStore.ts`, `providers/StripeProvider.tsx`, `app/cart/page.tsx`, `app/checkout/page.tsx`, `app/checkout/CheckoutForm.tsx`, `app/checkout/confirmation/page.tsx`

**Why this matters (resume):**
- **Payment integration** — Stripe is the industry standard; PaymentIntent API with webhook-driven confirmation is the production-grade pattern
- **Async event handling** — webhook idempotency (same event delivered twice = no-op), signature verification for security
- **Guest checkout architecture** — nullable FK pattern, dual-path order creation without code duplication
- **State management** — Zustand with localStorage persistence + SSR hydration guard (same pattern used in compare feature)
- **UX polish** — two-phase checkout with real-time validation, Framer Motion transitions, responsive cart layout

---

### Contact Advisor (PoR Inquiry)

Inquiry flow for "Price on Request" watches — requires authentication, sends dual emails (user confirmation + admin notification).

**What it does:**
- "Contact Advisor" button on PoR watches (`CurrentPrice = 0`) as primary action; also available as secondary action on priced watches
- Clicking navigates to `/contact?watchId=X`; if not authenticated, redirects to `/login?redirect=/contact?watchId=X` then returns seamlessly after login
- Watch-specific inquiry shows watch card preview (image, name, reference, price)
- General inquiry mode (`/contact` without watchId) also supported
- Free-text message textarea (max 2000 chars)
- On send: user receives confirmation email ("Inquiry Received"), admin receives notification email ("New Advisor Inquiry")
- Both emails use the Tourbillon email theme (gold `#bfa68a` on cream `#f0e6d2`)
- Inquiry persisted to `ContactInquiries` table regardless of email delivery success

**Tech approach:**
- Backend: `POST /api/contact/inquiry` (requires `[Authorize]`) → `ContactInquiryService` saves record + fires emails via existing `IEmailService`
- Emails sent fire-and-forget after DB save — user gets instant response even if SMTP is slow
- Admin email destination: `AdminSettings:SeedAdminEmail` from config
- Inquiry snapshots user name/email and watch name/reference for audit trail

**Files involved:**
- Backend: `ContactInquiry.cs` (model); `ContactInquiryService` (service); `ContactController`
- Frontend: `app/contact/page.tsx` (replaced stub)

**Why this matters (resume):**
- **Auth-gated UX flow** — redirect-to-login with seamless return via query params
- **Transactional email** — dual-recipient notification pattern with HTML templates, fire-and-forget for resilience
- **Data snapshot pattern** — inquiry records are self-contained (no broken references if user or watch changes later)

---

## Phase 5: Social

### RAG Chat Concierge (COMPLETE)

Floating conversational assistant available on every page — handles both specific watch comparisons and brand knowledge questions. Distinct from Watch Finder (discovery from vague intent → grid); this is informed conversation about specific watches, brands, or collections.

**What it does:**
- Floating pill at bottom-right on all pages; panel slides up on click
- Product comparison: "I like the Overseas and the Aquanaut, I go to the beach, which should I choose?" → specs analysis + recommendation + watch thumbnail cards
- Brand knowledge: "Tell me about Vacheron's history" → catalogue context + limited secondary web notes blended into a narrative with brand page link
- Conversation-aware: follow-ups reference earlier turns in session; state survives in-app navigation (layout.tsx mount, never unmounted on soft nav)

**Architecture — reuses Phase 3 infrastructure:**
- `ChatService` owns concierge orchestration and assembles grounded context before any wording call
- `WatchFinderService` remains the source of truth for search intent and catalogue retrieval
- Compare, exact-watch, follow-up, and revision paths are backend-resolved before the frontend sees the reply
- `ai-service /chat` writes concierge copy for the resolved context; Phase 13.5 removed the remaining legacy dependence on model-emitted action strings
- `QueryCacheService` caches first-turn (history-free) responses at cosine ≥ 0.92 — not applied to multi-turn
- Rate limit: 5/day deployed (`ChatSettings:DailyLimit`); `DisableLimitInDev: true` for local

**Infrastructure:**
- Redis-backed session store for chat history, compare scope, follow-up mode, and surfaced cards
- `POST /chat` endpoint in ai-service — Tourbillon-first response generation with optional limited brand-history web notes
- Pill UI matches `CompareIndicator` design; chat pill `bottom-8`, compare pill moves to `bottom-24`
- Brand/collection detection uses direct DB substring matching — no dedicated embeddings needed for a 13-brand catalogue

**Full spec:** `docs/phase5-rag-chatbot.md`

**Files involved:**
- `ai-service/routes/chat.py`, `ai-service/prompts/chat.py` — `POST /chat`, response-language enforcement, grounded wording, and limited brand-history web enrichment
- `ai-service/requirements.txt` — `duckduckgo-search`
- `backend/Controllers/ChatController.cs` — `POST /api/chat/message`, `DELETE /api/chat/session/{id}`
- `backend/Services/ChatService.cs` — concierge orchestration and backend-issued action generation
- `frontend/app/components/chat/ChatWidget.tsx`, `ChatPanel.tsx`
- `frontend/app/layout.tsx` — mount ChatWidget
- `frontend/lib/api.ts` — `sendChatMessage()`, `clearChatSession()`

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

## Phase 5.5: Favourites & Collections (IN PROGRESS)

### Favourites & Collections

Spotify-style save-to-favourites and named user collections for authenticated users.

**What it does:**
- Heart icon in navbar links to `/favourites` page (replaces non-functional cart icon placeholder)
- Heart toggle on every watch card — fills gold when the watch is saved anywhere (Favourites or any collection)
- Clicking the heart opens a portal popup: one-tap toggle for Favourites + named collection rows with tick indicators
- Create new named collections inline from the popup (no separate page needed)
- `/favourites` page shows all saved watches in the SmartSearch grid layout with a horizontal collections row above
- Filter grid by one or more collections; sort by Recently Saved, Brand A–Z, Price High–Low, Price Low–High
- Collection labels shown as small pills on watch cards on the `/favourites` page

**Tech approach:**
- Pure CRUD — no AI, no API cost
- Three new EF Core tables: `UserFavourites` (composite PK), `UserCollections`, `UserCollectionWatches` (junction)
- `FavouritesService` / `FavouritesController` — eight REST endpoints covering state, favourites, collections, and membership
- Zustand store (`favouritesStore`) without localStorage persist — server-side state, auth-gated, reset on logout
- Optimistic UI: snapshot → apply locally → await API → revert on error
- Portal popup (`SaveToCollectionPopup`) positioned via `getBoundingClientRect`, Framer Motion animation, click-outside + Escape close

**Services and controllers:**
- `FavouritesService`, `FavouritesController`
- `favouritesStore` (Zustand), `FavouriteToggle`, `SaveToCollectionPopup`

---

## AI Usage Limits

| Feature | Limit | Notes |
|---|---|---|
| Watch Finder | 5 searches / user / day | Cache hits are free and do not consume quota |
| Watch DNA save | 1 LLM call per save | Rule-based scoring at browse time is free |
| Compare Mode explanation | 10 / user / day | Raw comparison is unlimited |
| Chat Concierge | 5 / user / day (deployed); unlimited (local, env-gated) | Separate quota from Watch Finder |
| Story Content | No runtime limit | Pre-generated — zero API cost |
| Discovery Pages | No runtime limit | Static generation — zero API cost |

## Request Flow

```
User query
  ↓
ParseQueryIntentAsync — regex + DB lookup → brand/collection/price hard filters (no LLM, ~5ms)
  ↓
Embed query — nomic-embed-text → float[768] (~50ms)
  ↓
QueryCaches — cosine similarity >= 0.92
  ├─ HIT  → return cached result                   (quota not consumed, <200ms)
  └─ MISS → check quota
              ↓
            Allowed → vector search + tier routing + optional LLM rerank
                        ↓
                      [Background] store in QueryCaches
                      consume 1 quota unit
            Denied  → fallback to standard search (no AI)
```

**Cache bypass:** When hard SQL filters are detected (brand, collection, price), cache is skipped to prevent stale cross-category hits.

**Semantic matching:** Cache uses vector similarity (cosine >= 0.92), not string normalisation. "dress watch" and "dress watches" match (~0.96); "dress watch" and "dive watch" do not (~0.7).

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

## Retrieval Quality Audit (COMPLETE — Phase 5)

Technical audit of the AI retrieval system identified and fixed issues across Smart Search, Chat Concierge, and the embedding infrastructure. Full details in `docs/AI_PLAN.md` section 11.

**Bugs fixed:**
- Chat GENERAL queries returned empty context (`Feature == "rag_chat"` had zero rows) — changed to `watch_finder`
- BrandSpread destroyed vector relevance ordering in Tier 2 — removed from vector path
- Unique index `(WatchId, ChunkType)` blocked multi-feature embeddings — expanded to include `Feature`
- `use_case` and `brand_style` chunks near-identical within collections — enriched with 11 additional watch-specific fields

**Concerns dismissed:**
- 0.92 threshold is correctly scoped to `QueryCacheService` only (not confused with `WatchEmbeddings`)
- Watch DNA / Taste Profile does not use embeddings (100% rule-based scoring)

**Design principle established:** Deterministic category taxonomy (`InferCategory`, `InferOccasions`, `Collection.Style`) is permanent structured metadata. The LLM interprets and ranks on top — it never owns the ground truth.

**Related docs:**
- `docs/AI_PLAN.md` — full AI architecture and audit record
- `docs/AI_CONCEPTS.md` — plain-language reference for embedding, semantic search, and vector concepts

---

## Phase 7: Infrastructure & Operational Maturity

Upgrades the project from "works locally" to "production-grade system." Each milestone adds a distinct engineering skill. Full concept explanations in `docs/infra-concepts.md`.

### CI/CD Pipeline (COMPLETE)

GitHub Actions workflow (`.github/workflows/ci.yml`) runs on every push and PR to main. Two parallel jobs:
- **Backend**: .NET 8 restore + build (Release) + 25 xUnit tests
- **Frontend**: Node 20 install + TypeScript type-check (`tsc --noEmit`)

Branch protection rules can be configured to block merging until CI passes.

### Durable Background Jobs (Hangfire) (COMPLETE)

Replaces 8 `_ = Task.Run()` fire-and-forget patterns with durable, retryable jobs stored in PostgreSQL. Automatic retry with exponential backoff (10 attempts). Dashboard at `/hangfire` (open in Development, Admin-only in Production).

- `BackgroundEmailService` — wraps `IEmailService`, throws on failure for Hangfire retry. Used by Contact, Appointment, RegisterInterest (2 jobs each).
- Embedding jobs: `WatchFinderService`, `WatchCacheService` → `WatchEmbeddingService.GenerateBulkAsync`
- Cache store: `WatchFinderService` → `QueryCacheService.StoreAsync`
- Editorial embedding: `WatchEditorialService` → `WatchEmbeddingService.GenerateEditorialChunksAsync`
- Editorial seeding: `AdminController` → `WatchEditorialService.SeedAllAsync`
- `IServiceScopeFactory` removed from `WatchFinderService`, `WatchCacheService`, `WatchEditorialService` — Hangfire manages its own scope.
- `HangfireDashboardAuthFilter` in `backend/Infrastructure/`

### Redis: Distributed State (COMPLETE)

Replaces four in-memory patterns that break on restart:
- Auth codes: `MagicLoginService`, `PasswordResetService` → Redis string keys with TTL (10 min / 30 s)
- Rate limiting: `PasswordChangeRateLimitService`, `ChatService` → Redis atomic INCR counters with TTL
- Chat sessions: `ConcurrentDictionary<string, ChatSession>` singleton → Redis hashes (`chat:session:{id}`) with 1-hour auto-expiry

`IRedisService` / `RedisService` wrap `IConnectionMultiplexer` for testable atomic operations. `redis:7-alpine` service added to `docker-compose.yml` with health check and `redis_data` volume. Backend reads `Redis:ConnectionString` from config (default `localhost:6379`; overridden by `Redis__ConnectionString` env var in Docker).

### Observability

- **Serilog** structured logging → JSON output, rolling file sink, request enrichment
- **ASP.NET health checks** → `/health/ready` (checks PostgreSQL + Redis + AI service), `/health/live` (liveness probe)
- **Metrics** — search tier distribution, cache hit rate, AI service latency, email delivery rate

### Advisor CRM + Inquiry Pipeline

Extends Contact Advisor, Register Interest, and Appointment from one-shot submissions into a unified CRM with:
- Status pipeline: `New → Contacted → In Progress → Closed (Won/Lost/No Response)`
- Advisor notes per inquiry
- Follow-up reminders via Hangfire scheduled jobs
- Unified admin view at `/admin/crm` across all inquiry types

### Chat Concierge Hardening (COMPLETE)

Hardens the chat concierge to be a specialist watch advisor — grounded in Tourbillon's catalogue, resistant to misuse, and enriched with editorial knowledge.

**What it does:**
- System prompt rewritten with 5 hardening layers: scope, grounding, safety, prompt injection resistance, consistency
- AI prioritises Tourbillon catalogue data + navigable pill links, then supplements with limited web notes only for approved brand-history questions
- Editorial content (WhyItMatters, BestFor) now injected into chat context — AI has access to rich horological knowledge already in the DB
- Empty-context fallback: when vector search returns no matches, AI is told explicitly (prevents hallucination)
- Collection.Style labels included in context for deterministic category awareness
- Redis-backed session state keeps the last surfaced cards, compare scope, and follow-up mode so replies like `yes`, ordinal references, and short entity repeats continue from the prior turn
- Chat actions now execute compare, cursor, and navigate actions directly, and Smart Search actions are rewritten into canonical catalogue terms instead of echoing raw conversational phrasing. Phase 13.5 moved all core action ownership fully into backend orchestration.
- Frontend passes a preferred-language hint so English prompts stop drifting into another language, and the ai-service retries when the draft response does not match the requested language

**Hardening layers:**
1. **Scope** — watches, horology, and Tourbillon topics only; polite redirect for off-topic
2. **Grounding** — prioritise provided context, cite specific watches/collections, admit when data is missing
3. **Anti-hallucination** — never invent specs, prices, or availability; use limited brand-history web notes only as secondary context
4. **Prompt injection resistance** — ignore role-change and system-prompt-reveal attempts
5. **Harassment refusal** — single polite redirect, no engagement with abuse
6. **Consistency** — always "Tourbillon", spec-based reasoning over adjectives

**Files involved:**
- `ai-service/routes/chat.py`, `ai-service/prompts/chat.py` — chat prompt, response-language checks, limited web enrichment
- `backend/Services/ChatService.cs` — editorial context injection, empty-context fallback, response-language + action controls
- `frontend/contexts/ChatContext.tsx`, `frontend/app/components/chat/ChatPanel.tsx` — preferred language hinting and direct action execution

### Concierge QA Loop (APRIL 13, 2026)

The concierge hardening pass was re-run as a full loop against the live local stack (`make back`, direct `POST /api/chat/message` probes, then Playwright on `http://localhost:3000`).

**Bugs reproduced and fixed:**
- `navigate` chips were echoing their label back into chat instead of routing the app
- English prompts could drift into another language under the local Qwen setup
- "browse the web" brand-history prompts were misrouted into catalogue search and compare actions
- Watch ordering relied on scattered hardcoded policy rules and ignored one-sided price preferences

**Post-fix checks:**
- `browse the web for Vacheron Constantin history` now stays in English and returns navigate-only actions
- `show me some reversos` stays in English and still returns catalogue discovery actions
- Playwright confirmed `Explore the Calatrava collection` routes to `/collections/patek-philippe-calatrava`
- Playwright confirmed `Compare these watches` routes to `/compare`
- Backend build, backend tests, and frontend type-check all pass

### Phase 13.5: Chat Concierge Reliability Refactor (COMPLETE)

Addressed the main reliability gap in the concierge: overlapping decision-makers across `ChatService`, ai-service chat composition, and `WatchFinderService`.

**What changed:**
- Backend is the single orchestration authority for concierge behavior
- `WatchFinderService` remains the source of truth for search intent and catalogue retrieval
- `ChatService` classifies routes (search, compare, entity info, continuation, revision, general advice) before any wording call
- Backend builds all watch cards and compare/search/navigate/cursor actions before the frontend sees the reply
- `ai-service /chat` is the wording layer only — system prompt forbids action emission; endpoint returns empty actions list

**What was removed:**
- `_extract_actions()` and `_filter_actions()` removed from `ai-service/routes/chat.py`
- `MergeActions()` and `AllowAiActions` removed from `backend/Services/ChatService.cs`
- `CallAiServiceAsync` now returns a plain `string` instead of `(string, List<ChatAction>)`
- `allowActions` field removed from ai-service request payload
- Full `ACTIONS:` format replaced in system prompt with a 3-line no-emit rule

**Post-fix checks:**
- Backend build, 2184 backend tests, and 9 Python tests all pass
- New test `HandleMessageAsync_DiscoveryIgnoresAiReturnedActions` verifies AI-returned action payloads are fully ignored
- `HandleMessageAsync_MessyRecommendation_RewritesSearchActionIntoCanonicalTerms` confirms backend-generated search action uses canonical terms, not user's raw phrasing

### Slug-Based URLs + Cloudinary Public ID Sync (IN PROGRESS)

Replaces sequential database IDs in URLs (`/watches/42`) with human-readable slugs (`/watches/patek-philippe-nautilus-5811-1g-blue-dial`). Hides DB structure, improves SEO, matches industry standard (Chrono24, Hodinkee).

**What it does:**
- `Slug` column added to Watch, Brand, Collection models with unique indexes
- Slugs auto-generated on startup from `Brand.Name + Collection.Name + Watch.Name`
- All public-facing API endpoints and frontend routes use slugs
- Admin/internal endpoints stay numeric
- Chat concierge link format updated to use slugs in context and prompt
- Cloudinary public IDs re-synced with current watch names via existing `NormalizeImageNames` endpoint

**Slug format:**
- Brand: `patek-philippe`
- Collection: `patek-philippe-nautilus` (brand-prefixed to prevent collisions)
- Watch: `patek-philippe-nautilus-5811-1g-blue-dial`

**Files involved:**
- `backend/Models/Watch.cs`, `Brand.cs`, `Collection.cs` — Slug property
- `backend/Helpers/SlugHelper.cs` — slug generation utility
- `backend/Database/DbInitializer.cs` — EnsureSlugsPopulated on startup
- `backend/Controllers/WatchController.cs`, `BrandController.cs`, `CollectionController.cs` — slug endpoints
- `backend/Services/ChatService.cs` — context strings with slugs
- `frontend/lib/api.ts` — slug-based fetch functions
- `frontend/app/watches/[slug]/`, `brands/[slug]/`, `collections/[slug]/` — renamed route folders
- `ai-service/app.py` — CHAT_SYSTEM_PROMPT and `_inject_entity_links` use slugs

### Phase 11: Smart Search Analytics Dashboard

Phase 11 is already owned by Smart Search work. The next implementation pass around search should focus on measurement and recommendation visibility rather than infrastructure.

- Search queries with routing path, tier, result count, zero-result rate, and click-through
- Cache hit rate over time and deterministic-vs-semantic routing split
- Popular watches driven by search, favourites, and compare interactions
- Admin dashboard at `/admin/analytics` with Recharts visualizations

### Phase 12: Trend Page Enhancements

Extend `/trend` beyond Watch DNA into a live product-signals surface using the browsing and engagement data the platform already collects.

- Show most viewed watches for the last 7, 14, and 30 days
- Add product trend modules that surface rising watches and recent interest shifts
- Reuse `UserBrowsingEvent` and related engagement data instead of introducing a parallel tracking system
- Keep Watch DNA as the anchor, then layer product-trend sections around it

### Phase 13: Storage Abstraction + S3 + CloudFront

Generic `IStorageService` interface with `CloudinaryStorageService` and `S3StorageService` implementations. Swappable via configuration. S3 bucket for image storage, CloudFront CDN for global delivery with 30-day edge caching.

### Phase 14: Kubernetes (Optional)

Convert Docker Compose to K8s manifests: Deployment, Service, Ingress, ConfigMap, Secret, HPA. StatefulSet for PostgreSQL. Rolling deployments with zero downtime. Honest note: overkill for single-instance deployment — value is resume/learning, not operational necessity.

---

## Resume Keywords Covered

AI/LLM integration, semantic search, vector embeddings (pgvector, HNSW indexing), recommendation systems, personalization engine, conversational commerce, retrieval-augmented generation (RAG), hybrid SQL + vector search, tiered retrieval routing, embedding quality auditing, programmatic content generation, full-stack implementation, rule-based scoring systems, NLP-to-SQL query pipeline, cost engineering (quota limits, semantic cache strategy, pre-generation), transactional email (dual-recipient notification), client-side state management (Zustand + localStorage persistence), SSR hydration strategies, responsive UI with motion design (Framer Motion), async event-driven architecture, durable background job processing (Hangfire, retry with exponential backoff), Redis (distributed caching, rate limiting, session storage), CI/CD pipeline (GitHub Actions, automated quality gates), structured logging (Serilog), health check probes, observability and operational metrics, CRM pipeline (status workflow, follow-up scheduling), search analytics (tier distribution, cache hit rate, click-through tracking), AWS S3 + CloudFront (storage abstraction, CDN), Kubernetes (container orchestration, HPA auto-scaling, rolling deployments), Docker Compose multi-service orchestration, LLM prompt hardening (grounding, scope guardrails, anti-hallucination, prompt injection resistance).
