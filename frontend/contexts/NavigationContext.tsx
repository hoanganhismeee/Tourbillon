// Navigation context for managing back navigation state
// Persists to sessionStorage so the back-nav checkpoint survives detail-page reloads.
// sessionStorage is tab-scoped — cleared when the tab closes, which is correct for scroll positions.
'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

// Interface for navigation state
interface NavigationState {
  scrollPosition: number;
  currentPage: number;
  path: string;
  timestamp: number;
}

// Context interface
interface NavigationContextType {
  navigationState: NavigationState | null;
  saveNavigationState: (state: NavigationState) => void;
  clearNavigationState: () => void;
}

const NavigationContext = createContext<NavigationContextType | undefined>(undefined);

const STORAGE_KEY = 'tourbillon-nav';

interface NavigationProviderProps {
  children: ReactNode;
}

export const NavigationProvider = ({ children }: NavigationProviderProps) => {
  const [navigationState, setNavigationState] = useState<NavigationState | null>(null);

  // Hydrate from sessionStorage after mount (SSR-safe: always starts null)
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (
        parsed && typeof parsed === 'object' &&
        typeof parsed.scrollPosition === 'number' &&
        typeof parsed.currentPage === 'number' &&
        typeof parsed.path === 'string' &&
        typeof parsed.timestamp === 'number'
      ) {
        setNavigationState(parsed as NavigationState);
      }
    } catch { /* corrupt data — ignore */ }
  }, []);

  // Persist to sessionStorage on every change; remove key when state is cleared
  useEffect(() => {
    try {
      if (navigationState) {
        sessionStorage.setItem(STORAGE_KEY, JSON.stringify(navigationState));
      } else {
        sessionStorage.removeItem(STORAGE_KEY);
      }
    } catch { /* private browsing / quota — ignore */ }
  }, [navigationState]);

  const saveNavigationState = (state: NavigationState) => {
    setNavigationState(state);
  };

  const clearNavigationState = () => {
    setNavigationState(null);
  };

  return (
    <NavigationContext.Provider value={{
      navigationState,
      saveNavigationState,
      clearNavigationState,
    }}>
      {children}
    </NavigationContext.Provider>
  );
};

export const useNavigation = () => {
  const context = useContext(NavigationContext);
  if (context === undefined) {
    throw new Error('useNavigation must be used within a NavigationProvider');
  }
  return context;
};
