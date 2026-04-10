# Tourbillon Architecture

Current system architecture as of March 2026. This document exists to provide context for AI assistants and contributors without needing to explore the full codebase.

## System Overview

```
                         +------------------+
                         |    Frontend      |
                         |   Next.js 15     |
                         |   :3000          |
                         +--------+---------+
                                  | HTTP (proxy routes + direct)
                         +--------v---------+
                         |    Backend       |
                         |   .NET 8 API    |
                         |   :5248         |
                         +--------+---------+
                                  |
                    +-------------+-------------+
                    v             v             v
             +------------+ +----------+ +------------+
             | PostgreSQL | |ai-service| | Cloudinary |
             | (pgvector) | | (Flask)  | |  (Images)  |
             +------------+ +----------+ +------------+
                                  |
                            +-----v------+
                            | Ollama /   |
                            | Claude API |
                            +------------+
```

Notes:
- `ai-service/` is a Python Flask service that owns all LLM calls (intent parsing, reranking, embedding, chat, taste extraction). The .NET backend sends and receives structured data only — no prompt strings in C#.
- Selenium/scraping components are **temporary** — used only during initial product data collection. Not part of the production architecture.

---

## Backend (.NET 8 Web API)

Entry point: `backend/Program.cs`

### Controllers (15)

| Controller | Purpose |
|---|---|
| `AdminController` | Scraping endpoints (temporary) + admin watch CRUD + image upload + embedding/cache admin |
| `WatchController` | Watch listing, detail, search, filter, AI watch finder |
| `BrandController` | Brand CRUD and listing |
| `CollectionController` | Collection CRUD and listing |
| `SearchController` | Full-text search |
| `AuthenticationController` | Login, register, Google OAuth, magic login, setup-first-admin |
| `AccountController` | Delete account, update profile |
| `ProfileController` | User profile read/update |
| `ChatController` | Chat concierge sessions + message handling |
| `ContactController` | Contact advisor inquiry submission |
| `FavouritesController` | Favourites + collections CRUD (8 endpoints) |
| `TasteController` | Watch DNA — GET profile, POST manual save, POST AI generation from behaviour |
| `BehaviorController` | Browsing event ingest (`POST /api/behavior/events`, no auth) + anonymous→user merge (`POST /api/behavior/merge`, [Authorize]) |
| `AppointmentController` | Boutique appointment booking |
| `RegisterInterestController` | Watch interest registration |

### Services (28)

**AI & Retrieval:**
- `WatchFinderService` — Orchestrates Smart Search routing. Deterministic intent parsing runs first; non-watch queries return empty early; high-confidence catalogue queries go through direct SQL / deterministic fallback before vector retrieval; semantic or weakly structured queries continue to embedding + rerank. Returns `QueryIntent` to the frontend for filter-bar pre-population, including style-derived collection suggestions that are UI-only and not hard SQL collection filters.
- `DeterministicWatchSearchService` — Catalogue-first Smart Search path for exact references, reference fragments, explicit brand / collection queries, and structured spec queries (price, diameter, material, movement, WR). Includes relaxed near-match fallback so over-tight spec combinations prefer close catalogue matches over empty results.
- `WatchFilterMapper` — Maps parsed intent to SQL predicates.
- `WatchEmbeddingService` — Builds 4 text chunks per watch (full, brand_style, specs, use_case), calls ai-service `/embed` in true batches (50 watches / 200 texts per HTTP call), upserts into WatchEmbeddings. Category taxonomy is deterministic (`InferCategory`, `InferOccasions`).
- `QueryCacheService` — Persistent semantic query cache. Cosine similarity threshold 0.92. Cache bypassed when hard SQL filters detected.
- `ChatService` — Chat concierge orchestration. Short-circuits abusive and unrelated prompts, resolves exact watches and compare requests deterministically, reuses `WatchFinderService` for discovery queries, and sends only compact Tourbillon catalogue context to ai-service when explanation helps. Signed-in users also send a compact Watch DNA + behavior summary so responses can adapt to their inferred taste without exposing raw profile internals. Redis session store with 1-hour TTL. Rate-limited per user/day. System prompt is scoped, grounded, anti-hallucination, and catalogue-bound by default.
- `TasteProfileService` — Watch DNA. Two AI paths: `ParseAndSaveAsync` (manual text → `/parse-taste`) and `GenerateFromBehaviorAsync` (browsing events → `/generate-dna-from-behavior`). Manual taste remains the durable source of truth; behavior analysis is stored separately and only fills gaps in the effective profile. `ScoreWatch()` is a pure static method (brand +3, material +2, dial +2, size +1, price +1 = 9 max). Zero AI cost at browse time.
- `BehaviorService` — Browsing event storage for Watch DNA. `FlushEventsAsync` bulk-inserts with time-window deduplication (single batch query). `MergeAnonymousAsync` reassigns anonymous events to an existing signed-in user when that browser history is intentionally attached to the account. `GetRecentEventsAsync` returns recent events for AI profile generation. Requires ≥ 3 events before generation is attempted.
- `WatchEditorialService` — Editorial content per collection. Generated once, stored in DB, served at zero runtime cost. 339/339 coverage.

