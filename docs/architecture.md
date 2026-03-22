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
                    v                           v
             +------------+             +------------+
             | PostgreSQL |             | Cloudinary |
             |  (Npgsql)  |             |  (Images)  |
             +------------+             +------------+
```

Notes:
- `ai-service/` is a Python Flask service that owns all LLM calls (intent parsing, reranking, embedding generation). The .NET backend sends and receives structured data only — no prompt strings in C#.
- Selenium/scraping components are **temporary** — used only during initial product data collection, will be removed once all brands are scraped. Not part of the production architecture.
- Claude Haiku API calls used during scraping (`ClaudeApiService.cs`) are separate from the AI Watch Finder — the scraper calls Claude directly; the Watch Finder goes through `ai-service`.

---

## Backend (.NET 8 Web API)

Entry point: `backend/Program.cs`

### Controllers (8)

| Controller | Purpose |
|---|---|
| `AdminController` | Scraping endpoints (temporary) + admin watch CRUD + image upload |
| `WatchController` | Watch listing, detail, search, filter |
| `BrandController` | Brand CRUD and listing |
| `CollectionController` | Collection CRUD and listing |
| `SearchController` | Full-text search |
| `AuthenticationController` | Login, register, setup-first-admin |
| `AccountController` | Delete account, update profile |
| `ProfileController` | User profile read/update |

### Services (14 key services)

**Scraping pipeline (temporary — will be removed after data collection):**
- `SitemapScraperService` — Main scraper. Selenium renders page, HtmlAgilityPack strips HTML, Claude Haiku extracts JSON. Three modes: sitemap, listing page, single URL.
- `ClaudeApiService` — Calls Claude Haiku API via HttpClient. Will migrate to ai-service.
- `WatchCacheService` — Inserts scraped watches into DB with duplicate checking by reference number. Fires background embedding generation for newly inserted watches.
- `BrandScraperService` — Legacy per-brand XPath scraper. Superseded.

**AI Watch Finder (Phase 2+):**
- `WatchFinderService` — Orchestrates the Phase 3B hybrid pipeline: (1) `ParseQueryIntentAsync` extracts brand/collection/price as hard SQL pre-filters (no LLM, ~5ms); (2) embed query → check `QueryCache`; (3) on miss: vector similarity search with pre-filters applied as WHERE on the `WatchEmbeddings` JOIN → LLM rerank → background cache store. Returns `QueryIntent` to frontend for filter bar pre-population. Fallback to LLM parse + SQL filter if embed fails.
- `WatchFilterMapper` — Maps parsed LLM intent to SQL predicates.
- `WatchEmbeddingService` — Builds 4 text chunks per watch, calls ai-service `/embed` in true batches (50 watches / 200 texts per HTTP call), upserts into `WatchEmbeddings`. Skips already-embedded watches on demand-driven calls.
- `QueryCacheService` — Persistent semantic query cache. Looks up the nearest cached query by cosine similarity (threshold 0.92). On hit, returns stored JSON result immediately — no LLM call. On miss, stores the new result for future similar queries.

**User/auth:**
- `UserRegistrationService`, `UserProfileService`, `PasswordChangeService`, `PasswordResetService`, `AccountDeletionService`, `RoleManagementService`
- `PasswordChangeRateLimitService` — Rate limiting

**Infrastructure:**
- `CloudinaryService` — Upload from URL (scrape pipeline) or stream (manual upload), delete. All uploads use `Overwrite = true`.
- `EmailService` — SMTP email sending
- `CurrencyConverter` — Currency conversion singleton

### Models (10)

| Model | Notes |
|---|---|
| `Watch` | Name = reference number, Description = brand subtitle, Specs = JSON string, Image = Cloudinary public ID |
| `Brand` | 13 brands loaded from `Data/brands.csv` |
| `Collection` | ~51 collections loaded from `Data/collections.csv` |
| `User` | ASP.NET Identity user |
| `PriceTrend` | Price history per watch |
| `BrandScraperConfig` | XPath config for legacy scraper (temporary) |
| `WatchSpecs` | Deserialized specs: DialSpecs, CaseSpecs, MovementSpecs, StrapSpecs |
| `WatchEmbedding` | pgvector row — WatchId + ChunkType + ChunkText + vector(768). 4 rows per watch. |
| `QueryCache` | pgvector row — QueryText + QueryEmbedding vector(768) + ResultJson. One row per unique search. |
| `WatchDto` | Data transfer object |

### DTOs (12)

Auth: `LoginDto`, `RegisterDto`, `ResetPasswordDto`, `ForgotPasswordDto`, `VerifyCodeDto`
User: `UpdateUserDto`, `UserProfileDto`, `DeleteAccountDto`
Watch: `ScrapedWatchDto`, `UpdateWatchDto`, `WatchPageData`
Email: `TestEmailDto`

### Database

- **DbContext**: `Database/TourbillonContext.cs` — PostgreSQL via Npgsql
- **DbInitializer**: Seeds 9 "Holy Trinity" showcase watches (PP Nautilus, VC Overseas, AP Royal Oak) on startup. Ensures Admin role exists.
- **Migrations**: `backend/Migrations/`
- **Connection**: `appsettings.json` -> `ConnectionStrings.DefaultConnection`

### Authentication & Authorization

- ASP.NET Core Identity with integer-based roles
- HttpOnly cookies, 30-minute sliding expiration, SameSite=Strict
- `RequireAdminRole` policy gates scraping endpoints
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
| `/` | Home / landing page with AI search (redirects to `/smart-search`) |
| `/smart-search` | AI Watch Finder results page — horizontal filter bar + full-width grid |
| `/brands/[brandId]` | Brand detail |
| `/collections/[collectionId]` | Collection detail |
| `/watches/` | Watch listing + detail |
| `/watches/[watchId]?wristFit=17` | Watch detail with wrist fit pre-filled |
| `/cart/` | Shopping cart |
| `/search/` | Global search |
| `/login/`, `/register/` | Auth |
| `/forgot-password/`, `/reset-password/` | Password recovery |
| `/account/`, `/account/edit-details/` | User account |
| `/contact/` | Contact page |
| `/stories/`, `/trend/` | Content pages |
| `/scrape/` | Admin scraping UI (password-protected, temporary) |
| `/debug-images/` | Image debugging |

### API Route Handlers

| Handler | Purpose |
|---|---|
| `app/api/scraper-proxy/` | Proxies scrape requests to .NET backend (temporary) |
| `app/api/search/` | Search proxy |
| `app/api/upload/` | Upload proxy |
| `app/api/watch-finder/` | Proxies `POST /api/watch/find` to .NET backend |
| `app/api/watch-finder-explain/` | Proxies `POST /api/watch/explain` to .NET backend |
| `app/api/ai-ready/` | Proxies `GET /ready` to ai-service — polls warmup status |

### Key Libraries

| File | Purpose |
|---|---|
| `lib/api.ts` | Centralized API client, 100+ exported functions. All backend calls go through here. |
| `lib/cloudinary.ts` | Image URL builder. Card (400x400), detail (1200x1200), thumbnail (200x200). Brand CDN URLs passed through directly (Cloudinary fetch times out on them). |
| `lib/states.ts` | Global state management |

### Contexts (3 React Context providers)

- `AuthContext` — User auth state
- `WatchesPageContext` — Watch listing, filter, pagination state
- `NavigationContext` — Navigation state

### Scroll/Motion Wrappers

`app/scrollMotion/` — Reusable Framer Motion components: `ScrollFade`, `StaggeredFade`, `MotionMain`

### Image Configuration (next.config.ts)

- Cloudinary: `res.cloudinary.com`
- Brand CDNs whitelisted: Patek, VC, AP, ALS, Breguet, Rolex, Blancpain, Omega, Grand Seiko, Frederique Constant
- Local backend: `http://localhost:5248/images/**`
- Formats: AVIF + WebP with auto DPR

