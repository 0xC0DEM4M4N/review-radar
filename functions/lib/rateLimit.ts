/**
 * Distributed rate limiting using the Cloudflare Cache API.
 *
 * Cloudflare Workers isolate memory is ephemeral, so in-memory Maps are not
 * reliable across requests. The Cache API provides a durable (per-datacenter)
 * key/value store backed by short-lived synthetic responses.
 */

export interface RateLimitOptions {
  limit: number;
  windowMs: number;
}

function getClientIP(request: Request): string {
  return request.headers.get('CF-Connecting-IP') || 'unknown';
}

function cacheKey(request: Request, prefix: string, identifier: string): string {
  const url = new URL(request.url);
  return `${url.origin}/__ratelimit/${prefix}/${identifier}`;
}

interface RateLimitState {
  count: number;
  resetAt: number;
}

async function getRateLimitState(
  cache: Cache,
  key: string
): Promise<RateLimitState | null> {
  try {
    const res = await cache.match(key);
    if (!res) return null;
    const json = await res.json();
    if (
      typeof json === 'object' &&
      json !== null &&
      typeof json.count === 'number' &&
      typeof json.resetAt === 'number'
    ) {
      return json as RateLimitState;
    }
  } catch {
    // Ignore cache read errors.
  }
  return null;
}

async function setRateLimitState(
  cache: Cache,
  key: string,
  state: RateLimitState
): Promise<void> {
  try {
    const res = new Response(JSON.stringify(state), {
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': `max-age=${Math.ceil((state.resetAt - Date.now()) / 1000)}`,
      },
    });
    await cache.put(key, res);
  } catch {
    // Ignore cache write errors; failing open is preferable to breaking the app.
  }
}

export async function checkRateLimit(
  request: Request,
  prefix: string,
  options: RateLimitOptions
): Promise<{ allowed: boolean; headers?: Record<string, string> }> {
  // Cache API is not available in all environments (e.g. local wrangler pages dev).
  // @ts-ignore - caches may be undefined in some local modes.
  const cache: Cache | undefined = typeof caches !== 'undefined' ? caches.default : undefined;
  if (!cache) {
    return { allowed: true };
  }

  const ip = getClientIP(request);
  const key = cacheKey(request, prefix, ip);
  const now = Date.now();

  const state = await getRateLimitState(cache, key);
  if (!state || now > state.resetAt) {
    await setRateLimitState(cache, key, { count: 1, resetAt: now + options.windowMs });
    return { allowed: true };
  }

  if (state.count >= options.limit) {
    const retryAfter = Math.ceil((state.resetAt - now) / 1000);
    return {
      allowed: false,
      headers: {
        'Retry-After': String(retryAfter),
        'X-RateLimit-Limit': String(options.limit),
        'X-RateLimit-Remaining': '0',
        'X-RateLimit-Reset': String(Math.ceil(state.resetAt / 1000)),
      },
    };
  }

  state.count += 1;
  await setRateLimitState(cache, key, state);
  return {
    allowed: true,
    headers: {
      'X-RateLimit-Limit': String(options.limit),
      'X-RateLimit-Remaining': String(Math.max(0, options.limit - state.count)),
      'X-RateLimit-Reset': String(Math.ceil(state.resetAt / 1000)),
    },
  };
}
