import type { PagesFunction } from '@cloudflare/workers-types';
import { encrypt, decrypt } from '../lib/crypto';
import { parseCookies, serializeCookie } from '../lib/cookie';

const COOKIE_NAME = 'rr_session';
const PAT_REGEX = /^(ghp_[a-zA-Z0-9]{36}|github_pat_[a-zA-Z0-9_]+)$/;

// Shorter-lived sessions reduce the window of misuse if a cookie is stolen.
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7; // 7 days

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const secret = context.env.SESSION_SECRET;
  if (!secret) {
    return new Response(JSON.stringify({ error: 'SESSION_SECRET not configured' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  let body: { pat?: string };
  try {
    body = await context.request.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const pat = body.pat?.trim() || '';
  if (!pat || !PAT_REGEX.test(pat)) {
    return new Response(JSON.stringify({ error: 'Invalid PAT format' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const encrypted = await encrypt(pat, secret);
    const cookie = serializeCookie(COOKIE_NAME, encrypted, {
      httpOnly: true,
      secure: true,
      sameSite: 'Strict',
      path: '/',
      maxAge: SESSION_MAX_AGE_SECONDS,
    });

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Set-Cookie': cookie,
      },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: 'Encryption failed' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const secret = context.env.SESSION_SECRET;
  if (!secret) {
    return new Response(JSON.stringify({ active: false }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const cookies = parseCookies(context.request.headers.get('cookie'));
  const session = cookies[COOKIE_NAME];
  if (!session) {
    return new Response(JSON.stringify({ active: false }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  let pat: string;
  try {
    pat = await decrypt(session, secret);
  } catch {
    return new Response(JSON.stringify({ active: false }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Verify the token is still valid with GitHub.
  try {
    const userRes = await fetch('https://api.github.com/user', {
      headers: {
        Authorization: `token ${pat}`,
        Accept: 'application/vnd.github.v3+json',
        'User-Agent': 'ReviewRadar',
      },
    });
    if (!userRes.ok) {
      return new Response(JSON.stringify({ active: false }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    const userData = (await userRes.json()) as { login?: string };
    return new Response(JSON.stringify({ active: true, user: userData.login || null }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch {
    return new Response(JSON.stringify({ active: false }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};

export const onRequestDelete: PagesFunction<Env> = async () => {
  const cookie = serializeCookie(COOKIE_NAME, '', {
    httpOnly: true,
    secure: true,
    sameSite: 'Strict',
    path: '/',
    maxAge: 0,
  });

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Set-Cookie': cookie,
    },
  });
};
