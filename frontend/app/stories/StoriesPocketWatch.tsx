// Decorative pocket watch for the Stories page.
// Sits large in the first section, then shrinks and parks itself in the top-right
// corner as the reader scrolls past it — like a persistent navbar emblem. It is a
// single fixed element interpolated by scroll, so the winding hands never stop.
// Purely decorative: pointer-events-none and aria-hidden.
'use client';

import { useEffect, useRef } from 'react';
import PocketWatch from '../components/decorations/PocketWatch';

const BASE = 300; // PocketWatch render size; on-screen size comes from transform scale

export default function StoriesPocketWatch() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    let raf = 0;
    let vw = window.innerWidth;
    let vh = window.innerHeight;
    const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

    // Breakpoint-aware home (large) and docked (small) geometry. Both anchor to the
    // right edge so the watch only ever shrinks up into the corner — never crosses
    // the left-aligned copy.
    const geometry = () => {
      const mobile = vw < 768;
      let largeW: number;
      if (vw >= 1280) largeW = 300;
      else if (vw >= 1024) largeW = 240;
      else if (vw >= 768) largeW = 190;
      else largeW = 96;
      const smallW = mobile ? 42 : 54;
      const marginR = vw >= 1280 ? vw * 0.06 : vw >= 1024 ? 56 : vw >= 768 ? 32 : 12;
      const dockRight = mobile ? 10 : 22;
      const dockTop = mobile ? 12 : 16;
      return {
        mobile,
        largeW,
        smallW,
        xLarge: vw - largeW - marginR,
        // Sit beside the headline's empty right side, clear of the masthead meta.
        yLarge: mobile ? Math.max(150, vh * 0.26) : Math.max(150, vh * 0.24),
        xSmall: vw - smallW - dockRight,
        ySmall: dockTop,
      };
    };

    let g = geometry();

    const apply = () => {
      // Progress 0 -> 1 across the first ~60% of the viewport height.
      const p = Math.min(1, Math.max(0, window.scrollY / (vh * 0.6)));
      const w = lerp(g.largeW, g.smallW, p);
      const x = lerp(g.xLarge, g.xSmall, p);
      const y = lerp(g.yLarge, g.ySmall, p);
      el.style.transform = `translate3d(${x}px, ${y}px, 0) scale(${w / BASE})`;
      // Slightly recede while large on mobile so it never fights the headline.
      el.style.opacity = g.mobile ? String(0.55 + 0.45 * p) : '1';
    };

    const onScroll = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        apply();
      });
    };
    const onResize = () => {
      vw = window.innerWidth;
      vh = window.innerHeight;
      g = geometry();
      apply();
    };

    apply();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onResize);
    return () => {
      if (raf) cancelAnimationFrame(raf);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onResize);
    };
  }, []);

  return (
    <div
      ref={ref}
      aria-hidden
      className="pointer-events-none fixed left-0 top-0 z-40 origin-top-left opacity-0 transition-opacity duration-500 will-change-transform"
      style={{ width: BASE, height: BASE * 1.2 }}
    >
      <PocketWatch size={BASE} variant="champagne" />
    </div>
  );
}
