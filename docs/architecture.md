# Tourbillon Architecture

Current system architecture as of September 2026. This document exists to provide context for AI assistants and contributors without needing to explore the full codebase.

## System Overview

```
+----------------------------------------------------------------------------------+
| Client: browser                                                                  |
|   runtime       React 19 client components                                       |
|   state         TanStack Query cache persisted to localStorage, Zustand stores   |
+-----------------------------------------+----------------------------------------+
                                          |
                                          |  HTTPS
                                          v
+----------------------------------------------------------------------------------+
| Frontend: Next.js 15 App Router, on Vercel                                       |
|   rendering     React Server Components; static assets on the Vercel CDN         |
|   interface     Tailwind CSS, shadcn, Framer Motion, GSAP, Lenis                 |
|   API access    typed client; route handlers proxy /api/backend/* to the API     |
+-----------------------------------------+----------------------------------------+
                                          |
                                          |  HTTPS, REST + JSON, session cookie
                                          v
+----------------------------------------------------------------------------------+
| Backend: ASP.NET Core Web API, .NET 8, on Railway                                |
|   identity      ASP.NET Identity, Google OAuth, role-based authorisation         |
|   data          EF Core + Npgsql, pgvector; BM25F index held in memory           |
|   jobs          Hangfire workers, queued in Redis                                |
|   operations    Serilog, health checks, Swagger                                  |
+-------+----------------+----------------+----------------+----------------+------+
        |                |                |                |                |
    SQL, TLS      Redis protocol       S3 API            SMTP          HTTP + JSON
     EF Core         over TLS          AWS SDK          MailKit      private network
        |                |                |                |                |
        v                v                v                v                v
+--------------+ +--------------+ +--------------+ +--------------+ +--------------+
| Neon         | | Upstash      | | Amazon S3    | | SMTP relay   | | AI service   |
| PostgreSQL   | | Redis        | | + CloudFront | |              | | Python,      |
| + pgvector   | |              | |              | |              | | Flask        |
|              | |              | |              | |              | |              |
| relational   | | sessions,    | | media store; | | outbound     | | prompts,     |
| data and     | | counters,    | | the browser  | | email        | | model calls, |
| 768-dim      | | caches,      | | loads images | |              | | embeddings   |
| vectors      | | job queue    | | from the CDN | |              | | (all-mpnet)  |
+--------------+ +--------------+ +--------------+ +--------------+ +-------+------+
                                                                            |
                                                       HTTPS, Messages API  |
                                                                            v
                                                                    +--------------+
                                                                    | Anthropic    |
                                                                    | Claude Haiku |
                                                                    | 4.5          |
                                                                    +--------------+

 Local: Docker Compose runs the backend, the AI service, PostgreSQL and Redis,
 with Ollama (qwen2.5) on the GPU in place of Anthropic.
 Delivery: GitHub Actions runs the backend tests and a frontend type-check on
 every push; Railway and Vercel deploy from main.
```

### Components

| Tier | Technology | Runs on | Owns |
|---|---|---|---|
| Client | React 19, TanStack Query (persisted to localStorage), Zustand | Browser | UI state, cached server data, the anonymous browsing-event buffer |
| Frontend | Next.js 15 App Router, Tailwind CSS, shadcn, Framer Motion, GSAP, Lenis | Vercel | Rendering, routing, and the `/api/backend/*` proxy to the API |
| Backend | ASP.NET Core Web API (.NET 8), EF Core + Npgsql, ASP.NET Identity, Hangfire, Serilog | Railway | Data, accounts, authorisation, background jobs, and every decision about what a visitor sees |
| AI service | Python, Flask, Anthropic SDK, sentence-transformers (all-mpnet-base-v2) | Railway, private network only | Prompts, model calls and embeddings. Returns words or structured data; never decides which cards or actions are shown |
| Database | PostgreSQL + pgvector | Neon (ap-southeast-2) | Catalogue, accounts, favourites, browsing events, 768-dim watch embeddings, the semantic query cache |
| Cache and queue | Redis | Upstash (ap-southeast-2) | Chat sessions, rate-limit counters, sign-in codes, the chat reply cache, Hangfire job storage |
| Media | Amazon S3 + CloudFront; Cloudinary behind the same `IStorageService` | AWS | Watch, brand and collection images, and video |
| Email | SMTP through MailKit | Mail provider | Sign-in codes, password flows, booking and inquiry emails |
| Model | Claude Haiku 4.5; Ollama with qwen2.5 locally | Anthropic | Intent classification, brief parsing, reply wording, action suggestions, editorial, taste profiles |

