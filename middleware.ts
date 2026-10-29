import { NextRequest, NextResponse } from 'next/server';

// Known crawlers, AI scrapers, SEO bots and script HTTP clients.
const BOT_UA =
  /bot\b|crawl|spider|scrape|slurp|gptbot|chatgpt|oai-searchbot|claudebot|claude-web|anthropic|ccbot|perplexity|bytespider|amazonbot|applebot|meta-external|facebookexternalhit|petalbot|semrush|ahrefs|mj12|dotbot|dataforseo|barkrowler|python-requests|python-urllib|aiohttp|httpx|go-http-client|libwww|curl\/|wget\/|okhttp|java\/|scrapy|phantomjs|selenium|puppeteer|httrack|nikto|sqlmap|masscan|zgrab|nmap/i;

// Allow platform health checks.
const ALLOWED_UA = /googlehc|google-cloud|kube-probe/i;

const WINDOW_MS = 60_000;
const PAGE_LIMIT = 120;
const API_LIMIT = 30;
const hits = new Map<string, { count: number; reset: number }>();

function clientIp(req: NextRequest): string {
  // The last entry is the one the Google front end appends. The first entry is client-controlled.
  const parts = (req.headers.get('x-forwarded-for') ?? '').split(',').map((p) => p.trim()).filter(Boolean);
  return parts[parts.length - 1] || req.headers.get('x-real-ip') || 'unknown';
}

// Best-effort per-instance limiter. Cloud Armor is the durable layer.
function rateLimited(key: string, limit: number): boolean {
  const now = Date.now();
  const entry = hits.get(key);
  if (!entry || entry.reset < now) {
    if (hits.size > 10_000) {
      for (const [k, v] of hits) if (v.reset < now) hits.delete(k);
    }
    hits.set(key, { count: 1, reset: now + WINDOW_MS });
    return false;
  }
  entry.count += 1;
  return entry.count > limit;
}

function deny(status: number, message: string, extra?: Record<string, string>) {
  return new NextResponse(message, {
    status,
    headers: { 'X-Robots-Tag': 'noindex, nofollow', 'Cache-Control': 'no-store', ...extra },
  });
}

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const ua = req.headers.get('user-agent') ?? '';

  if (pathname !== '/robots.txt' && !ALLOWED_UA.test(ua)) {
    if (!ua || BOT_UA.test(ua)) return deny(403, 'Forbidden');
  }

  const isApi = pathname.startsWith('/api/');
  if (process.env.NODE_ENV === 'production') {
    const limit = isApi ? API_LIMIT : PAGE_LIMIT;
    if (rateLimited(`${isApi ? 'api' : 'page'}:${clientIp(req)}`, limit)) {
      return deny(429, 'Too Many Requests', { 'Retry-After': '60' });
    }
  }

  // Block cross-site state-changing API calls.
  if (isApi && req.method !== 'GET' && req.method !== 'HEAD') {
    const origin = req.headers.get('origin');
    let originHost: string | null = null;
    try {
      originHost = origin ? new URL(origin).host : null;
    } catch {
      return deny(403, 'Forbidden');
    }
    if (originHost && originHost !== req.nextUrl.host) {
      return deny(403, 'Forbidden');
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
