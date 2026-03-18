# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Tourbillon is a luxury watch e-commerce platform. Stack: .NET 8 Web API + Next.js 15 (App Router) + PostgreSQL + Cloudinary image hosting.

## Commands

### Build & Validation (run after every code change)

**Backend — compile check:**
```bash
cd backend && dotnet build --no-restore 2>&1
```

**Frontend — type-check + lint:**
```bash
cd frontend && npm run build 2>&1
```

Run these after every change and fix all errors before moving on. `dotnet build` catches C# compile errors; `npm run build` catches TypeScript type errors and Next.js build issues that `npm run dev` silently ignores.

### Backend (ASP.NET Core)
```bash
cd backend
dotnet restore
dotnet ef database update   # Apply EF Core migrations
dotnet run                  # API on http://localhost:5248 (Swagger auto-opens)
```

Secrets are stored via .NET user-secrets (never in appsettings.json):
```bash
dotnet user-secrets set "Anthropic:ApiKey" "sk-ant-..."
dotnet user-secrets set "CloudinarySettings:ApiSecret" "..."
```

### Frontend (Next.js)
```bash
cd frontend
npm install
npm run dev          # Dev server on http://localhost:3000 (Turbopack)
npm run dev-fresh    # Clears .next cache before starting
npm run build        # Full build + type-check (use for validation)
npm run lint
```

### Docker (dev workflow)
Frontend is intentionally excluded from `docker-compose.yml` — it runs locally for instant HMR. Only `db`, `backend`, and `ai-service` are containerized.

```bash
# Terminal 1 — backend + db
docker compose up

# Terminal 2 — frontend with hot reload
cd frontend && npm run dev
```

For production deployment, add the frontend service back to the compose file and build with `--build`.

### Database
EF Core with Npgsql. Migrations live in `backend/Migrations/`. Connection string in `appsettings.json` → `ConnectionStrings.DefaultConnection`.

## Architecture

### Backend Structure
- **Controllers/** — 8 REST controllers. `AdminController` handles all scraping endpoints. `WatchController`, `BrandController`, `CollectionController` are standard CRUD.
- **Services/** — Business logic. Key services: `SitemapScraperService` (Selenium + Claude AI pipeline), `ClaudeApiService` (LLM extraction), `WatchCacheService` (DB insert with duplicate checking), `CloudinaryService`.
- **Models/** — EF Core entities. `Watch.Name` = reference number, `Watch.Description` = brand subtitle, `Watch.Specs` = JSON string serialized as `WatchSpecs`.
- **Database/DbInitializer.cs** — Seeds 9 "Holy Trinity" showcase watches (PP Nautilus, VC Overseas, AP Royal Oak) on startup. These are preserved during scrape-clear operations.
- **Data/** — `brands.csv` (13 brands) and `collections.csv` (~51 collections) loaded at startup.

### Frontend Structure
- **lib/api.ts** — Centralized API client with 100+ exported functions. All backend calls go through here.
- **app/contexts/** — Three React Context providers: `AuthContext` (user auth state), `WatchesPageContext` (listing/filter state), `NavigationContext`.
- **app/scrollMotion/** — Reusable Framer Motion wrappers (`ScrollFade`, `StaggeredFade`, `MotionMain`).
- **app/scrape/** — Admin scraping UI (password-protected, calls `/api/scraper-proxy/` Next.js route handlers which proxy to backend).

### Authentication
ASP.NET Identity with `HttpOnly` cookie sessions (30-min sliding expiration, `SameSite=Strict`). Role `"Admin"` gates scraping endpoints. First admin: `POST /api/authentication/setup-first-admin`.

### Scraping Pipeline
Universal approach: Selenium renders page → HtmlAgilityPack strips HTML to ~20-30KB → Claude Haiku API extracts structured JSON (name, ref number, price, image URL, specs). Two entry points:
- `scrape-sitemap` — parses sitemap.xml, filters by collection slug, scrapes each product URL
- `scrape-listing` — Claude extracts product URLs from a listing page first, then scrapes each

Cost: ~$0.001/watch via Claude Haiku. Max 25 watches per collection (cost-conscious limit).

## Data Conventions

- `Watch.Name` = reference number (e.g., `"1-36-01-02-05-61"`)
- `Watch.Description` = brand model subtitle (e.g., `"Glashütte Original Senator Excellence"`)
- `Watch.Specs` = JSON string: `{"dial":{}, "case":{}, "movement":{}, "strap":{}}`
- **Price = 0 means "Price on Request" (PoR)** — valid for luxury watches, never treat as error or delete
- Cloudinary image public IDs stored in `Watch.Image` (not full URLs). Full URL built via helper in `Watch.cs` / `lib/cloudinary.ts`.

## Coding Standards (from Cursor rules)

- **Comments:** 1–3 per file max; brief header comment describing purpose at top of each file/class
- **SOLID + DRY + KISS + YAGNI** — no speculative abstractions, no duplicate logic
- **No emojis** in code or output
- Watch image filenames: `brand+model.png` (e.g., `PP6119G.png`)
- Scrape full collection sizes — problematic batches can be wiped by brand ID after the fact
- Product cards must have clickable brand/collection name links; verify this when modifying watch cards
- For watch detail page specs layout, follow the Patek Philippe / Vacheron Constantin spec table structure (sectioned tables: Dial, Case, Movement, Strap)

## Key File References

| Purpose | File |
|---|---|
| Scraping documentation | `backend/SCRAPING_GUIDE.md` |
| Brand scrape progress | `backend/SCRAPE_STATUS.md` |
| Brand/collection IDs | `backend/Data/brands.csv`, `backend/Data/collections.csv` |
| API client | `frontend/lib/api.ts` |
| Image URL helpers | `frontend/lib/cloudinary.ts` |
| DB context + seeding | `backend/Database/TourbillonContext.cs`, `DbInitializer.cs` |
| Claude extraction service | `backend/Services/ClaudeApiService.cs` |
| Main scraper service | `backend/Services/SitemapScraperService.cs` |
| Feature roadmap | `ROADMAP.md` |