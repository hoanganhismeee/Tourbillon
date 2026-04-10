// Site-wide smooth scroll provider using Lenis.
// lerp: 0.08 — tuned for Windows trackpads (0.05 feels sluggish; go to 0.12 if lag reported).
// Wraps the entire app so all scroll events go through Lenis.
// prevent: walks up the DOM from the event target — if any ancestor is explicitly marked
// for native scrolling or is a genuinely scrollable container, Lenis yields to that element
// instead of moving the page. This keeps dropdowns, panels, popups, and custom scroll areas usable.
'use client';

import { ReactLenis } from 'lenis/react';

function isExplicitLenisPrevent(el: HTMLElement): boolean {
  return el.dataset.lenisPrevent === 'true';
}

function canScrollVertically(el: HTMLElement, style: CSSStyleDeclaration): boolean {
  return (
    ['auto', 'scroll', 'overlay'].includes(style.overflowY) &&
    el.scrollHeight > el.clientHeight + 1
  );
}

function canScrollHorizontally(el: HTMLElement, style: CSSStyleDeclaration): boolean {
  return (
    ['auto', 'scroll', 'overlay'].includes(style.overflowX) &&
    el.scrollWidth > el.clientWidth + 1
  );
}

function preventNestedNativeScroll(node: Element): boolean {
  let el: Element | null = node instanceof HTMLElement ? node : node.parentElement;

  while (el && el !== document.body) {
    if (!(el instanceof HTMLElement)) {
      el = el.parentElement;
      continue;
    }

    if (isExplicitLenisPrevent(el)) {
      return true;
    }

    const style = window.getComputedStyle(el);
    if (canScrollVertically(el, style) || canScrollHorizontally(el, style)) {
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
        prevent: preventNestedNativeScroll,
      }}
    >
      {children}
    </ReactLenis>
  );
}
