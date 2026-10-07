import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import { rmSync } from 'fs';
import os from 'os';
import path from 'path';
import { resetRateLimits } from '@/lib/apiGuard';

// Mocked boundaries: the LLM pipeline, the bank client and the email client.
const pipeline = vi.hoisted(() => ({ runPrototypePipeline: vi.fn() }));
vi.mock('@/lib/pipeline', () => pipeline);

const plaid = vi.hoisted(() => ({
  getAccessToken: vi.fn(() => null as string | null),
  getTransactionSummary: vi.fn(),
  createLinkToken: vi.fn(),
  exchangePublicToken: vi.fn(),
  setAccessToken: vi.fn(),
}));
vi.mock('@/lib/plaid', () => plaid);

const resend = vi.hoisted(() => ({
  sendEmail: vi.fn(),
  buildDailyBriefHtml: vi.fn(() => '<p>brief</p>'),
}));
vi.mock('@/lib/resend', () => resend);

const SECRET = 'test-secret-value';

function post(url: string, body: unknown, headers: Record<string, string> = {}) {
  return new NextRequest(`http://localhost${url}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-forwarded-for': '1.1.1.1', ...headers },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
}
function get(url: string, headers: Record<string, string> = {}) {
  return new NextRequest(`http://localhost${url}`, { headers });
}

beforeEach(() => {
  vi.clearAllMocks();
  resetRateLimits();
  delete process.env.CRON_SECRET;
  delete process.env.DISCORD_WEBHOOK_URL;
  delete process.env.RESEND_TO_EMAIL;
  process.env.BOARD_STORAGE_MODE = 'memory';
});

describe('admin routes fail closed', () => {
  it('discord/notify returns 503 when CRON_SECRET is unset, even with a header', async () => {
    const { POST } = await import('@/app/api/discord/notify/route');
    const res = await POST(post('/api/discord/notify', {}, { 'x-cron-secret': 'anything' }));
    expect(res.status).toBe(503);
    expect(resend.sendEmail).not.toHaveBeenCalled();
  });

  it('discord/notify returns 401 with no header when CRON_SECRET is set', async () => {
    process.env.CRON_SECRET = SECRET;
    const { POST } = await import('@/app/api/discord/notify/route');
    expect((await POST(post('/api/discord/notify', {}))).status).toBe(401);
    expect(resend.sendEmail).not.toHaveBeenCalled();
  });

  it('discord/notify returns 401 with a wrong header', async () => {
    process.env.CRON_SECRET = SECRET;
    const { POST } = await import('@/app/api/discord/notify/route');
    const res = await POST(post('/api/discord/notify', {}, { 'x-cron-secret': 'wrong' }));
    expect(res.status).toBe(401);
  });

  it('discord/notify with the right secret and no recipient sends no email', async () => {
    process.env.CRON_SECRET = SECRET;
    const { POST } = await import('@/app/api/discord/notify/route');
    const res = await POST(post('/api/discord/notify', {}, { 'x-cron-secret': SECRET }));
    expect(res.status).toBe(200);
    expect(resend.sendEmail).not.toHaveBeenCalled();
  });

  it('discord/notify does not echo provider error text to the caller', async () => {
    process.env.CRON_SECRET = SECRET;
    process.env.RESEND_TO_EMAIL = 'me@example.com';
    resend.sendEmail.mockRejectedValueOnce(new Error('key re_live_SECRET123 rejected'));
    const { POST } = await import('@/app/api/discord/notify/route');
    const res = await POST(post('/api/discord/notify', {}, { 'x-cron-secret': SECRET }));
    expect(res.status).toBe(500);
    expect(JSON.stringify(await res.json())).not.toContain('re_live_SECRET123');
  });

  it.each([
    ['plaid create-link-token', '@/app/api/plaid/create-link-token/route', 'POST'],
    ['plaid exchange-token', '@/app/api/plaid/exchange-token/route', 'POST'],
    ['plaid transactions', '@/app/api/plaid/transactions/route', 'GET'],
    ['visa evidence GET', '@/app/api/visa/evidence/route', 'GET'],
    ['visa evidence POST', '@/app/api/visa/evidence/route', 'POST'],
  ])('%s returns 401 without the secret', async (_name, mod, method) => {
    process.env.CRON_SECRET = SECRET;
    const handler = (await import(mod))[method];
    const req = method === 'GET' ? get('/x') : post('/x', { public_token: 'p' });
    expect((await handler(req)).status).toBe(401);
    expect(plaid.exchangePublicToken).not.toHaveBeenCalled();
    expect(plaid.setAccessToken).not.toHaveBeenCalled();
  });

  it('plaid exchange-token cannot replace the bank token without the secret', async () => {
    process.env.CRON_SECRET = SECRET;
    const { POST } = await import('@/app/api/plaid/exchange-token/route');
    await POST(post('/x', { public_token: 'attacker' }));
    expect(plaid.setAccessToken).not.toHaveBeenCalled();
  });

  it('plaid routes hide provider error detail', async () => {
    process.env.CRON_SECRET = SECRET;
    plaid.createLinkToken.mockRejectedValueOnce(new Error('Plaid /link failed: {"secret":"abc"}'));
    const { POST } = await import('@/app/api/plaid/create-link-token/route');
    const res = await POST(post('/x', {}, { 'x-cron-secret': SECRET }));
    expect(res.status).toBe(500);
    expect(JSON.stringify(await res.json())).not.toContain('abc');
  });
});

describe('visa evidence storage', () => {
  afterEach(() => rmSync(path.join(os.tmpdir(), 'protash-data'), { recursive: true, force: true }));

  it('saves and reads back with the secret, in a writable directory', async () => {
    process.env.CRON_SECRET = SECRET;
    const route = await import('@/app/api/visa/evidence/route');
    const headers = { 'x-cron-secret': SECRET };
    expect((await route.POST(post('/x', { a: 1 }, headers))).status).toBe(200);
    const res = await route.GET(get('/x', headers));
    expect(await res.json()).toEqual({ a: 1 });
  });

  it('returns 400 for invalid JSON and 413 for an oversized body', async () => {
    process.env.CRON_SECRET = SECRET;
    const route = await import('@/app/api/visa/evidence/route');
    const headers = { 'x-cron-secret': SECRET };
    expect((await route.POST(post('/x', '{bad', headers))).status).toBe(400);
    const big = JSON.stringify({ x: 'y'.repeat(300 * 1024) });
    expect((await route.POST(post('/x', big, headers))).status).toBe(413);
  });
});

describe('POST /api/prototype', () => {
  it('returns 400 when the intent is missing', async () => {
    const { POST } = await import('@/app/api/prototype/route');
    expect((await POST(post('/api/prototype', { context: {} }))).status).toBe(400);
    expect(pipeline.runPrototypePipeline).not.toHaveBeenCalled();
  });

  it('returns 413 for an intent over the cap and does not call the LLM pipeline', async () => {
    const { POST } = await import('@/app/api/prototype/route');
    const res = await POST(post('/api/prototype', { context: { intentDescription: 'x'.repeat(4001) } }));
    expect(res.status).toBe(413);
    expect(pipeline.runPrototypePipeline).not.toHaveBeenCalled();
  });

  it('accepts a request with a large boardContext', async () => {
    pipeline.runPrototypePipeline.mockResolvedValueOnce({ code: 'c', approved: true });
    const { POST } = await import('@/app/api/prototype/route');
    const res = await POST(
      post('/api/prototype', {
        context: { intentDescription: 'sales dashboard', boardContext: 'z'.repeat(200 * 1024) },
      })
    );
    expect(res.status).toBe(200);
  });

  it('rate limits a client after 15 requests in a minute', async () => {
    pipeline.runPrototypePipeline.mockResolvedValue({ code: 'c', approved: true });
    const { POST } = await import('@/app/api/prototype/route');
    const body = { context: { intentDescription: 'sales dashboard' } };
    for (let i = 0; i < 15; i++) expect((await POST(post('/api/prototype', body))).status).toBe(200);
    const blocked = await POST(post('/api/prototype', body));
    expect(blocked.status).toBe(429);
    expect(blocked.headers.get('Retry-After')).toBeTruthy();
  });

  it('returns a generic 500 and no internal error text', async () => {
    pipeline.runPrototypePipeline.mockRejectedValueOnce(new Error('DEEPSEEK key sk-abc123 invalid'));
    const { POST } = await import('@/app/api/prototype/route');
    const res = await POST(post('/api/prototype', { context: { intentDescription: 'sales dashboard' } }));
    expect(res.status).toBe(500);
    expect(JSON.stringify(await res.json())).not.toContain('sk-abc123');
  });

  it('returns 502 when the model cannot produce valid code', async () => {
    const { CodeGenerationError } = await import('@/lib/agents');
    pipeline.runPrototypePipeline.mockRejectedValueOnce(new CodeGenerationError('cut off'));
    const { POST } = await import('@/app/api/prototype/route');
    const res = await POST(post('/api/prototype', { context: { intentDescription: 'sales dashboard' } }));
    expect(res.status).toBe(502);
  });

  it('mood-asset shares the same limits and keeps its response field', async () => {
    pipeline.runPrototypePipeline.mockResolvedValueOnce({ code: 'c', approved: true });
    const { POST } = await import('@/app/api/mood-asset/route');
    const ok = await POST(post('/api/mood-asset', { context: { intentDescription: 'sales dashboard' } }));
    expect((await ok.json()).mood).toBe('enterprise');
    const long = await POST(post('/api/mood-asset', { context: { intentDescription: 'x'.repeat(4001) } }));
    expect(long.status).toBe(413);
  });
});

describe('board routes', () => {
  it('upload rejects a text field named "file" with 400', async () => {
    const { POST } = await import('@/app/api/board/upload/route');
    const fd = new FormData();
    fd.set('file', 'not a file');
    const res = await POST(new NextRequest('http://localhost/x', { method: 'POST', body: fd }));
    expect(res.status).toBe(400);
  });

  it('upload returns 400 with no file and 413 just over 5 MB, and accepts exactly 5 MB', async () => {
    const { POST } = await import('@/app/api/board/upload/route');
    const send = (size?: number) => {
      const fd = new FormData();
      if (size !== undefined) fd.set('file', new File(['a'.repeat(size)], 'a.txt', { type: 'text/plain' }));
      return POST(new NextRequest('http://localhost/x', { method: 'POST', body: fd }));
    };
    expect((await send()).status).toBe(400);
    expect((await send(5 * 1024 * 1024 + 1)).status).toBe(413);
    expect((await send(5 * 1024 * 1024)).status).toBe(200);
  });

  it('updateIntent cannot overwrite id, boardId or artifacts', async () => {
    const { POST } = await import('@/app/api/board/route');
    const created = await (await POST(post('/x', { action: 'createIntent', data: { title: 't', description: 'd' } }))).json();
    const id = created.intent.id as string;
    const boardId = created.intent.boardId as string;

    const res = await POST(
      post('/x', {
        action: 'updateIntent',
        data: { intentId: id, title: 'new', id: 'hijack', boardId: 'hijack', artifacts: ['x'] },
      })
    );
    const { intent } = await res.json();
    expect(intent.title).toBe('new');
    expect(intent.id).toBe(id);
    expect(intent.boardId).toBe(boardId);
    expect(intent.artifacts).toEqual([]);
  });

  it('board POST validates its input', async () => {
    const { POST } = await import('@/app/api/board/route');
    expect((await POST(post('/x', { action: 'updateIntent', data: {} }))).status).toBe(400);
    expect((await POST(post('/x', { action: 'deleteIntent', data: {} }))).status).toBe(400);
    expect((await POST(post('/x', { action: 'nope' }))).status).toBe(400);
    expect((await POST(post('/x', '{bad'))).status).toBe(400);
  });

  it('artifact create accepts the UI payload (null intentId) and rejects a missing body field', async () => {
    const { POST } = await import('@/app/api/board/artifact/route');
    const okRes = await POST(
      post('/x', { action: 'createArtifact', data: { type: 'prototype', title: 't', content: 'c', intentId: null } })
    );
    expect(okRes.status).toBe(200);
    const bad = await POST(post('/x', { action: 'updateArtifact', data: null }));
    expect(bad.status).toBe(400);
  });

  it('search clamps its input', async () => {
    const { POST } = await import('@/app/api/board/search/route');
    expect((await POST(post('/x', { query: 'q', limit: 5000 }))).status).toBe(400);
    expect((await POST(post('/x', { query: 'q', limit: 5 }))).status).toBe(200);
  });
});
