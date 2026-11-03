import type { NextConfig } from 'next';

const isProd = process.env.NODE_ENV === 'production';

// The Next dev runtime needs 'unsafe-eval' and a websocket. Production does not.
const devScript = isProd ? '' : " 'unsafe-eval'";
const devConnect = isProd ? '' : ' ws: wss:';

const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${devScript}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  `connect-src 'self'${devConnect}`,
  "frame-src 'self'",
  "worker-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join('; ');

// /sandbox runs generated code in an opaque-origin iframe (see components/DynamicCanvasRenderer.tsx).
// Babel and the compiled component need 'unsafe-eval'. Block every network path out of the frame.
const sandboxCsp = [
  "default-src 'none'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  `connect-src ${isProd ? "'none'" : "'self' ws: wss:"}`,
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'none'",
  "frame-ancestors 'self'",
].join('; ');

const securityHeaders = [
  { key: 'X-Robots-Tag', value: 'noindex, nofollow, noarchive, nosnippet, noimageindex, noai, noimageai' },
  { key: 'Content-Security-Policy', value: csp },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=()' },
  { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
];

const nextConfig: NextConfig = {
  output: 'standalone',
  poweredByHeader: false,
  async rewrites() {
    // Browsers and crawlers request /favicon.ico directly. Serve the app icon.
    return [{ source: '/favicon.ico', destination: '/icon.svg' }];
  },
  async headers() {
    return [
      { source: '/:path*', headers: securityHeaders },
      // The last match wins for a repeated key. These override the global CSP and frame headers.
      {
        source: '/sandbox',
        headers: [
          { key: 'Content-Security-Policy', value: sandboxCsp },
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
        ],
      },
    ];
  },
};

export default nextConfig;
