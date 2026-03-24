// Route constants for the Tourbillon application
export const ROUTES = {
  // Main pages
  HOME: '/',
  WATCHES: '/watches',
  BRANDS: '/brands',
  COLLECTIONS: '/collections',
  SEARCH: '/search',
  
  // Auth pages
  LOGIN: '/login',
  REGISTER: '/register',
  ACCOUNT: '/account',
  
  // Other pages
  CONTACT: '/contact',
  STORIES: '/stories',
  TREND: '/trend',
} as const;

export const DYNAMIC_ROUTES = {
  WATCH_DETAIL: (id: number | string) => `/watches/${id}`,
  BRAND_DETAIL: (id: number | string) => `/brands/${id}`,
  COLLECTION_DETAIL: (id: number | string) => `/collections/${id}`,
  SEARCH_RESULTS: (query: string) => `/search?q=${encodeURIComponent(query)}`,
  CONTACT_ADVISOR: (watchId: number) => `/contact?watchId=${watchId}`,
} as const;