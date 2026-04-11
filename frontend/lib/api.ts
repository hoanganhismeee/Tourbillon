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
  slug: string;
  description: string;
  image: string;
  summary: string;
}

export interface Collection {
  id: number;
  name: string;
  slug: string;
  description: string;
  image: string;
  brandId: number;
  style?: string | null;
}

export interface WatchEditorialContent {
  whyItMatters: string;
  collectorAppeal: string;
  designLanguage: string;
  bestFor: string;
}

export interface Watch {
  id: number;
  name: string;
  slug: string;
  description: string;
  image: string;
  imageUrl?: string;
  imageVersion?: number | null;
  currentPrice: number;
  brandId: number;
  brandSlug?: string;
  collectionId: number | null;
  collectionSlug?: string | null;
  specs: string | null;
  editorialContent?: WatchEditorialContent | null;
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

export const fetchFeaturedWatches = async (): Promise<Watch[]> => {
  const response = await fetchWithTimeout(`${API_BASE_URL}/watch/featured`, { credentials: 'include' });
  if (!response.ok) throw new Error('Failed to fetch featured watches');
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

export const fetchCollectionsByBrand = async (brandId: number): Promise<Collection[]> => {
  const response = await fetchWithTimeout(`${API_BASE_URL}/collection/brand/${brandId}`, { credentials: 'include' });
  if (!response.ok) {
    throw new Error(`Failed to fetch collections for brandId: ${brandId}`);
  }
  return response.json();
};

// ── Slug-based fetch functions (public-facing pages) ─────────────────────────

export const fetchBrandBySlug = async (slug: string): Promise<Brand> => {
  const response = await fetchWithTimeout(`${API_BASE_URL}/brand/by-slug/${slug}`, { credentials: 'include' });
  if (!response.ok) throw new Error(`Failed to fetch brand: ${slug}`);
  return response.json();
};

export const fetchWatchBySlug = async (slug: string): Promise<Watch> => {
  const response = await fetchWithTimeout(`${API_BASE_URL}/watch/by-slug/${slug}`, { credentials: 'include' });
  if (!response.ok) throw new Error(`Failed to fetch watch: ${slug}`);
  return response.json();
};

export const fetchCollectionBySlug = async (slug: string): Promise<Collection> => {
  const response = await fetchWithTimeout(`${API_BASE_URL}/collection/by-slug/${slug}`, { credentials: 'include' });
  if (!response.ok) throw new Error(`Failed to fetch collection: ${slug}`);
  return response.json();
};

export const fetchWatchesByBrandSlug = async (slug: string): Promise<Watch[]> => {
  const response = await fetchWithTimeout(`${API_BASE_URL}/watch/brand/by-slug/${slug}`, { credentials: 'include' });
  if (!response.ok) throw new Error(`Failed to fetch watches for brand: ${slug}`);
  return response.json();
};

export const fetchWatchesByCollectionSlug = async (slug: string): Promise<Watch[]> => {
  const response = await fetchWithTimeout(`${API_BASE_URL}/watch/collection/by-slug/${slug}`, { credentials: 'include' });
  if (!response.ok) throw new Error(`Failed to fetch watches for collection: ${slug}`);
  return response.json();
};

export const fetchCollectionsByBrandSlug = async (slug: string): Promise<Collection[]> => {
  const response = await fetchWithTimeout(`${API_BASE_URL}/collection/brand/by-slug/${slug}`, { credentials: 'include' });
  if (!response.ok) throw new Error(`Failed to fetch collections for brand: ${slug}`);
  return response.json();
};

// --- AI Watch Finder ---

export interface WatchMatchDetail {
  score: number;
}

export interface QueryIntent {
  brandId: number | null;
  brandIds?: number[];
  collectionId: number | null;
  collectionIds?: number[];
  collectionsDerivedFromStyle?: boolean;
  maxPrice: number | null;
  minPrice: number | null;
  minDiameterMm: number | null;
  maxDiameterMm: number | null;
  caseMaterial: string | null;
  movementType: string | null;
  waterResistance: string | null;
  waterResistanceBuckets?: string[];
  style?: string | null;
  complications?: string[];
  powerReserves?: string[];
}

export interface WatchFinderResult {
  watches: Watch[];
  otherCandidates: Watch[];
  matchDetails: Record<number, WatchMatchDetail>;
  parsedIntent: Record<string, unknown> | null;
  queryIntent: QueryIntent | null;
  searchPath?: string | null;
}

export interface FilterOptions {
  caseMaterials: string[];
  movementTypes: string[];
  diameters: string[];
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

// Checks whether an email is already registered — used by /auth/start to route to login or register.
export const checkEmailExists = async (email: string): Promise<boolean> => {
    const response = await fetch(`${API_BASE_URL}/authentication/check-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
        credentials: 'include',
    });
    if (!response.ok) throw new Error('Failed to check email');
    const data = await response.json();
    return data.exists as boolean;
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

export const adminUpdateEditorial = async (watchId: number, data: WatchEditorialContent): Promise<void> => {
  const response = await fetchWithTimeout(`${API_BASE_URL}/admin/editorial/${watchId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
    credentials: 'include'
  });
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.message || errorData.Message || 'Failed to update editorial');
  }
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

export interface MagicLoginVerifyResult {
  message: string;
  isNewAccount: boolean;
}

export const verifyMagicLogin = async (data: { email: string; code: string }): Promise<MagicLoginVerifyResult> => {
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
  return response.json();
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
  summary?: string | null;
  behaviorPreferredBrandIds: number[];
  behaviorPreferredMaterials: string[];
  behaviorPreferredDialColors: string[];
  behaviorPriceMin: number | null;
  behaviorPriceMax: number | null;
  behaviorPreferredCaseSize: 'small' | 'medium' | 'large' | null;
  behaviorSummary?: string | null;
  behaviorAnalyzedAt: string | null;
  hasBehaviorAnalysis: boolean;
  hasEnoughBehaviorData: boolean;
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

// Trigger AI generation of taste profile from browsing history — returns updated profile.
export const generateTasteProfile = async (): Promise<TasteProfile> => {
  const response = await fetchWithTimeout(`${API_BASE_URL}/taste/generate`, {
    method: 'POST',
    credentials: 'include',
  });
  if (!response.ok) throw new Error('Failed to generate taste profile');
  return response.json();
};

// Upload image for an existing watch — backend builds canonical public ID and updates DB.
export const adminUploadWatchImage = async (watchId: number, file: File): Promise<{ success: boolean; publicId: string; version: number }> => {
  const formData = new FormData();
  formData.append('file', file);

  // We intentionally do not use fetchWithTimeout here since uploads can be slow
  const response = await fetch(`${API_BASE_URL}/admin/watches/${watchId}/image`, {
    method: 'POST',
    body: formData,
    credentials: 'include'
  });
  if (!response.ok) {
    if (response.status === 404) {
      throw new Error('Image upload endpoint not available — rebuild and restart the backend container');
    }
    const text = await response.text();
    let message = `Upload failed (${response.status})`;
    try { message = JSON.parse(text)?.message || JSON.parse(text)?.Message || message; } catch { /* empty body */ }
    throw new Error(message);
  }
  return response.json();
};

// Upload image without a watch ID — used when creating a new watch before it has been saved.
// Returns a temporary public ID; caller should rename after the watch is created.
export const adminUploadWatchImageTemp = async (file: File, slug: string): Promise<{ success: boolean; publicId: string }> => {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('slug', slug);

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

export const adminRefreshImageCache = async (brandId?: number): Promise<{ updated: number; version: number }> => {
  const url = brandId
    ? `${API_BASE_URL}/admin/watches/refresh-image-cache?brandId=${brandId}`
    : `${API_BASE_URL}/admin/watches/refresh-image-cache`;
  const response = await fetchWithTimeout(url, { method: 'POST', credentials: 'include' });
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.message || errorData.Message || 'Failed to refresh image cache');
  }
  return response.json();
};

export interface CloudinaryOrphansResult {
  dryRun: boolean;
  message: string;
  totalCloudinaryAssets: number;
  totalDbImages: number;
  orphanCount: number;
  orphans: string[];
}

export const adminMigrateImageUrls = async (dryRun = true): Promise<{ dryRun: boolean; message: string; count: number; changes: { watchId: number; watchName: string; oldImage: string; newImage: string }[] }> =>
  fetchWithTimeout(`${API_BASE_URL}/admin/migrate-image-urls?dryRun=${dryRun}`, { method: 'POST', credentials: 'include' }).then(r => r.json());

export const adminCleanCloudinaryOrphans = async (dryRun = true): Promise<CloudinaryOrphansResult> =>
  fetchWithTimeout(`${API_BASE_URL}/admin/cloudinary-orphans?dryRun=${dryRun}`, { method: 'DELETE', credentials: 'include' }).then(r => r.json());

export interface NormalizeImageNamesResult {
  dryRun: boolean;
  message: string;
  total: number;
  updated: number;
  skipped: number;
  failed: number;
  changes: { watchId: number; watchName: string; oldImage: string; newImage: string }[];
  failures: { id: number; name: string; image: string; reason: string }[];
}

export const adminNormalizeImageNames = async (dryRun = true): Promise<NormalizeImageNamesResult> =>
  fetchWithTimeout(`${API_BASE_URL}/admin/normalize-image-names?dryRun=${dryRun}`, { method: 'POST', credentials: 'include' }).then(r => r.json());

export const adminRevertImageNames = async (
  changes: NormalizeImageNamesResult['changes']
): Promise<{ message: string; reverted: number; cloudinaryFailures: number }> =>
  fetchWithTimeout(`${API_BASE_URL}/admin/revert-image-names`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(changes)
  }).then(r => r.json());


// --- Contact Advisor ---

export interface CreateContactInquiryRequest {
  watchId?: number;
  message: string;
}

export interface ContactInquiryResponse {
  id: number;
  createdAt: string;
}

export const submitContactInquiry = async (data: CreateContactInquiryRequest): Promise<ContactInquiryResponse> => {
  const response = await fetchWithTimeout(`${API_BASE_URL}/contact/inquiry`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
    credentials: 'include',
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({ message: 'Failed to submit inquiry' }));
    throw new Error(err.message || 'Failed to submit inquiry');
  }
  return response.json();
};