---

## AI Service (Python Flask)

Entry point: `ai-service/app.py`

```
Frontend (Next.js — Vercel)
    ↓
Backend (.NET 8 API — EC2)
    ↓
AI Service (Python / Flask — same EC2 instance)
    ↓
Claude Haiku API (production) / Ollama Qwen 2.5 7B (local)
```

External services: PostgreSQL (RDS or EC2-hosted) · Amazon S3 + CloudFront (images) · Anthropic API

**Architecture rule:** All prompt construction and response parsing lives here. The .NET backend sends and receives structured data only — no prompt strings in C#. This isolates all AI concerns to one layer.

**Environment switching — single env var, no code change:**

```python
LLM_BASE_URL = os.getenv("LLM_BASE_URL", "http://localhost:11434/v1")
LLM_API_KEY  = os.getenv("LLM_API_KEY",  "ollama")
LLM_MODEL    = os.getenv("LLM_MODEL",    "qwen2.5:7b")
```

Local defaults point to Ollama. Set these in `.env` (or the Docker Compose `environment` block) to switch to production without touching code.

**Endpoints:**

| Endpoint | Purpose |
|---|---|
| `POST /watch-finder/parse` | NL query → structured intent JSON (LLM call 1) |
| `POST /watch-finder/rerank` | Candidate pool → scores-only array (LLM call 2, no explanations) |
| `POST /watch-finder/explain` | Single-watch on-demand explanation (cached) |
| `POST /embed` | Batch text → float[768] embeddings via nomic-embed-text (no LLM) |
| `GET /ready` | 503 until model warmup completes, 200 after |
| `GET /health` | Always 200, includes readiness flag |

