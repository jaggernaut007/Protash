'use client';

import React, { useState } from 'react';
import { SavedComponent, useSavedComponents } from '@/lib/useSavedComponents';

interface SavedComponentsPanelProps {
  onLoadComponent: (component: SavedComponent) => void;
}

export default function SavedComponentsPanel({
  onLoadComponent,
}: SavedComponentsPanelProps) {
  const { components, deleteComponent, renameComponent } = useSavedComponents();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');

  const handleRename = (id: string) => {
    if (editingName.trim()) {
      renameComponent(id, editingName);
      setEditingId(null);
    }
  };

  const startEdit = (component: SavedComponent) => {
    setEditingId(component.id);
    setEditingName(component.name);
  };

  if (!components || components.length === 0) {
    return (
      <div className="text-center text-xs text-gray-600 py-6">
        <p className="font-medium">Your mood board is empty</p>
        <p className="text-gray-500 mt-1">Create an app that matches your vibe and save it!</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {components.map((comp) => (
        <div
          key={comp.id}
          className="group p-3 rounded-xl glass-panel hover:bg-white/80 transition-all duration-300 flex items-center justify-between gap-2"
        >
          <div className="flex-1 min-w-0">
            {editingId === comp.id ? (
              <input
                type="text"
                value={editingName}
                onChange={(e) => setEditingName(e.target.value)}
                onBlur={() => handleRename(comp.id)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleRename(comp.id);
                  if (e.key === 'Escape') setEditingId(null);
                }}
                autoFocus
                className="input-glass text-xs py-1.5 px-2.5"
              />
            ) : (
              <button
                onClick={() => onLoadComponent(comp)}
                className="w-full text-left px-2 py-1 text-xs font-medium text-gray-900 hover:text-gray-700 truncate transition-colors"
                title={comp.name}
              >
                📄 {comp.name}
              </button>
            )}
            <p className="text-xs text-gray-500 px-2 mt-0.5">
              {new Date(comp.savedAt).toLocaleString('en-US', {
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </p>
          </div>

          <div className="flex items-center gap-1 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
            {editingId !== comp.id && (
              <>
                <button
                  onClick={() => startEdit(comp)}
                  className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-200/50 rounded-lg transition-all"
                  title="Give it a new name"
                >
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                    />
                  </svg>
                </button>
                <button
                  onClick={() => deleteComponent(comp.id)}
                  className="p-2 text-gray-600 hover:text-red-700 hover:bg-red-100/50 rounded-lg transition-all"
                  title="Remove from mood board"
                >
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                    />
                  </svg>
                </button>
              </>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