// --- Appointment Booking ---

export interface CreateAppointmentRequest {
  watchId?: number;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  phoneRegionCode?: string;
  notifyByEmail: boolean;
  notifyBySms: boolean;
  boutiqueName: string;
  visitPurpose: string;
  brandName?: string;
  appointmentDate: string; // ISO 8601 UTC
}

export interface AppointmentResponse {
  id: number;
  appointmentDate: string;
  status: string;
  createdAt: string;
}

export const submitAppointment = async (data: CreateAppointmentRequest): Promise<AppointmentResponse> => {
  const response = await fetchWithTimeout(`${API_BASE_URL}/appointment/book`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
    credentials: 'include',
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({ message: 'Failed to book appointment' }));
    throw new Error(err.message || 'Failed to book appointment');
  }
  return response.json();
};

// --- Register Your Interest ---

export interface CreateRegisterInterestRequest {
  salutation: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  phoneRegionCode?: string;
  message?: string;
  watchId?: number;
  brandName?: string;
  collectionName?: string;
}

export interface RegisterInterestResponse {
  id: number;
  createdAt: string;
}

export const submitRegisterInterest = async (data: CreateRegisterInterestRequest): Promise<RegisterInterestResponse> => {
  const response = await fetchWithTimeout(`${API_BASE_URL}/register-interest`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
    credentials: 'include',
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({ message: 'Failed to submit registration' }));
    throw new Error(err.message || 'Failed to submit registration');
  }
  return response.json();
};

