// Tracks whether the most-recent navigation was triggered by the browser's
// back/forward buttons (popstate) vs a programmatic forward push.
// popstate → _isBack = true; history.pushState → _isBack = false.
// Shared by AnimatedLayout (scroll-to-top gate) and useScrollRestore (restoration gate).

let _isBack = false;

if (typeof window !== 'undefined') {
  window.addEventListener('popstate', () => { _isBack = true; });
  const orig = history.pushState;
  history.pushState = function (...args: Parameters<typeof orig>) {
    _isBack = false;
    return orig.apply(this, args);
  };
}

export function isBackNavigation(): boolean {
  return _isBack;
}
