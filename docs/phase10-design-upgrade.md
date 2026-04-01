# Phase 10: Premium UI & Motion Design

## Context

Tourbillon's feature set is complete through Phase 9. Phase 10 is a dedicated frontend enhancement sprint to elevate the site from "functional luxury" to "cinematic luxury" — matching the visual standard of Hodinkee, Patek Philippe's website, and A. Lange & Söhne. The user will supply looped product videos (watch movements). The core principle: **kinetic elegance** — motion that feels like Swiss watchmaking precision. No bounce, no playfulness. Only expo-out curves, restrained durations, and cream-gold as the sole accent.

---

## Library Stack Decision

### Add in Phase 10:
| Library | Purpose | Install |
|---|---|---|
| `lenis` | Smooth momentum scroll site-wide | `npm install lenis` |
| `shadcn/ui` | Accessible form/overlay primitives (Radix UI) | `npx shadcn@latest init` |
| `gsap` + `@gsap/react` | Cinematic scroll sequences (3 key moments) | `npm install gsap @gsap/react` |

### Defer to Phase 10G (until 3D assets ready):
| Library | Purpose |
|---|---|
| `@react-three/fiber` + `@react-three/drei` | Interactive 3D watch viewer, tourbillon bg element |

### Already in use (expand):
- **Framer Motion v12** — extend to cards, filter panel, layout animations

---

## Animation Constants (use consistently throughout Phase 10)

```ts
// frontend/lib/motion.ts  (new shared file)
export const EASE_LUXURY = [0.16, 1, 0.3, 1]   // expo-out — fast start, elegant settle
export const EASE_ENTER  = [0.22, 1, 0.36, 1]   // current ScrollFade easing, keep
export const EASE_EXIT   = [0.4, 0, 1, 1]        // ease-in for departures

export const DUR = {
  fast: 0.25,    // micro-interactions (hover, tap)
  mid:  0.6,     // card entrances, panel slides
  slow: 1.0,     // page heroes, text reveals
  crawl: 1.6,    // GSAP scroll pin sequences
}
```

**Rules:** Never use linear. Never use spring with mass > 1 or stiffness > 200. Duration never exceeds 1.6s for UI elements.

---

## Sub-Phase Breakdown

---

### 10A — Smooth Scroll Foundation
**Scope:** Lenis site-wide. No visual changes; pure feel improvement.

**Files:**
- `frontend/app/layout.tsx` — wrap children with `<LenisProvider>`
- `frontend/app/providers/LenisProvider.tsx` — new provider using `lenis/react`

**Implementation:**
```ts
// LenisProvider.tsx
import { ReactLenis } from 'lenis/react'
export function LenisProvider({ children }) {
  return (
    <ReactLenis root options={{ lerp: 0.08, duration: 1.2, smoothWheel: true }}>
      {children}
    </ReactLenis>
  )
}
```

**Risk:** On Windows trackpads, Lenis can feel sluggish. Set `lerp: 0.08` (not 0.05). If user reports lag, fall back to `lerp: 0.12`.

**Integration with Framer:** Lenis + Framer's `useScroll` can conflict. Use Lenis's own scroll events for GSAP (`lenis.on('scroll', ScrollTrigger.update)`). Framer `useScroll` needs `layoutEffect` override — add `lenis.on('scroll', ScrollTrigger.update)` in GSAP setup (10C).

**Validation:** `npx tsc --noEmit`

---

### 10B — shadcn/ui Integration
**Scope:** Replace custom form inputs and overlays with shadcn primitives, themed to the dark luxury palette.

**Install:**
```bash
cd frontend
npx shadcn@latest init
# Choose: TypeScript, CSS variables, custom CSS file, no src/ dir
```

**Theming — map to existing CSS variables:**
```css
/* globals.css additions — shadcn dark theme override */
:root {
  --background: 18 11 9;              /* #1e1512 */
  --foreground: 240 230 210;          /* #f0e6d2 cream-gold */
  --card: 26 17 12;                   /* #2a110c glassy */
  --border: 255 255 255 / 0.1;
  --ring: 240 230 210;
  --primary: 191 166 138;             /* #bfa68a */
  --muted: 255 255 255 / 0.4;
}
```

**Components to add + where used:**
| shadcn component | Replaces / Used in |
|---|---|
| `Sheet` (drawer) | `WatchFilterBar` — slide-in filter panel on mobile |
| `Command` + `CommandDialog` | `SearchOverlay.tsx` — replace custom search overlay |
| `Form` + `Input` + `Textarea` | `AppointmentPanel.tsx`, `RegisterInterestPanel.tsx`, `ContactPage` |
| `Badge` | Watch card status pill (production status) |
| `Separator` | Spec table section dividers |
| `Tooltip` | CompareToggle, FavouriteToggle hover labels |
| `ScrollArea` | ChatPanel message list |
| `Dialog` | SaveToCollectionPopup (replace custom portal logic) |

