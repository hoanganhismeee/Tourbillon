# Phase 11: Trend Intelligence Hub

## Context

The `/trend` route exists but is a placeholder stub. Phase 11 transforms it into a data-driven intelligence hub combining four features: real-time popularity analytics, price history charting (model already exists), AI-generated market insights, and a price alert subscription system. All four features reuse existing infrastructure (Hangfire, Redis, EmailService, Claude API) — no new external services required.

Phase 11 replaces the trend stub while pushing the original Phase 11 (S3/CloudFront) to Phase 12 and Kubernetes to Phase 13.

---

## Sub-Phase Breakdown

---

### 11A — Popularity Analytics ("Most Sought After")

**What it does:** Aggregates `UserFavourites` by `WatchId`, ranks by save count, surfaces the top N watches on the Trend page.

**Backend:**
- New endpoint: `GET /api/trend/popular?limit=12` in new `TrendController.cs`
- Query: `GROUP BY WatchId`, `COUNT(*)`, join with `Watches + Brand`, return `WatchDto` list with a `SaveCount` field appended
- No new model or migration needed — uses existing `UserFavourites` table

**Frontend:**
- New section on `/trend`: "Most Sought After" — grid of `WatchCard` components with a subtle "saved N times" badge
- Fetch via `lib/api.ts` → `getTrendingWatches(limit)`

**Files:**
- `backend/Controllers/TrendController.cs` (new)
- `backend/DTOs/TrendingWatchDto.cs` (new — WatchDto + SaveCount)
- `frontend/lib/api.ts` — add `getTrendingWatches()`
- `frontend/app/trend/page.tsx` — replace stub with real sections
- `frontend/app/trend/TrendClient.tsx` (new — client component)

---

### 11B — Price History Tracker

**What it does:** Snapshots `Watch.CurrentPrice` daily via a Hangfire recurring job into the existing `PriceTrends` table, then surfaces price movement charts on the Trend page (biggest movers) and on each Watch detail page.

**Key fact:** `PriceTrend` model and `PriceTrends` DbSet already exist:
```csharp
// backend/Models/PriceTrend.cs — already in codebase
public class PriceTrend {
    public int Id { get; set; }
    public decimal PriceHistory { get; set; }  // price at snapshot time
    public DateTime Date { get; set; }
    public int WatchId { get; set; }
    public Watch? Watches { get; set; }
}
```

**Backend:**
- New `PriceHistoryService.cs`:
  - `SnapshotAllPricesAsync()` — iterates all watches, inserts `PriceTrend` row only if price changed since last snapshot (idempotent). Scheduled via `RecurringJob.AddOrUpdate` (daily at midnight UTC).
  - `GetPriceHistoryAsync(watchId)` — returns ordered list of `(Date, Price)` pairs
  - `GetBiggestMoversAsync(limit, days)` — returns watches with highest % change in last N days
- Register recurring job in `Program.cs`: `RecurringJob.AddOrUpdate<PriceHistoryService>("daily-price-snapshot", x => x.SnapshotAllPricesAsync(), Cron.Daily)`
- New endpoints in `TrendController.cs`:
  - `GET /api/trend/price-movers?days=30&limit=8` — biggest movers
  - `GET /api/watches/{slug}/price-history` — in `WatchController.cs`

**Frontend:**
- Install `recharts` (lightweight, works with Next.js App Router)
- New `PriceHistoryChart.tsx` component — line chart of price over time
- Trend page section: "Price Movements" — top movers with mini sparklines
- Watch detail page: expandable "Price History" section below specs

**Files:**
- `backend/Services/PriceHistoryService.cs` (new)
- `backend/Controllers/TrendController.cs` — add price-movers endpoint
- `backend/Controllers/WatchController.cs` — add price-history endpoint
- `frontend/app/components/trend/PriceHistoryChart.tsx` (new)
- `frontend/app/watches/[slug]/` — add price history section
- `frontend/lib/api.ts` — add `getPriceMover()`, `getWatchPriceHistory(slug)`

---

### 11C — AI Market Insights Feed

**What it does:** A Hangfire recurring job aggregates real analytics (top saved, top searched, price shifts) and POSTs to the ai-service to generate a short editorial-style "weekly digest." The digest is stored in a new `MarketInsight` table and served on the Trend page as editorial cards.

