'use client';

import React, { useState } from 'react';
import { PrototypeArtifact } from '@/types/board';
import { v4 as uuidv4 } from 'uuid';

interface SavePrototypeProps {
  componentCode: string;
  intentId: string;
  intentDescription: string;
  domain?: string;
  specData?: Record<string, unknown>;
  onSave?: (prototype: PrototypeArtifact) => void;
  disabled?: boolean;
}

export default function SavePrototype({
  componentCode,
  intentId,
  intentDescription,
  domain,
  specData,
  onSave,
  disabled,
}: SavePrototypeProps) {
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState('');

  const handleSave = async () => {
    if (!componentCode?.trim()) {
      setMessage('No prototype to save');
      setTimeout(() => setMessage(''), 2000);
      return;
    }

    setIsSaving(true);
    setMessage('');

    try {
      const prototype: PrototypeArtifact = {
        id: uuidv4(),
        type: 'prototype',
        title: `Prototype: ${intentDescription.split('\n')[0].substring(0, 60)}`,
        content: componentCode,
        componentCode,
        createdAt: new Date(),
        updatedAt: new Date(),
        generatedAt: new Date(),
        intentId,
        metadata: { intentDescription, domain, spec: specData },
      };

      const response = await fetch('/api/board/artifact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'createArtifact',
          data: {
            type: 'prototype',
            title: prototype.title,
            content: componentCode,
            intentId,
            metadata: { intentDescription, domain, spec: specData },
          },
        }),
      });

      if (!response.ok) throw new Error('Failed to save prototype');

      const { artifact } = await response.json();
      onSave?.(artifact as PrototypeArtifact);

      setMessage('Prototype saved!');
      setTimeout(() => setMessage(''), 2000);
    } catch (error) {
      console.error('Error saving prototype:', error);
      setMessage(error instanceof Error ? error.message : 'Failed to save');
      setTimeout(() => setMessage(''), 2000);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={handleSave}
        disabled={disabled || isSaving || !componentCode?.trim()}
        className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
      >
        {isSaving ? 'Saving…' : 'Save Prototype'}
      </button>
      {message && (
        <span className={`text-xs font-medium ${message.includes('saved') ? 'text-emerald-400' : 'text-amber-400'}`}>
          {message}
        </span>
      )}
    </div>
  );
}
