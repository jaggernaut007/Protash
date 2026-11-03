/**
 * Guards for API routes: shared-secret check, per-client rate limit, body size cap.
 *
 * The service runs on Cloud Run with --allow-unauthenticated, so every route is public.
 * - Admin routes (Plaid, Discord notify, Visa evidence) use `requireSecret` and fail closed.
 * - Browser routes (prototype, agent, board) cannot hold a secret. They use `rateLimit` and
 *   `readJsonBody` to limit cost and memory use.
 * - Routes that call the LLM also take a slot from `acquireLlmSlot`. It caps the runs of all
 *   clients together, so many IP addresses cannot get past it.
 * Rate-limit state is per instance. Deploy with --max-instances to bound the total.
 */

import { NextResponse } from 'next/server';
import { timingSafeEqual } from 'crypto';

export const ADMIN_HEADER = 'x-cron-secret';

/** Return a 503/401 response when the caller does not hold the secret. Return null when allowed. */
export function requireSecret(req: Request, secret: string | undefined): NextResponse | null {
  if (!secret) {
    // Fail closed: an unset secret must never open the route.
    return NextResponse.json({ error: 'Endpoint not configured' }, { status: 503 });
  }
  const given = req.headers.get(ADMIN_HEADER) ?? '';
  const a = Buffer.from(given);
  const b = Buffer.from(secret);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  return null;
}

/** The last X-Forwarded-For entry is the one that the Google front end appends. */
export function clientIp(req: Request): string {
  const forwarded = req.headers.get('x-forwarded-for');
  if (!forwarded) return 'unknown';
  const parts = forwarded.split(',').map((p) => p.trim()).filter(Boolean);
  return parts[parts.length - 1] ?? 'unknown';
}

const hits = new Map<string, number[]>();
const MAX_TRACKED_KEYS = 10_000;

/** Return a 429 response when the client sent more than `limit` requests in `windowMs`. */
export function rateLimit(
  req: Request,
  bucket: string,
  limit: number,
  windowMs: number,
  now: number = Date.now()
): NextResponse | null {
  const key = `${bucket}:${clientIp(req)}`;
  const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs);

  if (recent.length >= limit) {
    hits.set(key, recent);
    const retryAfter = Math.max(1, Math.ceil((windowMs - (now - recent[0])) / 1000));
    return NextResponse.json(
      { error: 'Too many requests. Try again later.' },
      { status: 429, headers: { 'Retry-After': String(retryAfter) } }
    );
  }

  recent.push(now);
  hits.set(key, recent);

  if (hits.size > MAX_TRACKED_KEYS) {
    for (const [k, times] of hits) {
      if (times.every((t) => now - t >= windowMs)) hits.delete(k);
    }
  }
  return null;
}

/** Test helper: clear the rate-limit state. */
export function resetRateLimits(): void {
  hits.clear();
}

// One run costs up to about $0.30 at peak prices, so 200 runs a day cap the LLM bill near $60.
export const DEFAULT_DAILY_RUN_LIMIT = 200;
export const DEFAULT_MAX_CONCURRENT_RUNS = 4;

let budgetDay = '';
let runsToday = 0;
let runsInFlight = 0;

function envInt(name: string, fallback: number, min: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw.trim() === '') return fallback;
  const n = Number(raw);
  return Number.isInteger(n) && n >= min ? n : fallback;
}

export type LlmSlot = { ok: true; release: () => void } | { ok: false; response: NextResponse };

/**
 * Take one slot from the shared LLM budget. Call `release` in a `finally` block when the run ends.
 * - LLM_DAILY_RUN_LIMIT: runs in one UTC day for all clients together. 0 stops all runs.
 * - LLM_MAX_CONCURRENT_RUNS: runs in progress at the same time.
 * A failed run also counts, because the provider bills its tokens.
 */
export function acquireLlmSlot(now: number = Date.now()): LlmSlot {
  const day = new Date(now).toISOString().slice(0, 10);
  if (day !== budgetDay) {
    budgetDay = day;
    runsToday = 0;
  }

  if (runsToday >= envInt('LLM_DAILY_RUN_LIMIT', DEFAULT_DAILY_RUN_LIMIT, 0)) {
    const nextDay = Date.parse(`${day}T00:00:00Z`) + 86_400_000;
    return {
      ok: false,
      response: NextResponse.json(
        { error: 'The daily generation limit is reached. Try again tomorrow.' },
        { status: 503, headers: { 'Retry-After': String(Math.ceil((nextDay - now) / 1000)) } }
      ),
    };
  }
  if (runsInFlight >= envInt('LLM_MAX_CONCURRENT_RUNS', DEFAULT_MAX_CONCURRENT_RUNS, 1)) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: 'The service is busy. Try again in a minute.' },
        { status: 503, headers: { 'Retry-After': '30' } }
      ),
    };
  }

  runsToday += 1;
  runsInFlight += 1;
  let released = false;
  return {
    ok: true,
    release: () => {
      if (released) return;
      released = true;
      runsInFlight -= 1;
    },
  };
}

/** Test helper: clear the LLM budget state. */
export function resetLlmBudget(): void {
  budgetDay = '';
  runsToday = 0;
  runsInFlight = 0;
}

export type JsonBody = { ok: true; data: unknown } | { ok: false; response: NextResponse };

/** Read a JSON body with a size cap. A larger body returns 413. Invalid JSON returns 400. */
export async function readJsonBody(req: Request, maxBytes: number): Promise<JsonBody> {
  const declared = Number(req.headers.get('content-length') ?? '0');
  if (declared > maxBytes) {
    return { ok: false, response: NextResponse.json({ error: 'Request too large' }, { status: 413 }) };
  }
  const text = await req.text();
  if (Buffer.byteLength(text) > maxBytes) {
    return { ok: false, response: NextResponse.json({ error: 'Request too large' }, { status: 413 }) };
  }
  try {
    return { ok: true, data: JSON.parse(text) };
  } catch {
    return { ok: false, response: NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) };
  }
}
