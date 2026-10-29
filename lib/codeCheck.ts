/**
 * Static checks for generated component code.
 * A cut-off or malformed component cannot render, and LLM reviewers do not compile code.
 * This check uses the same Babel presets as components/DynamicCanvasRenderer.tsx.
 */

import * as Babel from '@babel/standalone';

export interface CodeCheckResult {
  ok: boolean;
  error?: string;
}

export function checkComponentCode(code: string): CodeCheckResult {
  if (!code.trim()) {
    return { ok: false, error: 'The generated code is empty.' };
  }
  if (!/export\s+default/.test(code)) {
    return { ok: false, error: 'The code has no "export default" component.' };
  }
  try {
    Babel.transform(code, {
      presets: [
        [Babel.availablePresets['react'], { runtime: 'classic' }],
        Babel.availablePresets['typescript'],
      ],
      filename: 'component.tsx',
    });
    return { ok: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { ok: false, error: message.split('\n')[0].slice(0, 300) };
  }
}
