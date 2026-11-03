/**
 * Compile generated component source into a React component.
 *
 * Runs only inside the sandboxed /sandbox iframe. The iframe has an opaque origin,
 * so the evaluated code cannot read the app's cookies, storage or same-origin APIs.
 * Imports are limited to React and Recharts. Any other import throws.
 */

import React from 'react';
import * as Babel from '@babel/standalone';
import * as RechartsAll from 'recharts';

let presetRegistered = false;
function ensurePreset() {
  if (presetRegistered) return;
  Babel.registerPreset('tsx-react', {
    presets: [
      [Babel.availablePresets['react'], { runtime: 'classic' }],
      Babel.availablePresets['typescript'],
    ],
  });
  presetRegistered = true;
}

type ImportSpec = {
  spec: string;
  defaultIdent?: string;
  namespaceIdent?: string;
  namedIdents?: Array<{ name: string; alias?: string }>;
};

const IDENT = /^[A-Za-z_$][A-Za-z0-9_$]*$/;

// React hooks and APIs that generated code may use without an import.
const REACT_APIS = [
  'useState', 'useEffect', 'useContext', 'useReducer',
  'useCallback', 'useMemo', 'useRef', 'useLayoutEffect',
  'useImperativeHandle', 'useDebugValue', 'useId', 'useTransition', 'useDeferredValue',
  'createContext', 'createRef', 'forwardRef', 'memo',
  'Fragment', 'StrictMode', 'Suspense', 'lazy',
  'cloneElement', 'isValidElement', 'Children',
];

// The only modules that generated code may import.
const ALLOWED_MODULES: Record<string, unknown> = {
  react: React,
  recharts: RechartsAll,
};

export function parseImports(source: string): ImportSpec[] {
  const specs: ImportSpec[] = [];
  const importRegex = /import\s+([\s\S]*?)\s+from\s+["']([^"']+)["'];?/g;
  let m: RegExpExecArray | null;
  while ((m = importRegex.exec(source)) !== null) {
    const clause = m[1].trim();
    const entry: ImportSpec = { spec: m[2].trim() };

    const nsMatch = clause.match(/^\*\s+as\s+([A-Za-z_$][A-Za-z0-9_$]*)$/);
    if (nsMatch) {
      entry.namespaceIdent = nsMatch[1];
    } else {
      const namedBlock = clause.match(/\{([^}]*)\}/);
      if (namedBlock) {
        const named: Array<{ name: string; alias?: string }> = [];
        namedBlock[1].split(',').forEach((seg) => {
          const s = seg.trim().replace(/^type\s+/, '');
          if (!s) return;
          const asMatch = s.match(/^([A-Za-z_$][A-Za-z0-9_$]*)\s+as\s+([A-Za-z_$][A-Za-z0-9_$]*)$/);
          if (asMatch) named.push({ name: asMatch[1], alias: asMatch[2] });
          else if (IDENT.test(s)) named.push({ name: s });
        });
        if (named.length > 0) entry.namedIdents = named;
      }
      const outsideBlock = clause.replace(/\{[^}]*\}/, '').trim();
      for (const part of outsideBlock.split(',')) {
        const p = part.trim();
        if (IDENT.test(p)) {
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
  return source
    .replace(/^[ \t]*import(?:\s+type)?\s+[\s\S]*?from\s+["'][^"']+["'];?\n?/gm, '')
    .replace(/^[ \t]*import\s+["'][^"']+["'];?\n?/gm, '');
}

function wrapDefaultExport(source: string): string {
  let defaultIdent: string | null = null;
  let src = source;
  src = src.replace(/export\s+default\s+function\s+([A-Za-z0-9_]+)\s*\(/, (_m, name) => {
    defaultIdent = name;
    return `function ${name}(`;
  });
  src = src.replace(/export\s+default\s+class\s+([A-Za-z0-9_]+)\s*/, (_m, name) => {
    defaultIdent = name;
    return `class ${name} `;
  });
  if (!defaultIdent) {
    if (/export\s+default\s+([A-Za-z_$][A-Za-z0-9_$]*)\s*;?/.test(src)) {
      src = src.replace(/export\s+default\s+([A-Za-z_$][A-Za-z0-9_$]*)\s*;?/, (_m, name) => `const __DEFAULT__ = ${name};`);
    } else if (/export\s+default\s+/.test(src)) {
      src = src.replace(/export\s+default\s+/, 'const __DEFAULT__ = ');
    }
  }
  return defaultIdent
    ? `${src}\nreturn ${defaultIdent};\n`
    : `${src}\nreturn (typeof __DEFAULT__ !== 'undefined' ? __DEFAULT__ : undefined);\n`;
}

export function compileComponent(code: string): React.ComponentType {
  ensurePreset();
  const source = code.trim();
  const paramNames: string[] = ['React'];
  const paramValues: unknown[] = [React];
  const add = (name: string, value: unknown) => {
    if (!IDENT.test(name) || paramNames.includes(name)) return;
    paramNames.push(name);
    paramValues.push(value);
  };

  for (const api of REACT_APIS) add(api, (React as unknown as Record<string, unknown>)[api]);
  for (const [key, val] of Object.entries(RechartsAll)) if (val !== undefined) add(key, val);

  for (const imp of parseImports(source)) {
    if (imp.spec === 'react-dom') continue;
    if (!(imp.spec in ALLOWED_MODULES)) {
      throw new Error(`Import "${imp.spec}" is not allowed. Use the pre-injected React and Recharts APIs.`);
    }
    const mod = ALLOWED_MODULES[imp.spec] as Record<string, unknown>;
    if (imp.defaultIdent && imp.defaultIdent !== 'React') add(imp.defaultIdent, mod.default ?? mod);
    if (imp.namespaceIdent) add(imp.namespaceIdent, mod);
    for (const { name, alias } of imp.namedIdents ?? []) add(alias || name, mod[name]);
  }

  const wrappedSrc = `var __ROOT_FN__ = function() { ${wrapDefaultExport(stripImports(source))} }; __ROOT_FN__`;
  const { code: compiled } = Babel.transform(wrappedSrc, {
    presets: ['tsx-react'],
    filename: 'DynamicComponent.tsx',
    sourceType: 'script',
    parserOpts: { sourceType: 'script' },
  });
  const sanitized = (compiled ?? '').replace(/^\s*import[^\n]*$/gm, '');

  const fn = new Function(...paramNames, `${sanitized}; return __ROOT_FN__;`);
  const out = fn(...paramValues)();
  if (!out) throw new Error('No default export or return value found in code');
  if (typeof out === 'function') return out as React.ComponentType;
  return () => out as React.ReactElement;
}
