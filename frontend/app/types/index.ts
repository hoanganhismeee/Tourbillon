// Central type definitions for the Tourbillon application

export interface Brand {
  id: number;
  name: string;
  summary: string;
  image?: string;
  type: string;
  relevanceScore?: number;
}

export interface Watch {
  id: number;
  name: string;
  currentPrice?: number;
  image?: string;
  brandId: number;
  collectionId?: number;
  brand?: { id: number; name: string };
  collection?: { id: number; name: string };
  type: string;
  relevanceScore?: number;
}

export interface Collection {
  id: number;
  name: string;
  image?: string;
  brandId: number;
  brand?: { id: number; name: string };
  type: string;
  relevanceScore?: number;
}

export interface SearchResult {
  watches: Watch[];
  brands: Brand[];
  collections: Collection[];
  totalResults: number;
  suggestions: string[];
}

export interface User {
  id: number;
  email: string;
  username?: string;
}

export interface NavigationState {
  scrollPosition: number;
  currentPage: number;
  path: string;
  timestamp: number;
} 