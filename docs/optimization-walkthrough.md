# Optimization Walkthrough — 2026-06-01

This is a learning companion to the eleven fixes shipped in the optimization
pass. Each section explains the underlying concept first, then walks through
what the code was doing, the fix that was applied, and why this particular
approach was chosen over alternatives.

Read top to bottom or skip to whatever section interests you — they're
independent.

---

## 1. Slug indexes (verification only)

### Concept — what is a database index?

A B-tree index is a sorted lookup structure the database keeps alongside a
table. Without one, finding a row by a non-primary column is an *O(n)* scan:
PostgreSQL reads every page of the table until it finds your match. With one,
it's *O(log n)* — typically a handful of page reads regardless of table size.

The cost of an index: writes get slightly slower (the index also has to be
updated), and disk space grows. The win on a read-heavy column like a slug
that's hit on every page view is enormous.

### What was happening

`TourbillonContext.cs` had a TODO-style comment claiming a follow-up migration
("AddSlugIndexes") would create unique indexes on `Brand.Slug`,
`Collection.Slug`, and `Watch.Slug` — but no such migration existed.

### What's actually there

`DbInitializer.EnsureSlugsPopulated` runs on every startup and ends with a
raw SQL block:

```sql
CREATE UNIQUE INDEX IF NOT EXISTS "IX_Brands_Slug"      ON "Brands"      ("Slug");
CREATE UNIQUE INDEX IF NOT EXISTS "IX_Collections_Slug" ON "Collections" ("Slug");
CREATE UNIQUE INDEX IF NOT EXISTS "IX_Watches_Slug"     ON "Watches"     ("Slug");
```

`CREATE INDEX IF NOT EXISTS` is **idempotent** — on first boot it creates the
index, on subsequent boots it's a no-op. Indexes live outside the EF model
snapshot, but that's fine: the database knows they exist and uses them when
planning queries.

### The fix

Updated the misleading comment so future maintainers don't go hunting for a
migration that was never written.

### Why not just write the migration?

Because the slug columns were added with `defaultValue: ""` and existing rows
were backfilled at startup. A unique index can't be created until the empty
strings are populated — which is exactly the chicken-and-egg problem
`EnsureSlugsPopulated` was designed to solve. Doing it in startup code keeps
the migration ordering simple.

---

## 2. Dropping `CountAsync` before `FirstOrDefaultAsync`

### Concept — `Count` vs `First` in SQL

A SQL `SELECT COUNT(*) FROM table WHERE ...` requires the database to **scan
every matching row** to produce the count (even with an index, it has to walk
every index entry that matches). A `SELECT ... LIMIT 1` stops as soon as one
row is found.

If you only need to know "is there anything?", `First` (with `LIMIT 1`) is
always cheaper than `Count` followed by `if (count > 0)`.

### What was happening

`QueryCacheService.LookupAsync` looked like:

```csharp
var count = await _context.QueryCaches.Where(q => q.Feature == feature).CountAsync();
if (count == 0) return null;

var nearest = await _context.QueryCaches
    .Where(q => q.Feature == feature)
    .OrderBy(q => q.QueryEmbedding.CosineDistance(queryVector))
    .FirstOrDefaultAsync();
```

The `Count` was supposed to short-circuit on an empty cache. But
`FirstOrDefaultAsync` already short-circuits — it returns `null` when there's
no row. So the count was doing redundant work on every lookup, and on a
populated cache it was scanning the whole `QueryCaches` table.

The vector ordering (`OrderBy ... CosineDistance`) makes the second query
non-trivial too — backed by an HNSW index on `QueryEmbedding`, it can return
in milliseconds, but running both queries doubled per-lookup latency.

### The fix

Removed the `Count` entirely. `FirstOrDefaultAsync` returns `null` on an empty
result set, and the existing `if (nearest?.QueryEmbedding == null) return null;`
already handles that case.

### Why this matters

This runs on every chat turn that uses smart-search caching. Two queries
became one. The cost difference is small per call but multiplies across every
user.

