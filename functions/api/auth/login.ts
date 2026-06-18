import type { PagesFunction } from '@cloudflare/workers-types';
import { serializeCookie } from '../../lib/cookie';

// Only allow same-origin absolute paths to prevent open redirects.
function validateReturnTo(value: string | null): string {
  if (!value) return '/';
  // Reject anything that isn't a plain absolute path.
  if (!value.startsWith('/') || value.startsWith('//')) return '/';
  // Reject CR/LF to guard against response-splitting attempts.
  if (/[\r\n]/.test(value)) return '/';
  return value;
}

async function generateCodeChallenge(verifier: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(verifier);
  const digest = await crypto.subtle.digest('SHA-256', data);
  const bytes = new Uint8Array(digest);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function generateVerifier(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const clientId = context.env.GITHUB_CLIENT_ID;
  if (!clientId) {
    return new Response(JSON.stringify({ error: 'GITHUB_CLIENT_ID not configured' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const url = new URL(context.request.url);
  const returnTo = validateReturnTo(url.searchParams.get('returnTo'));

  // Generate random state and PKCE verifier
  const stateBytes = crypto.getRandomValues(new Uint8Array(32));
  const state = btoa(String.fromCharCode(...stateBytes));
  const verifier = generateVerifier();
  const challenge = await generateCodeChallenge(verifier);

  const redirectUri = `${url.origin}/api/auth/callback`;

  const stateCookie = serializeCookie('auth_state', state, {
    httpOnly: true,
    secure: true,
    sameSite: 'Lax',
    path: '/',
    maxAge: 600, // 10 minutes
  });

  const verifierCookie = serializeCookie('auth_verifier', verifier, {
    httpOnly: true,
    secure: true,
    sameSite: 'Lax',
    path: '/',
    maxAge: 600,
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
    `&state=${encodeURIComponent(state)}` +
    `&code_challenge=${encodeURIComponent(challenge)}` +
    `&code_challenge_method=S256`;

  const headers = new Headers();
  headers.set('Location', githubUrl);
  headers.append('Set-Cookie', stateCookie);
  headers.append('Set-Cookie', verifierCookie);
  headers.append('Set-Cookie', returnCookie);

  return new Response(null, { status: 302, headers });
};