**Risk:** shadcn uses `cn()` utility (clsx + tailwind-merge). Add `lib/utils.ts` with `cn`. Confirm `tailwind-merge` is compatible with Tailwind v4 (it is, but test after adding).

**Validation:** `npx tsc --noEmit`

---

### 10C — Homepage Cinematic Scroll (GSAP)
**Scope:** 3 key GSAP scroll moments on the homepage. Lenis + GSAP integration.

**Install:** `npm install gsap @gsap/react`

**Lenis + ScrollTrigger bridge:**
```ts
// app/providers/GSAPProvider.tsx
import { useEffect } from 'react'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { useLenis } from 'lenis/react'

gsap.registerPlugin(ScrollTrigger)

export function GSAPProvider({ children }) {
  const lenis = useLenis(({ scroll }) => {
    ScrollTrigger.update()
  })
  useEffect(() => {
    ScrollTrigger.refresh()
  }, [])
  return <>{children}</>
}
```

**Moment 1 — Pinned video text reveal (VideoSection):**
- Pin the video for 200px of scroll
- GSAP timeline: headline "TOURBILLON" fades up + letter-spacing expands from 0.05em → 0.5em
- Scroll hint fades out
- File: `VideoSection.tsx`

**Moment 2 — "Art of Fine Watchmaking" word-by-word reveal:**
- Split heading into `<span>` per word
- GSAP stagger reveal: each word fades+slides from `y:30` to `y:0` on scroll
- File: `app/page.tsx` (heading section)

**Moment 3 — Trinity Showcase parallax depth:**
- 3 watch cards at staggered vertical parallax speeds (0.8x, 1x, 1.2x)
- Creates depth-of-field illusion without WebGL
- File: `TrinityShowcase.tsx`

**Second video section (product movement loop):**
- New component: `frontend/app/components/sections/ProductVideoSection.tsx`
- Full-bleed looped `<video>` (user-supplied: watch rotor/movement close-up)
- Overlay text: collection name or brand tagline
- Positioned after `WatchFinderSearch` on homepage
- File: `app/page.tsx` (add after search section)

**Validation:** `npx tsc --noEmit`

---

### 10D — Watch Card Enhancements
**Scope:** Near-3D CSS tilt, gold shimmer hover, image reveal.

**Near-3D tilt effect (no WebGL):**
```ts
// New hook: frontend/hooks/useTilt.ts
// On mousemove: map (x, y) within card bounds to rotateX (-8 to 8deg) + rotateY (-8 to 8deg)
// CSS: transform-style: preserve-3d, perspective: 800px
// Image floats forward: translateZ(20px)
// On mouseleave: spring back to 0,0 (Framer motion spring, stiffness 200, damping 30)
```

**Implementation on WatchCard:**
- The existing cards in `AllWatchesSection.tsx` currently use basic hover:scale-105
- Replace with `motion.div` with `style={{ rotateX, rotateY, transformPerspective: 800 }}`
- Add gold border shimmer: `bg-gradient-to-r from-transparent via-[#f0e6d2]/20 to-transparent` sliding on hover (CSS `@keyframes shimmer`)
- Image: blur-to-sharp reveal on `IntersectionObserver` entry (already partially done, refine)

**StaggeredFade upgrade:**
- Current: all items fade same direction
- New: alternate odd/even items from left/right (even: `x: -30`, odd: `x: 30`)

**Files:** `AllWatchesSection.tsx`, possibly extract `WatchCard.tsx` as its own component (currently inline)

**Validation:** `npx tsc --noEmit`

---

### 10E — Watch Detail Page Enhancements
**Scope:** Product video support, richer image area, spec reveal, sticky header.

**Product video loop:**
- If `watch.VideoUrl` exists (new optional field or hardcoded per watch initially): show `<video>` in left column instead of/alongside image
- User-supplied: close-up of movement, caseback rotor, or bracelet links
- Fallback: existing Cloudinary image
- Toggle between image and video: thumbnail strip below main image area
- File: `app/watches/[slug]/page.tsx`

**Image gallery:**
- Current: single image
- New: if multiple Cloudinary images available (or video + image), horizontal thumbnail strip
- Framer `layoutId` for shared element transition between thumbnail and main image

**Spec table reveal:**
- Current: static table
- New: each spec row reveals with `ScrollFade` stagger (delay 0.05s × index)

**Sticky watch name header (mobile):**
- On mobile, watch name disappears as user scrolls
- Add: compact sticky bar at top with watch name + price (appears after scrolling past hero)
- Use `useScroll` + `useMotionValueEvent`

**Dramatic price reveal:**
- Price number: count-up animation on mount (Framer `useTransform` or simple counter hook)
- Only fires once, respects `prefers-reduced-motion`

**Files:** `app/watches/[slug]/page.tsx`, new `WatchMediaGallery.tsx` component

**Validation:** `npx tsc --noEmit`

---

### 10F — Navigation & Global Polish
**Scope:** Scroll-responsive navbar, directional page transitions, skeleton screens, texture.

