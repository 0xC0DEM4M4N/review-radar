import type { PagesFunction } from '@cloudflare/workers-types';
import { decrypt } from '../../lib/crypto';

const COOKIE_NAME = 'rr_session';

const ALLOWED_PATHS = [
  /^repos\/[^/]+\/[^/]+\/pulls$/,
  /^repos\/[^/]+\/[^/]+\/pulls\/\d+\/files$/,
  /^repos\/[^/]+\/[^/]+\/pulls\/\d+\/reviews$/,
  /^repos\/[^/]+\/[^/]+\/pulls\/\d+\/comments$/,
  /^repos\/[^/]+\/[^/]+\/commits\/[a-f0-9]+\/check-runs$/,
  /^search\/issues$/,
  /^user$/,
];

const RATE_LIMIT = 1000; // requests per window
const RATE_WINDOW_MS = 60 * 1000; // 1 minute

interface RateRecord {
  count: number;
  resetAt: number;
}

const ipTracker = new Map<string, RateRecord>();

function getClientIP(request: Request): string {
  return request.headers.get('CF-Connecting-IP') || 'unknown';
}

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const record = ipTracker.get(ip);

  if (!record || now > record.resetAt) {
    ipTracker.set(ip, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return true;
  }

  if (record.count >= RATE_LIMIT) {
    return false;
  }

  record.count++;
  return true;
}

function parseCookies(header: string | null): Record<string, string> {
  const cookies: Record<string, string> = {};
  if (!header) return cookies;
  header.split(';').forEach((cookie) => {
    const [name, ...rest] = cookie.trim().split('=');
    if (name) cookies[name] = rest.join('=');
  });
  return cookies;
}

function isPathAllowed(path: string): boolean {
  const clean = path.split('?')[0];
  return ALLOWED_PATHS.some((re) => re.test(clean));
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const clientIP = getClientIP(context.request);
  if (!checkRateLimit(clientIP)) {
    return new Response(JSON.stringify({ error: 'Rate limit exceeded' }), {
      status: 429,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const secret = context.env.SESSION_SECRET;
  if (!secret) {
    return new Response(JSON.stringify({ error: 'SESSION_SECRET not configured' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const cookies = parseCookies(context.request.headers.get('cookie'));
  const session = cookies[COOKIE_NAME];
  if (!session) {
    return new Response(JSON.stringify({ error: 'No session' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  let pat: string;
  try {
    pat = await decrypt(session, secret);
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid session' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const params = context.params.path as string[];
  const path = Array.isArray(params) ? params.join('/') : '';
  const query = new URL(context.request.url).search;

  if (!isPathAllowed(path + query)) {
    return new Response(JSON.stringify({ error: 'Forbidden path' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const githubUrl = `https://api.github.com/${path}${query}`;
  const isOAuthToken = pat.startsWith('gho_') || pat.startsWith('ghu_');

  try {
    const githubRes = await fetch(githubUrl, {
      method: 'GET',
      headers: {
        Authorization: `token ${pat}`,
        Accept: 'application/vnd.github.v3+json',
        'User-Agent': 'ReviewRadar',
      },
    });

    const body = await githubRes.text();

    if (githubRes.status === 404 && isOAuthToken && path.startsWith('repos/')) {
      return new Response(
        JSON.stringify({
          error:
            'Repository not found or not accessible. If this repo is under a GitHub organization, your org may have OAuth App restrictions. Try using a Personal Access Token instead.',
        }),
        {
          status: 404,
          headers: {
            'Content-Type': 'application/json',
            'X-Content-Type-Options': 'nosniff',
          },
        }
      );
    }

    return new Response(body, {
      status: githubRes.status,
      headers: {
        'Content-Type': githubRes.headers.get('Content-Type') || 'application/json',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: 'GitHub request failed' }), {
      status: 502,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