**Scraping pipeline (temporary):**
- `SitemapScraperService` — Main scraper. Selenium + HtmlAgilityPack + Claude Haiku extraction. Three modes: sitemap, listing page, single URL.
- `WatchCacheService` — Inserts scraped watches into DB with duplicate checking. Fires background embedding generation.
- `BrandScraperService` — Legacy per-brand XPath scraper. Superseded.

**User/auth:**
- `UserRegistrationService`, `UserProfileService`, `PasswordChangeService`, `PasswordResetService`
- `AccountDeletionService`, `RoleManagementService`, `MagicLoginService`
- `PasswordChangeRateLimitService` — In-memory rate limiting (IMemoryCache)

**Business logic:**
- `ContactInquiryService` — PoR inquiry persistence + dual-email notification (user confirmation + admin alert)
- `AppointmentService` — Boutique appointment booking + dual-email notification
- `RegisterInterestService` — Watch interest registration + dual-email notification
- `FavouritesService` — Favourites + named collections CRUD with optimistic UI support

**Infrastructure:**
- `CloudinaryService` — Image upload/delete behind `ICloudinaryService` interface
- `EmailService` — SMTP sending via MailKit with detailed diagnostics
- `BackgroundEmailService` — Hangfire-compatible wrapper for fire-and-forget email dispatch with retry
- `RedisService` — Distributed state: auth codes, rate limits, chat sessions. Abstracts atomic INCR, string KV, and hash operations.
- `CurrencyConverter` — Currency conversion singleton

### Models (21)

| Model | Notes |
|---|---|
| `Watch` | Name = reference number, Description = brand subtitle, Specs = JSON string, Image = Cloudinary public ID |
| `Brand` | 13 brands (IDs: 1-10, 12, 13, 15) |
| `Collection` | ~51 collections with Style column for SQL pre-filtering |
| `User` | ASP.NET Identity user |
| `WatchSpecs` | Deserialized specs: DialSpecs, CaseSpecs, MovementSpecs, StrapSpecs |
| `WatchEmbedding` | pgvector row — WatchId + ChunkType + Feature + ChunkText + vector(768). Unique on (WatchId, ChunkType, Feature). |
| `QueryCache` | pgvector row — QueryText + Feature + QueryEmbedding vector(768) + ResultJson |
| `WatchEditorialContent` | AI-generated editorial per collection (4 sections) |
| `WatchEditorialLink` | Junction: maps watches to their collection's editorial |
| `UserFavourite` | Composite PK (UserId, WatchId) |
| `UserCollection` | Named user collections |
| `UserCollectionWatch` | Junction: watches in collections |
| `UserTasteProfile` | Watch DNA preferences (JSON arrays as text columns, unique per user) + separate behavior-analysis fields + `Summary` (AI-generated 1–2 sentence taste description) |
| `UserBrowsingEvent` | Browsing event for Watch DNA generation. `UserId` nullable (anonymous until merge). `AnonymousId` = client UUID from localStorage. EventType: watch_view, brand_view, collection_view, search. |
| `ChatSession` | In-memory chat session with conversation history |
| `ContactInquiry` | Advisor inquiry with snapshot fields |
| `Appointment` | Boutique appointment with notification preferences |
| `RegisterInterest` | Watch interest registration with snapshot fields |
| `PriceTrend` | Price history per watch (schema only, no service yet) |
| `BrandScraperConfig` | XPath config for legacy scraper (temporary) |
| `WatchDto` | Data transfer object for watch API responses |

### DTOs (23)

