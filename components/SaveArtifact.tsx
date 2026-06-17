'use client';

import React, { useState } from 'react';
import { Artifact } from '@/types/board';
import { v4 as uuidv4 } from 'uuid';

interface SaveArtifactProps {
  intentId: string;
  artifactType: 'decision' | 'constraint' | 'preference';
  onSave?: (artifact: Artifact) => void;
  disabled?: boolean;
  defaultTitle?: string;
  defaultContent?: string;
}

export default function SaveArtifact({
  intentId,
  artifactType,
  onSave,
  disabled,
  defaultTitle = '',
  defaultContent = '',
}: SaveArtifactProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [title, setTitle] = useState(defaultTitle);
  const [content, setContent] = useState(defaultContent);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState('');

  const handleSave = async () => {
    if (!title.trim() || !content.trim()) {
      setMessage('Please fill in all fields');
      setTimeout(() => setMessage(''), 2000);
      return;
    }

    setIsSaving(true);
    setMessage('');

    try {
      const response = await fetch('/api/board/artifact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'createArtifact',
          data: {
            type: artifactType,
            title,
            content,
            intentId,
            metadata: {
              savedAt: new Date().toISOString(),
            },
          },
        }),
      });

      if (!response.ok) throw new Error('Failed to save artifact');

      const { artifact } = await response.json();
      if (onSave) {
        onSave(artifact);
      }

      setMessage('Artifact saved!');
      setTitle('');
      setContent('');
      setIsOpen(false);
      setTimeout(() => setMessage(''), 2000);
    } catch (error) {
      console.error('Error saving artifact:', error);
      setMessage(
        error instanceof Error ? error.message : 'Failed to save'
      );
      setTimeout(() => setMessage(''), 2000);
    } finally {
      setIsSaving(false);
    }
  };

  const labels = {
    decision: 'Save Decision',
    constraint: 'Save Constraint',
    preference: 'Save Preference',
  };

  return (
    <>
      <button
        onClick={() => setIsOpen(!isOpen)}
        disabled={disabled}
        className="px-3 py-2 rounded-md bg-emerald-600 text-white font-medium text-sm hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {labels[artifactType]}
      </button>

      {isOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-lg max-w-md w-full p-6 space-y-4">
            <h3 className="font-semibold text-lg text-slate-900">
              {labels[artifactType]}
            </h3>

            <input
              type="text"
              placeholder="Title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3 py-2 rounded-md border border-slate-300 bg-white text-slate-900 text-sm placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />

            <textarea
              placeholder="Content / Description"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className="w-full h-24 px-3 py-2 rounded-md border border-slate-300 bg-white text-slate-900 text-sm placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none"
            />

            {message && (
              <div
                className={`text-sm p-2 rounded ${
                  message.includes('saved')
                    ? 'bg-green-50 text-green-700'
                    : 'bg-amber-50 text-amber-700'
                }`}
              >
                {message}
              </div>
            )}

            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setIsOpen(false)}
                disabled={isSaving}
                className="px-3 py-2 rounded-md bg-slate-200 text-slate-900 font-medium text-sm hover:bg-slate-300 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={isSaving || !title.trim() || !content.trim()}
                className="px-3 py-2 rounded-md bg-emerald-600 text-white font-medium text-sm hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSaving ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