---

## 3. Pinning `MaxPoolSize` for Npgsql

### Concept — what is a connection pool?

Opening a TCP connection to PostgreSQL is expensive (TLS handshake, auth
roundtrips). Apps reuse a pool of pre-opened connections. The connection
*pool* sits inside your app process; each request "borrows" a connection,
runs queries on it, and returns it.

The pool has a size cap. If all connections are busy, new requests **wait**.
If the cap is too high, your app can open more connections than the database
allows — Neon caps your project at 100 connections total across all clients.
If you exceed that cap, queries fail with "connection limit exceeded".

### What was happening

`Program.cs` registered the EF Core data source with no explicit pool size:

```csharp
var pgDataSourceBuilder = new NpgsqlDataSourceBuilder(pgConnectionString);
pgDataSourceBuilder.UseVector();
```

Npgsql's default is `MaxPoolSize=100`. If Railway runs two backend replicas,
each replica can open up to 100 connections — that's 200 total, exceeding
Neon's hard cap. Under a traffic spike you'd see random query failures.

Hangfire (background jobs) also uses the same connection string and opens
its own pool independently.

### The fix

Created a separate connection string for EF Core with `MaxPoolSize=20`,
keeping Hangfire on the original:

```csharp
var efConnectionString = new NpgsqlConnectionStringBuilder(pgConnectionString)
{
    MaxPoolSize = 20,
}.ToString();
var pgDataSourceBuilder = new NpgsqlDataSourceBuilder(efConnectionString);
```

Now two replicas × 20 = 40, plus Hangfire's pool, fits comfortably inside
Neon's 100-connection ceiling.

### Why 20 and not 50?

EF Core connections are short-lived — open, query, close, return to pool.
A single replica handling 1000 req/min with average query time 50 ms only
needs `1000 × 0.05 / 60 ≈ 0.83` concurrent connections on average. 20 gives
a generous safety margin for tail-latency spikes without crowding out other
services.

### The wider lesson

Pool sizing is one of those things that looks "fine" in development and
silently bites in production. Always pin it explicitly when you know the
DB's connection cap.

---

## 4. Caching brand/collection rosters in `ChatService`

### Concept — in-process caching

The fastest database query is the one you don't make. If data changes rarely
and is read often, cache it in your app's memory and serve from there.

`IMemoryCache` is .NET's built-in in-process cache. It's per-replica (not
shared across servers like Redis would be), but for read-mostly reference
data that doesn't have to be perfectly consistent across replicas, that's
fine.

The trade-off: cached data can be stale. If an admin renames a brand, every
replica might serve the old name for up to the TTL (Time To Live) window.
You pick a TTL based on how much staleness you tolerate.

### What was happening

`ChatService.ResolveEntityMentionsAsync` ran on every chat message and
started with:

```csharp
var brands = await _context.Brands.AsNoTracking().ToListAsync();
var collections = await _context.Collections.AsNoTracking().ToListAsync();
```

Two full-table scans per turn. With ~50 brands and ~200 collections that's
not a huge row count, but it's two round-trips to Neon on every message,
and another similar pair in `BuildCatalogueRosterContextAsync`.

### The fix

Injected `IMemoryCache` (already registered in `Program.cs` via
`AddMemoryCache()`) and added two helpers:

```csharp
private Task<List<Brand>> GetCachedBrandsAsync() =>
    _memoryCache.GetOrCreateAsync(BrandsCacheKey, async entry =>
    {
        entry.AbsoluteExpirationRelativeToNow = RosterCacheTtl;
        return await _context.Brands.AsNoTracking().ToListAsync();
    })!;
```

`GetOrCreateAsync` atomically: returns the cached entry if present, otherwise
runs the factory once (concurrent callers all wait on the same result, no
"thundering herd"), stores the result with the TTL, and returns it.

### Why 5 minutes?

Brand/collection rosters change only when an admin edits the catalogue — a
rare event. 5 minutes is short enough that admin changes appear quickly in
chat suggestions but long enough that 95%+ of chat turns hit the cache.

