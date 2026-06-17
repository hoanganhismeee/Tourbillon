// Decorative pocket watch for the Stories page.
// Sits large in the hero, then eases down into a corner emblem as you scroll.
// A continuous lerp loop smooths the motion, and it swaps with the navbar:
// hidden while scrolling up (navbar owns the top), shown while scrolling down.
// A single fixed element, so the winding hands never stop. Decorative only.
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
    let lastY = window.scrollY;
    let dir: 'up' | 'down' = 'down';

    // Smoothed state, eased toward their targets every frame.
    let prog = Math.min(1, Math.max(0, window.scrollY / (vh * 0.6)));
    let shown = 1;
    let started = false;

    const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

    // Breakpoint-aware home (large) and docked (small) geometry, anchored to the
    // right edge so the watch only ever shrinks up toward the corner.
    const geometry = () => {
      const mobile = vw < 768;
      let largeW: number;
      if (vw >= 1280) largeW = 340;
      else if (vw >= 1024) largeW = 280;
      else if (vw >= 768) largeW = 220;
      else largeW = 116;
      // A generous docked emblem — readable, not a speck.
      const smallW = mobile ? 70 : 108;
      const pad = vw >= 1024 ? 96 : vw >= 640 ? 40 : 24;
      const largeH = largeW * 1.2;
      const dockRight = mobile ? 14 : 28;
      const dockTop = mobile ? 14 : 20;
      return {
        mobile,
        largeW,
        smallW,
        xLarge: vw - largeW - pad,
        yLarge: mobile ? Math.max(150, vh * 0.26) : Math.max(132, (vh - largeH) / 2),
        xSmall: vw - smallW - dockRight,
        ySmall: dockTop,
      };
    };

    let g = geometry();

    const frame = () => {
      const targetP = Math.min(1, Math.max(0, window.scrollY / (vh * 0.6)));
      // Ease progress toward the scroll target for buttery motion.
      prog += (targetP - prog) * 0.16;
      if (Math.abs(targetP - prog) < 0.0005) prog = targetP;

      const w = lerp(g.largeW, g.smallW, prog);
      const x = lerp(g.xLarge, g.xSmall, prog);
      const y = lerp(g.yLarge, g.ySmall, prog);
      el.style.transform = `translate3d(${x}px, ${y}px, 0) scale(${w / BASE})`;

      // Swap with the navbar: while scrolling up (navbar visible) the watch hides,
      // unless we are essentially back at the hero where it lives full-size.
      const hide = dir === 'up' && targetP > 0.08;
      // On mobile the watch recedes a touch while large so it never fights the copy.
      const target = hide ? 0 : g.mobile ? 0.55 + 0.45 * prog : 1;
      shown += (target - shown) * 0.16;
      el.style.opacity = String(shown);

      raf = requestAnimationFrame(frame);
    };

    const onScroll = () => {
      const y = window.scrollY;
      const d = y - lastY;
      if (d > 4) dir = 'down';
      else if (d < -4) dir = 'up';
      lastY = y;
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
      className="pointer-events-none fixed left-0 top-0 z-40 origin-top-left opacity-0 will-change-transform"
      style={{ width: BASE, height: BASE * 1.2, filter: 'drop-shadow(0 22px 48px rgba(0,0,0,0.55))' }}
    >
      {/* Soft halo behind the dial gives the watch presence and depth */}
      <div className="absolute left-1/2 top-[56%] -z-10 h-[88%] w-[88%] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(circle,rgba(191,166,138,0.20),transparent_62%)]" />
      <PocketWatch size={BASE} variant="champagne" />
    </div>
  );
}
