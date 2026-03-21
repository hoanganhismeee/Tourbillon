# Story-first Product Pages — Implementation Plan

## this file just just for me to read again incase i forget the idea

## Context

Watch detail pages currently show only specs. The goal is to add AI-generated editorial sections
("Why This Watch Matters", "Collector Appeal", "Design Language", "Best For") that turn raw specs
into compelling narratives for luxury buyers.

The content is generated **once offline** using a strong local Ollama model (phi4:14b), stored in
PostgreSQL, and served as a plain SQL join at runtime — zero AI cost in production.

The strategy mirrors the existing QueryCache and embedding pre-seeding pattern:
generate locally → pg_dump → import to prod → first user hits fully-populated DB.

Instead of 351 per-watch AI calls, generate **one editorial archetype per collection** (~51 calls)
and link every watch in that collection to it. Similar watches share content — same principle as
QueryCache sharing results across similar queries.

---

## Add new Local Ollama Model: gemma2:9b for quality-first work (writting), main local dev would still be qwen2.5:7b

**Recommended model:** `gemma2:9b` (Google Gemma 2, 9B parameters)

- ~5.5 GB VRAM — fits comfortably on any 8GB GPU
- Best writing quality and instruction-following in the 7–10B range
- Excellent structured JSON output (critical for parsing editorial sections)
- Significantly better prose than qwen2.5:7b (already used for dev)
- Fallback if VRAM is very tight: `llama3.1:8b` (~5GB VRAM)

**Why this matters for Phase 5 (RAG chatbot):**
The 4 editorial sections per watch become embedding chunks for the chatbot's retrieval store.
Higher-quality, specific prose → richer semantic embeddings → better chatbot answers.
gemma2:9b produces factual, varied vocabulary which improves cosine retrieval over generic filler.

Setup before seeding:

```bash
ollama pull gemma2:9b
# In docker-compose or .env, set:
LLM_MODEL=gemma2:9b
```

The existing `LLM_MODEL` env var in ai-service already handles the swap — no code change needed.

---

## Files to Create / Modify

### New files


| File                                        | Purpose                                 |
| ------------------------------------------- | --------------------------------------- |
| `backend/Models/WatchEditorialContent.cs`   | EF entity: archetype editorial content  |
| `backend/Models/WatchEditorialLink.cs`      | EF entity: watch → editorial content FK |
| `backend/Services/WatchEditorialService.cs` | Seed logic + status                     |


### Modified files


| File                                      | Change                                     |
| ----------------------------------------- | ------------------------------------------ |
| `backend/Database/TourbillonContext.cs`   | Add 2 DbSets + model config                |
| `backend/Controllers/AdminController.cs`  | Add 3 editorial endpoints                  |
| `backend/Controllers/WatchController.cs`  | Include editorial in GET /api/watches/{id} |
| `ai-service/app.py`                       | Add POST /generate-editorial endpoint      |
| `frontend/lib/api.ts`                     | Add editorialContent field to Watch type   |
| `frontend/app/watches/[watchId]/page.tsx` | Add 4 editorial sections below specs       |


Plus one new EF Core migration.

---

## Data Model

### WatchEditorialContent

```csharp
public class WatchEditorialContent
{
    public int Id { get; set; }
    public int SeedWatchId { get; set; }           // Watch whose specs drove generation
    public Watch SeedWatch { get; set; } = null!;
    public string WhyItMatters { get; set; } = "";
    public string CollectorAppeal { get; set; } = "";
    public string DesignLanguage { get; set; } = "";
    public string BestFor { get; set; } = "";
    public DateTime GeneratedAt { get; set; }
    public ICollection<WatchEditorialLink> Links { get; set; } = [];
}
```

### WatchEditorialLink

```csharp
public class WatchEditorialLink
{
    public int WatchId { get; set; }               // FK (unique — one editorial per watch)
    public Watch Watch { get; set; } = null!;
    public int EditorialContentId { get; set; }
    public WatchEditorialContent EditorialContent { get; set; } = null!;
}
```

No pgvector column needed — watches are linked by collection FK at seed time, not by cosine
similarity. The similarity lookup is only a fallback for watches with no collection (rare edge case).

---

## AI Service: POST /generate-editorial

New endpoint in `ai-service/app.py`:

**Input:**

