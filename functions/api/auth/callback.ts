import type { PagesFunction } from '@cloudflare/workers-types';
import { encrypt } from '../../lib/crypto';
import { parseCookies, serializeCookie } from '../../lib/cookie';

const COOKIE_NAME = 'rr_session';

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const secret = context.env.SESSION_SECRET;
  const clientId = context.env.GITHUB_CLIENT_ID;
  const clientSecret = context.env.GITHUB_CLIENT_SECRET;

  if (!secret || !clientId || !clientSecret) {
    return new Response(JSON.stringify({ error: 'OAuth not fully configured' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const url = new URL(context.request.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const error = url.searchParams.get('error');

  if (error) {
    return new Response(JSON.stringify({ error: `GitHub OAuth error: ${error}` }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  if (!code || !state) {
    return new Response(JSON.stringify({ error: 'Missing code or state' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Validate state
  const cookies = parseCookies(context.request.headers.get('cookie'));
  const expectedState = cookies['auth_state'];
  if (!expectedState || state !== expectedState) {
    return new Response(JSON.stringify({ error: 'Invalid state' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Exchange code for token
  let accessToken: string;
  try {
    const tokenRes = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        code,
      }),
    });

    const tokenData = (await tokenRes.json()) as { access_token?: string; error?: string };
    if (tokenData.error || !tokenData.access_token) {
      return new Response(JSON.stringify({ error: tokenData.error || 'Failed to exchange code for token' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    accessToken = tokenData.access_token;
  } catch (e) {
    return new Response(JSON.stringify({ error: 'Token exchange failed' }), {
      status: 502,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Encrypt and store token
  let encrypted: string;
  try {
    encrypted = await encrypt(accessToken, secret);
  } catch {
    return new Response(JSON.stringify({ error: 'Encryption failed' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const sessionCookie = serializeCookie(COOKIE_NAME, encrypted, {
    httpOnly: true,
    secure: true,
    sameSite: 'Strict',
    path: '/',
    maxAge: 60 * 60 * 24 * 30, // 30 days
  });

  const clearState = serializeCookie('auth_state', '', {
    httpOnly: true,
    secure: true,
    sameSite: 'Strict',
    path: '/',
    maxAge: 0,
  });

  const clearReturn = serializeCookie('auth_return', '', {
    httpOnly: true,
    secure: true,
    sameSite: 'Strict',
    path: '/',
    maxAge: 0,
  });

  const returnTo = cookies['auth_return'] || '/';

  const headers = new Headers();
  headers.set('Location', returnTo);
  headers.append('Set-Cookie', sessionCookie);
  headers.append('Set-Cookie', clearState);
  headers.append('Set-Cookie', clearReturn);

  return new Response(null, { status: 302, headers });
};
