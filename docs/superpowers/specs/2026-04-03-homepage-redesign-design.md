# Homepage Redesign + Multi-Select Filters — Design Spec

**Date:** 2026-04-03  
**Status:** Approved for implementation

---

## Context

The homepage has several issues to fix and new features to add:

- `StyleArchetypeGrid` shows black tiles because Cloudinary collection images return 404s
- "Grand Complication" and "Independent Maker" category names feel mismatched with the rest
- `WatchFinderSearch` (SmartSearch) is the first interactive element after the video — user has no context yet
- Featured Watches section sits between Style Archetypes and Brand Showcase, creating redundancy
- Brand filters on `/watches` are single-select only; clicking an archetype tile can only filter by one collection
- Project has no footer

---

## 1. Homepage Section Order

Final order (top to bottom):

| # | Section | Status |
|---|---------|--------|
| 1 | Navbar | existing |
| 2 | VideoSection (full-screen, GSAP pin) | existing |
| 3 | EditorialIntro | **new** |
| 4 | StyleArchetypeGrid (updated) | **updated** |
| 5 | BrandShowcaseSection / Trinity | **optimized** |
| 6 | WatchFinderSearch | **moved** (was #2 after video) |
| 7 | WatchDnaSpotlight | existing |
| 8 | Footer | **new** |

**Removed:** FeaturedWatchesSection (overlaps with Trinity showcase content)

---

## 2. EditorialIntro (new section)

Replaces the current `<div className="container mx-auto px-8 pt-36 pb-24">` block in `page.tsx`.

**Content:**
- Eyebrow: `"The Art of Timekeeping"` (uppercase, letter-spaced, gold)
- Headline: rendered by existing `<HeroHeading />` component
- Subtext: `"Exceptional timepieces from the world's finest maisons, curated for the discerning collector."`
- Two CTAs: `Explore Watches → /watches` and `Our Story → /stories`
- Centred layout, generous vertical padding

**File:** `frontend/app/components/sections/EditorialIntro.tsx` (new)

---

## 3. StyleArchetypeGrid — Updated

### New category names

| Old | New | Rationale |
|-----|-----|-----------|
| The Sport Watch | **The Sport Watch** | kept — includes dive watches |
| The Dress Watch | **The Dress Watch** | kept |
| The Grand Complication | **The Complication** | shorter, still precise |
| The Independent Maker | **The Art Watch** | métiers d'art, artistic/decorative dials |

### Tile design

Each tile replaces the single broken Cloudinary image with **3 watch images side-by-side** at reduced opacity — a collage approach. Video backgrounds will replace these once the user sources appropriate clips (tiles display a subtle `video coming` badge placeholder until then).

### Archetype → collection slug mapping

Each tile navigates to `/watches` with multi-value `collection` URL params.

```ts
const ARCHETYPES = [
  {
    label: 'The Sport Watch',
    subLabel: 'Precision under pressure',
    collectionSlugs: ['royal-oak', 'overseas', 'nautilus', 'sea-q'],
    // Royal Oak (AP), Overseas (VC), Nautilus (PP), SeaQ (Glashütte — dive watch)
  },
  {
    label: 'The Dress Watch',
    subLabel: 'Restraint as a statement',
    collectionSlugs: ['calatrava', 'lange-1', 'senator'],
    // Calatrava (PP), Lange 1 (ALS), Senator (GO)
  },
  {
    label: 'The Complication',
    subLabel: 'Every mechanism a poem',
    collectionSlugs: ['grand-complications'],
    // Grand Complications (PP) — verify slug; add royal-oak-concept (AP) if slug exists
  },
  {
    label: 'The Art Watch',
    subLabel: 'Horology as canvas',
    collectionSlugs: ['metiers-d-art'],
    // Métiers d'Art (VC) — verify slug against DB before shipping
  },
]
```

> **Slug verification required before shipping:** Run `SELECT slug FROM "Collections";` in psql and confirm `sea-q`, `metiers-d-art`, `royal-oak-concept` exist. Update the arrays if slugs differ.

### Navigation URL format

```
/watches?collection=royal-oak&collection=overseas&collection=nautilus&collection=sea-q
```

Uses repeatable `collection` params (not comma-separated) — parsed with `searchParams.getAll('collection')`.

**File:** `frontend/app/components/sections/StyleArchetypeGrid.tsx` (modify)

---

## 4. /watches Page — Multi-Select Filters

### State change

```ts
// Before
activeBrandId: number | null
activeCollectionId: number | null

// After
selectedBrandIds: number[]
selectedCollectionIds: number[]
```

### URL format

```
/watches?brand=audemars-piguet&brand=patek-philippe&collection=royal-oak
```

Parsed with:
```ts
const brandSlugs = searchParams.getAll('brand')
const collectionSlugs = searchParams.getAll('collection')
```

IDs resolved client-side after brands/collections load (same pattern as current `initializedRef` in BrandNavPanel).

### BrandNavPanel changes

- Props change: `activeBrandId/activeCollectionId` → `selectedBrandIds: number[]`, `selectedCollectionIds: number[]`
- Each brand row gets a checkbox; clicking brand toggles it in/out of `selectedBrandIds`
- Collections only shown (expanded) when parent brand is selected
- Each collection row gets a checkbox
- Selected items styled with cream-gold accent (same visual language as current active state)
- **Clear All button** appears at top of panel when any filter is active; resets all selections and navigates to `/watches`

### AllWatchesSection changes

Props change:
```ts
// Before
brandFilter?: number | null
collectionFilter?: number | null

// After
brandFilters?: number[]
collectionFilters?: number[]
```

Filter logic:
```ts
if (brandFilters && brandFilters.length > 0)
  filtered = filtered.filter(w => brandFilters.includes(w.brandId))
if (collectionFilters && collectionFilters.length > 0)
  filtered = filtered.filter(w => w.collectionId != null && collectionFilters.includes(w.collectionId))
```

**Files modified:**
- `frontend/app/watches/page.tsx`
- `frontend/app/components/layout/BrandNavPanel.tsx`
- `frontend/app/components/sections/AllWatchesSection.tsx`

---

## 5. BrandShowcaseSection — Optimizations

Keep the current full-screen scroll structure exactly. Optimize:

- Remove brand logo images (avoids 404s) — show brand name as text with small founding-year detail
- Add 3 reference chips per brand (model reference numbers), clickable → `/watches?collection=slug`
- More brands strip: text-only chips, no logos, ends with "Explore all brands →"

**File:** `frontend/app/components/sections/BrandShowcaseSection.tsx` (minor edit)

---

## 6. WatchFinderSearch — Repositioned

Moved from directly after the video hero to **after BrandShowcaseSection**, framed as a discovery fallback:

> "Can't find what you're after? Describe your ideal watch."

Wrapped in a new section container with its own eyebrow and headline. `TasteCTA` moves here too.

**File:** `frontend/app/page.tsx` (reorder only)

---

## 7. Footer (new)

Inspired by Izaak Reich footer structure.

### Structure

```
┌─────────────────────────────────────────┐
│         T O U R B I L L O N             │  ← large wordmark, dark-on-dark
├──────────────┬──────────────┬───────────┤
│   CONTACT    │   EXPLORE    │ NEWSLETTER│
│              │              │           │
│ Book Advisor │ Watches      │ email box │
│ contact@...  │ Brands       │ Instagram │
│ London       │ Stories      │           │
│              │ Smart Search │           │
│              │ Compare      │           │
│              │ Trending     │           │
├──────────────┴──────────────┴───────────┤
│ © 2025 Tourbillon   Privacy · Terms ·   │
└─────────────────────────────────────────┘
```

### Design notes
- Wordmark: full width, `text-[#1e1c18]` on dark background — reads as texture, not a banner
- Divider lines between columns: `border-[#1a1714]`
- Newsletter input: minimal dark input, arrow submit button, no heavy form
- All link colors: `#706050` default, `#a09080` on hover
- No border-radius on inputs/buttons — consistent with existing sharp luxury aesthetic

**File:** `frontend/app/components/layout/Footer.tsx` (new)  
**Also:** add `<Footer />` to `frontend/app/layout.tsx`

---

## 8. page.tsx final structure

```tsx
<>
  <VideoSection />
  <EditorialIntro />
  <StyleArchetypeGrid />
  <BrandShowcaseSection />
  <section className="...">  {/* SmartSearch section */}
    <WatchFinderSearch />
    <TasteCTA />
  </section>
  <WatchDnaSpotlight />
</>
// Footer rendered in layout.tsx, not page.tsx
```

---

## Verification Checklist

- [ ] All 4 archetype tiles show watch collage images (no black tiles)
- [ ] Clicking Sport Watch tile navigates to `/watches?collection=royal-oak&collection=overseas&...`
- [ ] On `/watches`, selecting 2 brands shows watches from both
- [ ] Deselecting a brand removes it from URL and grid
- [ ] Clear All button resets URL to `/watches` and empties grid filters
- [ ] Footer renders on all pages (via layout.tsx)
- [ ] Footer links navigate correctly
- [ ] Newsletter input is present (no backend wiring needed yet)
- [ ] No Cloudinary 404 errors in console for archetype tiles
- [ ] `npx tsc --noEmit` passes with 0 errors