```json
{
  "brand": "Patek Philippe",
  "collection": "Nautilus",
  "name": "5711/1A-014",
  "description": "Patek Philippe Nautilus",
  "case_material": "stainless steel",
  "diameter_mm": 40,
  "dial_color": "olive green",
  "movement_type": "automatic",
  "power_reserve_h": 45,
  "price_tier": "ultra-luxury"
}
```

**Output:**

```json
{
  "why_it_matters": "...",
  "collector_appeal": "...",
  "design_language": "...",
  "best_for": "..."
}
```

**Prompt design:**

- System: luxury watch journalist persona, 2–3 sentences per section, no generic filler
- Temperature: 0.35 (slightly higher than other endpoints for more natural prose variety)
- Max tokens: 500
- Uses same `parse_llm_json()` defensive parser already in app.py

**Price tier mapping** (computed in .NET before calling ai-service):

- 0 = "price on request"
- < 10,000 = "accessible luxury"
- < 30,000 = "mid-luxury"
- < 100,000 = "high luxury"
- > = 100,000 = "ultra-luxury"

---

## WatchEditorialService — Seeding Logic

```
SeedAllAsync():
  For each Collection (51 total):
    1. Pick seed watch: watch in this collection with most non-null WatchSpecs fields
    2. If collection has no watches: skip
    3. POST /generate-editorial to ai-service with seed watch data
    4. Store WatchEditorialContent (SeedWatchId = seed watch Id)
    5. INSERT WatchEditorialLink for every watch in this collection → same ContentId

  For watches with CollectionId = null (orphans):
    Generate individually (expected to be rare or zero)

  Return: { seeded (collections), linked (watches), skipped }
```

The service reuses `IHttpClientFactory.CreateClient("ai-service")` — same pattern as
`WatchEmbeddingService` and `WatchFinderService`.

---

## Admin Endpoints (AdminController.cs)

```
POST /api/admin/editorial/seed
  → WatchEditorialService.SeedAllAsync()
  → Returns { seeded, linked, skipped, timestamp }

GET /api/admin/editorial/status
  → Returns { totalWatches, withEditorial, coveragePct }

DELETE /api/admin/editorial
  → Clears WatchEditorialLinks and WatchEditorialContents
  → Returns { deleted }
```

All follow the existing `[Authorize(Roles = "Admin")]` + try/catch + `Ok(new { Success, ... })` pattern.

---

## WatchController Change

`GET /api/watches/{id}` — include editorial content in response:

```csharp
var watch = await _context.Watches
    .Include(w => w.Brand)
    .Include(w => w.Collection)
    .Include(w => w.EditorialLink)
        .ThenInclude(l => l.EditorialContent)   // <-- new
    .FirstOrDefaultAsync(w => w.Id == id);
```

Add navigation property to `Watch.cs`:

```csharp
public WatchEditorialLink? EditorialLink { get; set; }
```

The frontend receives `editorialContent` as part of the watch object — no new API endpoint needed.

---

## Frontend

### lib/api.ts — extend Watch type

```typescript
editorialContent?: {
  whyItMatters: string;
  collectorAppeal: string;
  designLanguage: string;
  bestFor: string;
} | null;
```

### app/watches/[watchId]/page.tsx — 4 new sections

Rendered below the specs table. Only shown if `editorialContent` is present (graceful degradation
for any watch not yet seeded).

Each section: heading + paragraph, clean typography matching existing page style. No new components
needed — inline JSX with existing Tailwind classes.

---

## Pre-Deploy Workflow

```bash
# 1. Pull the model (one-time)
ollama pull phi4:14b

# 2. Start services with phi4 as LLM
LLM_MODEL=phi4:14b docker compose up

# 3. Seed editorial content (admin panel or curl)
POST /api/admin/editorial/seed
# ~51 Ollama calls, ~2–5 min total

# 4. Verify
GET /api/admin/editorial/status
# Expected: coveragePct ~100%

# 5. Dump editorial tables
pg_dump -t '"WatchEditorialContents"' -t '"WatchEditorialLinks"' tourbillon > editorial_seed.sql

# 6. Import to production
psql $PROD_DB < editorial_seed.sql
```

After import, prod serves editorial content from the DB with zero AI calls — just a SQL join.

---

## Verification

1. `dotnet build` — no compile errors
2. `npx tsc --noEmit` — no TypeScript errors
3. `POST /api/admin/editorial/seed` → check response shows ~51 seeded, ~351 linked
4. `GET /api/admin/editorial/status` → coveragePct near 100%
5. Visit any watch detail page → 4 editorial sections render below specs
6. Watch with no editorial (if any) → page still renders, sections simply absent

