// Defines the authentication context for the application.
// It owns session restoration, auth completion, and browser-scoped Watch DNA syncing rules.
"use client";

import { createContext, useContext, useEffect, useRef, useState, ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import { getCurrentUser, logoutUser, flushBehaviorEvents, mergeBehaviorEvents, setUnauthorizedHandler, User } from '@/lib/api';
import { useFavourites } from '@/stores/favouritesStore';
import { CACHE_PERSIST_KEY } from '@/providers/QueryProvider';

export type AuthLoginMode = 'existing-account' | 'new-account' | 'refresh';

interface AuthContextType {
    user: User | null;
    login: (mode?: AuthLoginMode) => Promise<void>;
    logout: () => Promise<void>;
    isAuthenticated: boolean;
    isAdmin: boolean;
    loading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
    children: ReactNode;
}

export const AuthProvider = ({ children }: AuthProviderProps) => {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);
    const router = useRouter();
    const queryClient = useQueryClient();
    const lastUserIdRef = useRef<string | null>(null);

    // Wipes both the in-memory React Query cache and its persisted localStorage copy.
    // Called on logout and on detected user-identity change so private query data
    // (favourites, taste profile, account) never bleeds across user sessions.
    const clearPersistedQueryCache = () => {
        queryClient.clear();
        try {
            if (typeof window !== 'undefined') {
                window.localStorage.removeItem(CACHE_PERSIST_KEY);
            }
        } catch {
            // Storage unavailable — in-memory clear is the important guarantee.
        }
    };

    // Dedupes concurrent invocations so a rapid double-login (e.g. tab focus
    // refresh racing with the auth callback) cannot double-flush the same
    // anonymous buffer or duplicate-merge events on the backend.
    const syncInFlightRef = useRef<Promise<void> | null>(null);

    const syncAnonymousBehavior = (): Promise<void> => {
        if (syncInFlightRef.current) return syncInFlightRef.current;
        const run = (async () => {
            try {
                const { getAnonId, getBufferedEvents, clearBuffer } = await import('@/lib/behaviorTracker');
                const anonId = getAnonId();
                const events = getBufferedEvents();
                if (events.length > 0) {
                    await flushBehaviorEvents(events, anonId);
                    clearBuffer();
                }
                await mergeBehaviorEvents(anonId);
            } catch (err) {
                // Best-effort only; auth must not fail because tracking sync failed.
                // Log the underlying error so silent DNA-sync regressions surface in
                // browser consoles / Sentry instead of disappearing into the void.
                console.warn('syncAnonymousBehavior failed', err);
            } finally {
                syncInFlightRef.current = null;
            }
        })();
        syncInFlightRef.current = run;
        return run;
    };

    const resetAnonymousBehavior = async () => {
        try {
            const { resetAnonymousTracking } = await import('@/lib/behaviorTracker');
            resetAnonymousTracking();
        } catch {
            // Best-effort only; auth should never fail because tracking reset failed.
        }
    };

    const getInitialAuthMode = (): AuthLoginMode => {
        if (typeof window === 'undefined') return 'existing-account';

        const searchParams = new URLSearchParams(window.location.search);
        if (window.location.pathname === '/auth/callback' && searchParams.get('newAccount') === '1') {
            return 'new-account';
        }

        return 'existing-account';
    };

    const fetchUser = async (mode: AuthLoginMode = 'refresh') => {
        try {
            const userData = await getCurrentUser();
            // If the resolved identity differs from the last one we saw, wipe cached
            // queries before exposing the new user — prevents user-A's favourites,
            // taste profile, etc. from being served to user-B on the same browser.
            const identity = userData.email?.toLowerCase() ?? null;
            if (lastUserIdRef.current !== null && lastUserIdRef.current !== identity) {
                clearPersistedQueryCache();
            }
            lastUserIdRef.current = identity;
            setUser(userData);
            useFavourites.getState().loadFavourites();

            if (mode === 'existing-account') {
                await syncAnonymousBehavior();
            } else if (mode === 'new-account') {
                await resetAnonymousBehavior();
            }
        } catch (error) {
            if (error instanceof Error && error.message !== 'Not authenticated') {
                console.error('Failed to fetch user', error);
            }
            setUser(null);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchUser(getInitialAuthMode());

        // Register 401 interceptor — fires when any authenticated API call returns 401
        // (e.g. cookie expired mid-session). Clears local auth state without a full page reload.
        setUnauthorizedHandler(() => {
            clearPersistedQueryCache();
            lastUserIdRef.current = null;
            setUser(null);
            useFavourites.getState().reset();
            toast.error('Your session has expired. Please sign in again.');
            router.push('/auth/start');
        });
    }, []);

    const login = async (mode: AuthLoginMode = 'refresh') => {
        await fetchUser(mode);
    };

    const logout = async () => {
        try {
            await logoutUser();
            await resetAnonymousBehavior();
            clearPersistedQueryCache();
            lastUserIdRef.current = null;
            setUser(null);
            useFavourites.getState().reset();
            router.push('/');
        } catch (error) {
            console.error('Logout failed', error);
        }
    };

    const isAuthenticated = !!user;
    const isAdmin = user?.roles?.includes('Admin') ?? false;

    return (
        <AuthContext.Provider value={{ user, login, logout, isAuthenticated, isAdmin, loading }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};
