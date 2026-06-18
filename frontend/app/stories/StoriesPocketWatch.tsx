// Decorative pocket watch for the Stories page.
// Sits large in the hero, then eases down into a small emblem on the upper-right as
// you scroll — set in from the corner and well below the navbar so the two never
// collide. Position and scale are a single eased function of scroll progress, so the
// motion glides and the watch stays visible throughout (no direction-based hiding).
// One fixed element, so the winding hands never stop. Decorative only.
'use client';

import { useEffect, useRef } from 'react';
import PocketWatch from '../components/decorations/PocketWatch';

const BASE = 320; // PocketWatch render size; on-screen size comes from transform scale

export default function StoriesPocketWatch() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    let raf = 0;
    let vw = window.innerWidth;
    let vh = window.innerHeight;

    const clamp = (n: number) => Math.min(1, Math.max(0, n));
    const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

    // Smoothed scroll progress, eased toward its target every frame. 0 = hero, 1 = docked.
    let prog = clamp(window.scrollY / (vh * 0.6));
    let shown = 0; // opacity, eases to 1 once positioned
    let started = false;

    // Breakpoint-aware home (large) and docked (small) geometry, anchored to the right
    // edge. The docked spot is set in from the corner and below the navbar so they never
    // touch — the watch reads as a floating emblem, not a corner sticker.
    const geometry = () => {
      const mobile = vw < 768;
      let largeW: number;
      if (vw >= 1280) largeW = 340;
      else if (vw >= 1024) largeW = 280;
      else if (vw >= 768) largeW = 220;
      else largeW = 116;
      const desktop = vw >= 1024;
      const smallW = mobile ? 58 : 92;
      const pad = vw >= 1024 ? 96 : vw >= 640 ? 40 : 24;
      const largeH = largeW * 1.2;
      const dockRight = mobile ? 14 : 48; // in from the right edge
      const dockTop = mobile ? 72 : 150; // clear of the navbar
      // Hero: centre the watch on the page's horizontal middle, but never left of the
      // "keeps a story." headline (approx right edge below + a small gap) so they
      // never collide on narrower screens where the headline is proportionally wider.
      const headlineRight = 96 + 6.7 * Math.min(vw * 0.068, 92);
      const xLarge = desktop
        ? Math.round(Math.max(headlineRight + 32, vw * 0.5 - largeW / 2))
        : vw - largeW - pad;
      return {
        largeW,
        smallW,
        xLarge,
        yLarge: mobile ? Math.max(150, vh * 0.26) : Math.max(150, (vh - largeH) / 2),
        xSmall: vw - smallW - dockRight,
        ySmall: dockTop,
      };
    };

    let g = geometry();

    const frame = () => {
      const targetP = clamp(window.scrollY / (vh * 0.6));
      // Ease progress toward the scroll target for buttery motion.
      prog += (targetP - prog) * 0.14;
      if (Math.abs(targetP - prog) < 0.0004) prog = targetP;

      const w = lerp(g.largeW, g.smallW, prog);
      const x = lerp(g.xLarge, g.xSmall, prog);
      const y = lerp(g.yLarge, g.ySmall, prog);
      el.style.transform = `translate3d(${x}px, ${y}px, 0) scale(${w / BASE})`;

      // Always visible once mounted — a gentle fade-in only, never a hide.
      shown += (1 - shown) * 0.1;
      el.style.opacity = String(shown);

      raf = requestAnimationFrame(frame);
    };

    const onResize = () => {
      vw = window.innerWidth;
      vh = window.innerHeight;
      g = geometry();
    };

    // Reveal once positioned to avoid a first-paint flash.
    const start = () => {
      if (started) return;
      started = true;
      el.style.transition = 'none';
      raf = requestAnimationFrame(frame);
    };

    start();
    window.addEventListener('resize', onResize);
    return () => {
      if (raf) cancelAnimationFrame(raf);
      window.removeEventListener('resize', onResize);
    };
  }, []);

  return (
    <div
      ref={ref}
      aria-hidden
      className="pointer-events-none fixed left-0 top-0 z-40 origin-top-left opacity-0 will-change-transform"
      style={{ width: BASE, height: BASE * 1.2, filter: 'drop-shadow(0 22px 48px rgba(0,0,0,0.55))' }}
    >
      {/* Soft halo behind the dial gives the watch presence and depth */}
      <div className="absolute left-1/2 top-[56%] -z-10 h-[88%] w-[88%] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(circle,rgba(191,166,138,0.20),transparent_62%)]" />
      <PocketWatch size={BASE} variant="champagne" />
    </div>
  );
}
