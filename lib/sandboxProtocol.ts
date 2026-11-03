/** Message protocol between the canvas host and the /sandbox iframe. */

export const HOST_SOURCE = 'protash-host';
export const SANDBOX_SOURCE = 'protash-sandbox';

/** Host → sandbox. */
export type HostEvent = { type: 'render'; code: string };

/** Sandbox → host. */
export type SandboxEvent =
  | { type: 'ready' }
  | { type: 'rendered' }
  | { type: 'error'; message: string };

export function isSandboxEvent(data: unknown): data is SandboxEvent & { source: string } {
  if (!data || typeof data !== 'object') return false;
  const d = data as Record<string, unknown>;
  if (d.source !== SANDBOX_SOURCE) return false;
  if (d.type === 'ready' || d.type === 'rendered') return true;
  return d.type === 'error' && typeof d.message === 'string';
}
