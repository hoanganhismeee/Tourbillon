// This file serves as a centralized API layer for the frontend.
// It contains all the functions responsible for making requests to the backend API,
// creating a reusable and maintainable way to manage data fetching.
const API_BASE_URL = 'http://localhost:5248/api';

// Data Interfaces
export interface Brand {
  id: number;
  name: string;
  description: string;
  image: string;
}

export interface Collection {
  id: number;
  name: string;
  description: string;
  image: string;
  brandId: number;
}

export interface Watch {
  id: number;
  name: string;
  description: string;
  image: string;
  currentPrice: number;
  brandId: number;
  collectionId: number | null;
}

// API Fetch Functions

export const fetchBrands = async (): Promise<Brand[]> => {
  const response = await fetch(`${API_BASE_URL}/brand`);
  if (!response.ok) {
    throw new Error('Failed to fetch brands');
  }
  return response.json();
};

export const fetchBrandById = async (id: number): Promise<Brand> => {
  const response = await fetch(`${API_BASE_URL}/brand/${id}`);
  if (!response.ok) {
    throw new Error(`Failed to fetch brand with id: ${id}`);
  }
  return response.json();
};

export const fetchWatchById = async (id: number): Promise<Watch> => {
  const response = await fetch(`${API_BASE_URL}/watch/${id}`);
  if (!response.ok) {
    throw new Error(`Failed to fetch watch with id: ${id}`);
  }
  return response.json();
};

export const fetchCollections = async (): Promise<Collection[]> => {
  const response = await fetch(`${API_BASE_URL}/collection`);
  if (!response.ok) {
    throw new Error('Failed to fetch collections');
  }
  return response.json();
};

export const fetchWatches = async (): Promise<Watch[]> => {
  const response = await fetch(`${API_BASE_URL}/watch`);
  if (!response.ok) {
    throw new Error('Failed to fetch watches');
  }
  return response.json();
};

export const fetchWatchesByBrand = async (brandId: number): Promise<Watch[]> => {
  const response = await fetch(`${API_BASE_URL}/watch/brand/${brandId}`);
  if (!response.ok) {
    throw new Error(`Failed to fetch watches for brandId: ${brandId}`);
  }
  return response.json();
};

export const fetchWatchesByCollection = async (collectionId: number): Promise<Watch[]> => {
  const response = await fetch(`${API_BASE_URL}/watch/collection/${collectionId}`);
  if (!response.ok) {
    throw new Error(`Failed to fetch watches for collectionId: ${collectionId}`);
  }
  return response.json();
}; 