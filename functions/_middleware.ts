import type { PagesFunction } from '@cloudflare/workers-types';

export const onRequest: PagesFunction = async (context) => {
  const response = await context.next();

  // Add security headers to all responses.
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), interest-cohort=()');

  // HSTS is safe once HTTPS is confirmed (Cloudflare Pages is HTTPS-only).
  response.headers.set('Strict-Transport-Security', 'max-age=63072000; includeSubDomains; preload');

  // Baseline CSP. For static HTML, the post-build script in scripts/generate-csp-hashes.cjs
  // writes a stricter policy with per-build inline-script hashes to dist/_headers.
  const csp =
    "default-src 'self'; " +
    "script-src 'self' 'unsafe-inline' https://static.cloudflareinsights.com; " +
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; " +
    "connect-src 'self' https://api.github.com https://cloudflareinsights.com; " +
    "img-src 'self' https: data:; " +
    "font-src 'self' https://fonts.gstatic.com; " +
    "frame-ancestors 'none'; " +
    "base-uri 'self';";
  response.headers.set('Content-Security-Policy', csp);

  return response;
};
