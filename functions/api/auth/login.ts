import type { PagesFunction } from '@cloudflare/workers-types';
import { serializeCookie } from '../../lib/cookie';

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const clientId = context.env.GITHUB_CLIENT_ID;
  if (!clientId) {
    return new Response(JSON.stringify({ error: 'GITHUB_CLIENT_ID not configured' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const url = new URL(context.request.url);
  const returnTo = url.searchParams.get('returnTo') || '/';

  // Generate random state
  const stateBytes = crypto.getRandomValues(new Uint8Array(32));
  const state = btoa(String.fromCharCode(...stateBytes));

  const redirectUri = `${url.origin}/api/auth/callback`;

  const stateCookie = serializeCookie('auth_state', state, {
    httpOnly: true,
    secure: true,
    sameSite: 'Lax',
    path: '/',
    maxAge: 600, // 10 minutes
  });

  const returnCookie = serializeCookie('auth_return', returnTo, {
    httpOnly: true,
    secure: true,
    sameSite: 'Lax',
    path: '/',
    maxAge: 600,
  });

  const githubUrl =
    `https://github.com/login/oauth/authorize` +
    `?client_id=${encodeURIComponent(clientId)}` +
    `&redirect_uri=${encodeURIComponent(redirectUri)}` +
    `&scope=${encodeURIComponent('repo read:user')}` +
    `&state=${encodeURIComponent(state)}`;

  const headers = new Headers();
  headers.set('Location', githubUrl);
  headers.append('Set-Cookie', stateCookie);
  headers.append('Set-Cookie', returnCookie);

  return new Response(null, { status: 302, headers });
};
