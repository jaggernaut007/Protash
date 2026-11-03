'use client';

/**
 * /sandbox — renders generated component code.
 *
 * The host loads this page in <iframe sandbox="allow-scripts"> without allow-same-origin,
 * so the page runs with an opaque origin. next.config.ts gives it a CSP with connect-src 'none'.
 * The host sends code with postMessage. This page accepts messages only from window.parent.
 */

import React, { useEffect, useState } from 'react';
import { compileComponent } from '@/lib/compileComponent';
import { HOST_SOURCE, SANDBOX_SOURCE, type SandboxEvent } from '@/lib/sandboxProtocol';

function post(event: SandboxEvent) {
  // The parent origin is the app origin. An opaque-origin frame cannot name it reliably, so use '*'.
  // The messages hold no secrets: only status and error text.
  window.parent.postMessage({ source: SANDBOX_SOURCE, ...event }, '*');
}

class RenderBoundary extends React.Component<
  { children: React.ReactNode; onError: (message: string) => void },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(error: Error) {
    this.props.onError(error.message);
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}

export default function SandboxPage() {
  const [Comp, setComp] = useState<React.ComponentType | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [renderKey, setRenderKey] = useState(0);

  useEffect(() => {
    function onMessage(e: MessageEvent) {
      if (e.source !== window.parent) return;
      const msg = e.data;
      if (!msg || msg.source !== HOST_SOURCE || msg.type !== 'render' || typeof msg.code !== 'string') return;
      try {
        const component = msg.code.trim() ? compileComponent(msg.code) : null;
        setError(null);
        setComp(() => component);
        setRenderKey((k) => k + 1);
        post({ type: 'rendered' });
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to compile component';
        setComp(null);
        setError(message);
        post({ type: 'error', message });
      }
    }
    window.addEventListener('message', onMessage);
    post({ type: 'ready' });
    return () => window.removeEventListener('message', onMessage);
  }, []);

  const onRenderError = (message: string) => {
    setError(message);
    post({ type: 'error', message });
  };

  if (error) {
    return (
      <div className="m-6 rounded-xl border border-red-200 bg-red-50 p-4 text-red-700">
        <p className="font-semibold">Render error</p>
        <pre className="mt-2 whitespace-pre-wrap text-sm">{error}</pre>
      </div>
    );
  }
  if (!Comp) return null;
  return (
    <div className="w-full h-screen">
      <RenderBoundary key={renderKey} onError={onRenderError}>
        <Comp />
      </RenderBoundary>
    </div>
  );
}
