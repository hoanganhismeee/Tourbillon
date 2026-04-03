# Phase 10 + Homepage Redesign — Merged Implementation Plan

> **Updated 2026-04-04.** This document supersedes the original Phase 10 plan and incorporates the full homepage redesign from the 2026-04-03 brainstorm session.
> Spec: `docs/superpowers/specs/2026-04-03-homepage-redesign-design.md`

---

## Key Decisions

- Brand videos (AP.mp4, VC.mp4 etc.) → brand pages only, not homepage
- Movement.mp4 → cinematic interstitial between Style Archetypes and Brand Showcase (Phase 10 A2, repositioned)
- SmartSearch moved after brand showcase (context before action)
- FeaturedWatchesSection removed (redundant with Trinity showcase)
- Style archetype categories: Sport Watch · Dress Watch · The Complication · Métiers d'Art
- Multi-select filters required on /watches for archetype tiles to work
- Footer missing from project — added in Step 5

---

## Already Completed

- `lib/motion.ts` — shared animation constants
- `app/providers/LenisProvider.tsx` — smooth scroll
- `app/providers/GSAPProvider.tsx` — GSAP + ScrollTrigger bridge
- `hooks/useTilt.ts` — 3D card tilt hook
- `app/components/cards/WatchCard.tsx` — extracted from AllWatchesSection
- `TrinityShowcase.tsx` — GSAP parallax depth (Phase 10 A1 moment 3)
- `HeroHeading.tsx` — GSAP word-by-word reveal (Phase 10 A1 moment 2)
- `VideoSection.tsx` — GSAP pin + wordmark letter-spacing reveal (Phase 10 A1)
- `shadcn` — installed (component migration pending)
- `globals.css` — grain texture overlay via `body::after` + noise.svg (Phase 10 C1)

---

## Final Homepage Section Order

| # | Section | Status |
|---|---------|--------|
| 1 | Navbar (compact-on-scroll: Phase 10 C2) | existing |
| 2 | VideoSection — GSAP pin + wordmark reveal | existing (done) |
| 3 | EditorialIntro — brand statement + 2 CTAs | **new** |
| 4 | StyleArchetypeGrid — 4 categories, multi-collection links | **updated** |
| 5 | ProductVideoSection — Movement.mp4 cinematic interstitial | **new (Phase 10 A2)** |
| 6 | BrandShowcaseSection — Trinity full-screen scroll, no logos | **optimized** |
| 7 | SmartSearch section — "Can't find what you're after?" | **moved** |
| 8 | WatchDnaSpotlight | existing |
| 9 | Footer — wordmark + 3 columns | **new** |

---

## Style Archetype Categories + Collection Slugs

```ts
const ARCHETYPES = [
  {
    label: 'The Sport Watch',
    subLabel: 'Precision under pressure',
    collectionSlugs: ['audemars-piguet-royal-oak', 'vacheron-constantin-overseas', 'patek-philippe-nautilus', 'omega-speedmaster', 'rolex-submariner'],
  },
  {
    label: 'The Dress Watch',
    subLabel: 'Restraint as a statement',
    collectionSlugs: ['patek-philippe-calatrava', 'a-lange-sohne-lange-1', 'jaeger-lecoultre-master-ultra-thin', 'vacheron-constantin-patrimony'],
  },
  {
    label: 'The Complication',
    subLabel: 'Every mechanism a poem',
    collectionSlugs: ['patek-philippe-grand-complications', 'audemars-piguet-royal-oak-concept', 'a-lange-sohne-datograph'],
  },
  {
    label: "Métiers d'Art",
    subLabel: 'Horology as canvas',
    collectionSlugs: ['vacheron-constantin-metiers-d-art', 'breguet-reine-de-naples', 'greubel-forsey-collection'],
  },
]
```

---

## Implementation Steps

### Step 1 — Multi-Select Filter System on /watches

**1a. `watches/page.tsx`:** State → `selectedBrandIds: number[]` + `selectedCollectionIds: number[]`. URL params → `searchParams.getAll('brand')` + `searchParams.getAll('collection')`. Slug→ID resolution via useEffect. `handleBrandToggle`, `handleCollectionToggle`, `handleClearAll`.

**1b. `BrandNavPanel.tsx`:** Props → `selectedBrandIds[]`, `selectedCollectionIds[]`, `onBrandToggle`, `onCollectionToggle`, `onClearAll`. Multi-select checkboxes. Clear All button visible when any filter active. Collections expand when parent brand selected.

**1c. `AllWatchesSection.tsx`:** Props `brandFilter/collectionFilter (null)` → `brandFilters/collectionFilters (number[])`. Filter by array includes.

Commit: `feat(watches): multi-select brand/collection filters with clear all button`

---

### Step 2 — StyleArchetypeGrid

Updated categories, brand-prefixed collection slugs, multi-collection href, 3-watch collage per tile (replaces broken single-image approach).

Commit: `feat(homepage): style archetype grid — new categories, multi-collection links, watch collages`

---

### Step 3 — Homepage Reorder + New Sections

New: `EditorialIntro.tsx` (brand statement, reuses HeroHeading), `ProductVideoSection.tsx` (Movement.mp4, 70vh, "The Craft" editorial overlay). `page.tsx` reordered, FeaturedWatchesSection removed.

Commit: `feat(homepage): reorder sections — editorial intro, movement interstitial, smartsearch repositioned`

---

### Step 4 — BrandShowcaseSection Fix

Replace brand logo `<Image>` with `<span>` text. Eliminates Cloudinary 404s. No structural changes.

Commit: `fix(brands): replace brand logo images with text to eliminate Cloudinary 404s`

---

### Step 5 — Footer

New `Footer.tsx`: TOURBILLON wordmark (dark-on-dark) + Contact / Explore / Newsletter columns + copyright bar. Added to `layout.tsx`.

Commit: `feat(layout): add footer — wordmark, contact/explore/newsletter columns`

---

## Phase 10 Remaining Polish (ships after homepage)

### C2 — Compact navbar on scroll
`NavBar.tsx` — scrollY > 60px: height 80→56px, Framer spring stiffness 300 damping 30.

### C3 — Skeleton screens
`WatchCardSkeleton.tsx` — shimmer skeleton replaces animate-spin in TrinityShowcase loading state.

### C4 — Magnetic hover on CTAs
`hooks/useMagnetic.ts` — 30% cursor drift on "Book an Appointment" / "Register Interest".

### D1 — Watch detail enhancements
`watches/[slug]/page.tsx` — spec table ScrollFade stagger, sticky name bar mobile, motion-number price counter.

### D2 — shadcn migration
Priority: Dialog → SaveToCollectionPopup, ScrollArea → ChatPanel, Tooltip → toggle buttons, Sheet → SlidingPanel, Command → SearchOverlay.

### Brand videos on brand pages
`brands/[slug]/page.tsx` — brand hero replaced with looping video from brand-to-video map:
`patek-philippe → /Patek-Philippe-5270R.mp4`, `vacheron-constantin → /VC.mp4`, `audemars-piguet → /AP.mp4`, `jaeger-lecoultre → /JLC.mp4`, `a-lange-sohne → /ALS.mp4`

---

## Verification

```bash
cd frontend && npx tsc --noEmit
```

- [ ] No black archetype tiles (watch collage or gradient fallback)
- [ ] Archetype tile links navigate to correct multi-collection URL
- [ ] Multi-select filters on /watches work; Clear All resets to /watches
- [ ] Movement.mp4 autoplays muted on homepage
- [ ] Footer on all pages, newsletter input renders
- [ ] No Cloudinary 404s in console
- [ ] TypeScript: 0 errors