### Connections

| From → to | Protocol | What crosses it |
|---|---|---|
| Browser → Vercel | HTTPS | Pages, React Server Component payloads, and API calls to `/api/backend/*` |
| Browser → CloudFront | HTTPS | Images and video. The API returns storage IDs and the frontend builds the CDN URL, so media never passes through the API |
| Vercel → API | HTTPS, REST + JSON | Proxied API calls carrying the HttpOnly session cookie (`BACKEND_INTERNAL_URL`) |
| API → Neon | PostgreSQL protocol over TLS (Npgsql) | EF Core queries and pgvector similarity search. The pool is tuned so Neon's compute can suspend when idle |
| API → Upstash | Redis protocol over TLS | Sessions, counters, caches, Hangfire queues |
| API → AI service | HTTP + JSON over Railway's private network (`ai.railway.internal:5000`) | Structured requests and replies. No prompt text crosses this boundary |
| AI service → Anthropic | HTTPS, Messages API | The only place the Anthropic key is used |
| API → S3 | S3 API (AWS SDK) | Uploads from the admin area |
| API → SMTP | SMTP (MailKit), sent from Hangfire jobs | Transactional email, retried by the queue rather than inside a request |
| Browser ↔ Google → API | OAuth 2.0 | Sign-in with Google |

### One request end to end

A concierge message shows every tier:

1. The browser posts to `/api/backend/chat/message`; the Next.js route handler on Vercel forwards it to the API.
2. The API checks the rate limit and loads the session (Redis), resolves named brands and collections (PostgreSQL), and asks the AI service to classify the message, starting the LLM reading of the brief at the same time.
3. Retrieval runs in the API: SQL over the catalogue, pgvector similarity search, and the in-memory BM25F index, fused by reciprocal rank fusion. The API builds the watch cards and actions.
4. The API asks the AI service for the reply wording and for suggested actions in parallel, validates the suggestions, and stores the session.
5. The reply returns with a `Server-Timing` header naming each stage's time; the browser loads the card images from CloudFront.

### Local and production

| | Production | Local (`make up`) |
|---|---|---|
| Frontend | Vercel | `npm run dev` on :3000 |
| Backend | Railway | Docker, :5248 |
| AI service | Railway, private network | Docker, :5000, with Ollama inside the container on the GPU (`docker-compose.nvidia.yml`) |
| Model | Claude Haiku 4.5 | qwen2.5 7B through Ollama, or Anthropic when `.env` sets `LLM_BASE_URL` |
| Database | Neon | `pgvector/pgvector:pg17` container, :5432 |
| Redis | Upstash | `redis:7-alpine` container, :6379 |

GitHub Actions (`.github/workflows/ci.yml`) runs the backend tests and a frontend type-check on every push and pull request to `main`; Railway and Vercel deploy from `main`.

### Security boundaries

- The Anthropic key exists only in the AI service, and the AI service has no public domain.
- Sessions live in HttpOnly cookies. Admin endpoints require the Admin role, and the Hangfire dashboard sits behind its own authorisation filter.
- Chat and search quotas are counted in Redis per user or IP, so a restart of the API does not reset them.
- `ai-service/` owns all prompt text; the .NET backend sends and receives structured data only.

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
| `ProfileController` | User profile read/update, current-password-backed password changes |
| `ChatController` | Chat concierge sessions + message handling |
| `ContactController` | Contact advisor inquiry submission |
| `FavouritesController` | Favourites + collections CRUD (8 endpoints) |
| `TasteController` | Watch DNA — GET profile, POST manual save, POST AI generation from behaviour |
| `BehaviorController` | Browsing event ingest (`POST /api/behavior/events`, no auth) + anonymous→user merge (`POST /api/behavior/merge`, [Authorize]) |
| `AppointmentController` | Boutique appointment booking |
| `RegisterInterestController` | Watch interest registration |

### Services (28)

