"use client";

import React, { useEffect, useState } from "react";
import * as Babel from "@babel/standalone";
import * as RechartsAll from "recharts";
import { useCode } from "@/context/CodeContext";

// Configure a preset for React + TypeScript with automatic JSX runtime
Babel.registerPreset("tsx-react", {
  presets: [
    [Babel.availablePresets["react"], { runtime: "classic" }],
    Babel.availablePresets["typescript"],
  ],
});

interface DynamicCanvasRendererProps {
  code?: string;
  className?: string;
}

export default function DynamicCanvasRenderer({ code: propCode, className }: DynamicCanvasRendererProps) {
  const { code: contextCode } = useCode();
  const code = propCode || contextCode;
  const [error, setError] = useState<string | null>(null);
  const [Comp, setComp] = useState<React.ComponentType | null>(null);
  const trimmed = (code ?? "").trim();

  type ImportSpec = {
    spec: string; // package or path, e.g., 'dayjs' or 'lodash/debounce'
    defaultIdent?: string; // e.g., dayjs
    namespaceIdent?: string; // e.g., d3
    namedIdents?: Array<{ name: string; alias?: string }>; // e.g., {name:'debounce', alias:'debounce'}
  };

  const cdnCache = (typeof window !== "undefined" && (window as any).__CDN_MODULE_CACHE__) || new Map<string, any>();
  if (typeof window !== "undefined") {
    (window as any).__CDN_MODULE_CACHE__ = cdnCache;
  }

  function parseImports(source: string): ImportSpec[] {
    const specs: ImportSpec[] = [];
    const importRegex = /import\s+([\s\S]*?)\s+from\s+["']([^"']+)["'];?/g;
    let m: RegExpExecArray | null;
    while ((m = importRegex.exec(source)) !== null) {
      const clause = m[1].trim();
      const spec = m[2].trim();
      const entry: ImportSpec = { spec };

      // namespace: * as ns
      const nsMatch = clause.match(/^\*\s+as\s+([A-Za-z_$][A-Za-z0-9_$]*)$/);
      if (nsMatch) {
        entry.namespaceIdent = nsMatch[1];
      } else {
        // Extract entire { ... } block first (handles multi-line named imports)
        const namedBlock = clause.match(/\{([^}]*)\}/);
        if (namedBlock) {
          const named: Array<{ name: string; alias?: string }> = [];
          namedBlock[1].split(",").forEach(seg => {
            const s = seg.trim();
            if (!s) return;
            const asMatch = s.match(/^([A-Za-z_$][A-Za-z0-9_$]*)\s+as\s+([A-Za-z_$][A-Za-z0-9_$]*)$/);
            if (asMatch) named.push({ name: asMatch[1], alias: asMatch[2] });
            else if (/^[A-Za-z_$][A-Za-z0-9_$]*$/.test(s)) named.push({ name: s });
          });
          if (named.length > 0) entry.namedIdents = named;
        }

        // Default import is any bare identifier outside the { } block
        const outsideBlock = clause.replace(/\{[^}]*\}/, "").trim();
        for (const part of outsideBlock.split(",")) {
          const p = part.trim();
          if (/^[A-Za-z_$][A-Za-z0-9_$]*$/.test(p)) {
            entry.defaultIdent = p;
            break;
          }
        }
      }
      specs.push(entry);
    }
    return specs;
  }

  function stripImports(source: string): string {
    // Handle multi-line imports like: import {\n  A,\n  B,\n} from 'pkg';
    return source
      .replace(/^import(?:\s+type)?\s+[\s\S]*?from\s+["'][^"']+["'];?\n?/gm, '')
      .replace(/^import\s+["'][^"']+["'];?\n?/gm, '');
  }

  async function loadFromCdn(spec: string): Promise<any> {
    const url = `https://esm.sh/${spec}?target=es2022`;
    if (cdnCache.has(url)) return cdnCache.get(url);
    // @ts-ignore - external URL dynamic import
    const mod = await import(/* webpackIgnore: true */ url);
    cdnCache.set(url, mod);
    return mod;
  }

  function isExternal(spec: string): boolean {
    return !(spec.startsWith("./") || spec.startsWith("../") || spec.startsWith("/") || spec.startsWith("data:"));
  }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!trimmed) {
        setComp(null);
        setError(null);
        return;
      }
      try {
        setError(null);
        // Detect imports (before stripping) and prepare dependency map
        const imports = parseImports(trimmed);
        const paramNames: string[] = ["React"]; // Always inject React
        const paramValues: any[] = [React];

        // Auto-inject common React hooks and APIs from the bundled React instance
        // so generated code always uses the same React that drives the renderer.
        const reactApis = [
          // hooks
          'useState', 'useEffect', 'useContext', 'useReducer',
          'useCallback', 'useMemo', 'useRef', 'useLayoutEffect',
          'useImperativeHandle', 'useDebugValue', 'useId', 'useTransition', 'useDeferredValue',
          // creation APIs (often imported named and not available without this)
          'createContext', 'createRef', 'forwardRef', 'memo',
          'Fragment', 'StrictMode', 'Suspense', 'lazy',
          'cloneElement', 'isValidElement', 'Children',
        ];

        reactApis.forEach(api => {
          if ((React as any)[api]) {
            paramNames.push(api);
            paramValues.push((React as any)[api]);
          }
        });

        // Pre-inject all Recharts named exports so generated code can use them
        // even when the AI omits the import statement (the prompt claims they are pre-injected).
        Object.keys(RechartsAll).forEach(key => {
          const val = (RechartsAll as any)[key];
          if (val !== undefined && !paramNames.includes(key)) {
            paramNames.push(key);
            paramValues.push(val);
          }
        });

        // merge globals if present (always include bundled recharts to avoid CDN React mismatch)
        const globals: Record<string, any> = {
          recharts: RechartsAll,
          ...((typeof window !== "undefined" && (window as any).__CANVAS_LIBS__) || {}),
        };

        // Load external modules via CDN as needed and prepare identifiers
        for (const imp of imports) {
          if (!isExternal(imp.spec)) continue; // ignore local paths

          // Prefer preloaded globals if they match
          const maybeGlobalDefault = globals[imp.defaultIdent || ""];
          const maybeGlobalNs = globals[imp.namespaceIdent || ""];

          // For React/react-dom, reuse in-memory React to avoid shadowing with CDN builds
          if (imp.spec === 'react' || imp.spec === 'react-dom') {
            continue; // React already injected as the first param
          }

          let mod: any = null;
          if (imp.defaultIdent && maybeGlobalDefault) {
            mod = { default: maybeGlobalDefault };
          } else if (imp.namespaceIdent && maybeGlobalNs) {
            mod = maybeGlobalNs;
          } else if (globals[imp.spec]) {
            // Use webpack-bundled module by package spec (avoids CDN React instance mismatch)
            mod = globals[imp.spec];
          } else {
            mod = await loadFromCdn(imp.spec);
          }

          // default identifier
          if (imp.defaultIdent) {
            paramNames.push(imp.defaultIdent);
            paramValues.push(mod?.default ?? mod);
          }
          // namespace identifier
          if (imp.namespaceIdent) {
            paramNames.push(imp.namespaceIdent);
            paramValues.push(mod);
          }
          // named identifiers
          if (imp.namedIdents && imp.namedIdents.length > 0) {
            for (const { name, alias } of imp.namedIdents) {
              const localName = alias || name;
              paramNames.push(localName);
              paramValues.push((mod && mod[name]) ?? undefined);
            }
          }
        }

        // Strip imports for compilation
        const withoutImports = stripImports(trimmed);

        // Normalize export default
        let defaultIdent: string | null = null;
        let src = withoutImports;
        src = src.replace(/export\s+default\s+function\s+([A-Za-z0-9_]+)\s*\(/, (_m, name) => {
          defaultIdent = name;
          return `function ${name}(`;
        });
        src = src.replace(/export\s+default\s+class\s+([A-Za-z0-9_]+)\s*/, (_m, name) => {
          defaultIdent = name;
          return `class ${name} `;
        });
        if (!defaultIdent) {
          const identMatch = src.match(/export\s+default\s+([A-Za-z_$][A-Za-z0-9_$]*)\s*;?/);
          if (identMatch) {
            src = src.replace(/export\s+default\s+([A-Za-z_$][A-Za-z0-9_$]*)\s*;?/, (_m, name) => `const __DEFAULT__ = ${name};`);
          } else if (/export\s+default\s+/.test(src)) {
            src = src.replace(/export\s+default\s+/, "const __DEFAULT__ = ");
          }
        }
        if (defaultIdent) {
          src = `${src}\nreturn ${defaultIdent};\n`;
        } else {
          src = `${src}\nreturn (typeof __DEFAULT__ !== 'undefined' ? __DEFAULT__ : undefined);\n`;
        }

        // Wrap in a function body
        const wrappedSrc = `var __ROOT_FN__ = function() { ${src} }; __ROOT_FN__`;

        // Transpile
        const { code: compiled } = Babel.transform(wrappedSrc, {
          presets: ["tsx-react"],
          filename: "DynamicComponent.tsx",
          sourceType: "script",
          parserOpts: { sourceType: "script" },
        });

        const sanitized = compiled.replace(/^\s*import[^\n]*$/gm, "");

        // Execute with injected parameters (React + resolved deps)
        const fn = new Function(...paramNames, `${sanitized}; return __ROOT_FN__;`);
        const Out = fn(...paramValues)();
        if (!Out) throw new Error("No default export or return value found in code");
        
        // Ensure Out is a component function, not a JSX element
        let component: React.ComponentType;
        
        if (typeof Out === 'function') {
          // It's a function, use it directly
          component = Out;
        } else if (Out && typeof Out === 'object' && ('$$typeof' in Out || 'type' in Out)) {
          // It's a JSX element, wrap it in a component function
          component = () => Out;
        } else {
          // Fallback: treat as element
          component = () => Out;
        }
        
        // Verify component is a function before setting
        if (typeof component !== 'function') {
          throw new Error(`Component must be a function, got ${typeof component}`);
        }
        
        if (!cancelled) setComp(() => component);
      } catch (e: any) {
        // eslint-disable-next-line no-console
        console.error(e);
        if (!cancelled) setError(e?.message ?? "Failed to compile component");
        if (!cancelled) setComp(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trimmed]);

  // No code: render an empty canvas
  if (!trimmed) {
    return <div className={className ?? "w-full h-full"} />;
  }

  return (
    <div className={className ?? "w-full h-full"}>
      {error ? (
        <div className="m-6 rounded-xl border border-red-200 bg-red-50 p-4 text-red-700">
          <p className="font-semibold">Render error</p>
          <pre className="mt-2 whitespace-pre-wrap text-sm">{error}</pre>
        </div>
      ) : Comp ? (
        <Comp />
      ) : null}
    </div>
  );
}