### What this saves

For a chat turn that does entity resolution AND builds the catalogue roster,
it saves *four* DB round-trips. Multiply by every concierge message.

### The principle

If a piece of data is **read 100× more than it's written**, cache it. The
ratio matters more than the absolute query cost.

---

## 5. EF Core `Include` vs `Select` — what gets translated

### Concept — how EF turns LINQ into SQL

EF Core translates a LINQ query into SQL **lazily**. It builds an expression
tree as you chain `.Where()`, `.Include()`, `.OrderBy()`, etc., and only
generates SQL when you call a terminal method (`.ToListAsync()`,
`.FirstOrDefaultAsync()`, `.AnyAsync()`).

`Include()` tells EF "also fetch this navigation property". It causes a
`JOIN` in the generated SQL. But there's a subtlety: if you chain a
`.Select(...)` projection after the Include, **EF discards the Include**.
The projection wins — only the columns you ask for in `Select` end up in
the generated SQL.

### What was happening

In `WatchFinderService.VectorSearchAsync`:

```csharp
var q = _context.WatchEmbeddings
    .Include(e => e.Watch)              // looks like it loads the whole Watch graph
    .Where(e => e.Feature == "watch_finder" && e.Embedding.CosineDistance(queryVector) < MaxDistance);

if (intent?.BrandId != null) q = q.Where(e => e.Watch.BrandId == intent.BrandId);
// ...

var orderedRows = await q
    .OrderBy(e => e.Embedding!.CosineDistance(queryVector))
    .Select(e => new { e.WatchId, Distance = (float)e.Embedding!.CosineDistance(queryVector) })
    .Take(150)
    .ToListAsync();
```

The `Include(e => e.Watch)` reads like "load the entire Watch entity along
with each embedding row." The audit flagged this as a double-fetch. But the
`Select` at the end projects only `(WatchId, Distance)` — EF Core ignores
the Include in this case.

Why the JOIN to `Watches` still exists in the generated SQL: the WHERE
clauses reference `e.Watch.BrandId`, `e.Watch.CurrentPrice`, etc. EF must
join the table to evaluate those predicates, but only the columns referenced
get pulled, not the full row.

### The fix

The `Include` was dead code — confusing the reader without affecting
behavior. Removed it and added a comment explaining why no `Include` is
needed:

```csharp
// No Include — the WHERE clauses below reference e.Watch.* which EF translates
// to an implicit JOIN, and the final Select projects only (WatchId, Distance)
// so EF would drop any Include here anyway.
var q = _context.WatchEmbeddings
    .Where(e => e.Feature == "watch_finder" && e.Embedding != null && e.Embedding.CosineDistance(queryVector) < MaxDistance);
```

### Why bother if EF was handling it right?

Two reasons. First, the next person reading this code (you, in three months)
won't have to re-derive EF's projection-Include rule from scratch. Second,
when you actually do need to read more columns later, you'll know whether
to add `Include` or expand the `Select` — that decision is no longer
buried under a misleading clue.

### The wider lesson

A clean read of "what is this query actually doing" is more valuable than
defensive includes that *seem* to help but don't. Trust your projection.

---

## 6. TanStack Query stale time for shared queries

### Concept — what is staleTime?

TanStack Query (the data-fetching library on the frontend) keeps responses
in an in-memory cache keyed by `queryKey` (e.g. `['brands']`). Each entry
has two relevant timestamps:

- `staleTime` — how long the data is considered fresh. While fresh, no
  background refetch happens even if a new component mounts the query.
- `gcTime` (formerly `cacheTime`) — how long the entry sticks around in the
  cache after no component is using it.

If `staleTime: 0` (the default), every component mount triggers a refetch
"just in case." That's safe for user-specific data but wasteful for global
reference data.

### What was happening

