# Tourbillon AI Feature Roadmap

## Status Overview

| Feature | Status | Phase |
|---|---|---|
| RAG AI Chat Assistant | Done | - |
| Compare Mode | Planned | 1 |
| Wrist-fit Recommender | Planned | 1 |
| AI Watch Finder + Concierge | Planned | 2 |
| Story-first Product Pages | Planned | 2 |
| Watch DNA / Taste Profile | Planned | 3 |
| AI Discovery Pages (GEO/SEO) | Planned | 3 |
| Save / Build Collection | Planned | 4 |

---

## Phase 1: Quick Wins

### Compare Mode

Side-by-side comparison for 2-4 watches with both raw specs and human-readable insights.

**What it does:**
- Specs table comparing dial, case, movement, strap across selected watches
- AI-generated tabs: Wearability, Brand Character, Who Is It For
- Natural language comparisons: "thinner", "dressier", "better for small wrists"

**Tech approach:**
- Specs table: Pure frontend logic using existing `WatchSpecs` data (no AI cost)
- AI insights: Claude Haiku generates comparison text from specs JSON (~$0.001/comparison)
- Cache AI responses to avoid repeated calls for the same watch pair

**Files involved:**
- New frontend component for compare UI
- New backend endpoint to generate AI comparison (or reuse ai-service)
- Existing data: `WatchSpecs` model (`backend/Models/WatchSpecs.cs`)

---

### Wrist-fit Recommender

Fit scoring based on wrist measurements and watch dimensions.

**What it does:**
- User inputs wrist circumference (cm), style preference, formality level
- System scores each watch on: fit score, wrist presence, cuff friendliness
- Uses existing case specs: diameter, thickness, lug-to-lug

**Tech approach:**
- Pure rule engine — no AI needed, no API cost
- Scoring formula based on diameter/wrist ratio, thickness thresholds, lug-to-lug vs wrist width
- Can integrate into product page as a widget or into AI Watch Finder as a filter

**Files involved:**
- New frontend component for wrist input + score display
- Scoring logic can live in frontend (all data already available from specs)
- Existing data: `CaseSpecs.Diameter`, `CaseSpecs.Thickness`, `CaseSpecs.LugToLug`

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
- Claude Haiku generates editorial content per watch (~$0.001/watch)
- Generated once, cached in DB (new column or separate table)
- Triggered manually via admin panel or batch job for all watches

**Files involved:**
- Backend: new model/column for editorial content, generation endpoint
- Frontend: new sections in `frontend/app/watches/[watchId]/page.tsx`
- Existing: `ClaudeApiService.cs` pattern for Haiku calls

---

## Phase 3: Advanced AI

### Watch DNA / Taste Profile

Personalization engine that learns user preferences and adapts the experience.

**What it does:**
- Tracks user interactions: clicks, favorites, comparisons, chat queries
- Builds taste profile: "Classic Conservative", "Integrated Bracelet Sport", "Understated Haute Horlogerie"
- Homepage recommendations and search results adapt to profile
- Profile displayed to user as a "Watch DNA" card

**Tech approach:**
- Phase A (free): Track interactions in DB, rule-based clustering from specs patterns (e.g., user clicks many gold cases + thin watches = "Classic Dress" profile)
- Phase B (cheap): Use embeddings to compute taste vectors, find similar watches via cosine similarity
- Requires auth (already have ASP.NET Identity)

**Files involved:**
- New DB table: `UserInteractions` (userId, watchId, type, timestamp)
- New DB table or column: `UserProfile` (taste vector / profile tags)
- Backend service for profile computation
- Frontend: profile card component, personalized recommendations on homepage

**Why this matters (resume):**
- Recommendation systems, personalization, user behavior tracking
- Major ecommerce trend — every platform is investing in this

---

### AI Discovery Pages (GEO/SEO)

Auto-generated curated pages optimized for both traditional SEO and AI search citation.

**What it does:**
- Pages like: "Best Salmon Dial Watches", "Best Watches for Small Wrists", "Quiet Luxury Dress Watches", "German Alternatives to Rolex"
- Each page: editorial intro + curated watch grid filtered from DB
- Optimized for GEO (Generative Engine Optimization) — structured to be cited by AI search engines

**Tech approach:**
- Define page themes as DB queries (e.g., salmon dial = `dial.color LIKE '%salmon%'`, small wrist = `diameter < 38mm`)
- Claude Haiku generates editorial content per theme (~$0.001/page)
- Next.js SSG (Static Site Generation) for performance and SEO
- Generate once, rebuild periodically or on data changes

**Files involved:**
- New Next.js pages under `frontend/app/discover/[slug]/`
- Backend endpoint to query watches by theme criteria
- Content generation via Claude Haiku
- Sitemap integration for SEO

**Why this matters (resume):**
- GEO is a new and growing trend in ecommerce
- Shows understanding of AI + SEO intersection, programmatic content generation

---

## Phase 4: Polish

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

## Cost Summary

| Item | Cost |
|---|---|
| Claude Haiku API | ~$0.001/call |
| Embeddings (if used) | Free with local model (all-MiniLM-L6-v2) |
| Infrastructure | No additions needed — PostgreSQL + .NET already sufficient |
| **Total dev/testing** | **< $5/month** |

## Resume Keywords Covered

AI/LLM integration, semantic search, recommendation systems, personalization engine, conversational commerce, retrieval-augmented generation (RAG), GEO/SEO optimization, programmatic content generation, full-stack implementation, rule-based scoring systems.