**AI & Retrieval:**
- `WatchFinderService` — Two entry points. `SearchCatalogueAsync` is Smart Search and never calls a model: deterministic parse and SQL, then BM25F inside the parsed hard filters, and no results for a query with no watch signal (no classifier gate, LLM parse, rerank or semantic cache). `FindWatchesAsync` is the concierge's retrieval and keeps the full pipeline described next. Orchestrates concierge retrieval routing. Deterministic intent parsing runs first; non-watch queries return empty early; high-confidence catalogue queries go through direct SQL / deterministic fallback before vector retrieval; semantic or weakly structured queries continue to the LLM parse and then vector search fused with BM25F by reciprocal rank fusion, whose order is the answer (the LLM rerank that used to follow was removed: on the 50 open-ended benchmark briefs it moved no metric significantly and cost 1.9 s per reply). The LLM parse is started beside the concierge's intent classifier (`IConciergeSearchHints.PrefetchIntent`, switched by `ChatSettings:PrefetchParse`), and the finder reuses the concierge's classification instead of classifying the same message again. When a hard price cap empties the vector pool, the service retries once without that cap, marks the search path as widened, and leaves hard refusal for genuine post-widening misses only. Returns `QueryIntent` to the frontend for filter-bar pre-population, including style-derived collection suggestions that are UI-only and not hard SQL collection filters.
- `Bm25WatchIndex` / `LexicalWatchSearchService` — In-memory BM25F index over brand (with aliases), collection (with styles), reference, description and spec values. Singleton, rebuilt on a ten-minute lifetime; a few hundred watches need no search engine or Postgres extension.
- `HybridWatchRetrievalService` / `ReciprocalRankFusion` — Retrieval modes on `POST /api/watch/find`: `mode=bm25`, `mode=vector` and `mode=hybrid` (BM25F and cosine rankings fused by reciprocal rank, k = 60). Each runs one retrieval design with no parser, LLM or cache, so the eval harness can compare them; an unknown mode returns 400. BM25F is the Smart Search fallback; vector and hybrid are not on a default path, because neither beat BM25F in the benchmark.
- `DeterministicWatchSearchService` — Catalogue-first Smart Search path for exact references, reference fragments, explicit brand / collection queries, and structured spec queries (price, diameter, material, movement, WR). Includes relaxed near-match fallback so over-tight spec combinations prefer close catalogue matches over empty results.
- `WatchFilterMapper` — Maps parsed intent to SQL predicates.
- `WatchEmbeddingService` — Builds 4 text chunks per watch (full, brand_style, specs, use_case), calls ai-service `/embed` in true batches (50 watches / 200 texts per HTTP call), upserts into WatchEmbeddings. Category taxonomy is deterministic (`InferCategory`, `InferOccasions`).
- `QueryCacheService` — Persistent semantic query cache. Cosine similarity threshold 0.92. Cache bypassed when hard SQL filters detected.
- `ChatService` — Chat concierge orchestration and the long-term control-flow authority for concierge behavior. Deterministic fast paths already handle greetings, abusive inputs, cursor commands, exact slug resolution, ordinal follow-ups, compare requests, and recommendation revisions when the user rejects a shortlist. Incoming chat is normalized before routing so noisy ordinal typos and fuzzy brand spellings can still resolve into the right catalogue scope. Direct model or reference lookups stay inside the active brand or collection scope when the user is clearly continuing an in-progress conversation, which prevents broad semantic search from drifting into unrelated maisons on made-up references. Discovery corrections trigger a fresh catalogue search, replace the visible watch cards, and persist rejected brands/watch slugs in Redis-backed session state so the same poor-fit results are not resurfaced immediately. When WatchFinder marks a discovery result as widened, ChatService injects an explicit context notice so the wording layer can acknowledge the missed budget/spec constraint and pivot to the closest catalogue alternatives instead of refusing. Signed-in users also send a compact Watch DNA + behavior summary so responses can adapt to inferred taste without exposing raw profile internals. The frontend sends an explicit response-language hint, which the backend normalizes before forwarding to ai-service. Backend wording composition now runs behind a grounded validation seam: `/chat` drafts are checked against the allowed watches, brands, and collections, retried once with a correction when they drift, and downgraded to deterministic catalogue wording if they still fail validation. Redis session store carries history, last surfaced cards, compare scope, and follow-up mode with a 1-hour TTL. Rate-limited per user/day. Limited web enrichment is allowed only for approved brand-history questions, treated as secondary context that cannot override catalogue facts or create shopping actions. Phase 13.5 removes the remaining legacy reliance on model-emitted chat actions so backend-issued actions become the only feature-trigger path.
- `TasteProfileService` — Watch DNA. Two AI paths: `ParseAndSaveAsync` (manual text → `/parse-taste`) and `GenerateFromBehaviorAsync` (browsing events → `/generate-dna-from-behavior`). Manual taste remains the durable source of truth; behavior analysis is stored separately and only fills gaps in the effective profile. `ScoreWatch()` is a pure static method (brand +3, material +2, dial +2, size +1, price +1 = 9 max) and the single scorer used by `CatalogueOrderingService`. Zero AI cost at browse time.
- `CatalogueOrderingService` — Catalogue ranking for the watches page. `BuildFeaturedOrder` produces the stable merchandising order (weighted brand round-robin + collection interleave via FNV-1a stable hashing); `BuildPersonalizedOrder` re-ranks the featured head by `TasteProfileService.ScoreWatch` with brand-diversity caps. Exposed via `GET /api/watch/ordered` and `GET /api/watch/ordered/personalized`. Filtering, price sort, and pagination remain client-side.
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
- `IStorageService` — Provider-neutral image storage interface. `CloudinaryStorageService` wraps the existing Cloudinary implementation; `S3StorageService` stores images in S3 and serves them through CloudFront. `Storage:Provider` selects the active backend.
- `CloudinaryService` — Cloudinary upload/delete implementation kept for the Cloudinary storage provider and rollback path.
- `EmailService` — SMTP sending via MailKit with detailed diagnostics
- `BackgroundEmailService` — Hangfire-compatible wrapper for fire-and-forget email dispatch with retry
- `RedisService` — Distributed state: auth codes, rate limits, chat sessions. Abstracts atomic INCR, string KV, and hash operations.
- `CurrencyConverter` — Currency conversion singleton

