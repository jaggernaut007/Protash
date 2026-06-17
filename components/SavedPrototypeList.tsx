"use client";

import React, { useEffect, useState, useCallback } from "react";
import { Artifact } from "@/types/board";

interface SavedPrototypeListProps {
  onLoad: (artifact: Artifact) => void;
}

export default function SavedPrototypeList({ onLoad }: SavedPrototypeListProps) {
  const [prototypes, setPrototypes] = useState<Artifact[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isCollapsed, setIsCollapsed] = useState(false);

  const loadPrototypes = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/board");
      if (!res.ok) throw new Error("Failed to fetch board");
      const board = await res.json();
      const assets = (board?.artifacts || []).filter(
        (a: Artifact) => a.type === "prototype"
      );
      setPrototypes(assets);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load prototypes");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPrototypes();
  }, [loadPrototypes]);

  return (
    <div className="w-full rounded-xl border border-slate-700/50 bg-slate-900/60 p-4">
      <div className="flex items-center justify-between mb-3">
        <div>
          <p className="text-sm font-semibold text-slate-100">Saved Prototypes</p>
          <p className="text-xs text-slate-500">Load a previously saved prototype</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setIsCollapsed(prev => !prev)}
            className="px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700/50 transition-colors"
          >
            {isCollapsed ? "Expand" : "Collapse"}
          </button>
          <button
            type="button"
            onClick={loadPrototypes}
            disabled={isLoading}
            className="px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700/50 transition-colors disabled:opacity-50"
          >
            {isLoading ? "Loading…" : "Refresh"}
          </button>
        </div>
      </div>

      {!isCollapsed && (
        <>
          {error && (
            <div className="mb-3 rounded-lg border border-amber-400/30 bg-amber-500/10 px-3 py-2 text-amber-300 text-xs">
              {error}
            </div>
          )}

          {prototypes.length === 0 && !isLoading ? (
            <p className="text-sm text-slate-500">No saved prototypes yet.</p>
          ) : (
            <div className="flex flex-col gap-2 max-h-64 overflow-y-auto pr-1">
              {prototypes.map((prototype) => (
                <div
                  key={prototype.id}
                  className="flex items-center justify-between rounded-lg border border-slate-700/40 bg-slate-800/50 px-3 py-2.5 hover:border-slate-600/60 hover:bg-slate-800/70 transition-all"
                >
                  <div className="flex flex-col min-w-0 flex-1">
                    <span className="text-sm font-medium text-slate-200 truncate">
                      {prototype.title?.replace('Prototype: ', '') || "Untitled"}
                    </span>
                    <span className="text-xs text-slate-500">
                      {prototype.updatedAt
                        ? new Date(prototype.updatedAt).toLocaleString()
                        : ""}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => onLoad(prototype)}
                    className="ml-3 px-3 py-1.5 rounded-lg text-xs font-medium bg-indigo-600/80 hover:bg-indigo-500 text-white transition-colors"
                  >
                    Load
                  </button>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
