"use client";

import React, { useEffect } from "react";
import * as recharts from "recharts";

// Allowlisted common libs to preload via CDN and expose as globals
const PRELOAD_LIBS: Array<{ name: string; spec: string; alias?: string }> = [
  { name: "lodash", spec: "lodash" },
  { name: "dayjs", spec: "dayjs" },
  { name: "zod", spec: "zod" },
];

async function loadFromCdn(spec: string): Promise<any> {
  const url = `https://esm.sh/${spec}?target=es2022`;
  // Dynamic ESM import from CDN (client-side only)
  // @ts-ignore - external URL dynamic import
  return import(/* webpackIgnore: true */ url);
}

export default function PreloadLibs(): null {
  useEffect(() => {
    (async () => {
      try {
        const registry: Record<string, any> = (window as any).__CANVAS_LIBS__ || {};
        // Recharts must use the webpack-bundled copy so it shares the same React instance
        registry['recharts'] = recharts;
        for (const lib of PRELOAD_LIBS) {
          if (!registry[lib.alias || lib.name]) {
            const mod = await loadFromCdn(lib.spec);
            // Default export fallback to the module itself
            const value = mod?.default ?? mod;
            registry[lib.alias || lib.name] = value;
          }
        }
        (window as any).__CANVAS_LIBS__ = registry;
      } catch (e) {
        // Fail silently; renderer will attempt on-demand loads
        // eslint-disable-next-line no-console
        console.warn("PreloadLibs: failed to preload libs", e);
      }
    })();
  }, []);

  return null;
}
