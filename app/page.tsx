'use client';

import React, { useState, useCallback } from 'react';
import { CodeProvider } from '@/context/CodeContext';
import { SavedComponentProvider } from '@/context/SavedComponentContext';
import { useCode } from '@/context/CodeContext';
import Canvas from '@/components/Canvas';
import IntentConsole from '@/components/IntentConsole';
import SavePrototype from '@/components/SavePrototype';
import SavedPrototypeList from '@/components/SavedPrototypeList';
import { MessageBus } from '@/lib/messageBus';
import { Intent, Artifact } from '@/types/board';

const messageBus = new MessageBus();

function HomeContent() {
  const { code, setCode } = useCode();
  const [currentIntent, setCurrentIntent] = useState<Intent | null>(null);
  const [isLibraryOpen, setIsLibraryOpen] = useState(false);
  const [isResettingBoard, setIsResettingBoard] = useState(false);

  const handlePrototypeGenerated = useCallback((generatedCode: string) => {
    setCode(generatedCode);
  }, [setCode]);

  const handleIntentCreated = useCallback((intent: Intent) => {
    setCurrentIntent(intent);
  }, []);

  const handleLoadSavedPrototype = useCallback(async (artifact: Artifact) => {
    setCode(artifact.content || '');
    if (artifact.intentId) {
      try {
        const res = await fetch('/api/board');
        if (res.ok) {
          const board = await res.json();
          const intent = board?.intents?.find((i: Intent) => i.id === artifact.intentId);
          if (intent) setCurrentIntent(intent);
        }
      } catch (err) {
        console.error('Failed to load intent for prototype:', err);
      }
    }
  }, [setCode]);

  const handleNewBoard = useCallback(async () => {
    if (isResettingBoard) return;
    const confirmed = window.confirm('Start a new board? This will clear all prototypes and intents.');
    if (!confirmed) return;
    try {
      setIsResettingBoard(true);
      const res = await fetch('/api/board', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'resetBoard', data: {} }),
      });
      if (!res.ok) throw new Error('Failed to reset board');
      setCode('');
      setCurrentIntent(null);
      setIsLibraryOpen(false);
    } catch (err) {
      console.error('Error resetting board:', err);
      alert('Could not reset the board. Please try again.');
    } finally {
      setIsResettingBoard(false);
    }
  }, [isResettingBoard, setCode]);

  return (
    <main className="grid h-screen w-full grid-cols-1 lg:grid-cols-[340px,1fr] bg-slate-950 overflow-hidden text-slate-100">
      {/* Intent Console — Left Panel */}
      <aside className="order-2 lg:order-1 h-full flex flex-col border-t lg:border-t-0 lg:border-r border-slate-800 bg-slate-950 overflow-y-auto">
        <IntentConsole
          messageBus={messageBus}
          onPrototypeGenerated={handlePrototypeGenerated}
          onIntentCreated={handleIntentCreated}
        />
      </aside>

      {/* Canvas — Right */}
      <section className="order-1 lg:order-2 h-full flex flex-col gap-0 overflow-hidden">
        {/* Header bar */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950 shrink-0">
          <div className="flex items-center gap-3">
            <span className="text-base font-semibold tracking-tight text-slate-100">Protash</span>
            {currentIntent && (
              <span className="px-2.5 py-1 rounded-md text-xs font-medium bg-slate-800 text-slate-400 border border-slate-700/50 truncate max-w-[200px]">
                {currentIntent.title}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {code && currentIntent && (
              <SavePrototype
                componentCode={code}
                intentId={currentIntent.id}
                intentDescription={currentIntent.description}
                domain={currentIntent.domain}
              />
            )}
            <button
              type="button"
              onClick={() => setIsLibraryOpen(true)}
              className="px-4 py-2 rounded-lg text-sm font-medium bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700/50 transition-colors"
            >
              Prototypes
            </button>
            <button
              type="button"
              onClick={handleNewBoard}
              disabled={isResettingBoard}
              className="px-4 py-2 rounded-lg text-sm font-medium bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700/50 transition-colors disabled:opacity-50"
            >
              {isResettingBoard ? 'Resetting…' : 'New Board'}
            </button>
          </div>
        </div>

        {/* Canvas area */}
        <div className="relative flex-1 w-full overflow-hidden bg-slate-950">
          <Canvas />
        </div>

        {/* Mobile save strip */}
        <div className="flex items-center justify-between gap-3 px-4 py-3 border-t border-slate-800 bg-slate-950 xl:hidden shrink-0">
          <div className="text-sm text-slate-400 truncate">
            {currentIntent ? (
              <span>
                <span className="text-slate-500">Intent: </span>
                <span className="text-slate-200 font-medium">{currentIntent.title}</span>
              </span>
            ) : (
              <span>Submit an intent to get started</span>
            )}
          </div>
          {code && currentIntent && (
            <SavePrototype
              componentCode={code}
              intentId={currentIntent.id}
              intentDescription={currentIntent.description}
            />
          )}
        </div>

        {/* Saved prototypes on smaller screens */}
        <div className="xl:hidden px-4 pb-4">
          <SavedPrototypeList onLoad={handleLoadSavedPrototype} />
        </div>
      </section>

      {/* Slide-out library panel */}
      <div
        className={`fixed inset-y-0 right-0 z-40 hidden xl:flex w-[340px] transform bg-slate-950 border-l border-slate-800 transition-transform duration-300 ease-out ${isLibraryOpen ? 'translate-x-0' : 'translate-x-full'}`}
      >
        <div className="flex h-full w-full flex-col gap-4 p-6 overflow-y-auto">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-slate-100">Saved Prototypes</p>
            <button
              type="button"
              onClick={() => setIsLibraryOpen(false)}
              className="px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700/50 transition-colors"
            >
              Close
            </button>
          </div>

          {code && currentIntent && (
            <div className="rounded-xl border border-slate-700/50 bg-slate-900/60 p-4">
              <p className="text-xs font-medium text-slate-400 mb-3">Save current prototype</p>
              <SavePrototype
                componentCode={code}
                intentId={currentIntent.id}
                intentDescription={currentIntent.description}
                domain={currentIntent.domain}
              />
            </div>
          )}

          <SavedPrototypeList onLoad={handleLoadSavedPrototype} />
        </div>
      </div>

      {/* Current intent pill */}
      <div className="pointer-events-none fixed bottom-6 left-1/2 z-30 -translate-x-1/2">
        <div className="pointer-events-auto flex items-center gap-2 rounded-full px-4 py-2 bg-slate-900 border border-slate-700/60 shadow-xl text-xs">
          <span className="text-slate-500">Current</span>
          <span className="font-medium text-slate-200">
            {currentIntent ? currentIntent.title : 'No intent yet'}
          </span>
        </div>
      </div>
    </main>
  );
}

export default function Home() {
  return (
    <CodeProvider>
      <SavedComponentProvider>
        <HomeContent />
      </SavedComponentProvider>
    </CodeProvider>
  );
}