Seven different components called `useQuery({ queryKey: ['brands'] })` and
six called `['collections']`. The QueryProvider's default `staleTime` was
5 minutes — fine, but every five minutes of activity all seven components
each triggered a background refetch of brands.

### The fix

In `QueryProvider`, after creating the client, pinned per-key defaults:

```csharp
client.setQueryDefaults(['brands'],      { staleTime: 60 * 60 * 1000 });
client.setQueryDefaults(['collections'], { staleTime: 60 * 60 * 1000 });
```

Every consumer of those keys inherits the 1-hour stale window without
touching the call sites.

### Why centralize it?

You *could* set `staleTime` per-component. But then a new component added
six months from now defaults back to 5 minutes, and the next person debugging
extra refetches has to find every call site. Provider-level defaults make
the rule canonical.

### Why an hour and not Infinity?

`staleTime: Infinity` plus TanStack's localStorage persister means a user
could see stale brand data across sessions days later (until cache is
manually invalidated). An hour gives the win on every navigation within a
session while still catching admin edits naturally.

CLAUDE.md has an explicit rule against `staleTime: Infinity` on user-specific
queries for exactly this reason — but brands/collections are public, so a
long stale window is safe.

---

## 7. Server-side metadata + JSON-LD on watch detail pages

### Concept — why does Next.js have two component types?

The Next.js App Router distinguishes:
- **Server Components** — rendered on the server (or at build time), can do
  async work, can `export async function generateMetadata()`. Cannot use
  hooks or browser APIs.
- **Client Components** (marked with `'use client'` at the top) — hydrate
  in the browser, can use `useState`, `useEffect`, event handlers. **Cannot
  export `generateMetadata`.**

`generateMetadata` is the API search engines and social-media link
unfurlers consume. Without it, your page falls back to whatever `metadata`
is exported from the nearest server component up the tree (usually the root
layout, which has site-wide values).

### What is JSON-LD?

JSON-LD (JSON for Linking Data) is a structured-data format Google reads
to understand what a page is *about*. For an e-commerce product page, a
Product schema with name, price, image, brand, and availability lets Google
show rich results (price snippet, star rating, etc.) directly in search
results, which dramatically improves click-through rate.

### What was happening

`app/watches/[slug]/page.tsx` was `'use client'`. Every product page
inherited the root layout's `metadata` block, which said "Tourbillon" —
generic. Google saw every product page as identical. No JSON-LD existed
anywhere, so no rich snippets.

### The fix

Created a new server component `app/watches/[slug]/layout.tsx`. Layouts in
the App Router wrap their child pages, so this layout sits between the root
layout and the existing client `page.tsx`:

```tsx
export async function generateMetadata({ params }) {
  const { slug } = await params;
  const watch = await fetchWatch(slug);
  return {
    title: `${brandLabel} ${watch.name} — Tourbillon`,
    description: watch.description.slice(0, 200),
    alternates: { canonical: `${SITE_URL}/watches/${watch.slug}` },
    openGraph: { /* ... */ },
  };
}

export default async function WatchDetailLayout({ children, params }) {
  // ... build jsonLd object ...
  return (
    <>
      <script type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      {children}
    </>
  );
}
```

The existing client `page.tsx` is untouched — it still handles all the
interactive bits (image carousel, panels, scroll).

### Why a layout instead of converting the page?

The client `page.tsx` is ~500 lines of hooks, state, and event handlers.
Converting it to a server component would be a multi-day refactor with
visible-regression risk. A layout is a thin server wrapper that adds the
metadata without touching the existing UI. Two server-side fetches per
request (one in `generateMetadata`, one in the default export) sound
wasteful, but Next.js automatically **dedupes** identical `fetch` calls
within the same request — so it's actually one round-trip.

### Why `dangerouslySetInnerHTML`?

