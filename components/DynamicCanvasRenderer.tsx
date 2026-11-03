"use client";

/**
 * Renders generated component code inside a sandboxed iframe.
 *
 * The iframe has sandbox="allow-scripts" and no allow-same-origin, so the generated code
 * runs with an opaque origin. It cannot read this page's DOM, cookies or storage, and its
 * CSP (see next.config.ts) blocks network calls. Compilation happens in the iframe (/sandbox).
 */

import React, { useCallback, useEffect, useRef, useState } from "react";
import { useCode } from "@/context/CodeContext";
import { HOST_SOURCE, isSandboxEvent, type HostEvent } from "@/lib/sandboxProtocol";

interface DynamicCanvasRendererProps {
  code?: string;
  className?: string;
}

export default function DynamicCanvasRenderer({ code: propCode, className }: DynamicCanvasRendererProps) {
  const { code: contextCode } = useCode();
  const trimmed = (propCode || contextCode || "").trim();
  const frameRef = useRef<HTMLIFrameElement>(null);
  const [ready, setReady] = useState(false);

  const send = useCallback((event: HostEvent) => {
    // An opaque-origin frame has no origin to target, so use '*'. The code is not secret.
    frameRef.current?.contentWindow?.postMessage({ source: HOST_SOURCE, ...event }, "*");
  }, []);

  useEffect(() => {
    function onMessage(e: MessageEvent) {
      if (!frameRef.current || e.source !== frameRef.current.contentWindow) return;
      if (!isSandboxEvent(e.data)) return;
      if (e.data.type === "ready") setReady(true);
      // The sandbox shows the error itself. Log it here for debugging.
      // eslint-disable-next-line no-console
      else if (e.data.type === "error") console.error("[sandbox]", e.data.message);
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  useEffect(() => {
    if (ready) send({ type: "render", code: trimmed });
  }, [ready, trimmed, send]);

  // Keep the iframe mounted when the code is empty. A remount would need a new "ready" handshake.
  return (
    <div className={className ?? "w-full h-full"} hidden={!trimmed}>
      <iframe
        ref={frameRef}
        src="/sandbox"
        title="Generated prototype"
        sandbox="allow-scripts"
        referrerPolicy="no-referrer"
        className="w-full h-full border-0 bg-transparent"
      />
    </div>
  );
}
