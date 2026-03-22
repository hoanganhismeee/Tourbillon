# Story-first Product Pages — Implementation Plan

## this file just just for me to read again incase i forget the idea

## Context

Watch detail pages currently show only specs. The goal is to add AI-generated editorial sections
("Why This Watch Matters", "Collector Appeal", "Design Language", "Best For") that turn raw specs
into compelling narratives for luxury buyers.

The content is generated **once offline** using a strong local Ollama model (gemma2:9b), stored in
PostgreSQL, and served as a plain SQL join at runtime — zero AI cost in production.

The strategy mirrors the existing QueryCache and embedding pre-seeding pattern:
generate locally → pg_dump → import to prod → first user hits fully-populated DB.

Instead of 351 per-watch AI calls, generate **one editorial archetype per collection** (~51 calls)
and link every watch in that collection to it. Similar watches share content — same principle as
QueryCache sharing results across similar queries.

---

## User Experience Flow

```
Homepage
  ↓
All Watches grid
  (order personalised by Watch DNA taste profile)
  ↓
User clicks a watch card
  ↓
┌─────────────────────────────────────┐
│  Product Detail Page                │
│                                     │
│  [Hero: image + name + price]       │  ← first impression
│                                     │
│  [Specs table]                      │  ← technical verification
│  dial / case / movement / strap     │    "does this fit my needs?"
│                                     │
│  ── STORY-FIRST SECTIONS ──         │  ← emotional reinforcement
│  Why This Watch Matters             │    "now I *want* it"
│  Collector Appeal                   │
│  Design Language                    │
│  Best For                           │
│                                     │
│  [Related watches]                  │  ← continue discovery
└─────────────────────────────────────┘
```

**Why this order:** Luxury buyers verify specs first (does it fit my wrist/budget/style?),
then need emotional narrative to justify the price. Editorial sits at that inflection point.

**UX properties:**
- Pre-loaded from DB → renders with the page, no skeleton/loading state
- Entirely passive — no user action, always present on seeded watches
- If watch has no editorial → sections simply don't render (page still works)

**Phase 5 connection:** The chatbot retrieves these sections as context chunks.
A user asking "Is this good for black-tie?" on the product page gets a specific,
informed answer because the editorial content is already embedded in the retrieval store.

---

## Local Ollama Model: gemma2:9b

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

## Files Created / Modified

### New files
| File | Purpose |
|---|---|
| `backend/Models/WatchEditorialContent.cs` | EF entity: archetype editorial content |
| `backend/Models/WatchEditorialLink.cs` | EF entity: watch → editorial content FK |
| `backend/Services/WatchEditorialService.cs` | Seed logic + status |
| `scripts/seed_editorial.sh` | Pre-deploy seed script — run once locally |

### Modified files
| File | Change |
|---|---|
| `backend/Models/Watch.cs` | Added EditorialLink navigation property |
| `backend/Models/WatchDto.cs` | Added EditorialContent + EditorialContentDto |
| `backend/Database/TourbillonContext.cs` | Added 2 DbSets + WatchEditorialLink PK config |
| `backend/Program.cs` | Registered WatchEditorialService |
| `backend/Controllers/AdminController.cs` | Added editorial/seed, editorial/status, editorial endpoints |
| `backend/Controllers/WatchController.cs` | GetWatch includes editorial via ThenInclude |
| `ai-service/app.py` | Added POST /generate-editorial endpoint |
| `frontend/lib/api.ts` | Added WatchEditorialContent interface + field on Watch |
| `frontend/app/watches/[watchId]/page.tsx` | Added 4 editorial sections below specs |

---

## Data Model

### WatchEditorialContent
One record per collection (seed watch = most spec-complete in that collection).
```csharp
public class WatchEditorialContent
{
    public int Id { get; set; }
    public int SeedWatchId { get; set; }
    public string WhyItMatters { get; set; }
    public string CollectorAppeal { get; set; }
    public string DesignLanguage { get; set; }
    public string BestFor { get; set; }
    public DateTime GeneratedAt { get; set; }
}
```

### WatchEditorialLink
PK = WatchId (one editorial per watch). Many watches share one WatchEditorialContent.
```csharp
public class WatchEditorialLink
{
    public int WatchId { get; set; }        // PK
    public int EditorialContentId { get; set; }
}
```

---

## AI Service: POST /generate-editorial

Input: `{ brand, collection, name, description, case_material, diameter_mm, dial_color, movement_type, power_reserve_h, price_tier }`
Output: `{ why_it_matters, collector_appeal, design_language, best_for }`

- System prompt: luxury watch journalist persona, 2–3 sentences per section, no generic filler
- Temperature: 0.35 (higher than other endpoints for natural prose variety)
- Max tokens: 500
- Uses same `parse_llm_json()` defensive parser
- Retry with stricter prompt on JSON parse failure

**Price tier mapping:**
- 0 = "price on request" | < 10k = "accessible luxury" | < 30k = "mid-luxury" | < 100k = "high luxury" | >= 100k = "ultra-luxury"

---

## Seeding Logic (WatchEditorialService)

```
SeedAllAsync():
  Group all watches by CollectionId
  For each collection group:
    Skip watches already in WatchEditorialLinks
    Pick seed = watch with most non-null WatchSpecs fields
    POST /generate-editorial to ai-service
    Store WatchEditorialContent (SeedWatchId = seed.Id)
    Insert WatchEditorialLink for every watch in group → same ContentId

  For null-collection watches:
    Generate individually (rare edge case)

  Return: { seeded, linked, skipped }
```

---

## Admin Endpoints

```
POST /api/admin/editorial/seed    → seed all collections
GET  /api/admin/editorial/status  → { total, withEditorial, coveragePct }
DELETE /api/admin/editorial       → clear all content + links (before re-seeding)
```

---

## Pre-Deploy Workflow

```bash
# 1. Set LLM_MODEL in ai-service
LLM_MODEL=gemma2:9b docker compose up

# 2. Run seed script
bash scripts/seed_editorial.sh
# Prompts for admin email/password, then seeds ~51 collections (~2-5 min)

# 3. Import SQL dump to production
psql $PROD_DB < scripts/editorial_seed_YYYYMMDD_HHMMSS.sql
```

After import, prod serves editorial content as a plain SQL join — zero AI calls at runtime.

---

## Commit Messages (per milestone)

1. `feat: add WatchEditorialContent and WatchEditorialLink entities with migration`
2. `feat(ai-service): add generate-editorial endpoint for story-first content`
3. `feat: add WatchEditorialService with seed/status/clear admin endpoints`
4. `feat: include editorial content in watch detail API response`
5. `feat(frontend): add story-first editorial sections to watch detail page`
6. `chore: add editorial seed script for pre-deploy content generation`
7. `docs: update story-first plan with UX flow and gemma2:9b model`
