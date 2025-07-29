// Context for managing watches page state globally
// Allows navbar and other components to control pagination state and shuffle tracking
// Provides centralized state management for the watches page across the entire application
'use client';

import React, { createContext, useContext, useState, ReactNode } from 'react';

// TypeScript interface defining the shape of the context value
// Contains pagination state and shuffle tracking functionality
interface WatchesPageContextType {
  currentPage: number; // Current page number (1, 2, 3, etc.)
  setCurrentPage: (page: number) => void; // Function to update current page
  resetToPageOne: () => void; // Function to reset pagination back to page 1
  hasShuffledWatches: boolean; // Flag to track if watches have been shuffled in current session
  setHasShuffledWatches: (shuffled: boolean) => void; // Function to update shuffle state
}

// Create the React context with undefined as initial value
// This allows TypeScript to enforce proper usage within provider
const WatchesPageContext = createContext<WatchesPageContextType | undefined>(undefined);

// Custom hook to consume the WatchesPageContext
// Provides type safety and error handling for context usage
export const useWatchesPage = () => {
  const context = useContext(WatchesPageContext);
  if (context === undefined) {
    throw new Error('useWatchesPage must be used within a WatchesPageProvider');
  }
  return context;
};

// Props interface for the provider component
interface WatchesPageProviderProps {
  children: ReactNode; // React children that will have access to the context
}

// Provider component that wraps the application and provides context values
// Manages pagination state and shuffle tracking for the entire watches section
export const WatchesPageProvider = ({ children }: WatchesPageProviderProps) => {
  // State for current page number - starts at page 1
  const [currentPage, setCurrentPage] = useState(1);
  
  // State to track if watches have been shuffled in the current session
  // Prevents re-shuffling when navigating via navbar
  const [hasShuffledWatches, setHasShuffledWatches] = useState(false);

  // Function to reset pagination back to page 1
  // Used by navbar "Timepieces" link to return to main watches page
  const resetToPageOne = () => {
    setCurrentPage(1);
  };

  // Provide context values to all child components
  return (
    <WatchesPageContext.Provider value={{ 
      currentPage, 
      setCurrentPage, 
      resetToPageOne, 
      hasShuffledWatches, 
      setHasShuffledWatches 
    }}>
      {children}
    </WatchesPageContext.Provider>
  );
}; 