**Models loaded at startup:** `qwen2.5:7b` (LLM) + `nomic-embed-text` (embeddings). Both run in the same Ollama container.

### AI Service Warm-up Strategy

**Why warm-up exists:** Ollama lazy-loads models into VRAM on first request. Without pre-warming, the first user search triggers a 30–60 second model load — visible as a hanging spinner. This is a local Ollama problem only.

**How it works (local dev):**

```
docker compose up
  ├─ ai-service starts
  │     ├─ Ollama starts, models pulled/cached in ollama_data volume
  │     ├─ Flask starts
  │     ├─ POST /watch-finder/parse  ← loads qwen2.5:7b into VRAM
  │     ├─ POST /embed               ← loads nomic-embed-text into VRAM
  │     └─ touch /tmp/ai_ready       ← sentinel file signals readiness
  │
  └─ backend starts only after ai-service healthcheck passes (test: -f /tmp/ai_ready)
        └─ first user search hits warm models — no wait
```

`OLLAMA_KEEP_ALIVE: -1` keeps both models in VRAM indefinitely after the first load. On subsequent restarts (models already cached in volume), warm-up takes ~5–15 seconds (disk → VRAM), not 60.

**In production (Anthropic API):** The warm-up is unnecessary. `claude-haiku-4-5` is a remote API — it responds instantly and has no load step. The sentinel file is still written (the two warm-up requests return in milliseconds), so `depends_on: service_healthy` still works and no code changes are needed.

**Removing warm-up for a production-only Anthropic build:** If you ever build an image that will never use Ollama, simplify `entrypoint.sh` to just `python app.py` and replace the healthcheck with `curl -f http://localhost:5000/health`. The `depends_on: service_healthy` on the backend can stay as-is.

**Scope:** AI Watch Finder intent parsing + candidate ranking + on-demand explanations + semantic embedding generation. Future: Compare Mode insights, Chat Assistant, Watch DNA taste profiling.

**Response parsing — defensive layer:** Both Haiku and Qwen can add conversational filler before JSON output. The AI service strips preamble and validates schema before returning to the backend. On parse failure it retries once with a stricter prompt; on second failure it returns a structured error so the backend falls back to standard search.

