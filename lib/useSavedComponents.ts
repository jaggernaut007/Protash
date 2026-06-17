'use client';

import { useState, useEffect } from 'react';

export interface SavedComponent {
  id: string;
  name: string;
  code: string;
  savedAt: number;
}

const STORAGE_KEY = 'ashleyOs_savedComponents';

export function useSavedComponents() {
  const [components, setComponents] = useState<SavedComponent[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  // Load from localStorage on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
          setComponents(JSON.parse(stored));
        }
      } catch (error) {
        console.error('Failed to load saved components:', error);
      }
      setIsLoaded(true);
    }
  }, []);

  // Save to localStorage whenever components change
  useEffect(() => {
    if (isLoaded && typeof window !== 'undefined') {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(components));
      } catch (error) {
        console.error('Failed to save components to localStorage:', error);
      }
    }
  }, [components, isLoaded]);

  const saveComponent = (code: string): SavedComponent => {
    const timestamp = Date.now();
    const id = `comp_${timestamp}`;
    const name = `Component ${new Date(timestamp).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}`;

    const newComponent: SavedComponent = {
      id,
      name,
      code,
      savedAt: timestamp,
    };

    setComponents((prev) => [newComponent, ...prev]);
    return newComponent;
  };

  const deleteComponent = (id: string) => {
    setComponents((prev) => prev.filter((c) => c.id !== id));
  };

  const renameComponent = (id: string, newName: string) => {
    setComponents((prev) =>
      prev.map((c) => (c.id === id ? { ...c, name: newName } : c))
    );
  };

  const getComponent = (id: string): SavedComponent | undefined => {
    return components.find((c) => c.id === id);
  };

  return {
    components,
    saveComponent,
    deleteComponent,
    renameComponent,
    getComponent,
    isLoaded,
  };
}
