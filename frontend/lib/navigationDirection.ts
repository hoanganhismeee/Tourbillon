// Scroll restoration contract for navigation.
//
// Explicit back buttons call markScrollRestore() to declare checkpoint-restore intent.
// Browser back button (popstate) is handled as a secondary signal for native navigation.
// AnimatedLayout reads isScrollRestore() to decide whether to skip scroll-to-top.
// useScrollRestore reads isScrollRestore() to decide whether to restore position,
// then calls clearScrollRestore() once restoration is handled.

let _popBack = false;

if (typeof window !== 'undefined') {
  window.addEventListener('popstate', () => { _popBack = true; });
  const orig = history.pushState;
  history.pushState = function (...args: Parameters<typeof orig>) {
    _popBack = false;
    return orig.apply(this, args);
  };
}

const FLAG_KEY = 'tourbillon-restore-intent';

/** Call immediately before router.back() when the button's job is checkpoint restoration. */
export function markScrollRestore(): void {
  try { sessionStorage.setItem(FLAG_KEY, '1'); } catch { /* ignore */ }
}

/** True when the current navigation should restore a saved scroll checkpoint. */
export function isScrollRestore(): boolean {
  try {
    if (sessionStorage.getItem(FLAG_KEY) === '1') return true;
  } catch { /* ignore */ }
  return _popBack;
}

/** Call after restoration is complete to clear both the explicit flag and the popstate signal. */
export function clearScrollRestore(): void {
  try { sessionStorage.removeItem(FLAG_KEY); } catch { /* ignore */ }
  _popBack = false;
}
