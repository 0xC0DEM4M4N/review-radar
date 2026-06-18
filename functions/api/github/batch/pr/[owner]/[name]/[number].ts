import type { PagesFunction } from '@cloudflare/workers-types';
import { decrypt } from '../../../../../../lib/crypto';
import { parseCookies } from '../../../../../../lib/cookie';
import { checkRateLimit } from '../../../../../../lib/rateLimit';

const COOKIE_NAME = 'rr_session';

async function fetchWithTimeout(url: string, opts: Record<string, any>, ms: number): Promise<Response | null> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), ms);
  try {
    const res = await fetch(url, { ...opts, signal: controller.signal });
    return res;
  } catch {
    return null;
  } finally {
    clearTimeout(id);
  }
}

async function fetchAllPages(baseUrl: string, headers: Record<string, string>, maxPages = 5): Promise<any[]> {
  // Fetch all pages in parallel to minimise latency for PRs with many changed files.
  const urls = Array.from({ length: maxPages }, (_, i) => {
    const page = i + 1;
    return `${baseUrl}${baseUrl.includes('?') ? '&' : '?'}per_page=100&page=${page}`;
  });

  const responses = await Promise.all(
    urls.map((url) => fetchWithTimeout(url, { headers }, 8000))
  );

  const all: any[] = [];
  for (const res of responses) {
    if (!res || !res.ok) break;
    const data = await res.json();
    if (!Array.isArray(data) || data.length === 0) break;
    all.push(...data);
    if (data.length < 100) break;
  }
  return all;
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const rateLimit = await checkRateLimit(context.request, 'github-batch', {
    limit: 500,
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

  const { owner, name, number } = context.params as { owner: string; name: string; number: string };

  // Validate path parameters before building URLs to prevent injection/SSRF.
  const OWNER_REGEX = /^[a-zA-Z0-9](?:[a-zA-Z0-9_.-]{0,37}[a-zA-Z0-9])?$/;
  const NAME_REGEX = /^[a-zA-Z0-9_.-]{1,100}$/;
  const NUMBER_REGEX = /^[1-9][0-9]*$/;
  if (!OWNER_REGEX.test(owner) || !NAME_REGEX.test(name) || !NUMBER_REGEX.test(number)) {
    return new Response(JSON.stringify({ error: 'Invalid repository or PR identifier' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const url = new URL(context.request.url);
  const sha = url.searchParams.get('sha');
  if (sha && !/^[a-f0-9]{7,40}$/i.test(sha)) {
    return new Response(JSON.stringify({ error: 'Invalid commit SHA' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const ghHeaders: Record<string, string> = {
    Authorization: `token ${pat}`,
    Accept: 'application/vnd.github.v3+json',
    'User-Agent': 'ReviewRadar',
  };

  const repoBase = `https://api.github.com/repos/${owner}/${name}`;
  const prBase = `${repoBase}/pulls/${number}`;

  const fetchers: Promise<[string, any]>[] = [
    fetchWithTimeout(`${prBase}/reviews`, { headers: ghHeaders }, 8000)
      .then(async (r) => {
        if (!r || !r.ok) return ['reviews', []];
        return ['reviews', await r.json()];
      })
      .catch(() => ['reviews', []] as [string, any]),

    fetchWithTimeout(`${prBase}/comments`, { headers: ghHeaders }, 8000)
      .then(async (r) => {
        if (!r || !r.ok) return ['comments', []];
        return ['comments', await r.json()];
      })
      .catch(() => ['comments', []] as [string, any]),

    fetchAllPages(`${prBase}/files`, ghHeaders)
      .then((files) => ['files', files] as [string, any])
      .catch(() => ['files', []] as [string, any]),

    sha
      ? fetchWithTimeout(`${repoBase}/commits/${sha}/check-runs`, { headers: ghHeaders }, 8000)
          .then(async (r) => {
            if (!r || !r.ok) return ['checks', null];
            return ['checks', await r.json()];
          })
          .catch(() => ['checks', null] as [string, any])
      : Promise.resolve(['checks', null] as [string, any]),
  ];

  const results = await Promise.all(fetchers);
  const data: Record<string, any> = {};
  for (const [key, value] of results) {
    data[key] = value;
  }

  return new Response(JSON.stringify(data), {
    headers: { 'Content-Type': 'application/json' },
  });
};