**Backend:**
- New `MarketInsight` model + migration:
  ```csharp
  public class MarketInsight {
      public int Id { get; set; }
      public string Headline { get; set; }       // "Nautilus demand hits 12-month high"
      public string Body { get; set; }            // 2-3 sentence digest
      public string Category { get; set; }        // "demand" | "price" | "collection"
      public DateTime GeneratedAt { get; set; }
  }
  ```
- New `MarketInsightService.cs`:
  - `GenerateInsightsAsync()` — aggregates top 5 saved watches + biggest price movers + top search terms (from `QueryCaches` table), builds structured payload, POSTs to `/generate-insights` on ai-service, saves 3-5 `MarketInsight` rows
  - `GetLatestInsightsAsync(limit)` — returns most recent insights
  - Scheduled weekly: `RecurringJob.AddOrUpdate<MarketInsightService>("weekly-insights", x => x.GenerateInsightsAsync(), Cron.Weekly)`
- New `/generate-insights` route in `ai-service/app.py` — structured prompt, returns JSON array of `{headline, body, category}`
- New endpoint: `GET /api/trend/insights?limit=6` in `TrendController.cs`

**Frontend:**
- Trend page section: "Market Intelligence" — editorial cards (headline + body + category badge)
- `InsightCard.tsx` component — minimal card with category tag and timestamp

**Files:**
- `backend/Models/MarketInsight.cs` (new)
- `backend/Migrations/` — new migration for MarketInsights table
- `backend/Services/MarketInsightService.cs` (new)
- `backend/Controllers/TrendController.cs` — add insights endpoint
- `backend/Database/TourbillonContext.cs` — add `DbSet<MarketInsight>`
- `ai-service/app.py` — add `/generate-insights` route
- `frontend/app/components/trend/InsightCard.tsx` (new)
- `frontend/lib/api.ts` — add `getTrendInsights()`

---

### 11D — Price Alert System

**What it does:** Authenticated users subscribe to a watch. A Hangfire recurring job checks for price changes daily and fires `BackgroundEmailService` for any matched alerts.

**Backend:**
- New `PriceAlert` model + migration:
  ```csharp
  public class PriceAlert {
      public int Id { get; set; }
      public string UserId { get; set; }
      public int WatchId { get; set; }
      public decimal PriceAtSubscription { get; set; }
      public DateTime CreatedAt { get; set; }
      public bool IsActive { get; set; }
      // Navigation
      public Watch? Watch { get; set; }
      public ApplicationUser? User { get; set; }
  }
  ```
- New `PriceAlertService.cs`:
  - `SubscribeAsync(userId, watchId)` — upsert active alert, store current price
  - `UnsubscribeAsync(userId, watchId)` — set IsActive = false
  - `GetUserAlertsAsync(userId)` — list active alerts
  - `CheckAndNotifyAsync()` — for each active alert, compare current price vs PriceAtSubscription; if changed, enqueue email via `BackgroundJob.Enqueue<BackgroundEmailService>(...)`, then update stored price
  - Scheduled daily: `RecurringJob.AddOrUpdate<PriceAlertService>("daily-price-alerts", x => x.CheckAndNotifyAsync(), Cron.Daily)`
- New `PriceAlertController.cs`:
  - `POST /api/price-alerts/{watchSlug}` — subscribe (auth required)
  - `DELETE /api/price-alerts/{watchSlug}` — unsubscribe (auth required)
  - `GET /api/price-alerts` — list user's active alerts (auth required)

**Frontend:**
- Watch detail page: "Notify me of price changes" toggle button (shown only when logged in)
  - Same pattern as `FavouriteToggle.tsx` — optimistic update, auth-gated
- Account page (`/account/edit-details` or new `/account/alerts` tab): list of active price alerts with unsubscribe button
- `PriceAlertToggle.tsx` component — mirrors `FavouriteToggle.tsx` pattern

**Files:**
- `backend/Models/PriceAlert.cs` (new)
- `backend/Migrations/` — new migration for PriceAlerts table
- `backend/Services/PriceAlertService.cs` (new)
- `backend/Controllers/PriceAlertController.cs` (new)
- `backend/Database/TourbillonContext.cs` — add `DbSet<PriceAlert>`
- `frontend/app/components/PriceAlertToggle.tsx` (new)
- `frontend/app/watches/[slug]/` — add PriceAlertToggle
- `frontend/app/account/` — add alerts management section
- `frontend/lib/api.ts` — add `subscribePriceAlert(slug)`, `unsubscribePriceAlert(slug)`, `getUserPriceAlerts()`

