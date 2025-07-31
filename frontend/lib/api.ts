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
  summary: string;
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
  specs: string | null;
}

export interface User {
    email: string;
    firstName: string;
    lastName: string;
    phoneNumber: string;
    address?: string;
    city?: string;
    state?: string;
    country?: string;
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

export const fetchCollectionById = async (id: number): Promise<Collection> => {
  const response = await fetch(`${API_BASE_URL}/collection/${id}`, { credentials: 'include' });
  if (!response.ok) {
    throw new Error(`Failed to fetch collection with id: ${id}`);
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

export const fetchCollectionsByBrand = async (brandId: number): Promise<Collection[]> => { // fetchs collections for based on brandId
  const response = await fetch(`${API_BASE_URL}/collection/brand/${brandId}`, { credentials: 'include' });
  if (!response.ok) {
    throw new Error(`Failed to fetch collections for brandId: ${brandId}`);
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

// Interface for updating user data
interface UpdateUserData {
    email: string;
    firstName: string;
    lastName: string;
    phoneNumber?: string;
    address?: string;
    city?: string;
    state?: string;
    country?: string;
    currentPassword?: string; // Required when changing password
    newPassword?: string;
}

// Interface for deleting user account
interface DeleteAccountData {
    currentPassword: string;
    confirmPassword: string;
}

export const updateUser = async (data: UpdateUserData) => {
    try {
        const response = await fetch(`${API_BASE_URL}/account/update`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
            credentials: 'include',
        });
        if (!response.ok) {
            const errorData = await response.json();
            // Handle both array of errors and single error message
            if (Array.isArray(errorData)) {
                const errorMessage = errorData.map((err: AuthError) => err.description).join(', ') || 'Update failed';
                return { error: errorMessage };
            } else {
                // Show the specific error message from backend
                const errorMessage = errorData.Message || errorData.message || 'Update failed';
                return { error: errorMessage };
            }
        }
        return response.json();
    } catch (err) {
        console.error('Network error:', err);
        return { error: 'Network error occurred' };
    }
};

export const deleteAccount = async (data: DeleteAccountData) => {
    try {
        const response = await fetch(`${API_BASE_URL}/account/delete`, {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
            credentials: 'include',
        });
        if (!response.ok) {
            const errorData = await response.json();
            const errorMessage = errorData.Message || 'Account deletion failed';
            return { error: errorMessage };
        }
        // Handle empty response for successful deletion
        const text = await response.text();
        return text ? JSON.parse(text) : { Message: "Account deleted successfully" };
    } catch (err) {
        console.error('Network error:', err);
        return { error: 'Network error occurred' };
    }
}; 