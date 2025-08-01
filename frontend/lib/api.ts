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
  additionalImages?: string; // Comma-separated list of additional image filenames
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
    dateOfBirth?: string;
    address?: string;
    city?: string;
    state?: string;
    country?: string;
}

// API Fetch Functions

// Fetches all brands from the backend
export const fetchBrands = async (): Promise<Brand[]> => {
  const response = await fetch(`${API_BASE_URL}/brand`, { credentials: 'include' });
  if (!response.ok) {
    throw new Error('Failed to fetch brands');
  }
  return response.json();
};

// Fetches a specific brand by its ID
export const fetchBrandById = async (id: number): Promise<Brand> => {
  const response = await fetch(`${API_BASE_URL}/brand/${id}`, { credentials: 'include' });
  if (!response.ok) {
    throw new Error(`Failed to fetch brand with id: ${id}`);
  }
  return response.json();
};

// Fetches a specific watch by its ID
export const fetchWatchById = async (id: number): Promise<Watch> => {
  const response = await fetch(`${API_BASE_URL}/watch/${id}`, { credentials: 'include' });
  if (!response.ok) {
    throw new Error(`Failed to fetch watch with id: ${id}`);
  }
  return response.json();
};

// Fetches all collections from the backend
export const fetchCollections = async (): Promise<Collection[]> => {
  const response = await fetch(`${API_BASE_URL}/collection`, { credentials: 'include' });
  if (!response.ok) {
    throw new Error('Failed to fetch collections');
  }
  return response.json();
};

// Fetches a specific collection by its ID
export const fetchCollectionById = async (id: number): Promise<Collection> => {
  const response = await fetch(`${API_BASE_URL}/collection/${id}`, { credentials: 'include' });
  if (!response.ok) {
    throw new Error(`Failed to fetch collection with id: ${id}`);
  }
  return response.json();
};

// Fetches all watches from the backend
export const fetchWatches = async (): Promise<Watch[]> => {
  const response = await fetch(`${API_BASE_URL}/watch`, { credentials: 'include' });
  if (!response.ok) {
    throw new Error('Failed to fetch watches');
  }
  return response.json();
};

// Fetches all watches that belong to a specific brand
export const fetchWatchesByBrand = async (brandId: number): Promise<Watch[]> => {
  const response = await fetch(`${API_BASE_URL}/watch/brand/${brandId}`, { credentials: 'include' });
  if (!response.ok) {
    throw new Error(`Failed to fetch watches for brandId: ${brandId}`);
  }
  return response.json();
};

// Fetches all watches that belong to a specific collection
export const fetchWatchesByCollection = async (collectionId: number): Promise<Watch[]> => {
  const response = await fetch(`${API_BASE_URL}/watch/collection/${collectionId}`, { credentials: 'include' });
  if (!response.ok) {
    throw new Error(`Failed to fetch watches for collectionId: ${collectionId}`);
  }
  return response.json();
};

// Fetches all collections that belong to a specific brand
export const fetchCollectionsByBrand = async (brandId: number): Promise<Collection[]> => {
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

// Gets the currently logged-in user's profile information
export const getCurrentUser = async (): Promise<User> => {
    const response = await fetch(`${API_BASE_URL}/profile/me`, { credentials: 'include' });
    if (!response.ok) {
        throw new Error('Not authenticated');
    }
    return response.json();
};

// Registers a new user account
export const registerUser = async (data: RegisterData) => {
    const response = await fetch(`${API_BASE_URL}/authentication/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
        credentials: 'include',
    });
    if (!response.ok) {
        const errorData = await response.json();
        // Handle the new error format from backend
        const errorMessage = errorData.Message || errorData.message || 'Registration failed';
        throw new Error(errorMessage);
    }
    return response.json();
};

// Logs in an existing user
export const loginUser = async (data: LoginData) => {
    const response = await fetch(`${API_BASE_URL}/authentication/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
        credentials: 'include',
    });
    if (!response.ok) {
        const errorData = await response.json();
        const errorMessage = errorData.Message || errorData.message || 'Login failed';
        throw new Error(errorMessage);
    }
    // Login doesn't return user data, it sets a cookie. AuthContext will fetch the user.
    return;
};

// Logs out the current user
export const logoutUser = async () => {
    const response = await fetch(`${API_BASE_URL}/authentication/logout`, {
        method: 'POST',
        credentials: 'include',
    });
    if (!response.ok) {
        const errorData = await response.json();
        const errorMessage = errorData.Message || errorData.message || 'Logout failed';
        throw new Error(errorMessage);
    }
};

// Interface for updating user data
interface UpdateUserData {
    email: string;
    firstName: string;
    lastName: string;
    phoneNumber?: string;
    dateOfBirth?: string;
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

// Updates the current user's profile information
export const updateUser = async (data: UpdateUserData) => {
    try {
        const response = await fetch(`${API_BASE_URL}/profile/update`, {
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

// Permanently deletes the current user's account
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