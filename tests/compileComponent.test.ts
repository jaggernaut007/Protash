import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { compileComponent, parseImports } from '@/lib/compileComponent';
import { isSandboxEvent, SANDBOX_SOURCE } from '@/lib/sandboxProtocol';

describe('compileComponent', () => {
  it('compiles a default-export function component with injected hooks', () => {
    const Comp = compileComponent(`
      export default function Card() {
        const [n] = useState(3);
        return <p className="x">count {n}</p>;
      }`);
    expect(renderToStaticMarkup(React.createElement(Comp))).toBe('<p class="x">count 3</p>');
  });

  it('accepts react and recharts imports', () => {
    const Comp = compileComponent(`
      import React, { useMemo } from 'react';
      import { ResponsiveContainer as RC } from 'recharts';
      export default function A() { const v = useMemo(() => typeof RC, []); return <span>{v}</span>; }`);
    expect(renderToStaticMarkup(React.createElement(Comp))).toMatch(/<span>(function|object)<\/span>/);
  });

  it('rejects any other import', () => {
    expect(() => compileComponent(`import x from 'evil-pkg';\nexport default function A() { return null; }`))
      .toThrow(/Import "evil-pkg" is not allowed/);
    expect(() => compileComponent(`import * as d3 from 'https://esm.sh/d3';\nexport default function A() { return null; }`))
      .toThrow(/not allowed/);
  });

  it('throws when there is no default export', () => {
    expect(() => compileComponent('const a = 1;')).toThrow(/No default export/);
  });
});

describe('parseImports', () => {
  it('reads default, named and namespace imports', () => {
    expect(parseImports(`import R, { a, b as c } from 'react';\nimport * as rc from 'recharts';`)).toEqual([
      { spec: 'react', defaultIdent: 'R', namedIdents: [{ name: 'a' }, { name: 'b', alias: 'c' }] },
      { spec: 'recharts', namespaceIdent: 'rc' },
    ]);
  });
});

describe('isSandboxEvent', () => {
  it('accepts only well-formed sandbox messages', () => {
    expect(isSandboxEvent({ source: SANDBOX_SOURCE, type: 'ready' })).toBe(true);
    expect(isSandboxEvent({ source: SANDBOX_SOURCE, type: 'error', message: 'x' })).toBe(true);
    expect(isSandboxEvent({ source: SANDBOX_SOURCE, type: 'error' })).toBe(false);
    expect(isSandboxEvent({ source: 'other', type: 'ready' })).toBe(false);
    expect(isSandboxEvent(null)).toBe(false);
  });
});