Auth: `LoginDto`, `RegisterDto`, `ResetPasswordDto`, `ForgotPasswordDto`, `VerifyCodeDto`, `MagicLoginDto`
User: `UpdateUserDto`, `UserProfileDto`, `DeleteAccountDto`
Watch: `ScrapedWatchDto`, `UpdateWatchDto`, `CreateWatchDto`, `WatchPageData`, `ImageChangeDto`
Features: `AppointmentDto`, `RegisterInterestDto`, `ContactInquiryDto`, `SaveTasteDto`, `TasteProfileDto`, `FavouritesDto`, `BrowsingEventBatchDto`, `BrowsingEventItemDto`, `MergeAnonymousDto`
Email: `TestEmailDto`

### Database

- **DbContext**: `Database/TourbillonContext.cs` — PostgreSQL via Npgsql + pgvector extension
- **DbInitializer**: No-op on startup — all seed data is managed via EF migrations. Ensures Admin role exists.
- **Migrations**: `backend/Migrations/` — includes pgvector support, editorial tables, contact/appointment/register-interest, favourites/collections, taste profiles, unique index expansion (WatchId, ChunkType, Feature)
- **Connection**: `appsettings.json` -> `ConnectionStrings.DefaultConnection`

### Authentication & Authorization

- ASP.NET Core Identity with integer-based roles
- Google OAuth + Email Magic Login (passwordless OTP via magic links)
- HttpOnly cookies, 30-minute sliding expiration, SameSite=Strict
- `RequireAdminRole` policy gates admin endpoints
- First admin created via `POST /api/authentication/setup-first-admin`
- API keys stored in .NET user-secrets (never in source)

### Key Security Notes

- `[AllowAnonymous]` is currently ON for some scrape endpoints — must remove for production
- `[Authorize(Roles = "Admin")]` is commented out on `AdminController` — must re-enable for production

---

## Frontend (Next.js 15, App Router)

### Pages / Routes

| Route | Purpose |
|---|---|
| `/` | Home — cinematic video hero + AI search bar |
| `/smart-search` | AI Watch Finder — horizontal filter bar + full-width grid |
| `/watches/` | Watch listing with taste profile personalization |
| `/watches/[slug]` | Watch detail — specs, editorial, wrist fit, compare toggle |
| `/brands/[slug]` | Brand detail with heritage description |
| `/collections/[slug]` | Collection detail |
| `/compare` | Side-by-side watch comparison with AI insights |
| `/favourites` | Saved watches + collection filtering/sorting |
| `/contact` | Contact advisor inquiry form |
| `/search` | Redirects to `/smart-search` |
| `/stories` | Curated editorial articles (5 horological stories) |
| `/trend` | Trend-led Watch DNA page with auto behavior analysis |
| `/login`, `/register` | Auth |
| `/login/magic` | Magic link OTP entry |
| `/auth/callback` | Google OAuth callback |
| `/forgot-password`, `/reset-password` | Password recovery |
| `/account` | User account management |
| `/account/edit-details` | Profile editing + link out to Watch DNA on `/trend` |
| `/scrape` | Admin watch management (temporary) |
| `/debug-images` | Image debugging utility |

### API Route Handlers

| Handler | Purpose |
|---|---|
| `app/api/watch-finder/` | Proxies `POST /api/watch/find` to .NET backend |
| `app/api/watch-finder-explain/` | Proxies `POST /api/watch/explain` to .NET backend |
| `app/api/ai-ready/` | Proxies `GET /ready` to ai-service — polls warmup status |
| `app/api/search/` | Search proxy |
| `app/api/scraper-proxy/` | Proxies scrape requests to .NET backend (temporary) |

### State Management

**Zustand Stores (with SSR safety):**
- `stores/compareStore.ts` — Watch comparison state. `skipHydration: true` for SSR, localStorage persistence.
- `stores/favouritesStore.ts` — Favourites + collections. Server-side state (no localStorage), auth-gated, reset on logout. Optimistic UI with snapshot-based rollback.

**React Contexts (5):**
- `AuthContext` — User auth state, login/logout, profile. Existing-account sign-ins flush and merge the current anonymous Watch DNA buffer; new-account completions and logout reset the anonymous browser state instead.
- `WatchesPageContext` — Watch listing, filter, pagination state
- `NavigationContext` — Navigation state
- `ChatContext` — Chat concierge state. Persists session ID, visible message history, and usage counters in `sessionStorage` so chat survives soft navigation and hard refresh in the same tab. When authenticated, it also fetches the user's Watch DNA profile and folds a compact taste summary into chat requests.
- `CursorContext` — Custom cursor state