```python
def parse_llm_json(raw: str) -> dict:
    match = re.search(r'[\[{]', raw)
    if not match:
        raise ValueError("No JSON found in response")
    return json.loads(raw[match.start():])
```

---

## Vector Search Architecture — Why and How

This section explains the two-layer vector system from first principles. It is written for contributors who haven't worked with embeddings before.

### The problem with SQL keyword search

When a user searches "Vacheron dress watch 39–40mm", there is no single database column that captures brand + style + diameter together. SQL can only match what was explicitly stored. A WHERE clause on individual columns will miss watches that are clearly relevant but weren't tagged with the exact extracted values.

The Phase 2 pipeline works around this with an LLM that parses the query into structured filters (`brand=Vacheron Constantin`, `diameter=39-40mm`), but the LLM-extracted fields are still mapped to SQL predicates. A nuanced query still produces a blunt database query.

### What an embedding is

An embedding is what you get when you pass text through a neural network that has learned the meaning of language. The network outputs a list of 768 numbers — a coordinate in a 768-dimensional space. The important property: **texts with similar meaning end up close together in that space**.

```
"Vacheron dress watch 39–40mm"       → [0.12, -0.43, 0.87, ...]   (768 numbers)
"VC Patrimony slim 40mm"             → [0.11, -0.41, 0.85, ...]   (close — similar meaning)
"AP Royal Oak steel sport watch"     → [-0.23, 0.91, -0.15, ...]  (far — different meaning)
```

"Closeness" is measured by cosine similarity — the angle between two vectors. Similarity 1.0 = identical meaning, 0.0 = unrelated, negative = opposite.

### Why embed all the watches upfront

At query time, we embed the user's query (one call, ~50ms). We then need to find which watches are semantically closest to it. To do that comparison, the watches must already be in the same vector space.

If we didn't pre-compute watch embeddings, we would have to embed all 351 watches on every single search request — 351 Ollama calls before we could return a single result. Pre-computing once and storing the vectors in PostgreSQL means each search only needs one embed call (the query), then a fast database similarity scan.

This is the same principle as a database index: pay the cost once at write time, get fast reads forever.

### The two-layer design

```
Layer 1 — WatchEmbeddings (what each watch IS)
  One entry per watch chunk (4 chunks × 351 watches = 1,404 rows)
  Answers: "which watches are semantically similar to this query?"
  Used by: Phase 3B vector retrieval (replaces SQL filtering)

Layer 2 — QueryCaches (what was returned for a past query)
  One entry per unique search query ever run
  Answers: "have we seen this exact query (or one very close to it) before?"
  Used by: instant cache hits before the LLM pipeline runs at all
```

They solve different problems and stack on top of each other:

```
User query
  ↓
[Layer 2] Embed query → cosine similarity vs QueryCaches
  ├─ hit (similarity ≥ 0.92) → return stored result              <100ms, no LLM
  └─ miss
       ↓
     [Layer 1] Phase 3B: cosine similarity vs WatchEmbeddings → top 30 candidates
       ↓
     LLM rerank → top 8 results
       ↓
     [Background] store result in QueryCaches for next time
```

### How similarity search is fast — HNSW index

Finding the nearest vector in 768-dimensional space by brute force means computing cosine distance against every row — O(n). Fine at 100 rows, slow at 100,000.

Both `WatchEmbeddings` and `QueryCaches` carry an **HNSW index** (Hierarchical Navigable Small World) on their vector columns. HNSW pre-builds a graph where each vector is connected to its approximate nearest neighbors. Lookup traverses the graph top-down: a coarse layer narrows the search space, finer layers home in on the answer. Result: O(log n), not O(n).

The "small world" intuition: any two vectors are reachable in a small number of hops, the same way any two people on Earth are connected through ~6 acquaintances. The hierarchy just starts the search coarse so fewer hops are needed.

HNSW is approximate — it can occasionally miss the true nearest neighbor. For semantic similarity at threshold 0.92, this is irrelevant. A vector at 0.93 similarity will still be found.