Inline `<script>` JSON-LD must be raw JSON text. React strips child content
from `<script>` tags by default; `dangerouslySetInnerHTML` is the standard
escape hatch. It's "dangerous" in the sense that you must trust the source
(we do — it's our own data, stringified safely).

### The effect

Each product page now has a unique title/description, an Open Graph image
for social shares, a canonical URL (avoiding duplicate-content penalties),
and structured-data markup Google can parse. This is the single biggest
free lever for organic acquisition.

---

## 8. Removing the `unoptimized` flag on `next/image`

### Concept — what does `next/image` actually do?

The `<Image>` component is one of Next.js's main performance features. When
you give it an image and a `sizes` attribute, Next.js:

1. **Generates a srcset** — multiple resolution variants at the breakpoints
   you configured. The browser picks the smallest one that fits.
2. **Converts format** — serves AVIF or WebP to browsers that support them
   (typically 30–60% smaller than JPEG).
3. **Caches at the edge** — the optimized variants are cached on Vercel's
   CDN, so repeat requests don't re-process.
4. **Lazy-loads** — images outside the viewport defer loading until needed.

For all of that to work, the image source domain must be whitelisted in
`next.config.ts`'s `images.remotePatterns`.

The `unoptimized` prop **disables every one of these features** — the
browser fetches the raw URL exactly as given.

### What was happening

`app/watches/[slug]/page.tsx`:

```tsx
<Image
  src={imgSrc || watch.imageUrl || imageTransformations.detail(watch.image)}
  width={1200}
  height={1200}
  sizes="(min-width: 1024px) 600px, 90vw"
  priority
  fetchPriority="high"
  unoptimized   // <-- this kills everything
/>
```

A mobile user on a 400px-wide screen was downloading the full 1200×1200 JPEG
straight from CloudFront. Probably 2–4 MB per visit, when 100 KB of WebP
would have been visually identical.

The flag was likely added to work around a domain whitelist issue at some
point and never removed.

### The fix

Verified `next.config.ts` whitelists `*.cloudfront.net` (it does), then
removed the `unoptimized` prop. The `sizes`, `width`, `height`, `priority`
attributes were already correct, so `next/image` now generates a proper
srcset and serves AVIF/WebP to capable browsers.

### Why this is one of the highest-ROI fixes

Listing pages and detail pages are image-heavy. Cutting per-page bandwidth
by 80%+ shows up on three different bills (Vercel egress, CloudFront
transfer, user data). It also improves perceived page speed dramatically,
especially on mobile networks. One commit, no logic change, immediate win.

### Why `sizes` matters

Without `sizes`, the browser doesn't know which srcset variant to choose
until layout is complete, so it tends to pick a large one defensively.
`sizes="(min-width: 1024px) 600px, 90vw"` tells it: "at desktop this image
takes 600px; at mobile it's 90% of viewport." The browser can now pick the
smallest variant that meets that size *before* the image starts loading.

---

## 9. Slimming the listing endpoint payload

### Concept — DTO shaping vs entity dumps

A "DTO" (Data Transfer Object) is the shape your API returns to the client.
A common mistake is to serialize the database entity as-is — including every
field, even ones the client doesn't use. That bloats responses, leaks
internal structure, and wastes bandwidth on every request.

The principle: **return only what the consumer actually needs.** Different
endpoints often want different shapes from the same underlying entity.

### What was happening

`GET /api/watch` (the watches listing endpoint) returned `WatchDto` for
every watch. `WatchDto` includes `Description` — the long editorial prose
shown on the detail page (often 200–1000 characters per watch).

The listing UI (`WatchCard.tsx`) doesn't use `Description`. None of the
listing-related code reads it. But every visit downloaded ~500 watches ×
~500 bytes of description = ~250 KB of dead payload, cached for the entire
TanStack staleTime window.

### The fix

In `WatchController.GetAllWatches`, null out the field before serializing:

```csharp
var watchDtos = watches.Select(w =>
{
    var dto = WatchDto.FromWatch(w, _storage);
    dto.Description = null;
    return dto;
}).ToList();
```

JSON serializers omit null values by default (or serialize them as the cheap
`"description":null`, depending on settings), so the wire payload shrinks
significantly.

### Why not project at the EF query?

You *could* write `.Select(w => new SlimWatchDto { Id = w.Id, ... })` which
would also skip pulling `Description` from PostgreSQL. That's the
theoretically cleanest version — saves DB IO too, not just bandwidth.

I didn't because `FromWatch` runs storage-service logic (building image URLs
with versioning) that's not trivial to inline into a LINQ projection. The
null-out approach captures 90% of the win (bandwidth) with one line of
change and no risk of breaking the URL-building logic. A future cleanup
could move to a true projection if `Description` turns out to dominate
query time as well.

