// Shared scroll-restoration hook for all listing pages.
// Call with isReady = true once the page's content is in the DOM.
// Reads the back-nav checkpoint from sessionStorage, scrolls to the saved position,
// then fades the body back in (body was hidden by handleBackClick before navigation).
'use client';

import { useEffect, useRef } from 'react';
import { useNavigation } from '@/contexts/NavigationContext';

const STORAGE_KEY = 'tourbillon-nav';

export function useScrollRestore(isReady: boolean) {
  const { clearNavigationState } = useNavigation();
  const hasRun = useRef(false);

  useEffect(() => {
    if (!isReady || hasRun.current) return;
    hasRun.current = true;

    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      let restored = false;
      if (raw) {
        const saved = JSON.parse(raw);
        // Only restore if the checkpoint belongs to this page — not a stale checkpoint
        // from a previous listing page the user navigated forward away from.
        if (
          typeof saved.scrollPosition === 'number' &&
          saved.path === window.location.pathname
        ) {
          window.scrollTo(0, saved.scrollPosition);
          clearNavigationState();
          restored = true;
        }
      }
      // On fresh forward navigation (no matching checkpoint), force scroll to top.
      // Browser scroll restoration can wrongly resume a prior position when the same
      // URL still exists in the history stack.
      if (!restored) window.scrollTo(0, 0);
    } catch { /* corrupt data — ignore */ }

    // Let the scroll position settle for one frame, then fade the page in unhurriedly.
    // expo-out easing (0.16, 1, 0.3, 1) — fast start, long gentle tail — feels premium.
    requestAnimationFrame(() => {
      if (document.body.style.opacity === '0') {
        document.body.style.transition = 'opacity 0.65s cubic-bezier(0.16, 1, 0.3, 1)';
        document.body.style.opacity = '1';
        setTimeout(() => { document.body.style.transition = ''; }, 700);
      }
    });
  }, [isReady]); // eslint-disable-line react-hooks/exhaustive-deps
}
