// Tefines the authentication context for the application
// which provides a way to manage and share user authentication state across all components.
"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { getCurrentUser, logoutUser, User } from '@/api/api';

// Define the shape of the context
interface AuthContextType {
    user: User | null;
    login: () => Promise<void>; // The login function will now trigger a user fetch
    logout: () => void;
    isAuthenticated: boolean;
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
    const router = useRouter();

    const fetchUser = async () => {
        try {
            const userData = await getCurrentUser();
            setUser(userData);
        } catch (error) {
            // This is expected if the user is not logged in.
            // We only log errors that are not the "Not authenticated" message.
            if (error instanceof Error && error.message !== 'Not authenticated') {
                console.error('Failed to fetch user', error);
            }
            setUser(null); // Ensure user is null if fetch fails
        }
    };

    // Check for user session on initial mount
    useEffect(() => {
        fetchUser();
    }, []);

    const login = async () => {
        // This function is called after a successful login/register API call
        // to re-fetch the user data and update the context state.
        await fetchUser();
    };

    const logout = async () => {
        try {
            await logoutUser();
            setUser(null);
            router.push('/');
        } catch (error) {
            console.error('Logout failed', error);
        }
    };

    const isAuthenticated = !!user;

    return (
        <AuthContext.Provider value={{ user, login, logout, isAuthenticated }}>
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