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

export interface User {
    email: string;
    firstName: string;
    lastName: string;
    phoneNumber: string;
}

// API Fetch Functions
export const fetchBrands = async (): Promise<Brand[]> => {
  const response = await fetch(`${API_BASE_URL}/brand`, { credentials: 'include' });
  if (!response.ok) {
    throw new Error('Failed to fetch brands');
  }
  return response.json();
};

export const fetchBrandById = async (id: number): Promise<Brand> => {
  const response = await fetch(`${API_BASE_URL}/brand/${id}`, { credentials: 'include' });
  if (!response.ok) {
    throw new Error(`Failed to fetch brand with id: ${id}`);
  }
  return response.json();
};

export const fetchWatchById = async (id: number): Promise<Watch> => {
  const response = await fetch(`${API_BASE_URL}/watch/${id}`, { credentials: 'include' });
  if (!response.ok) {
    throw new Error(`Failed to fetch watch with id: ${id}`);
  }
  return response.json();
};

export const fetchCollections = async (): Promise<Collection[]> => {
  const response = await fetch(`${API_BASE_URL}/collection`, { credentials: 'include' });
  if (!response.ok) {
    throw new Error('Failed to fetch collections');
  }
  return response.json();
};

export const fetchWatches = async (): Promise<Watch[]> => {
  const response = await fetch(`${API_BASE_URL}/watch`, { credentials: 'include' });
  if (!response.ok) {
    throw new Error('Failed to fetch watches');
  }
  return response.json();
};

export const fetchWatchesByBrand = async (brandId: number): Promise<Watch[]> => {
  const response = await fetch(`${API_BASE_URL}/watch/brand/${brandId}`, { credentials: 'include' });
  if (!response.ok) {
    throw new Error(`Failed to fetch watches for brandId: ${brandId}`);
  }
  return response.json();
};

export const fetchWatchesByCollection = async (collectionId: number): Promise<Watch[]> => {
  const response = await fetch(`${API_BASE_URL}/watch/collection/${collectionId}`, { credentials: 'include' });
  if (!response.ok) {
    throw new Error(`Failed to fetch watches for collectionId: ${collectionId}`);
  }
  return response.json();
};

// --- Auth API Functions ---

// Interfaces for Auth data
interface AuthError {
    code: string;
    description: string;
}

interface RegisterData {
    email: string;
    password?: string;
    firstName: string;
    lastName: string;
    phoneNumber?: string;
}

interface LoginData {
    email: string;
    password?: string;
}

export const getCurrentUser = async (): Promise<User> => {
    const response = await fetch(`${API_BASE_URL}/account/me`, { credentials: 'include' });
    if (!response.ok) {
        throw new Error('Not authenticated');
    }
    return response.json();
};

export const registerUser = async (data: RegisterData) => {
    const response = await fetch(`${API_BASE_URL}/account/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
        credentials: 'include',
    });
    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.map((err: AuthError) => err.description).join(', ') || 'Registration failed');
    }
    return response.json();
};

export const loginUser = async (data: LoginData) => {
    const response = await fetch(`${API_BASE_URL}/account/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
        credentials: 'include',
    });
    if (!response.ok) {
        throw new Error('Login failed');
    }
    // Login doesn't return user data, it sets a cookie. AuthContext will fetch the user.
    return;
};

export const logoutUser = async () => {
    const response = await fetch(`${API_BASE_URL}/account/logout`, {
        method: 'POST',
        credentials: 'include',
    });
    if (!response.ok) {
        throw new Error('Logout failed');
    }
}; 