### Key Libraries

| File | Purpose |
|---|---|
| `lib/api.ts` | Centralized API client, 100+ exported functions. All backend calls go through here. |
| `lib/cloudinary.ts` | Image URL builder. Card (400x400), detail (1200x1200), thumbnail (200x200). AVIF/WebP with auto DPR. |
| `lib/behaviorTracker.ts` | Client-side event tracker for Watch DNA. Generates `tourbillon-anon-id` UUID; stores up to 100 events in `tourbillon-behavior` localStorage buffer. All access is SSR-safe (try/catch). Existing-account sign-ins flush + merge via `AuthContext`; new-account completions and logout reset the anonymous browser state. |
| `lib/states.ts` | Global state management |

### Key Components

- `components/chat/ChatWidget.tsx`, `ChatPanel.tsx` — Floating chat concierge (pill at bottom-right, slide-up panel)
- `components/favourites/FavouriteToggle.tsx`, `SaveToCollectionPopup.tsx` — Heart toggle + collection popup
- `components/sections/VideoSection.tsx` — Full-screen cinema hero on homepage
- `components/WatchFilterBar.tsx` — Smart search horizontal filter bar
- `components/CompareToggle.tsx`, `CompareIndicator.tsx` — Compare mode UI

### Scroll/Motion Wrappers

`app/scrollMotion/` — Reusable Framer Motion components: `ScrollFade`, `StaggeredFade`, `MotionMain`

### Image Configuration (next.config.ts)

- Cloudinary: `res.cloudinary.com`
- Brand CDNs whitelisted: Patek, VC, AP, ALS, Breguet, Rolex, Omega, Grand Seiko, Frederique Constant (Blancpain removed — brand deleted from DB)
- Local backend: `http://localhost:5248/images/**`
- Formats: AVIF + WebP with auto DPR

---

## AI Service (Python Flask)

Entry point: `ai-service/app.py`

Internal layout:
- `ai-service/routes/` - endpoint registration by domain (`watch_finder`, `chat`, `taste`, `editorial`, `embeddings`, `collections`, `system`)
- `ai-service/prompts/` - prompt strings grouped by domain
- `ai-service/core/` - shared runtime, warmup, cache, and LLM helpers

```
Frontend (Next.js)
    |
Backend (.NET 8 API)
    |
AI Service (Python / Flask)
    |
Claude Haiku API (production) / Ollama Qwen 2.5 7B (local)
```

**Architecture rule:** All prompt construction and response parsing lives in the `ai-service` Python package. The .NET backend sends and receives structured data only — no prompt strings in C#. This isolates all AI concerns to one layer.

**Environment switching — single env var, no code change:**

```python
LLM_BASE_URL = os.getenv("LLM_BASE_URL", "http://localhost:11434/v1")
LLM_API_KEY  = os.getenv("LLM_API_KEY",  "ollama")
LLM_MODEL    = os.getenv("LLM_MODEL",    "qwen2.5:7b")
```

**Endpoints:**

| Endpoint | Purpose |
|---|---|
| `POST /watch-finder/parse` | NL query -> structured intent JSON (LLM call) |
| `POST /watch-finder/rerank` | Candidate pool -> scores-only array (LLM call) |
| `POST /watch-finder/explain` | Single-watch on-demand explanation (cached) |
| `POST /embed` | Batch text -> float[768] embeddings via nomic-embed-text (no LLM) |
| `POST /chat` | Conversational response from compact Tourbillon-only context |
| `POST /parse-taste` | Free-text -> structured taste preferences JSON (LLM call) |
| `POST /generate-dna-from-behavior` | Browsing events array -> structured taste preferences + `summary` string (LLM call) |
| `GET /ready` | 503 until model warmup completes, 200 after |
| `GET /health` | Always 200, includes readiness flag |

**Models loaded at startup:** `qwen2.5:7b` (LLM) + `nomic-embed-text` (embeddings). Both run in the same Ollama container.

**Prompts:** `RERANK_SYSTEM_PROMPT`, `PARSE_SYSTEM_PROMPT`, `TASTE_SYSTEM_PROMPT`, `CHAT_SYSTEM_PROMPT` — all defined in `app.py`. Chat prompt written for Haiku (prose instructions, 130-word cap, inline watch cards).

