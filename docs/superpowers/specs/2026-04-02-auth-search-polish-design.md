# Auth Pages + Search Transition Polish

**Date:** 2026-04-02

## Context

Auth pages (login/register) rated 7/10. Key issues: left panel content overflows and cuts off the quote; brand panel is purely typographic with no visual depth; form entrance is a single-block fade with no per-element stagger. Search overlay uses manual double-RAF + CSS state management that can be replaced with Framer Motion AnimatePresence for consistency and fewer lines.

## Auth Pages — Option B (Elevated Brand Panel, quiet luxury)

**Constraint:** Keep additions restrained — barely perceptible glow, minimal icon, no exaggerated decoration.

### Brand panel fixes (both pages)
- Fix vertical overflow: reduce heading from 3.5rem → 3rem, tighten spacing between body/benefits/quote so content fits without cutting off
- Add radial ambient glow: `radial-gradient` positioned center-left, very low opacity (~0.06 max)
- Add minimal watch icon at bottom: thin SVG circle (~32px) with simple hour + minute hand lines, `opacity: 0.12`
- Staggered sequential reveal using Framer Motion `variants` + `staggerChildren`: line → label → heading → body → benefits → quote. Each child `{ opacity: 0, y: 8 } → { opacity: 1, y: 0 }`, stagger 0.07s

### Form panel fixes (both pages)
- Stagger form elements: each field row + CTA + footer delayed individually (~0.06s apart), using `variants` with staggerChildren
- Input focus: animated gold underline — use `after:` pseudo via CSS or a wrapper `<div>` that transitions `scaleX(0 → 1)` on focus. Keep it 1px, `#bfa68a`, CSS transition only (no Framer Motion per keystroke)
- CTA hover: subtle shimmer — `background-position` slide on hover via CSS `background-size: 200%` + `transition: background-position 0.5s`. Not animated on load, only on hover.

### Files
- `frontend/app/login/page.tsx`
- `frontend/app/register/page.tsx`

## Search Overlay — Framer Motion AnimatePresence

**Goal:** Remove ~40 lines of boilerplate (shouldRender, visible, double-RAF, setTimeout) replacing with AnimatePresence + motion.div.

### Approach
- Wrap the portal content in `<AnimatePresence>`
- Backdrop: `motion.div` with `initial={{ opacity: 0 }}` / `animate={{ opacity: 1 }}` / `exit={{ opacity: 0 }}`
- Card: `motion.div` with same scale+translate as current (`scale: 0.92, x: 80, y: -56` → `scale: 1, x: 0, y: 0`), `transformOrigin: 'top right'` via `style` prop, using `EASE_LUXURY` + durations matching current (enter 320ms, exit 160ms)
- Remove: `shouldRender`, `visible` states, double-RAF effect, setTimeout cleanup
- Keep: portal, focus timeout (80ms after open), body overflow lock, `EASE_LUXURY` / `EASE_EXIT` from lib/motion

### File
- `frontend/app/components/layout/SearchOverlay.tsx`

## Verification
1. Visit `/login` — brand panel fully visible, no overflow; subtle glow visible but not garish; watch icon at bottom; content staggers in sequentially; form fields stagger in
2. Click an email/password input — gold underline animates in from left to right
3. Hover "Sign In" button — shimmer slides left to right
4. Visit `/register` — same improvements, consistent feel
5. Click search icon in navbar — overlay appears with scale+translate from top-right, no console errors
6. Close overlay — exits correctly, state resets
7. Run `npx tsc --noEmit` — zero errors