// ── My Inquiries ──────────────────────────────────────────────────────────────

export interface MyContactInquiry {
  id: number;
  watchName?: string;
  watchReference?: string;
  message: string;
  status: string;
  createdAt: string;
}

export interface MyAppointment {
  id: number;
  boutiqueName: string;
  visitPurpose: string;
  appointmentDate: string;
  brandName?: string;
  status: string;
  createdAt: string;
}

export interface MyRegisterInterest {
  id: number;
  brandName?: string;
  collectionName?: string;
  watchDescription?: string;
  watchReference?: string;
  status: string;
  createdAt: string;
}

export const getMyContactInquiries = async (): Promise<MyContactInquiry[]> => {
  const response = await fetchWithTimeout(`${API_BASE_URL}/contact/my-inquiries`, {
    credentials: 'include',
  });
  if (!response.ok) throw new Error('Failed to fetch inquiries');
  return response.json();
};

export const getMyAppointments = async (): Promise<MyAppointment[]> => {
  const response = await fetchWithTimeout(`${API_BASE_URL}/appointment/my-appointments`, {
    credentials: 'include',
  });
  if (!response.ok) throw new Error('Failed to fetch appointments');
  return response.json();
};

export const getMyRegisterInterests = async (): Promise<MyRegisterInterest[]> => {
  const response = await fetchWithTimeout(`${API_BASE_URL}/register-interest/my-submissions`, {
    credentials: 'include',
  });
  if (!response.ok) throw new Error('Failed to fetch submissions');
  return response.json();
};