### Models (21)

| Model | Notes |
|---|---|
| `Watch` | Name = reference number, Description = brand subtitle, Specs = JSON string, Image = provider public ID |
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
| `/stories` | Editorial brand storytelling: founding story, pocket-watch craft centerpiece, featured catalogue strip |
| `/portfolio` | Maker portfolio (about, tech stack, architecture) — URL-only, not linked from nav/footer |
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
- `ChatContext` — Chat concierge state. Persists session ID, visible message history, and usage counters in `sessionStorage` so chat survives soft navigation and hard refresh in the same tab. It forwards the browser's preferred language with every message. When authenticated, it also fetches the user's Watch DNA profile and folds a compact taste summary into chat requests. Backend-issued compare, cursor, search, and navigate actions are executed client-side, with `navigate` routing through the Next.js router instead of being echoed back into chat. Corrective follow-ups such as “show me something else” now receive a revised watch row from the backend instead of commentary on the old cards.
- `CursorContext` — Custom cursor state

### Key Libraries

| File | Purpose |
|---|---|
| `lib/api.ts` | Centralized API client, 100+ exported functions. All backend calls go through here. |
| `lib/cloudinary.ts` | Media URL builder. Cloudinary mode keeps transforms; S3 mode returns plain CloudFront URLs and relies on Next.js image optimization. |
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
- CloudFront: `*.cloudfront.net`
- Brand CDNs whitelisted: Patek, VC, AP, ALS, Breguet, Rolex, Omega, Grand Seiko, Frederique Constant (Blancpain removed — brand deleted from DB)
- Local backend: `http://localhost:5248/images/**`
- Formats: AVIF + WebP with auto DPR

---

## AI Service (Python Flask)

Entry point: `ai-service/app.py`

