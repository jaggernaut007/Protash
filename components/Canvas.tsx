import React from 'react';
import DynamicCanvasRenderer from './DynamicCanvasRenderer';
import { useCode } from '@/context/CodeContext';

function EmptyCanvas() {
  return (
    <div className="w-full h-full flex flex-col items-center justify-center gap-3 text-slate-500">
      <div className="w-16 h-16 rounded-2xl bg-slate-800/60 border border-slate-700/40 flex items-center justify-center">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-slate-600">
          <rect x="3" y="3" width="18" height="18" rx="2" />
          <path d="M3 9h18M9 21V9" />
        </svg>
      </div>
      <div className="text-center">
        <p className="text-sm font-medium text-slate-400">No prototype yet</p>
        <p className="text-xs text-slate-600 mt-1">Describe your intent to generate one</p>
      </div>
    </div>
  );
}

export default function Canvas() {
  const { code } = useCode();

  return (
    <div className="w-full h-full text-slate-100">
      {code?.trim() ? (
        <div className="w-full h-full overflow-auto overscroll-contain">
          <DynamicCanvasRenderer code={code} />
        </div>
      ) : (
        <EmptyCanvas />
      )}
    </div>
  );
}
