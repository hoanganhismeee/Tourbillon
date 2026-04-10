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

// Returns the rolling buffer of stored browsing events, or an empty array if unavailable.
export function getBufferedEvents(): BrowsingEvent[] {
  try {
    const raw = localStorage.getItem(BEHAVIOR_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed as BrowsingEvent[];
  } catch {
    return [];
  }
}

// Appends a new event (with current timestamp) to the buffer, trimming to the last 100 entries.
export function trackEvent(event: Omit<BrowsingEvent, 'timestamp'>): void {
  try {
    const events = getBufferedEvents();
    events.push({ ...event, timestamp: Date.now(), anonId: getAnonId() });
    const trimmed = events.slice(-MAX_EVENTS);
    localStorage.setItem(BEHAVIOR_KEY, JSON.stringify(trimmed));
  } catch {
    // Silently ignore — storage may be full or unavailable
  }
}

// Clears the behavior buffer from localStorage.
export function clearBuffer(): void {
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