Internal layout:
- `ai-service/routes/` - endpoint registration by domain (`watch_finder`, `chat`, `classify`, `route`, `taste`, `editorial`, `embeddings`, `collections`, `system`)
- `ai-service/prompts/` - prompt strings grouped by domain
- `ai-service/core/` - shared runtime, warmup, cache, LLM helpers, and the semantic route layer (`route_layer.py`)

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
| `POST /watch-finder/explain` | Single-watch on-demand explanation (cached) |
| `POST /embed` | Batch text -> float[768] embeddings via nomic-embed-text (no LLM) |
| `POST /route` | Semantic query router — classifies a discovery query as `simple_brand` (pure SQL sufficient) or `descriptor_query` (full WatchFinder needed). Uses cosine similarity against pre-embedded example utterances (`core/route_layer.py`). Falls back to `descriptor_query` on any error. No LLM — embedding only. |
| `POST /chat` | Conversational wording and composition from compact Tourbillon-first context, with optional limited web notes for approved brand-history questions. Returns the final message plus grounded watch, brand, and collection mentions extracted from the supplied catalogue context. Always returns an empty actions list — backend generates all compare/search/navigate/cursor/suggest actions before the reply reaches the frontend. |
| `POST /plan-actions` | Follow-up chip planner. Uses tool-calling plus pydantic validation to propose up to 3 grounded compare/navigate chips (watches, brands, collections) from the already surfaced watch cards; it has no Smart Search tool. Hallucinated or malformed tool output is dropped and the backend falls back to deterministic chip generation. |
| `POST /parse-taste` | Free-text -> structured taste preferences JSON (LLM call) |
| `POST /generate-dna-from-behavior` | Browsing events array -> structured taste preferences + `summary` string (LLM call) |
| `GET /ready` | 503 until model warmup completes, 200 after |
| `GET /health` | Always 200, includes readiness flag |

### Chat Concierge Routing

**Routing authority:** `ChatService` classifies the request and owns all app behavior. `WatchFinderService` is the source of truth for catalogue retrieval. `ai-service /chat` is a wording layer only — it never decides routing, compare, search, or navigation behavior.

**Classifier-first follow-ups (April 2026):** Greeting, affirmative, expansion, revision, and contextual follow-up detection now comes from `POST /classify` rather than semantic regex helpers in `ChatService`. Structural fast paths remain deterministic: abuse, cursor commands, explicit compare confirmation, ordinal card lookup, fuzzy brand matching, and `_watchDescriptorPattern` as the `/route` fallback.

**Parallel wording + chip planning:** For AI-backed replies with watch cards, `ChatService` now calls `/chat` and `/plan-actions` in parallel. Planner suggestions are merged only after slug/href validation against the visible cards; if planner output is unusable or the call fails, the old deterministic compare/brand/collection chip logic still runs. A Smart Search chip is attached only when Smart Search can read a filter from the message itself (brand, collection, price, size, material, movement, dial, style), and never to advice: an open brief such as "what should I wear to a wedding" hands Smart Search nothing it can filter on and opens an empty page, and whoever asks it came to the concierge so as not to search. On the 50 open-ended benchmark briefs, 21 of the chips the old rule attached opened an empty page.

**Links are added by the backend (September 2026):** the wording layer names a watch, brand or collection in plain words and `ChatService.LinkCatalogueNames` turns the first mention of each into a link, from the slug the backend already resolved. A markdown link cost the model around 40 output tokens on a URL the reader never sees, which is what pushed replies into their token ceiling; the prompt now forbids links, URLs and slugs outright. Linking never runs inside an existing link, links each destination once, and caps a reply at three watch links.

**Measured results:** every retrieval and latency number quoted in the README or the case study page is anchored to a run in [eval-results.md](eval-results.md), with its date and the commit it measured. The harness is `eval/`; a claim without a run behind it does not belong in either document.

**Reply cache invalidation (September 2026):** cached concierge answers are versioned by `chat:resp:ver`, and `TourbillonContext.SaveChangesAsync` bumps it whenever a save touches a `Watch`, `Brand` or `Collection`. It sits in the context rather than in each endpoint because a write path that forgets leaves answers quoting prices the catalogue no longer has; the scraper paths additionally re-warm the starters. The bump itself costs nothing: a starter is recomputed by the warm-up job or by the first visitor who asks for it.

**Reply language (September 2026):** `ChatService.ResolveResponseLanguage` picks english, french or vietnamese from the message (Vietnamese-only letters, French-only words and accents) with the browser tag as a tiebreak, and it keys both the reply cache and `ChatMessages`, which holds every line the backend writes itself: quota, greeting, off-topic, no-match, the advice no-fit prompt and the grounded fallback used when a draft fails the catalogue check twice. Before that, a French or Vietnamese visitor got those in English.

