import type { PagesFunction } from '@cloudflare/workers-types';
import { decrypt } from '../../lib/crypto';
import { parseCookies } from '../../lib/cookie';
import { checkRateLimit } from '../../lib/rateLimit';

const COOKIE_NAME = 'rr_session';

const ALLOWED_PATHS = [
  /^repos\/[^/]+\/[^/]+$/,
  /^repos\/[^/]+\/[^/]+\/pulls$/,
  /^repos\/[^/]+\/[^/]+\/pulls\/\d+$/,
  /^repos\/[^/]+\/[^/]+\/pulls\/\d+\/files$/,
  /^repos\/[^/]+\/[^/]+\/pulls\/\d+\/reviews$/,
  /^repos\/[^/]+\/[^/]+\/pulls\/\d+\/comments$/,
  /^repos\/[^/]+\/[^/]+\/commits\/[a-f0-9]+\/check-runs$/,
  /^repos\/[^/]+\/[^/]+\/commits$/,
  /^repos\/[^/]+\/[^/]+\/actions\/runs$/,
  /^repos\/[^/]+\/[^/]+\/actions\/runs\/\d+\/jobs$/,
  /^search\/issues$/,
  /^user$/,
];

function isPathAllowed(path: string): boolean {
  const clean = path.split('?')[0];
  return ALLOWED_PATHS.some((re) => re.test(clean));
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const rateLimit = await checkRateLimit(context.request, 'github-proxy', {
    limit: 1000,
    windowMs: 60 * 1000,
  });
  if (!rateLimit.allowed) {
    return new Response(JSON.stringify({ error: 'Rate limit exceeded' }), {
      status: 429,
      headers: {
        'Content-Type': 'application/json',
        ...rateLimit.headers,
      },
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

  // Forward conditional request headers so we can return 304s for unchanged data.
  const requestHeaders: Record<string, string> = {
    Authorization: `token ${pat}`,
    Accept: 'application/vnd.github.v3+json',
    'User-Agent': 'ReviewRadar',
  };
  const clientIfNoneMatch = context.request.headers.get('If-None-Match');
  if (clientIfNoneMatch) requestHeaders['If-None-Match'] = clientIfNoneMatch;

  try {
    const githubRes = await fetch(githubUrl, {
      method: 'GET',
      headers: requestHeaders,
    });

    if (githubRes.status === 304) {
      return new Response(null, { status: 304 });
    }

    const body = await githubRes.text();

    // If GitHub returned an error, forward its message in our response
    if (!githubRes.ok) {
      let githubError: string;
      try {
        const errJson = JSON.parse(body);
        githubError = errJson.message || body.slice(0, 200);
      } catch {
        githubError = body.slice(0, 200);
      }
      return new Response(JSON.stringify({ error: `GitHub API error ${githubRes.status}: ${githubError}` }), {
        status: githubRes.status,
        headers: { 'Content-Type': 'application/json' },
      });
    }

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

    const responseHeaders: Record<string, string> = {
      'Content-Type': githubRes.headers.get('Content-Type') || 'application/json',
      'X-Content-Type-Options': 'nosniff',
      'Cache-Control': 'private, max-age=60, stale-while-revalidate=300',
    };
    const etag = githubRes.headers.get('ETag');
    if (etag) responseHeaders['ETag'] = etag;

    return new Response(body, {
      status: githubRes.status,
      headers: responseHeaders,
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: 'GitHub request failed' }), {
      status: 502,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
