const API_BASE = '';

const MAX_RETRIES = 3;
const INITIAL_RETRY_DELAY_MS = 1000;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRetryableStatus(status: number): boolean {
  return status === 429 || status === 502 || status === 503 || status === 504;
}

async function fetchWithRetry(
  url: string,
  init: RequestInit,
  options: { maxRetries?: number; initialDelayMs?: number } = {}
): Promise<Response> {
  const maxRetries = options.maxRetries ?? MAX_RETRIES;
  const initialDelayMs = options.initialDelayMs ?? INITIAL_RETRY_DELAY_MS;

  let lastError: Error | null = null;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const res = await fetch(url, init);
      if (!res.ok && isRetryableStatus(res.status) && attempt < maxRetries) {
        const retryAfter = res.headers.get('Retry-After');
        const delayMs = retryAfter
          ? Math.max(parseInt(retryAfter, 10) * 1000, initialDelayMs)
          : initialDelayMs * 2 ** attempt;
        await sleep(delayMs);
        continue;
      }
      return res;
    } catch (e) {
      lastError = e instanceof Error ? e : new Error(String(e));
      if (attempt < maxRetries) {
        const delayMs = initialDelayMs * 2 ** attempt;
        await sleep(delayMs);
      }
    }
  }
  throw lastError || new Error(`Request failed after ${maxRetries} retries: ${url}`);
}

export async function saveSession(pat: string): Promise<void> {
  const res = await fetchWithRetry(`${API_BASE}/api/session`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ pat }),
    credentials: 'include',
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || `Session save failed: ${res.status}`);
  }
}

export async function checkSession(): Promise<{ active: boolean; user: string | null }> {
  const res = await fetchWithRetry(`${API_BASE}/api/session`, {
    method: 'GET',
    credentials: 'include',
  });
  if (!res.ok) return { active: false, user: null };
  const data = await res.json().catch(() => ({ active: false, user: null }));
  return { active: !!data.active, user: data.user || null };
}

export async function clearSession(): Promise<void> {
  await fetchWithRetry(`${API_BASE}/api/session`, {
    method: 'DELETE',
    credentials: 'include',
  });
}

export async function proxyGitHub(path: string): Promise<any> {
  const res = await fetchWithRetry(`${API_BASE}/api/github/${path}`, {
    method: 'GET',
    credentials: 'include',
    headers: { Accept: 'application/json' },
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    if (res.status === 401) throw new Error('Unauthorized — please log in with GitHub or set a PAT in Settings.');
    throw new Error(data.error || `GitHub proxy error: ${res.status}`);
  }
  return res.json();
}