**Advisory mode (June 2026):** The `advice_request` intent is the concierge's advisor persona, distinct from `discovery` (a catalogue filter). Personal-fit / suitability queries ("do I suit a diving watch, female 26", "should I get gold or steel") route to `BuildAdviceResolutionAsync`, which reuses the discovery search + grounding pipeline but caps the curated set to `AdviceCardLimit` (3) and sets `ChatResolution.AiMode = "advisor"`. The backend threads that structured flag to `/chat`, where `ADVISOR_GUIDANCE` (ai-service `prompts/chat.py`) makes the wording lead with genuine personal-fit reasoning (wrist scale, lifestyle, occasion, styling) before the picks, and acknowledge honestly when the surfaced watches do not match its own advice. A no-catalogue-fit advice query still answers in advisory prose, asking for budget, wrist size and dressiness, rather than a bare "no matches". Advice never carries a Smart Search chip: someone asking for advice came to the concierge so as not to search. Pure spec briefs stay `discovery`; named 2-brand choices stay `brand_decision`.

**Two-tier search routing (April 2026):**

| Query type | Detection | Search path | Token cost |
|---|---|---|---|
| Simple brand/collection reference | `IsSimpleBrandQueryAsync` → `POST /route` (cosine similarity); regex fallback | `GetCatalogueSampleAsync` (pure SQL, price DESC) | Zero |
| Complex / descriptor query | Semantic route returns `descriptor_query`; or regex detects descriptor after entity strip | `WatchFinderService.FindWatchesAsync` (LLM parse, vector + BM25F fused by RRF) | Normal |

**Detection — two-tier:**
1. `IsSimpleBrandQueryAsync` calls `POST /route` on ai-service, which pre-embeds example utterances (`core/route_layer.py`) and classifies by cosine similarity (threshold 0.45). Returns `simple_brand` or `descriptor_query`.
2. If ai-service is unreachable, falls back to `IsSimpleBrandQuery` — strips entity names then checks the remainder against `_watchDescriptorPattern` (style, material, complication, size, price, colour, activity words). No descriptor match → SQL.

**Inverted logic is intentional for the regex fallback**: watch descriptors are a finite, bounded set; acceptable request phrasings ("enlighten me about", "guide me through", "introduce me to") are infinite — whitelisting filler words fails on novel phrasing. The semantic router handles this naturally by similarity to known examples.

**Brand/collection info watch cards:** `BuildEntityInfoResolutionAsync` surfaces 4 watch cards (was 2) ordered by `CurrentPrice DESC` (flagship models first) for both brand and collection info intents. No additional LLM call — same SQL used for context building.

**Dispatcher null fallbacks:** Each `DispatchByIntentAsync` case that formerly returned `null` now returns an explicit message (e.g., compare with < 2 watches → "To compare I need at least two models"; affirmative with no context → "What are you looking for?"). Silent null cascades were a source of confusing fallthrough behavior.

**Cursor command handler:** Detects cursor intent (cursor/pointer keyword + action verb including past tenses), resolves cursor name from `_cursorAliases`. On unrecognized cursor name, returns a list of available cursors instead of `null` (which previously fell to `ai_fallback` and showed the welcome screen).

**Models loaded at startup:** `qwen2.5:7b` (LLM) + `nomic-embed-text` (embeddings). Both run in the same Ollama container.

**Prompts:** `PARSE_SYSTEM_PROMPT`, `TASTE_SYSTEM_PROMPT`, `CHAT_SYSTEM_PROMPT` — all defined in `ai-service/prompts/`. Chat prompt written for Haiku (prose instructions, 200-word cap, inline watch cards). Safety-net truncation in `routes/chat.py` enforces the cap for any model that overshoots.

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
     fuse with BM25F by reciprocal rank fusion -> fused order is the answer (no LLM)
       distance > 0.55 -> filtered out in the DB query
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

Flow: Selenium renders page -> HtmlAgilityPack strips to ~20-30KB HTML -> Claude Haiku extracts JSON -> image uploaded through the active storage provider -> Watch saved to DB with duplicate check. Max 25 watches per collection (cost-conscious limit).