// ── Chat concierge ────────────────────────────────────────────────────────────

export interface ChatWatchCard {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  image: string | null;
  imageUrl: string | null;
  currentPrice: number;
  brandId: number;
}

export interface ChatAction {
  type: 'compare' | 'search' | 'set_cursor';
  label: string;
  slugs?: string[];
  query?: string;
  cursor?: 'default' | 'tourbillon' | 'crosshair' | 'lumed' | 'hand' | 'bezel' | 'compass' | 'sapphire' | 'rotor';
}

export interface ChatApiResponse {
  message: string;
  watchCards: ChatWatchCard[];
  actions?: ChatAction[];
  rateLimited?: boolean;
  dailyUsed?: number | null;
  dailyLimit?: number | null;
}

export const sendChatMessage = async (
  sessionId: string,
  message: string,
  behaviorSummary?: string,
): Promise<ChatApiResponse> => {
  const response = await fetchWithTimeout(`${API_BASE_URL}/chat/message`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sessionId, message, behaviorSummary }),
    credentials: 'include',
    timeoutMs: 30000,
  });
  if (response.status === 429) {
    const data = await response.json().catch(() => ({}));
    return {
      message: 'You have reached your daily concierge quota of 5 messages. Please come back tomorrow.',
      watchCards: [],
      ...data,
      rateLimited: true
    };
  }
  if (!response.ok) {
    // Return a graceful error response rather than throwing — avoids Next.js error overlay
    const errText = await response.text().catch(() => '');
    const backendMsg = (() => { try { return JSON.parse(errText)?.message || JSON.parse(errText)?.error || ''; } catch { return ''; } })();
    return {
      message: backendMsg || `I don't quite get that request right now (${response.status}). Please rephrase it with a watch, brand, collection, comparison, size, material, or price range.`,
      watchCards: [],
    };
  }
  return response.json();
};

export const clearChatSession = async (sessionId: string): Promise<void> => {
  await fetchWithTimeout(`${API_BASE_URL}/chat/session/${sessionId}`, {
    method: 'DELETE',
    credentials: 'include',
  });
};

// ── Favourites & Collections ──────────────────────────────────────────────────

export interface UserCollectionSummary {
  id: number;
  name: string;
  watchIds: number[];
  previewImages: string[]; // Up to 4 Cloudinary public IDs for the card mosaic
  createdAt: string;
  updatedAt: string;
}

export interface FavouritesState {
  favouriteWatchIds: number[];
  collections: UserCollectionSummary[];
}

export interface FavouriteWatchesResponse {
  watches: Watch[];
  watchCollectionMembership: Record<number, number[]>;
  totalCount: number;
  page: number;
  pageSize: number;
}

export const getFavouritesState = async (): Promise<FavouritesState> => {
  const response = await fetchWithTimeout(`${API_BASE_URL}/favourites`, {
    credentials: 'include',
  });
  if (!response.ok) throw new Error('Failed to fetch favourites state');
  return response.json();
};

