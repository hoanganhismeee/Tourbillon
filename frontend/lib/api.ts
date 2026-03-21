// This file serves as a centralized API layer for the frontend.
// It contains all the functions responsible for making requests to the backend API,
// creating a reusable and maintainable way to manage data fetching.
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5248/api';

// Small helper to avoid hanging requests in dev when backend is down
// Aborts the request after the given timeout (default 10s)
const fetchWithTimeout = async (input: RequestInfo | URL, init?: RequestInit & { timeoutMs?: number }) => {
  const { timeoutMs = 10000, ...rest } = init || {};
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(input, { ...rest, signal: controller.signal });
  } finally {
    clearTimeout(timeoutId);
  }
};

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
  imageUrl?: string;
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
    roles: string[];
}

// API Fetch Functions
export const fetchBrands = async (): Promise<Brand[]> => {
  const response = await fetchWithTimeout(`${API_BASE_URL}/brand`, { credentials: 'include' });
  if (!response.ok) {
    throw new Error('Failed to fetch brands');
  }
  return response.json();
};

export const fetchBrandById = async (id: number): Promise<Brand> => {
  const response = await fetchWithTimeout(`${API_BASE_URL}/brand/${id}`, { credentials: 'include' });
  if (!response.ok) {
    throw new Error(`Failed to fetch brand with id: ${id}`);
  }
  return response.json();
};

export const fetchWatchById = async (id: number): Promise<Watch> => {
  const response = await fetchWithTimeout(`${API_BASE_URL}/watch/${id}`, { credentials: 'include' });
  if (!response.ok) {
    throw new Error(`Failed to fetch watch with id: ${id}`);
  }
  return response.json();
};

export const fetchCollections = async (): Promise<Collection[]> => {
  const response = await fetchWithTimeout(`${API_BASE_URL}/collection`, { credentials: 'include' });
  if (!response.ok) {
    throw new Error('Failed to fetch collections');
  }
  return response.json();
};

export const fetchCollectionById = async (id: number): Promise<Collection> => {
  const response = await fetchWithTimeout(`${API_BASE_URL}/collection/${id}`, { credentials: 'include' });
  if (!response.ok) {
    throw new Error(`Failed to fetch collection with id: ${id}`);
  }
  return response.json();
};

export const fetchWatches = async (): Promise<Watch[]> => {
  const response = await fetchWithTimeout(`${API_BASE_URL}/watch`, { credentials: 'include' });
  if (!response.ok) {
    throw new Error('Failed to fetch watches');
  }
  return response.json();
};

export const fetchWatchesByBrand = async (brandId: number): Promise<Watch[]> => {
  const response = await fetchWithTimeout(`${API_BASE_URL}/watch/brand/${brandId}`, { credentials: 'include' });
  if (!response.ok) {
    throw new Error(`Failed to fetch watches for brandId: ${brandId}`);
  }
  return response.json();
};

export const fetchWatchesByCollection = async (collectionId: number): Promise<Watch[]> => {
  const response = await fetchWithTimeout(`${API_BASE_URL}/watch/collection/${collectionId}`, { credentials: 'include' });
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

// --- AI Watch Finder ---

export interface WatchMatchDetail {
  score: number;
}

export interface WatchFinderResult {
  watches: Watch[];
  otherCandidates: Watch[];
  matchDetails: Record<number, WatchMatchDetail>;
  parsedIntent: Record<string, unknown> | null;
}

export interface FilterOptions {
  caseMaterials: string[];
  movementTypes: string[];
  dialColors: string[];
  waterResistance: string[];
  powerReserve: string[];
  complications: string[];
}

export const watchFinderSearch = async (query: string): Promise<WatchFinderResult> => {
  const response = await fetchWithTimeout('/api/watch-finder', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
    timeoutMs: 120000,
  });
  if (!response.ok) throw new Error('Watch finder search failed');
  return response.json();
};

export const watchFinderExplain = async (query: string, watchId: number): Promise<string> => {
  const response = await fetchWithTimeout('/api/watch-finder-explain', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, watchId }),
    timeoutMs: 15000,
  });
  if (!response.ok) throw new Error('Explain failed');
  const data = await response.json();
  return data.explanation as string;
};

export const fetchFilterOptions = async (): Promise<FilterOptions> => {
  const response = await fetchWithTimeout(`${API_BASE_URL}/watch/filter-options`, {
    credentials: 'include',
  });
  if (!response.ok) throw new Error('Failed to fetch filter options');
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
    const response = await fetch(`${API_BASE_URL}/profile/me`, { credentials: 'include' });
    if (!response.ok) {
        throw new Error('Not authenticated');
    }
    return response.json();
};

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

// Password Reset Interfaces
interface ForgotPasswordData {
    email: string;
}

interface VerifyCodeData {
    email: string;
    code: string;
}

interface ResetPasswordData {
    email: string;
    code: string;
    newPassword: string;
}