---

## Trend Page Final Layout

```
/trend
├── Hero — "Intelligence" heading + subtitle
├── Section 1 (11A) — "Most Sought After" — watch grid with save count badges
├── Section 2 (11B) — "Price Movements" — top movers with sparkline charts
├── Section 3 (11C) — "Market Intelligence" — AI-generated insight cards
└── Section 4 (11D) — "Price Alerts" — CTA for authenticated users
```

---

## Shared Infrastructure Reused

| Need | Existing piece |
|---|---|
| Background jobs | Hangfire (`BackgroundJob.Enqueue`, `RecurringJob.AddOrUpdate`) |
| Email dispatch | `BackgroundEmailService.SendAsync(to, subject, body)` |
| AI content generation | ai-service Flask pattern (mirror `/generate-editorial`) |
| Popularity data | `UserFavourites` DbSet |
| Price history storage | `PriceTrends` DbSet + `PriceTrend` model |
| Auth-gated UI | Pattern from `FavouriteToggle.tsx` |
| Watch DTO | `WatchDto.FromWatch(w, CloudName)` |

---

---

### Pre-Phase — Guest Sign-in Nudge Enhancements (implement first, standalone)

**What it does:** Two small UI copy + layout changes that tease the upcoming price alert feature to unauthenticated users.

**Change 1 — `SignInNudge` in `FavouriteToggle.tsx`:**
- Widen popup from `width: 180` → `width: 220`, update left offset accordingly (`anchorRect.right - 220`)
- Replace single line `"Sign in to save watches"` with two lines:
  - Primary: `"Sign in to save watches"`
  - Subtitle (smaller, muted): `"and get email alerts on price drops for your favourites"`
- Keep 1.5s auto-dismiss and existing button unchanged

**Change 2 — Guest CTA on `/trend` page:**
- Create `frontend/app/trend/TrendSignInCta.tsx` — client component, checks `useAuth().isAuthenticated`
- When guest: renders a subtle banner/card — *"Sign in to track price changes and receive email alerts on watches you follow"* + Sign in button linking to `/login?redirect=/trend`
- When authenticated: renders nothing (`null`)
- Insert component into `trend/page.tsx` below the heading

**Files:**
- `frontend/app/components/favourites/FavouriteToggle.tsx` — `SignInNudge` component only
- `frontend/app/trend/TrendSignInCta.tsx` (new)
- `frontend/app/trend/page.tsx` — import and add `<TrendSignInCta />`

---

## New Dependencies

- `recharts` — npm package for price history charts (SSR-safe with dynamic import)

---

## Commit Strategy (per memory)

| Chunk | Contents |
|---|---|
| 1 | Models + migrations (PriceAlert, MarketInsight) |
| 2 | PriceHistoryService + TrendController (11B backend) |
| 3 | PriceAlertService + PriceAlertController (11D backend) |
| 4 | MarketInsightService + ai-service route (11C backend) |
| 5 | TrendController popularity endpoint (11A backend) |
| 6 | Frontend: TrendClient + all Trend page sections |
| 7 | Frontend: PriceHistoryChart + Watch detail integration |
| 8 | Frontend: PriceAlertToggle + account alerts section |
| 9 | Docs: ROADMAP + CLAUDE.md + architecture.md updates |

---

## Verification

1. Start Docker (`docker compose up`) → backend + Redis + PostgreSQL
2. Run `dotnet ef database update` — confirms migrations applied cleanly
3. Trigger `SnapshotAllPricesAsync` via Hangfire dashboard → verify `PriceTrends` rows inserted
4. Subscribe to a watch price alert → change `CurrentPrice` in DB → trigger `CheckAndNotifyAsync` → verify email received
5. Trigger `GenerateInsightsAsync` via Hangfire dashboard → verify `MarketInsights` rows + ai-service response
6. Navigate to `/trend` → all 4 sections render with real data
7. Run `npx tsc --noEmit` — zero TypeScript errors
8. Run `dotnet build --no-restore` — zero compile errors