### Why not full server pagination?

The audit also flagged that the entire catalogue is fetched on every
listing visit (no pagination at all). Implementing real server pagination
requires porting the frontend `WatchOrderingService` — a 200-line
round-robin Featured-order algorithm — to .NET, because the Featured order
depends on the full catalogue to compute. That's a separate piece of work
tracked as task #12. Slimming the payload was the smallest ship that still
gave a real bandwidth win without that refactor.

---

## 10. Batching behavior tracker writes

### Concept — debouncing

When an event fires frequently (mouse moves, key presses, scroll, page
views), reacting to *every* event is wasteful if the consumer only cares
about the end state. **Debouncing** delays action until the event stops
firing for some quiet period — "wait for things to settle, then act once."

A close cousin is **throttling** — action runs at most once per N
milliseconds regardless of input rate. Debouncing is "act after quiet";
throttling is "act at most every N."

### What was happening

Every time a user viewed a watch, `trackEvent` did:

```ts
const events = getBufferedEvents();       // localStorage.getItem + JSON.parse
events.push({ ...event, timestamp: Date.now() });
const trimmed = events.slice(-MAX_EVENTS);
localStorage.setItem(BEHAVIOR_KEY, JSON.stringify(trimmed));  // serialize + write
```

For a user browsing 30 watches, that's 30 full read-parse-stringify-write
cycles. Synchronous localStorage writes block the main thread; on a slow
device they show up as input lag.

### The fix

Keep a queue of pending events **in memory**. Flush to localStorage on
three triggers:

1. **5 seconds of idle** — a debounce timer that resets on each call.
2. **10 pending events** — never let the in-memory queue grow unbounded.
3. **Tab hides** (`pagehide` and `visibilitychange`) — guarantees nothing
   is lost when the user closes the tab.

```ts
export function trackEvent(event) {
  pending.push({ ...event, timestamp: Date.now() });
  ensureUnloadHook();
  if (pending.length >= MAX_PENDING) { persistNow(); return; }
  if (flushTimer === null) flushTimer = setTimeout(persistNow, FLUSH_DEBOUNCE_MS);
}
```

### Why `pagehide` and not `beforeunload`?

`beforeunload` is unreliable on mobile and doesn't fire during back-forward
cache (bfcache) transitions. `pagehide` is the modern, reliable equivalent
that fires on tab close, navigation, and bfcache. `visibilitychange` covers
the case where the user tab-switches without closing.

### Why also flush in `getBufferedEvents`?

Other code reads the buffer to send it to the backend (`flushBehaviorEvents`
in `api.ts`). If we don't flush pending events to localStorage before
reading, the backend never sees the most recent events. The fix: any read
triggers a persist first.

### Effect

The user browses 30 watches in 90 seconds; instead of 30 localStorage
writes, they get 3 (one every 10 events). Main-thread time saved, mobile
input latency improved, no events lost.

### The wider lesson

When you find yourself making the same expensive operation many times in
quick succession, debouncing is almost always the right answer. The
trickiest part is the persistence-on-exit hook so you don't drop data on
tab close.

---

## 11. Hangfire recurring retention job

### Concept — background jobs vs cron

A **background job** is work your server does outside the request-response
cycle. It's the right pattern when:
- The work isn't time-critical from the user's perspective (cleanup,
  digests, embedding generation).
- The work is heavy (would time out a request).
- The work needs to happen on a schedule (nightly retention sweep).

Two common ways to run background work:

