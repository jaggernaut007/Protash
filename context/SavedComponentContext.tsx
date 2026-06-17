'use client';

import React, { createContext, useContext, useState, useCallback } from 'react';

interface SavedComponentContextType {
  loadedComponentName: string | null;
  loadComponent: (componentName: string) => void;
  clearLoadedComponent: () => void;
}

const SavedComponentContext = createContext<SavedComponentContextType | undefined>(undefined);

export function SavedComponentProvider({ children }: { children: React.ReactNode }) {
  const [loadedComponentName, setLoadedComponentName] = useState<string | null>(null);

  const loadComponent = useCallback((componentName: string) => {
    setLoadedComponentName(componentName);
  }, []);

  const clearLoadedComponent = useCallback(() => {
    setLoadedComponentName(null);
  }, []);

  return (
    <SavedComponentContext.Provider
      value={{ loadedComponentName, loadComponent, clearLoadedComponent }}
    >
      {children}
    </SavedComponentContext.Provider>
  );
}

export function useSavedComponentContext() {
  const context = useContext(SavedComponentContext);
  if (!context) {
    throw new Error('useSavedComponentContext must be used within SavedComponentProvider');
  }
  return context;
}