### The Feature column — scoped lookups in shared tables

Both `WatchEmbeddings` and `QueryCaches` carry a `Feature` column so multiple features can share the same table without cross-contamination:

| Table | Feature values | Who writes | Who reads |
|---|---|---|---|
| `WatchEmbeddings` | `"watch_finder"` (current), `"editorial"`, `"rag_chat"` (future) | `WatchEmbeddingService` | `WatchFinderService`, future RAG service |
| `QueryCaches` | `"watch_finder"`, `"rag_chat"` | `QueryCacheService` | Feature-scoped `LookupAsync(embedding, feature)` |

Watch Finder lookups filter `WHERE Feature = 'watch_finder'`, so the 34 pre-seeded Phase 5 RAG chatbot queries cached as `"rag_chat"` are never returned to Watch Finder users.

### Why the same embedding model everywhere

Vectors from different models are incompatible — they live in different spaces with different dimensions and learned meanings. A `nomic-embed-text` vector and a `text-embedding-3-small` vector cannot be compared. This is why the rule exists: `nomic-embed-text` in dev (Ollama) and `nomic-embed-text` in production (also Ollama, same container). The 100% watch coverage seeded in dev is valid in production because the model is identical.

### The four chunk types per watch

Each watch is embedded as four separate texts, not one. This is because a single text can't capture all the ways a user might describe it:

| Chunk | What it contains | Matches queries like |
|---|---|---|
| `full` | Brand + name + collection + price + all specs | "Patek Philippe 38mm white gold" |
| `brand_style` | Brand identity + case material + dial color + strap | "rose gold watch with alligator strap" |
| `specs` | All technical specs: diameter, thickness, water resistance, functions | "thin watch under 8mm with power reserve" |
| `use_case` | Inferred style profile: diving, dress, sport, everyday wear | "JLC Reverso under 50k" |

At retrieval time (Phase 3B), all four chunk vectors are compared against the query vector and the best-matching chunk wins. A query about case specs finds the right watch via its `specs` chunk even if the `full` chunk isn't the closest match.

---

## Scraping Pipeline (temporary — for initial data collection only)

3 strategies:

1. **Sitemap + Selenium + Claude Haiku** — `POST /api/admin/scrape-sitemap`. Production method. Parses sitemap.xml, filters by collection slug, scrapes each product URL. ~$0.001/watch.
2. **Listing Page + Selenium + Claude Haiku** — `POST /api/admin/scrape-listing`. For brands blocking sitemap access. Claude extracts product URLs from listing page first.
3. **Single URL** — `POST /api/admin/scrape-url`. Paste one product page URL, get structured data.

Flow: Selenium renders page -> HtmlAgilityPack strips to ~20-30KB HTML -> Claude Haiku extracts JSON (name, ref, price, image URL, specs) -> Image uploaded to Cloudinary -> Watch saved to DB with duplicate check.

Max 25 watches per collection (cost-conscious limit).

Once all brands are scraped, the scraping services (`SitemapScraperService`, `ClaudeApiService`, `BrandScraperService`), Selenium dependency, scrape endpoints in `AdminController`, and the `/scrape` frontend page will all be removed.

---

## Admin Watch Management (at `/scrape`)

- Brand/collection cascading filter dropdowns
- Watch data table with thumbnails
- Per-watch editor modal: image preview + Ctrl+V paste upload + data fields + raw JSON specs editor
- Image upload goes to Cloudinary, stores public ID (not URL)

---

## Data Conventions

- `Watch.Name` = Reference number (e.g., "5711/1A-010")
- `Watch.Description` = Brand model subtitle (e.g., "Patek Philippe Nautilus")
- `Watch.Specs` = JSON string with sections: `{dial:{}, case:{}, movement:{}, strap:{}}`
- `Watch.Image` = Cloudinary public ID, not a full URL
- **Price = 0 means "Price on Request"** — valid for luxury watches, never treat as error
- Watch image filenames: `brand+model.png` (e.g., `PP6119G.png`)

