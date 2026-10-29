import { describe, it, expect } from 'vitest';
import { checkComponentCode } from '@/lib/codeCheck';

const VALID = `export default function Dash() {
  const [n, setN] = useState(0);
  return <div className="w-full h-full"><button onClick={() => setN(n + 1)}>{n}</button></div>;
}`;

describe('checkComponentCode', () => {
  it('accepts a valid component', () => {
    expect(checkComponentCode(VALID)).toEqual({ ok: true });
  });

  it('rejects code that is cut off mid-file', () => {
    const cut = VALID.slice(0, VALID.length - 40);
    const result = checkComponentCode(cut);
    expect(result.ok).toBe(false);
    expect(result.error).toBeTruthy();
  });

  it('rejects empty output', () => {
    expect(checkComponentCode('   ').ok).toBe(false);
  });

  it('rejects code with no default export', () => {
    const result = checkComponentCode('function A() { return <div/>; }');
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/export default/);
  });

  it('accepts TypeScript syntax', () => {
    const ts = `type Row = { id: number };
export default function T() { const rows: Row[] = [{ id: 1 }]; return <ul>{rows.map(r => <li key={r.id}>{r.id}</li>)}</ul>; }`;
    expect(checkComponentCode(ts).ok).toBe(true);
  });
});
