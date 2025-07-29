// Navigation context for managing back navigation state
// Stores scroll position and page information to enable "Back" functionality
'use client';

import React, { createContext, useContext, useState, ReactNode } from 'react';

// Interface for navigation state
interface NavigationState {
  scrollPosition: number; // Scroll position in pixels
  currentPage: number; // Current page number
  path: string; // Path where user came from
  timestamp: number; // Timestamp for state management
}

// Context interface
interface NavigationContextType {
  navigationState: NavigationState | null;
  saveNavigationState: (state: NavigationState) => void;
  clearNavigationState: () => void;
}

// Create context with default values
const NavigationContext = createContext<NavigationContextType | undefined>(undefined);

// Provider component props
interface NavigationProviderProps {
  children: ReactNode;
}

// Provider component that wraps the app and manages navigation state
export const NavigationProvider = ({ children }: NavigationProviderProps) => {
  const [navigationState, setNavigationState] = useState<NavigationState | null>(null);

  // Save navigation state (called when user clicks on a watch card)
  const saveNavigationState = (state: NavigationState) => {
    setNavigationState(state);
  };

  // Clear navigation state (called after successful back navigation)
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

// Custom hook to use navigation context
export const useNavigation = () => {
  const context = useContext(NavigationContext);
  if (context === undefined) {
    throw new Error('useNavigation must be used within a NavigationProvider');
  }
  return context;
}; 