---

## Current vs Future Architecture Comparison

### Current State (Dockerized)

```
  docker compose up --build
        |
        +---> [db]           postgres:16-bookworm    :5432
        +---> [backend]      .NET 8 + Chromium       :5248 -> :8080
        +---> [frontend]     Node 20 + Next.js 15    :3000
        +---> [ai-service]   Python 3.12 + Flask     :5000
```

```
  [Browser]
      |
      v
  [Next.js :3000] --proxy--> [.NET 8 API :5248]
                                     |
                        +------------+------------+
                        v                         v
                   [PostgreSQL]             [Cloudinary]
```

- **Orchestration**: Docker Compose (`docker-compose.yml` at project root)
- **All images**: Debian Bookworm-based (glibc needed for Chrome, AI/ML libraries)
- **Frontend**: Next.js standalone output, `NEXT_PUBLIC_API_URL` env var (build-time), `BACKEND_INTERNAL_URL` for server-side routes (runtime)
- **Backend**: .NET 8 Kestrel on container port 8080, mapped to host 5248. Chromium + ChromeDriver installed for Selenium scraping.
- **Database**: PostgreSQL 16, data persisted in `pgdata` Docker volume. Auto-migrated on backend startup.
- **AI Service**: Flask stub with `/health` endpoint. Debian-based for future PyTorch/ML dependencies.
- **Secrets**: `.env` file at project root (gitignored), template in `.env.example`
- **CORS**: Configurable via `ALLOWED_ORIGINS` env var (defaults to `http://localhost:3000`)
- **Workflow**: `docker compose up --build` to start, `docker compose down` to stop, `docker compose down -v` to also wipe database
- **Images**: Cloudinary (upload from URL or stream, store public IDs)
- **Caching**: Persistent semantic query cache (`QueryCaches` table in PostgreSQL). In-memory LLM response cache in `ai-service` (cleared on restart). No Redis yet.
- **CDN**: None (Cloudinary handles edge delivery)
- **IaC**: None
- **CI/CD**: None

### Future State

```
  +---------------------------------------------------------------+
  |                    GitHub Actions (CI/CD)                      |
  |  build -> test -> Docker image -> push to registry -> deploy  |
  +---------------------------------------------------------------+
                                  |
  +---------------------------------------------------------------+
  |                      Terraform (IaC)                          |
  +---------------------------------------------------------------+
                                  | provisions
  +-------------------------------v-------------------------------+
  |                      Kubernetes Cluster                       |
  |                                                               |
  |  +-------------+  +-------------+  +--------+  +----------+  |
  |  |   Backend   |  | AI Service  |  | Redis  |  |PostgreSQL|  |
  |  |   .NET 8    |->| Python/Flask|  | (cache)|  | (managed |  |
  |  |   (Docker)  |  |  (Docker)   |  |        |  |  or pod) |  |
  |  +-------------+  +------+------+  +--------+  +----------+  |
  |                          |                                    |
  |                          v                                    |
  |                 +------------------+                          |
  |                 |  Claude API /    |                          |
  |                 |  Self-hosted LLM |                          |
  |                 +------------------+                          |
  +--------------------------+------------------------------------+
                             |
        +--------------------+--------------------+
        v                    v                    v
  +-----------+   +-------------------+   +--------------+
  |  Vercel / |   | S3 + CloudFront   |   |  AI Chatbot  |
  |  Amplify  |   | (Images + CDN)    |   |  (Customer-  |
  | (Frontend)|   |                   |   |   facing)    |
  +-----------+   +-------------------+   +--------------+
```

### What Each New Component Does (and Why It Matters)

**GitHub Actions (CI/CD)** — Automates build, test, and deploy on every push. Without this, you'd manually build Docker images, run tests, and push to registries every time. K8s handles *running* containers — CI/CD handles *getting them there*. This is a foundational DevOps skill interviewers expect.