### AI Service Warm-up Strategy

**Why warm-up exists:** Ollama lazy-loads models into VRAM on first request. Without pre-warming, the first user search triggers a 30-60 second model load. This is a local Ollama problem only.

**How it works (local dev):**

```
docker compose up
  +-- ai-service starts
  |     +-- Ollama starts, models pulled/cached in ollama_data volume
  |     +-- Flask starts
  |     +-- POST /watch-finder/parse  <- loads qwen2.5:7b into VRAM
  |     +-- POST /embed               <- loads nomic-embed-text into VRAM
  |     +-- touch /tmp/ai_ready       <- sentinel file signals readiness
  |
  +-- backend starts only after ai-service healthcheck passes (test: -f /tmp/ai_ready)
        +-- first user search hits warm models -- no wait
```

`OLLAMA_KEEP_ALIVE: -1` keeps both models in VRAM indefinitely. On subsequent restarts (models cached in volume), warm-up takes ~5-15 seconds.

**In production (Anthropic API):** Warm-up is unnecessary. Claude Haiku responds instantly. The sentinel file is still written, so `depends_on: service_healthy` still works without code changes.

**Response parsing — defensive layer:** Both Haiku and Qwen can add conversational filler before JSON. The AI service strips preamble and validates schema. On parse failure, retries once with stricter prompt; on second failure, returns structured error so backend falls back to standard search.

---

## Vector Search Architecture

Full explanation in `docs/AI_PLAN.md` section 4.

### Two-layer design

```
User query
  |
[Layer 2] Embed query -> cosine similarity vs QueryCaches
  +-- hit (similarity >= 0.92) -> return stored result              <100ms, no LLM
  +-- miss
       |
     [Layer 1] cosine similarity vs WatchEmbeddings -> top candidates
       |
     Tier routing:
       Tier 2 (distance < 0.20) -> return by vector relevance (no LLM)
       Tier 3 (distance 0.20-0.55) -> LLM rerank top 15
       Tier 4 (distance > 0.55) -> return empty
       |
     [Background] store result in QueryCaches
```

### Four chunk types per watch

Each watch is embedded as four separate texts targeting different query styles:

| Chunk | Content | Matches queries like |
|---|---|---|
| `full` | Brand + name + collection + price + all specs | "Patek Philippe 38mm white gold" |
| `brand_style` | Brand + ref + collection + material + dial (finish, indices, hands) + strap + caliber + case back + production status | "rose gold sunburst dial alligator strap" |
| `specs` | All technical specs: diameter, thickness, WR, power reserve, functions | "thin watch under 8mm with power reserve" |
| `use_case` | Deterministic category + diameter + material + WR + movement + non-trivial complications + occasions + price | "sport watch under 50k for active lifestyle" |

Category taxonomy in `use_case` chunks is deterministic. `InferCategory()` maps watches to one of five labels (`diver's watch`, `chronograph`, `sport watch`, `dress watch`, `luxury watch`) via collection-name mapping and specs inspection. `InferOccasions()` gates occasion labels by category and material. Both are stable backend logic, not LLM output.

### Feature column — scoped lookups

Both `WatchEmbeddings` and `QueryCaches` carry a `Feature` column. Unique index on `(WatchId, ChunkType, Feature)` allows independent chunk sets per feature.

| Table | Feature values | Scoping |
|---|---|---|
| `WatchEmbeddings` | `"watch_finder"`, `"editorial"` | WHERE Feature = X before cosine scan |
| `QueryCaches` | `"watch_finder"`, `"rag_chat"` | WHERE Feature = X before cosine scan |

### HNSW index

Both tables carry HNSW indexes on their vector columns. Approximate nearest-neighbor search in O(log n) instead of brute-force O(n). At 1,404 rows the difference is negligible, but the index scales.

### Same embedding model everywhere

`nomic-embed-text` (768-dim) in both dev and production (Ollama). Vectors from different models are incompatible. The 100% watch coverage seeded in dev is valid in production because the model is identical.

---

## Scraping Pipeline (temporary)

3 strategies:

1. **Sitemap + Selenium + Claude Haiku** — `POST /api/admin/scrape-sitemap`. Production method. ~$0.001/watch.
2. **Listing Page + Selenium + Claude Haiku** — `POST /api/admin/scrape-listing`. For brands blocking sitemap access.
3. **Single URL** — `POST /api/admin/scrape-url`. Paste one product page URL.

