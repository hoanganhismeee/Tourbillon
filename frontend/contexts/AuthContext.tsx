// Defines the authentication context for the application.
// It owns session restoration, auth completion, and browser-scoped Watch DNA syncing rules.
"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { getCurrentUser, logoutUser, flushBehaviorEvents, mergeBehaviorEvents, User } from '@/lib/api';
import { useFavourites } from '@/stores/favouritesStore';

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

    const syncAnonymousBehavior = async () => {
        try {
            const { getAnonId, getBufferedEvents, clearBuffer } = await import('@/lib/behaviorTracker');
            const anonId = getAnonId();
            const events = getBufferedEvents();
            if (events.length > 0) {
                await flushBehaviorEvents(events, anonId);
                clearBuffer();
            }
            await mergeBehaviorEvents(anonId);
        } catch {
            // Best-effort only; auth should never fail because tracking sync failed.
        }
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
    }, []);

    const login = async (mode: AuthLoginMode = 'refresh') => {
        await fetchUser(mode);
    };

    const logout = async () => {
        try {
            await logoutUser();
            await resetAnonymousBehavior();
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