**Redis (Cache Layer)** — Sits between the .NET API and PostgreSQL. The watch catalog is read-heavy and rarely changes — caching brand/collection/watch list responses in Redis avoids hitting the database on every page load. Also useful for: rate limiting (replacing in-memory `PasswordChangeRateLimitService`), session storage (more scalable than in-memory), and future job queuing.

**S3 + CloudFront** — S3 stores images, CloudFront serves them from edge locations worldwide. Raw S3 is slow without a CDN in front of it. CloudFront replaces what Cloudinary gives you today (edge caching, format optimization). Together they're cheaper at scale and you control the infrastructure.

**AI Service (Python/Flask)** — Single service that owns all LLM interactions: chatbot, any future AI features. Consolidates API key management and makes model swapping easy. The .NET backend becomes a pure REST API that calls the AI service when needed instead of making Claude API calls directly.

**Health Checks + Observability** — `/health` and `/ready` endpoints on backend and AI service. Kubernetes uses these to know if a pod is alive and ready to receive traffic. Add structured logging (Serilog to stdout) from Docker phase onward — K8s log aggregation depends on it.

### Migration Roadmap

| Phase | Change | What Moves | Replaces |
|-------|--------|------------|----------|
| **0. CI/CD** | GitHub Actions pipeline | Build, test, lint on every PR. Deploy on merge to main | Manual builds and deploys |
| **1. Dockerize** | Containerize backend + AI service | .NET API + Flask service into Docker images. `docker-compose.yml` for local multi-container dev. **DONE** | Local `dotnet run` |
| **2. Deploy Frontend** | Host on Vercel or AWS Amplify | Next.js with SSR/ISR | Local `npm run dev` |
| **3. Redis** | Add caching layer | Watch/brand/collection responses cached. Session storage. Rate limiting | Direct DB queries on every request |
| **4. S3 + CloudFront** | Move image storage to AWS | All watch images, upload pipeline, CDN delivery | Cloudinary |
| **5. AI Service** | Build out `ai-service/` | All LLM calls consolidated into Python service. Chatbot endpoint | `ClaudeApiService.cs` in backend |
| **6. Kubernetes** | Orchestrate containers | Backend + AI + Redis pods, scaling, health checks, rolling deploys | Docker Compose / manual |
| **7. Terraform** | Infrastructure as Code | All cloud resources (K8s, S3, CloudFront, RDS, Redis, networking) | Manual cloud console setup |

### Design Decisions

| Decision | Rationale |
|---|---|
| Single model (Haiku) in production | All Tourbillon AI tasks are short-input, short-output. No routing layer needed. |
| Qwen 2.5 7B locally, not a stronger model | Weaker model exposes prompt edge cases. Prompts that survive 7B are robust everywhere. |
| Cache checked before quota | Cache hits cost nothing. Penalising them with quota wastes user allowance. |
| Pre-generate static AI content | Story pages and Discovery pages generated once, stored in DB. Zero runtime cost, zero latency. |
| Backend owns all logic | SQL handles filtering, sorting, scoring. AI called only for NLU and explanation. |
| Defensive parsing in Python | AI service strips preamble, validates JSON schema, retries on parse failure. Never trust raw LLM output. |

### Key Decisions Still Open

- **Vercel vs Amplify**: Vercel is simpler for Next.js; Amplify ties into AWS ecosystem better if everything else is AWS
- **AI Chatbot**: Self-hosted (full control, higher cost) vs third-party API (simpler, usage-based pricing)
- **Database hosting**: Managed PostgreSQL (RDS) vs PostgreSQL pod in K8s. RDS is recommended — you don't want to manage database backups and failover yourself
- **ai-service scope**: Will handle chatbot, AI Watch Finder, Compare Mode insights, Story-first content generation, Taste Profile, and Discovery Pages. See `ROADMAP.md` for full feature list.
- **Redis hosting**: ElastiCache (managed) vs Redis pod in K8s. ElastiCache is simpler but adds AWS cost
