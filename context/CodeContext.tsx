'use client';

import React, { createContext, useContext, useState } from 'react';

interface CodeContextType {
  code: string;
  setCode: (code: string) => void;
}

const CodeContext = createContext<CodeContextType | undefined>(undefined);

export function CodeProvider({ children }: { children: React.ReactNode }) {
  const [code, setCode] = useState('');

  return (
    <CodeContext.Provider value={{ code, setCode }}>
      {children}
    </CodeContext.Provider>
  );
}

export function useCode() {
  const context = useContext(CodeContext);
  if (!context) {
    throw new Error('useCode must be used within CodeProvider');
  }
  return context;
}