Flow: Selenium renders page -> HtmlAgilityPack strips to ~20-30KB HTML -> Claude Haiku extracts JSON -> Image uploaded to Cloudinary -> Watch saved to DB with duplicate check. Max 25 watches per collection (cost-conscious limit).

Once scraping is complete, `SitemapScraperService`, `BrandScraperService`, scrape endpoints in `AdminController`, and the `/scrape` frontend page will all be removed.

---

## Data Conventions

- `Watch.Name` = Reference number (e.g., "5711/1A-010")
- `Watch.Description` = Brand model subtitle (e.g., "Patek Philippe Nautilus")
- `Watch.Specs` = JSON string with sections: `{dial:{}, case:{}, movement:{}, strap:{}}`
- `Watch.Image` = Cloudinary public ID, not a full URL
- `Watch.Slug`, `Brand.Slug`, `Collection.Slug` = URL-safe slugs used in all public routes (e.g., `patek-philippe-nautilus-5811-1g-blue-dial`). Auto-generated on startup from names. Unique indexed.
- **Price = 0 means "Price on Request"** — valid for luxury watches, never treat as error
- Watch image filenames: `brand+model.png` (e.g., `PP6119G.png`)

---

## Current Infrastructure State

```
  docker compose up --build
        |
        +---> [db]           pgvector/pgvector:pg17    :5432
        +---> [backend]      .NET 8 + Chromium         :5248 -> :8080
        +---> [ai-service]   Python 3.12 + Flask       :5000
```

Frontend runs locally (`npm run dev`) — intentionally excluded from Docker for instant HMR.

- **Orchestration**: Docker Compose (`docker-compose.yml` at project root)
- **Database**: PostgreSQL 17 with pgvector extension, data persisted in `pgdata` volume. Auto-migrated on backend startup.
- **AI Service**: Flask with 6 LLM endpoints + 2 health endpoints. Ollama for local models.
- **Secrets**: `.env` file at project root (gitignored), template in `.env.example`
- **CORS**: Configurable via `ALLOWED_ORIGINS` env var
- **Caching**: Persistent semantic query cache (QueryCaches in PostgreSQL). Redis (`redis:7-alpine`) for auth codes, rate limiting, and chat sessions via `IRedisService`.
- **Background work**: Hangfire with PostgreSQL storage. Dashboard at `/hangfire`. All fire-and-forget patterns use `BackgroundJob.Enqueue<T>` for durability and retry.
- **CDN**: Cloudinary handles image delivery
- **CI/CD**: GitHub Actions (`.github/workflows/ci.yml`) — backend build + test, frontend type-check on push/PR
- **IaC**: None

### Design Decisions

| Decision | Rationale |
|---|---|
| Single model (Haiku) in production | All tasks are short-input, short-output. No routing layer needed. |
| Qwen 2.5 7B locally | Weaker model exposes prompt edge cases. Prompts that survive 7B are robust everywhere. |
| Cache checked before quota | Cache hits cost nothing. Penalizing them with quota wastes user allowance. |
| Pre-generate editorial content | Generated once per collection, stored in DB. Zero runtime cost. |
| Backend owns all logic | SQL handles filtering, sorting, scoring. AI called only for NLU and explanation. |
| Deterministic category taxonomy | `InferCategory()` is permanent structured metadata. LLM interprets on top — never owns ground truth. |
| Defensive parsing in Python | AI service strips preamble, validates JSON, retries on failure. Never trust raw LLM output. |

### Infrastructure Status

| Milestone | Status |
|---|---|
| CI/CD (GitHub Actions) | Done — `.github/workflows/ci.yml`, backend build + tests, frontend tsc |
| Durable Background Jobs (Hangfire) | Done — PostgreSQL-backed, dashboard at `/hangfire` |
| Redis | Done — `redis:7-alpine` in Docker, auth codes / rate limits / chat sessions |
| Observability (Serilog + health checks) | Done |
| Advisor CRM | Done — inquiry page, Hangfire status auto-advance |
| Behavioural Watch DNA | Done — browser-scoped anonymous tracking, existing-account merge, clean new-account boundary, AI profile generation |
| Analytics Dashboard | Planned |
| S3 + CloudFront | Planned |
| Kubernetes | Planned |

