// Tefines the authentication context for the application
// which provides a way to manage and share user authentication state across all components.
"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { getCurrentUser, logoutUser, flushBehaviorEvents, mergeBehaviorEvents, User } from '@/lib/api';
import { useFavourites } from '@/stores/favouritesStore';

// Define the shape of the context
interface AuthContextType {
    user: User | null;
    login: () => Promise<void>; // The login function will now trigger a user fetch
    logout: () => void;
    isAuthenticated: boolean;
    isAdmin: boolean;
    loading: boolean;
}

// Create the context
const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Define the props for the provider
interface AuthProviderProps {
    children: ReactNode;
}

// Create the provider component
export const AuthProvider = ({ children }: AuthProviderProps) => {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);
    const router = useRouter();

    const fetchUser = async () => {
        try {
            const userData = await getCurrentUser();
            setUser(userData);
            // Eagerly populate favourites store after successful auth check
            useFavourites.getState().loadFavourites();
            // Flush any events buffered during this session (e.g. user stayed logged in)
            await flushBufferedEvents();
        } catch (error) {
            // This is expected if the user is not logged in.
            // We only log errors that are not the "Not authenticated" message.
            if (error instanceof Error && error.message !== 'Not authenticated') {
                console.error('Failed to fetch user', error);
            }
            setUser(null);
        } finally {
            setLoading(false);
        }
    };

    // Check for user session on initial mount
    useEffect(() => {
        fetchUser();
    }, []);

    // Flushes locally buffered browsing events and merges anonymous events to the authenticated user.
    // Called on both fresh login and on session restore, so events are never lost.
    const flushBufferedEvents = async () => {
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
            // best-effort — never block auth on tracking errors
        }
    };

    const login = async () => {
        // This function is called after a successful login/register API call
        // to re-fetch the user data and update the context state.
        // fetchUser flushes buffered events as part of session restoration.
        await fetchUser();
    };

    const logout = async () => {
        try {
            await logoutUser();
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

// Create a custom hook to use the auth context
export const useAuth = () => {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
}; 