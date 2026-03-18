// Global state for watch comparison feature
// Stores up to 4 selected watches, persists across page navigation
'use client';

import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { Watch } from '@/lib/api';

interface CompareContextType {
  compareWatches: Watch[];
  addToCompare: (watch: Watch) => boolean;
  removeFromCompare: (id: number) => void;
  clearCompare: () => void;
  isInCompare: (id: number) => boolean;
  compareCount: number;
  isFull: boolean;
}

const CompareContext = createContext<CompareContextType | undefined>(undefined);

export const useCompare = () => {
  const context = useContext(CompareContext);
  if (context === undefined) {
    throw new Error('useCompare must be used within a CompareProvider');
  }
  return context;
};

const MAX_COMPARE = 4;

export const CompareProvider = ({ children }: { children: ReactNode }) => {
  const [compareWatches, setCompareWatches] = useState<Watch[]>([]);

  const addToCompare = useCallback((watch: Watch): boolean => {
    let added = false;
    setCompareWatches(prev => {
      if (prev.length >= MAX_COMPARE) return prev;
      if (prev.some(w => w.id === watch.id)) return prev;
      added = true;
      return [...prev, watch];
    });
    return added;
  }, []);

  const removeFromCompare = useCallback((id: number) => {
    setCompareWatches(prev => prev.filter(w => w.id !== id));
  }, []);

  const clearCompare = useCallback(() => {
    setCompareWatches([]);
  }, []);

  const isInCompare = useCallback((id: number) => {
    return compareWatches.some(w => w.id === id);
  }, [compareWatches]);

  return (
    <CompareContext.Provider value={{
      compareWatches,
      addToCompare,
      removeFromCompare,
      clearCompare,
      isInCompare,
      compareCount: compareWatches.length,
      isFull: compareWatches.length >= MAX_COMPARE,
    }}>
      {children}
    </CompareContext.Provider>
  );
};
