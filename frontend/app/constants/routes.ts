// Route constants for the Tourbillon application
export const ROUTES = {
  // Main pages — the shop now lives under /tourbillon; the root is the portfolio landing
  HOME: '/tourbillon',
  WATCHES: '/watches',
  BRANDS: '/brands',
  COLLECTIONS: '/collections',
  SEARCH: '/search',
  
  // Auth pages
  AUTH_START: '/auth/start',
  LOGIN: '/login',
  REGISTER: '/register',
  ACCOUNT: '/account',
  ACCOUNT_INQUIRIES: '/account/inquiries',
  
  // Other pages
  CONTACT: '/contact',
  STORIES: '/stories',
  TREND: '/trend',
  // Portfolio landing (root) + case studies — URL-only, not linked from nav or footer.
  PORTFOLIO: '/',
  PORTFOLIO_TOURBILLON: '/projects/tourbillon',
  PORTFOLIO_FUELUP: '/projects/fuelup',
} as const;

export const DYNAMIC_ROUTES = {
  WATCH_DETAIL: (slug: string) => `/watches/${slug}`,
  WATCHES_SORT: (sort: string) => `/watches?sort=${encodeURIComponent(sort)}`,
  BRAND_DETAIL: (slug: string) => `/brands/${slug}`,
  COLLECTION_DETAIL: (slug: string) => `/collections/${slug}`,
  SEARCH_RESULTS: (query: string) => `/search?q=${encodeURIComponent(query)}`,
  CONTACT_ADVISOR: (watchId: number) => `/contact?watchId=${watchId}`,
} as const;
