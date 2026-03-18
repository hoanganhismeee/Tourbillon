// Cursor preference context — persists selected cursor style to localStorage
'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

export type CursorStyle = 'default' | 'tourbillon' | 'crosshair' | 'lumed' | 'hand' | 'bezel' | 'compass' | 'sapphire' | 'rotor';

export interface CursorOption {
  id: CursorStyle;
  label: string;
  description: string;
}

export const CURSOR_OPTIONS: CursorOption[] = [
  { id: 'default',    label: 'Default',     description: 'System cursor'           },
  { id: 'tourbillon', label: 'Tourbillon',  description: 'Rotating escapement'     },
  { id: 'crosshair',  label: 'Crosshair',   description: 'Dial precision marker'   },
  { id: 'lumed',      label: 'Lume Dot',    description: 'Luminous hour pip'       },
  { id: 'hand',       label: 'Watch Hand',  description: 'Sword-hand pointer'      },
  { id: 'bezel',      label: 'Bezel',       description: 'Rotating bezel ring'     },
  { id: 'compass',    label: 'Compass',     description: 'Navigation rose'         },
  { id: 'sapphire',   label: 'Sapphire',    description: 'Crystal facet gem'       },
  { id: 'rotor',      label: 'Rotor',       description: 'Automatic winding rotor' },
];

interface CursorContextType {
  cursor: CursorStyle;
  setCursor: (style: CursorStyle) => void;
}

const CursorContext = createContext<CursorContextType | undefined>(undefined);

export const useCursor = () => {
  const ctx = useContext(CursorContext);
  if (!ctx) throw new Error('useCursor must be used within CursorProvider');
  return ctx;
};

export const CursorProvider = ({ children }: { children: ReactNode }) => {
  const [cursor, setCursorState] = useState<CursorStyle>('default');

  useEffect(() => {
    const saved = localStorage.getItem('tourbillon-cursor') as CursorStyle | null;
    if (saved && CURSOR_OPTIONS.some(o => o.id === saved)) {
      setCursorState(saved);
    }
  }, []);

  const setCursor = (style: CursorStyle) => {
    setCursorState(style);
    localStorage.setItem('tourbillon-cursor', style);
  };

  return (
    <CursorContext.Provider value={{ cursor, setCursor }}>
      {children}
    </CursorContext.Provider>
  );
};