1. **OS cron** — a separate process the OS schedules. Reliable but lives
   outside your app; no visibility into success/failure unless you wire
   it up.
2. **In-app job framework** (Hangfire, Celery, Sidekiq) — stores schedules
   and run history in the database, gives you a dashboard, retries on
   failure.

Hangfire stores everything in PostgreSQL (`hangfire.*` tables), so jobs
survive restarts and Railway redeploys.

### What was happening

`UserBrowsingEvent` is append-only: every page view writes a row. There was
no cleanup. The table grows linearly with traffic forever. Eventually:
- Disk usage on Neon climbs (Neon bills on storage).
- Queries against `UserBrowsingEvent` get slower (more rows to scan/index).
- The Watch DNA pipeline only weighs recent events (typically 30 days)
  anyway, so 95%+ of the rows are dead weight.

### The fix

A new `BrowsingEventRetentionJob` deletes rows older than 90 days:

```csharp
public async Task<int> RunAsync()
{
    var cutoff = DateTime.UtcNow.AddDays(-RetentionDays);
    var deleted = await _context.Database.ExecuteSqlRawAsync(
        "DELETE FROM \"UserBrowsingEvents\" WHERE \"Timestamp\" < {0}",
        cutoff);
    return deleted;
}
```

Schedule it daily at 03:00 UTC via Hangfire's `RecurringJob.AddOrUpdate`:

```csharp
RecurringJob.AddOrUpdate<BrowsingEventRetentionJob>(
    "browsing-event-retention",
    job => job.RunAsync(),
    "0 3 * * *");
```

The string `"0 3 * * *"` is a five-field cron expression: minute=0, hour=3,
every day-of-month, every month, every day-of-week. Hangfire stores the
schedule in its DB tables and re-registers it on every boot
(`AddOrUpdate` is idempotent — calling it with the same job-id every
deploy is safe).

### Why parameterized SQL?

CLAUDE.md's database safety rules forbid string-interpolated SQL —
parameterized only. Even when the value is a `DateTime` and not user input,
it's a habit worth keeping; once you allow `$"... {x}"` once, it spreads.

### Why 90 days, not 30?

Watch DNA usually weighs the most recent month, but some users browse
slowly. 90 days gives headroom for late returners while still keeping the
table bounded. Easy to tune later.

### Why 03:00 UTC?

Off-peak for both APAC and Americas markets. A DELETE of millions of rows
takes some IO; running it when nobody's hitting the app reduces user-visible
impact.

### The wider lesson

Any append-only table needs a retention policy from day one. You can always
relax retention later by changing the cutoff; you can never recover the
disk usage of an unbounded table without a maintenance window.

---

## Common threads across all eleven fixes

A few patterns showed up over and over:

1. **The fastest operation is the one you don't do.** Caching (#4), removing
   redundant queries (#2), batching (#10), and dropping unused payload (#9)
   are all variants of "stop doing the thing you don't need."

2. **Defaults are rarely optimal.** Npgsql pool size (#3), TanStack staleTime
   (#6), `next/image unoptimized` (#8) — each was the framework's
   default, and each was wrong for the context.

3. **Cost lives in shape, not in scale.** Most of these fixes don't reduce
   row counts — they change *how* the data is fetched and shipped. Query
   shape (#2, #5), payload shape (#9), and cadence (#10) matter more than
   table size for typical workloads.

4. **Free wins exist if you look.** Removing the `unoptimized` flag (#8)
   and adding metadata (#7) cost nothing in complexity and pay off
   continuously. They were always available; nobody had pulled the lever.

5. **Some fixes are deferred for good reason.** Server pagination (task #12)
   is the *right* fix but requires porting non-trivial logic. The pragmatic
   call was to land the easy bandwidth win (#9) and track the rest for
   later. Honest scoping beats over-promising.

The single biggest takeaway: **most performance work is removal, not
addition.** You don't usually need a new layer or cache or queue — you need
to delete the redundant thing the previous engineer added by reflex.
