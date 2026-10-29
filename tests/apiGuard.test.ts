import { describe, it, expect, beforeEach } from 'vitest';
import { requireSecret, rateLimit, readJsonBody, resetRateLimits, clientIp } from '@/lib/apiGuard';

function req(headers: Record<string, string> = {}, body?: string) {
  return new Request('http://x/api', { method: 'POST', headers, body });
}

describe('requireSecret', () => {
  it('fails closed with 503 when the secret is not set', async () => {
    const res = requireSecret(req({ 'x-cron-secret': 'anything' }), undefined);
    expect(res?.status).toBe(503);
  });

  it('fails closed with 503 when the secret is an empty string', () => {
    expect(requireSecret(req({ 'x-cron-secret': '' }), '')?.status).toBe(503);
  });

  it('returns 401 when the header is missing', () => {
    expect(requireSecret(req(), 's3cret')?.status).toBe(401);
  });

  it('returns 401 for a wrong secret, including one of a different length', () => {
    expect(requireSecret(req({ 'x-cron-secret': 'wrong!' }), 's3cret')?.status).toBe(401);
    expect(requireSecret(req({ 'x-cron-secret': 'x' }), 's3cret')?.status).toBe(401);
  });

  it('allows the correct secret', () => {
    expect(requireSecret(req({ 'x-cron-secret': 's3cret' }), 's3cret')).toBeNull();
  });
});

describe('clientIp', () => {
  it('uses the last X-Forwarded-For entry, which the front end appends', () => {
    expect(clientIp(req({ 'x-forwarded-for': '6.6.6.6, 1.2.3.4' }))).toBe('1.2.3.4');
  });
  it('returns unknown without the header', () => {
    expect(clientIp(req())).toBe('unknown');
  });
});

describe('rateLimit', () => {
  beforeEach(() => resetRateLimits());
  const r = () => req({ 'x-forwarded-for': '1.2.3.4' });

  it('allows requests up to the limit, then returns 429 with Retry-After', () => {
    expect(rateLimit(r(), 'b', 2, 60_000, 1000)).toBeNull();
    expect(rateLimit(r(), 'b', 2, 60_000, 1001)).toBeNull();
    const blocked = rateLimit(r(), 'b', 2, 60_000, 1002);
    expect(blocked?.status).toBe(429);
    expect(Number(blocked?.headers.get('Retry-After'))).toBeGreaterThan(0);
  });

  it('allows requests again after the window passes', () => {
    rateLimit(r(), 'b', 1, 1000, 0);
    expect(rateLimit(r(), 'b', 1, 1000, 500)?.status).toBe(429);
    expect(rateLimit(r(), 'b', 1, 1000, 1500)).toBeNull();
  });

  it('counts each client and each bucket separately', () => {
    rateLimit(r(), 'b', 1, 60_000, 0);
    expect(rateLimit(req({ 'x-forwarded-for': '9.9.9.9' }), 'b', 1, 60_000, 1)).toBeNull();
    expect(rateLimit(r(), 'other', 1, 60_000, 1)).toBeNull();
  });
});

describe('readJsonBody', () => {
  it('parses valid JSON', async () => {
    const out = await readJsonBody(req({}, '{"a":1}'), 100);
    expect(out).toEqual({ ok: true, data: { a: 1 } });
  });

  it('returns 400 for invalid JSON', async () => {
    const out = await readJsonBody(req({}, '{bad'), 100);
    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.response.status).toBe(400);
  });

  it('returns 413 when the body is over the cap', async () => {
    const out = await readJsonBody(req({}, JSON.stringify({ a: 'x'.repeat(200) })), 100);
    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.response.status).toBe(413);
  });

  it('returns 413 on a declared content-length over the cap', async () => {
    const out = await readJsonBody(req({ 'content-length': '999999' }, '{}'), 100);
    if (!out.ok) expect(out.response.status).toBe(413);
    expect(out.ok).toBe(false);
  });
});