Once scraping is complete, `SitemapScraperService`, `BrandScraperService`, scrape endpoints in `AdminController`, and the `/scrape` frontend page will all be removed.

---

## Data Conventions

- `Watch.Name` = Reference number (e.g., "5711/1A-010")
- `Watch.Description` = Brand model subtitle (e.g., "Patek Philippe Nautilus")
- `Watch.Specs` = JSON string with sections: `{dial:{}, case:{}, movement:{}, strap:{}}`
- `Watch.Image` = provider public ID, not a full URL
- `Watch.Slug`, `Brand.Slug`, `Collection.Slug` = URL-safe slugs used in all public routes (e.g., `patek-philippe-nautilus-5811-1g-blue-dial`). Auto-generated on startup from names. Unique indexed.
- **Price = 0 means "Price on Request"** — valid for luxury watches, never treat as error
- Watch image filenames: `brand+model.png` (e.g., `PP6119G.png`)

---

## Reference Architecture Alignment

The target architecture splits into six layers: user channels, a shared query
understanding and routing layer, SmartSearch, the AI chatbot, caching, and
data/infrastructure. Most of it is built. This table records what is actually
implemented against that target so the gaps stay tracked rather than rediscovered.

| Layer / Box | Implementation | Status |
|---|---|---|
| Query classification, intent detection | `POST /classify` + `POST /route` (ai-service), 14 intent classes | Done |
| Query normalization | Implemented **twice** — see "Duplicated query understanding" below | Partial |
| Deterministic search — exact match, structured filters | `DeterministicWatchSearchService` | Done |
| Deterministic search — PostgreSQL full-text | No `to_tsvector` / `tsquery` anywhere; `SearchController` uses `ILIKE '%token%'` with a hand-rolled score | Missing |
| Deterministic search — trigram / fuzzy | No `pg_trgm`, no `similarity()` | Missing |
| Semantic search — pgvector cosine, top-K | `WatchFinderService.VectorSearchAsync`, HNSW index | Done |
| Hybrid ranking — lexical + vector + popularity fusion | No fusion. Paths are either/or: `direct_sql_*` or `vector_*`, never blended | Missing |
| Search result aggregator | `direct_sql_merged`, dedupe, brand diversity pass | Done |
| Product data hydration | `WatchDto.FromWatch` + `IStorageService` | Done |
| Conversation manager | Four independent Redis hash fields, written non-atomically | Partial |
| Intent and action planner | `ChatService.DispatchByIntentAsync` + `ActionPlannerService` | Done |
| Tool orchestrator | Nine inline `_watchFinderService` call sites, not a distinct layer | Partial |
| Knowledge retrieval — catalog, descriptions | `WatchEditorialContent` / `WatchEditorialLink` | Done |
| Knowledge retrieval — FAQs, guides, policies | No corpus | Missing |
| LLM orchestration, response formatter | `POST /chat`, watch cards, backend-issued actions | Done |
| Search result cache | `chat:resp:{version}` in Redis, version-bumped on invalidation | Done |
| Semantic cache | `QueryCaches` table in **PostgreSQL**, not Redis | Diverges |
| Conversation cache | `chat:session:{id}` in Redis, 1h TTL | Done |
| Background jobs — cache invalidation | `ChatService.InvalidateAndRewarmStartersAsync` | Done |
| Background jobs — embedding generation, re-index | Manual via `AdminController`, not a Hangfire job | Missing |
| Monitoring — logs | Serilog, structured routing traces (`path=`, `finder=`) | Done |
| Monitoring — metrics, distributed tracing | No OpenTelemetry, no `ActivitySource` | Missing |
| API gateway | Auth and rate limiting are per-controller behind the Next.js proxy; no distinct gateway | Diverges |

### Duplicated query understanding

The target draws query understanding as one shared layer feeding both SmartSearch
and the chatbot. It was implemented independently on each side, and the two copies
drifted:

