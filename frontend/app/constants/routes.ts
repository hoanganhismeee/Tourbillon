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
  WATCH_DETAIL: (slug: string) => `/watches/${slug}`,
  WATCHES_SORT: (sort: string) => `/watches?sort=${encodeURIComponent(sort)}`,
  BRAND_DETAIL: (slug: string) => `/brands/${slug}`,
  COLLECTION_DETAIL: (slug: string) => `/collections/${slug}`,
  SEARCH_RESULTS: (query: string) => `/search?q=${encodeURIComponent(query)}`,
  CONTACT_ADVISOR: (watchId: number) => `/contact?watchId=${watchId}`,
} as const;
