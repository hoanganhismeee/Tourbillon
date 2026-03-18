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
- `ai-service/` directory contains a Flask skeleton (`app.py` is empty). Placeholder for a future standalone Python AI service that will own all LLM calls.
- Selenium/scraping components are **temporary** — used only during initial product data collection, will be removed once all brands are scraped. Not part of the production architecture.
- Claude Haiku API calls currently live in `ClaudeApiService.cs` in the backend. These will migrate to `ai-service/` when that service is built out.

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
- `WatchCacheService` — Inserts scraped watches into DB with duplicate checking by reference number.
- `BrandScraperService` — Legacy per-brand XPath scraper. Superseded.

**User/auth:**
- `UserRegistrationService`, `UserProfileService`, `PasswordChangeService`, `PasswordResetService`, `AccountDeletionService`, `RoleManagementService`
- `PasswordChangeRateLimitService` — Rate limiting

**Infrastructure:**
- `CloudinaryService` — Upload from URL (scrape pipeline) or stream (manual upload), delete. All uploads use `Overwrite = true`.
- `EmailService` — SMTP email sending
- `CurrencyConverter` — Currency conversion singleton

### Models (8)

| Model | Notes |
|---|---|
| `Watch` | Name = reference number, Description = brand subtitle, Specs = JSON string, Image = Cloudinary public ID |
| `Brand` | 13 brands loaded from `Data/brands.csv` |
| `Collection` | ~51 collections loaded from `Data/collections.csv` |
| `User` | ASP.NET Identity user |
| `PriceTrend` | Price history per watch |
| `BrandScraperConfig` | XPath config for legacy scraper (temporary) |
| `WatchSpecs` | Deserialized specs: DialSpecs, CaseSpecs, MovementSpecs, StrapSpecs |
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
| `/` | Home / landing page |
| `/brands/[brandId]` | Brand detail |
| `/collections/[collectionId]` | Collection detail |
| `/watches/` | Watch listing + detail |
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

- `app/api/scraper-proxy/` — Proxies scrape requests to .NET backend (temporary)
- `app/api/search/` — Search proxy
- `app/api/upload/` — Upload proxy

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
- **Caching**: None
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

### Key Decisions Still Open

- **Vercel vs Amplify**: Vercel is simpler for Next.js; Amplify ties into AWS ecosystem better if everything else is AWS
- **AI Chatbot**: Self-hosted (full control, higher cost) vs third-party API (simpler, usage-based pricing)
- **Database hosting**: Managed PostgreSQL (RDS) vs PostgreSQL pod in K8s. RDS is recommended — you don't want to manage database backups and failover yourself
- **ai-service scope**: Will handle chatbot, AI Watch Finder, Compare Mode insights, Story-first content generation, Taste Profile, and Discovery Pages. See `ROADMAP.md` for full feature list.
- **Redis hosting**: ElastiCache (managed) vs Redis pod in K8s. ElastiCache is simpler but adds AWS cost