| Primitive | Chat concierge | Smart Search | Drift |
|---|---|---|---|
| Brand alias table | `ChatService._brandAliases` | `WatchFinderService._brandAliases` | Chat lacked the `Glashütte` (umlaut) key; Smart Search lacked `ALange`. Values disagreed on diacritics (`Sohne` vs `Söhne`) |
| Entity text normalization | `NormalizeEntityText` — space-separated, Unicode-aware | `NormaliseEntityText` — compacted, ASCII-only | Different output for the same input, both consumed by `.Contains` matching |
| Compound term expansion | `NormalizeCompoundWatchTerms` | `NormalizeQueryPhrases` | Chat did not expand `diverwatch` and did not collapse whitespace |

This matters because the chat path canonicalizes a query and then hands the result
to `FindWatchesAsync`, which normalizes it again under different rules. Any
asymmetry surfaces as the concierge and Smart Search resolving different brands
for the same words.

These primitives now live in `QueryNormalizer` (`backend/Services/QueryNormalizer.cs`);
both services delegate to it. Alias-to-brand resolution compares on `CompactText`
rather than exact string equality, so diacritic spelling in the alias table can no
longer decide whether a brand resolves.

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
- **Background work**: Hangfire with Redis storage. Dashboard at `/hangfire`. All fire-and-forget patterns use `BackgroundJob.Enqueue<T>` for durability and retry. Storage is deliberately not PostgreSQL — Hangfire's Postgres provider polls the database continuously (its counter aggregator alone every 5 minutes), which prevented Neon's serverless compute from ever suspending.
- **CDN**: Cloudinary remains available; S3 + CloudFront is supported behind the storage abstraction and can be enabled after migration.
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
| Blacklist bad patterns, not whitelist good ones | For open-ended text, enumerate what you want to block (finite descriptor domain). Whitelisting acceptable phrasings fails on every new synonym ("enlighten" vs "tell"). |
| SQL before LLM when entity is resolved | Once entity resolution gives a brand/collection ID, a SQL query is always cheaper and faster than the LLM parse and vector search. Reserve LLM search for queries with descriptors the SQL layer cannot interpret. |
| Explicit fallbacks over null cascades | When a dispatcher cannot fulfill an intent, return a user-facing message. Silent null returns cascade to unrelated handlers and produce confusing output. |
| Classifier is the semantic router — trust it | Regex pre-checks should guard only what classifiers cannot: latency-critical structural patterns (rate limit, abuse, cursor parsing) and exact token-level commands. Everything semantic — greetings, off-topic, follow-ups — belongs in the classifier. Duplicate semantic logic in regex is always a lagging copy. |

### Infrastructure Status

| Milestone | Status |
|---|---|
| CI/CD (GitHub Actions) | Done — `.github/workflows/ci.yml`, backend build + tests, frontend tsc |
| Durable Background Jobs (Hangfire) | Done — Redis-backed, dashboard at `/hangfire` |
| Redis | Done — `redis:7-alpine` in Docker, auth codes / rate limits / chat sessions |
| Observability (Serilog + health checks) | Done |
| Advisor CRM | Done — inquiry page, Hangfire status auto-advance |
| Behavioural Watch DNA | Done — browser-scoped anonymous tracking, existing-account merge, clean new-account boundary, AI profile generation |
| Analytics Dashboard | Planned |
| S3 + CloudFront | Done — `IStorageService` abstraction, CloudFront CDN, ECR images |
| Production Deployment | Done — Railway + Neon + Upstash |

---

## Production Deployment

### Stack

```
Browser
  → Vercel (Next.js 15 — free tier)
      → /api/backend/* Next.js proxy (same-origin, no CORS)
          → Railway (backend + ai-service, auto-deploy on push to main)
              Neon PostgreSQL  (external managed — free tier)
              Upstash Redis    (external managed — free tier)
  → AWS CloudFront (assets — d2lauyid2w6u9c.cloudfront.net)
      → S3 bucket (ap-southeast-2)
```

### Services

| Service | Host | Notes |
|---|---|---|
| Frontend | Vercel | Auto-deployed on push to main |
| Backend (.NET 8) | Railway | Root dir: `backend/`, builds from `backend/Dockerfile` |
| AI service (Flask) | Railway | Root dir: `ai-service/`, builds from `ai-service/Dockerfile.production` |
| PostgreSQL | Neon | Managed, ap-southeast-2 |
| Redis | Upstash | Managed, TLS, ap-southeast-2 |
| Assets | AWS CloudFront + S3 | CDN-served images + videos |

