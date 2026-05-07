// Shared scroll-restoration hook for all listing pages.
// Call with isReady = true once the page's content is in the DOM.
// Reads the back-nav checkpoint from sessionStorage, scrolls to the saved position,
// then fades the body back in (body was hidden by handleBackClick before navigation).
'use client';

import { useEffect, useRef } from 'react';
import { useLenis } from 'lenis/react';
import { useNavigation } from '@/contexts/NavigationContext';
import { EASE_LUXURY_CSS } from '@/lib/motion';
import { isScrollRestore, clearScrollRestore } from '@/lib/navigationDirection';

const STORAGE_KEY = 'tourbillon-nav';

export function useScrollRestore(isReady: boolean) {
  const { clearNavigationState } = useNavigation();
  // Lenis must be called with immediate:true so the position lands exactly —
  // the default lerp easing would overshoot or undershoot the saved position.
  const lenis = useLenis();
  const hasRun = useRef(false);

  useEffect(() => {
    if (!isReady || hasRun.current) return;
    hasRun.current = true;

    try {
      // Only restore on genuine back/forward navigation. Forward navigation to a URL
      // that happens to match a saved checkpoint must not restore the old position.
      if (isScrollRestore()) {
        const raw = sessionStorage.getItem(STORAGE_KEY);
        if (raw) {
          const saved = JSON.parse(raw);
          if (
            typeof saved.scrollPosition === 'number' &&
            saved.path === window.location.pathname + window.location.search
          ) {
            if (lenis) {
              lenis.scrollTo(saved.scrollPosition, { immediate: true });
            } else {
              window.scrollTo(0, saved.scrollPosition);
            }
            clearNavigationState();
            clearScrollRestore();
          }
        }
      }
    } catch { /* corrupt data — ignore */ }

    // Fade the page in. Runs after the scroll position settles (rAF = next paint).
    requestAnimationFrame(() => {
      if (document.body.style.opacity === '0') {
        document.body.style.transition = `opacity 0.65s ${EASE_LUXURY_CSS}`;
        document.body.style.opacity = '1';
        setTimeout(() => { document.body.style.transition = ''; }, 700);
      }
    });
  }, [isReady]); // eslint-disable-line react-hooks/exhaustive-deps
}