// Password Reset API Functions
export const forgotPassword = async (data: ForgotPasswordData) => {
    const response = await fetch(`${API_BASE_URL}/authentication/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
    });
    
    // Check if response has content before parsing JSON
    const text = await response.text();
    
    if (!response.ok) {
        try {
            const errorData = JSON.parse(text);
            const errorMessage = errorData.Message || errorData.message || 'Failed to send reset email';
            throw new Error(errorMessage);
        } catch {
            throw new Error(text || 'Failed to send reset email');
        }
    }
    
    // Return parsed JSON or empty object if response is empty
    return text ? JSON.parse(text) : { Message: 'Reset email sent successfully' };
};

export const verifyCode = async (data: VerifyCodeData) => {
    const response = await fetch(`${API_BASE_URL}/authentication/verify-code`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
    });
    
    const text = await response.text();
    
    if (!response.ok) {
        try {
            const errorData = JSON.parse(text);
            const errorMessage = errorData.Message || errorData.message || 'Invalid verification code';
            throw new Error(errorMessage);
        } catch {
            throw new Error(text || 'Invalid verification code');
        }
    }
    
    return text ? JSON.parse(text) : { Message: 'Code verified successfully' };
};

export const resetPassword = async (data: ResetPasswordData) => {
    const response = await fetch(`${API_BASE_URL}/authentication/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
    });
    if (!response.ok) {
        const errorData = await response.json();
        const errorMessage = errorData.Message || errorData.message || 'Failed to reset password';
        throw new Error(errorMessage);
    }
    return response.json();
};

// Admin Watch API Functions
export const adminFetchWatches = async (): Promise<Watch[]> => {
  const response = await fetchWithTimeout(`${API_BASE_URL}/admin/watches`, { credentials: 'include' });
  if (!response.ok) {
    throw new Error('Failed to fetch admin watches');
  }
  return response.json();
};

export const adminFetchWatchById = async (id: number): Promise<Watch> => {
  const response = await fetchWithTimeout(`${API_BASE_URL}/admin/watches/${id}`, { credentials: 'include' });
  if (!response.ok) {
    throw new Error(`Failed to fetch admin watch with id: ${id}`);
  }
  return response.json();
};

export interface UpdateWatchDto {
  name: string;
  description: string;
  currentPrice: number;
  image: string;
  collectionId: number | null;
  specs: string;
}

export const adminUpdateWatch = async (id: number, data: UpdateWatchDto): Promise<{ success: boolean; message: string; watch?: Watch }> => {
  const response = await fetchWithTimeout(`${API_BASE_URL}/admin/watches/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
    credentials: 'include'
  });
  if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || errorData.Message || 'Failed to update watch');
  }
  return response.json();
};

export interface CreateWatchDto {
  name: string;
  description: string;
  currentPrice: number;
  image: string;
  brandId: number;
  collectionId: number | null;
  specs: string;
}

export const adminCreateWatch = async (data: CreateWatchDto): Promise<{ success: boolean; message: string; watch?: Watch }> => {
  const response = await fetchWithTimeout(`${API_BASE_URL}/admin/watches`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
    credentials: 'include'
  });
  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.message || errorData.Message || 'Failed to create watch');
  }
  return response.json();
};

export const deleteWatch = async (id: number): Promise<void> => {
  const response = await fetchWithTimeout(`${API_BASE_URL}/watch/${id}`, {
    method: 'DELETE',
    credentials: 'include'
  });
  if (!response.ok && response.status !== 204) {
    throw new Error(`Failed to delete watch ${id}`);
  }
};

// ── Magic Login (passwordless OTP) ───────────────────────────────────────────

export const requestMagicLogin = async (email: string): Promise<void> => {
  const response = await fetchWithTimeout(`${API_BASE_URL}/authentication/magic-login/request`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  });
  if (!response.ok) {
    const err = await response.json();
    throw new Error(err.message || 'Failed to send code');
  }
};

export const verifyMagicLogin = async (data: { email: string; code: string }): Promise<void> => {
  const response = await fetchWithTimeout(`${API_BASE_URL}/authentication/magic-login/verify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    const err = await response.json();
    throw new Error(err.message || 'Invalid or expired code');
  }
};

// ── Taste Profile ────────────────────────────────────────────────────────────

export interface TasteProfile {
  tasteText: string | null;
  preferredBrandIds: number[];
  preferredMaterials: string[];
  preferredDialColors: string[];
  priceMin: number | null;
  priceMax: number | null;
  preferredCaseSize: 'small' | 'medium' | 'large' | null;
}

export const getTasteProfile = async (): Promise<TasteProfile> => {
  const response = await fetchWithTimeout(`${API_BASE_URL}/taste`, {
    credentials: 'include',
  });
  if (!response.ok) throw new Error('Failed to fetch taste profile');
  return response.json();
};

export const saveTasteProfile = async (tasteText: string): Promise<TasteProfile> => {
  const response = await fetchWithTimeout(`${API_BASE_URL}/taste`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ tasteText }),
  });
  if (!response.ok) {
    const err = await response.json();
    throw new Error(err.message || 'Failed to save taste profile');
  }
  return response.json();
};

export const adminUploadWatchImage = async (file: File, slug?: string): Promise<{ success: boolean; publicId: string }> => {
  const formData = new FormData();
  formData.append('file', file);
  if (slug) {
    formData.append('slug', slug);
  }

  // We intentionally do not use fetchWithTimeout here since uploads can be slow
  const response = await fetch(`${API_BASE_URL}/admin/watches/upload-image`, {
    method: 'POST',
    body: formData,
    credentials: 'include'
  });
  if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || errorData.Message || 'Failed to upload image');
  }
  return response.json();
};