**Scroll-responsive navbar:**
- At scroll = 0: full height, transparent background
- On scroll > 60px: compact (smaller height, `backdrop-blur-md bg-black/50` solidifies)
- Transition: `motion.nav` with `height` spring
- File: `NavBar.tsx` (use `useScroll` from Framer)

**Directional page transitions:**
- Current: all routes fade+y (same direction)
- New: `/watches` → `/watches/[slug]` slides left; back button slides right
- Use `NavigationContext` (already tracks back navigation) to determine direction
- `MotionMain.tsx`: accept `direction` prop, animate `x` ±60px instead of `y` 30px

**Skeleton loading states:**
- `AllWatchesSection`: replace current spinner with grid of shimmer skeletons
- Watch detail: skeleton for image + text blocks on initial load
- New: `frontend/app/components/ui/WatchCardSkeleton.tsx`

**Subtle grain texture overlay:**
- Add semi-transparent grain/noise SVG filter to `body` or `main`
- CSS: `::before { background-image: url('/noise.svg'); opacity: 0.03; pointer-events: none; }`
- Gives authentic luxury print feel (used by Bottega, Hermès, Loro Piana sites)
- Add `public/noise.svg` (SVG featureTurbulence filter, ~200 bytes)

**Magnetic hover buttons:**
- "Book an Appointment" and "Register Interest" CTAs: magnetic effect
- On hover: button drifts toward cursor by 30% of offset distance
- On leave: spring back (Framer spring)
- New hook: `frontend/hooks/useMagnetic.ts`

**Files:** `NavBar.tsx`, `MotionMain.tsx`, new skeleton components, `layout.tsx`

**Validation:** `npx tsc --noEmit`

---

### 10G — React Three Fiber Focal Points (Deferred)
**Status:** Deferred until user supplies 3D assets (GLB models or decides to use procedural).

**Planned moments (2 maximum):**

**1. Homepage background tourbillon:**
- Subtle slowly-rotating tourbillon cage as background element
- Either GLB model or procedural R3F geometry (circles + spokes)
- Very low opacity (5-10%), behind the video/hero content
- Fallback: CSS 3D rotation animation

**2. Watch detail 3D viewer:**
- For watches that have a GLB model: interactive rotate-on-drag viewer
- Drei `<OrbitControls>` with damping, no zoom
- Environment: `<Environment preset="studio">`
- Gold/dark lighting to match brand palette

**Install (when ready):**
```bash
npm install @react-three/fiber @react-three/drei three
npm install -D @types/three
```

**Fallback strategy:** Product video loop (Phase 10E) covers all watches until 3D models exist.

---

## Critical Files Summary

| File | Change |
|---|---|
| `frontend/app/layout.tsx` | Add LenisProvider, GSAPProvider |
| `frontend/app/providers/LenisProvider.tsx` | New |
| `frontend/app/providers/GSAPProvider.tsx` | New |
| `frontend/lib/motion.ts` | New — shared animation constants |
| `frontend/lib/utils.ts` | New — shadcn `cn()` utility |
| `frontend/hooks/useTilt.ts` | New — mouse-tracking 3D tilt |
| `frontend/hooks/useMagnetic.ts` | New — magnetic hover |
| `frontend/app/globals.css` | shadcn CSS vars, grain texture, shimmer keyframe |
| `frontend/app/components/sections/VideoSection.tsx` | GSAP pin + text reveal |
| `frontend/app/components/sections/ProductVideoSection.tsx` | New — product movement video |
| `frontend/app/components/sections/TrinityShowcase.tsx` | GSAP parallax depth |
| `frontend/app/components/sections/AllWatchesSection.tsx` | Tilt cards, directional stagger |
| `frontend/app/components/layout/NavBar.tsx` | Scroll-responsive compact mode |
| `frontend/app/components/ui/WatchCardSkeleton.tsx` | New — shimmer skeleton |
| `frontend/app/scrollMotion/MotionMain.tsx` | Directional slide transitions |
| `frontend/app/watches/[slug]/page.tsx` | Video gallery, spec stagger, sticky header, price counter |
| `frontend/public/noise.svg` | New — grain texture asset |
| `docs/ROADMAP.md` | Add Phase 10 rows |

---

## Implementation Order

Execute sub-phases in order — each is independently validatable:

```
10A (Lenis) → validate → 10B (shadcn) → validate → 10C (GSAP) → validate
→ 10D (Cards) → validate → 10E (Watch Detail) → validate
→ 10F (Nav + Polish) → validate → 10G when assets arrive
```

Each sub-phase ends with a commit message and `npx tsc --noEmit` passing.

---

## Verification

After each sub-phase:
1. `npx tsc --noEmit` — zero TypeScript errors
2. Open DevTools → Performance tab → record 3s scroll — no jank, 60fps
3. Test smooth scroll on both mouse wheel (Windows) and trackpad
4. Verify `prefers-reduced-motion` media query: animations should be instant/none
5. Full build check at end of all sub-phases: stop dev server, run `npm run build`
