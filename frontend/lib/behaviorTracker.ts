// Utility for silently tracking user browsing behavior to power AI-generated Watch DNA profiles.
// All localStorage access is wrapped in try/catch for SSR safety — Next.js server-renders
// pages where localStorage is not available.

const ANON_ID_KEY = 'tourbillon-anon-id';
const BEHAVIOR_KEY = 'tourbillon-behavior';
const MAX_EVENTS = 100;

export interface BrowsingEvent {
  type: 'watch_view' | 'brand_view' | 'collection_view' | 'search';
  entityId?: number;
  entityName: string;
  brandId?: number;
  timestamp: number;
  anonId?: string;
}

// Returns the stored anonymous ID or creates and persists a new UUID v4.
export function getAnonId(): string {
  try {
    const existing = localStorage.getItem(ANON_ID_KEY);
    if (existing) return existing;
    const id = crypto.randomUUID();
    localStorage.setItem(ANON_ID_KEY, id);
    return id;
  } catch {
    return '';
  }
}

const VALID_EVENT_TYPES: ReadonlySet<BrowsingEvent['type']> = new Set([
  'watch_view', 'brand_view', 'collection_view', 'search',
]);

// Defensive shape check — drops entries that don't match the current BrowsingEvent
// contract so a stale format in localStorage (e.g. after a schema change) cannot
// corrupt the flush payload sent to the backend.
function isValidEvent(value: unknown): value is BrowsingEvent {
  if (!value || typeof value !== 'object') return false;
  const e = value as Record<string, unknown>;
  return (
    typeof e.type === 'string'
    && VALID_EVENT_TYPES.has(e.type as BrowsingEvent['type'])
    && typeof e.entityName === 'string'
    && typeof e.timestamp === 'number'
  );
}

// In-memory queue of events that haven't been flushed to localStorage yet.
// Flushed on idle (FLUSH_DEBOUNCE_MS), when MAX_PENDING is hit, or on tab hide.
const pending: BrowsingEvent[] = [];
const FLUSH_DEBOUNCE_MS = 5000;
const MAX_PENDING = 10;
let flushTimer: ReturnType<typeof setTimeout> | null = null;
let unloadHookInstalled = false;

function readPersisted(): BrowsingEvent[] {
  try {
    const raw = localStorage.getItem(BEHAVIOR_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isValidEvent);
  } catch {
    return [];
  }
}

function persistNow(): void {
  if (pending.length === 0) return;
  try {
    const merged = [...readPersisted(), ...pending].slice(-MAX_EVENTS);
    localStorage.setItem(BEHAVIOR_KEY, JSON.stringify(merged));
    pending.length = 0;
    if (flushTimer) { clearTimeout(flushTimer); flushTimer = null; }
  } catch {
    // Storage may be full or unavailable — keep the pending buffer so a later
    // flush can retry instead of dropping events on the floor.
  }
}

function ensureUnloadHook(): void {
  if (unloadHookInstalled || typeof window === 'undefined') return;
  // pagehide fires reliably on tab close, navigation, and mobile bfcache transitions.
  window.addEventListener('pagehide', persistNow);
  window.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') persistNow();
  });
  unloadHookInstalled = true;
}

// Returns the rolling buffer of stored browsing events, or an empty array if unavailable.
// Flushes any pending in-memory events first so callers (e.g. flushBehaviorEvents) see
// everything tracked so far in the current session.
export function getBufferedEvents(): BrowsingEvent[] {
  persistNow();
  return readPersisted();
}

// Appends a new event (with current timestamp) to the in-memory queue and schedules
// a debounced flush. Avoids a parse + stringify + write cycle on every page view.
export function trackEvent(event: Omit<BrowsingEvent, 'timestamp'>): void {
  try {
    pending.push({ ...event, timestamp: Date.now(), anonId: getAnonId() });
    ensureUnloadHook();
    if (pending.length >= MAX_PENDING) {
      persistNow();
      return;
    }
    if (flushTimer === null) {
      flushTimer = setTimeout(persistNow, FLUSH_DEBOUNCE_MS);
    }
  } catch {
    // Silently ignore — storage may be full or unavailable
  }
}

// Clears the behavior buffer from localStorage and any pending in-memory events.
export function clearBuffer(): void {
  pending.length = 0;
  if (flushTimer) { clearTimeout(flushTimer); flushTimer = null; }
  try {
    localStorage.removeItem(BEHAVIOR_KEY);
  } catch {
    // Silently ignore
  }
}

// Removes the stored anonymous identity so the next event creates a fresh browser-scoped visitor.
export function clearAnonId(): void {
  try {
    localStorage.removeItem(ANON_ID_KEY);
  } catch {
    // Silently ignore
  }
}

// Resets all anonymous Watch DNA state in the current browser.
export function resetAnonymousTracking(): void {
  clearBuffer();
  clearAnonId();
}