export const addFavourite = async (watchId: number): Promise<void> => {
  const response = await fetchWithTimeout(`${API_BASE_URL}/favourites/${watchId}`, {
    method: 'POST',
    credentials: 'include',
  });
  if (!response.ok) throw new Error('Failed to add favourite');
};

export const removeFavourite = async (watchId: number): Promise<void> => {
  const response = await fetchWithTimeout(`${API_BASE_URL}/favourites/${watchId}`, {
    method: 'DELETE',
    credentials: 'include',
  });
  if (!response.ok) throw new Error('Failed to remove favourite');
};

export const getFavouriteWatches = async (params: {
  page?: number;
  pageSize?: number;
  collectionIds?: number[];
  sortBy?: string;
}): Promise<FavouriteWatchesResponse> => {
  const query = new URLSearchParams();
  if (params.page) query.set('page', String(params.page));
  if (params.pageSize) query.set('pageSize', String(params.pageSize));
  if (params.sortBy) query.set('sortBy', params.sortBy);
  if (params.collectionIds?.length) {
    params.collectionIds.forEach(id => query.append('collectionIds', String(id)));
  }
  const response = await fetchWithTimeout(`${API_BASE_URL}/favourites/watches?${query}`, {
    credentials: 'include',
  });
  if (!response.ok) throw new Error('Failed to fetch favourite watches');
  return response.json();
};

export const createCollection = async (name: string): Promise<UserCollectionSummary> => {
  const response = await fetchWithTimeout(`${API_BASE_URL}/favourites/collections`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name }),
    credentials: 'include',
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({ message: 'Failed to create collection' }));
    throw new Error(err.message || 'Failed to create collection');
  }
  return response.json();
};

export const deleteCollection = async (id: number): Promise<void> => {
  const response = await fetchWithTimeout(`${API_BASE_URL}/favourites/collections/${id}`, {
    method: 'DELETE',
    credentials: 'include',
  });
  if (!response.ok) throw new Error('Failed to delete collection');
};

export const renameCollection = async (id: number, name: string): Promise<UserCollectionSummary> => {
  const response = await fetchWithTimeout(`${API_BASE_URL}/favourites/collections/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name }),
    credentials: 'include',
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({ message: 'Failed to rename collection' }));
    throw new Error(err.message || 'Failed to rename collection');
  }
  return response.json();
};

export const addToCollection = async (collectionId: number, watchId: number): Promise<void> => {
  const response = await fetchWithTimeout(
    `${API_BASE_URL}/favourites/collections/${collectionId}/watches/${watchId}`,
    { method: 'PUT', credentials: 'include' }
  );
  if (!response.ok) throw new Error('Failed to add to collection');
};

export const removeFromCollection = async (collectionId: number, watchId: number): Promise<void> => {
  const response = await fetchWithTimeout(
    `${API_BASE_URL}/favourites/collections/${collectionId}/watches/${watchId}`,
    { method: 'DELETE', credentials: 'include' }
  );
  if (!response.ok) throw new Error('Failed to remove from collection');
};

// Sends locally buffered browsing events to the backend (anonymous or authenticated).
export const flushBehaviorEvents = async (events: import('./behaviorTracker').BrowsingEvent[], anonymousId: string): Promise<void> => {
  try {
    await fetchWithTimeout(`${API_BASE_URL}/behavior/events`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        anonymousId,
        events: events.map(e => ({
          eventType: e.type,
          entityId: e.entityId ?? null,
          entityName: e.entityName,
          brandId: e.brandId ?? null,
          timestamp: new Date(e.timestamp).toISOString(),
        })),
      }),
    });
  } catch {
    // best-effort — never block login on tracking errors
  }
};

// Reassigns anonymous browsing events to the authenticated user after login.
export const mergeBehaviorEvents = async (anonymousId: string): Promise<void> => {
  try {
    await fetchWithTimeout(`${API_BASE_URL}/behavior/merge`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ anonymousId }),
    });
  } catch {
    // best-effort — never block login on tracking errors
  }
};

