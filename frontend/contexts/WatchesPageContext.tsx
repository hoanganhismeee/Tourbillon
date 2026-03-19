// Context for tracking watch shuffle state globally
// Prevents re-shuffling the watch grid when the user navigates back via the navbar.
// Pagination is handled via URL search params (?page=N) instead of context.
'use client';

import React, { createContext, useContext, useState, ReactNode } from 'react';

interface WatchesPageContextType {
  hasShuffledWatches: boolean;
  setHasShuffledWatches: (shuffled: boolean) => void;
}

const WatchesPageContext = createContext<WatchesPageContextType | undefined>(undefined);

export const useWatchesPage = () => {
  const context = useContext(WatchesPageContext);
  if (context === undefined) {
    throw new Error('useWatchesPage must be used within a WatchesPageProvider');
  }
  return context;
};

interface WatchesPageProviderProps {
  children: ReactNode;
}

export const WatchesPageProvider = ({ children }: WatchesPageProviderProps) => {
  const [hasShuffledWatches, setHasShuffledWatches] = useState(false);

  return (
    <WatchesPageContext.Provider value={{ hasShuffledWatches, setHasShuffledWatches }}>
      {children}
    </WatchesPageContext.Provider>
  );
};
