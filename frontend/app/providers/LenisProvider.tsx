// Site-wide smooth scroll provider using Lenis.
// lerp: 0.08 — tuned for Windows trackpads (0.05 feels sluggish; go to 0.12 if lag reported).
// Wraps the entire app so all scroll events go through Lenis.
// prevent: walks up the DOM from the event target — if any ancestor is position:fixed with
// overflow scrolling (i.e. a modal overlay), Lenis yields to native scroll automatically.
// This means modals never need data-lenis-prevent added manually.
'use client';

import { ReactLenis } from 'lenis/react';

function preventInFixedOverflow(node: Element): boolean {
  let el: Element | null = node;
  while (el && el !== document.body) {
    const style = window.getComputedStyle(el);
    if (
      style.position === 'fixed' &&
      (style.overflowY === 'auto' || style.overflowY === 'scroll')
    ) {
      return true;
    }
    el = el.parentElement;
  }
  return false;
}

export function LenisProvider({ children }: { children: React.ReactNode }) {
  return (
    <ReactLenis
      root
      options={{
        lerp: 0.08,
        duration: 1.2,
        smoothWheel: true,
        prevent: preventInFixedOverflow,
      }}
    >
      {children}
    </ReactLenis>
  );
}
