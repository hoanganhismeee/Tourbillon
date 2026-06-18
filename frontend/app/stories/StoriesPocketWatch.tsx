// Decorative pocket watch for the Stories page.
// Sits large in the hero, then eases down into a small corner emblem as you scroll.
// It never disappears: instead of hiding when the navbar returns, it shares the
// top-right corner with it — sitting flush at the top while the navbar is hidden
// (scrolling down), and tucking just below the navbar when it slides back in
// (scrolling up). A continuous lerp loop eases position, scale, and the navbar tuck
// for buttery motion. A single fixed element, so the winding hands never stop.
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

    const clamp = (n: number) => Math.min(1, Math.max(0, n));
    const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

    // Smoothed state, eased toward their targets every frame.
    let prog = clamp(window.scrollY / (vh * 0.6)); // 0 = hero, 1 = docked
    let navShown = 1; // 1 = navbar visible (tuck below it), 0 = hidden (hug top)
    let shown = 0; // opacity, eases to 1 once positioned
    let started = false;

    // Breakpoint-aware home (large) and docked (small) geometry, anchored to the
    // right edge so the watch only ever shrinks up toward the corner. Two docked
    // Y targets let the emblem share the corner with the navbar instead of hiding.
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
      const dockRight = mobile ? 16 : 28;
      return {
        mobile,
        largeW,
        smallW,
        xLarge: vw - largeW - pad,
        yLarge: mobile ? Math.max(150, vh * 0.26) : Math.max(132, (vh - largeH) / 2),
        xSmall: vw - smallW - dockRight,
        yTop: mobile ? 12 : 18, // navbar hidden — hug the very corner
        yTuck: mobile ? 64 : 104, // navbar visible — slide below the navbar bar
      };
    };

    let g = geometry();

    const frame = () => {
      const targetP = clamp(window.scrollY / (vh * 0.6));
      // Ease progress toward the scroll target for buttery motion.
      prog += (targetP - prog) * 0.14;
      if (Math.abs(targetP - prog) < 0.0004) prog = targetP;

      // Mirror the navbar: it shows while scrolling up, hides while scrolling down.
      // Ease the tuck so the emblem glides between corner and below-navbar.
      const navTarget = dir === 'up' ? 1 : 0;
      navShown += (navTarget - navShown) * 0.12;

      const w = lerp(g.largeW, g.smallW, prog);
      const x = lerp(g.xLarge, g.xSmall, prog);
      // The navbar tuck only matters once docked; in the hero the watch sits low
      // and centered, well clear of the navbar regardless of direction.
      const dockY = lerp(g.yTop, g.yTuck, navShown);
      const y = lerp(g.yLarge, dockY, prog);
      el.style.transform = `translate3d(${x}px, ${y}px, 0) scale(${w / BASE})`;

      // Always visible once mounted — a gentle fade-in only, never a hide.
      shown += (1 - shown) * 0.1;
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
