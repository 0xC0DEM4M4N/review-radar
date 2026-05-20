const API_BASE = '';

export async function saveSession(pat: string): Promise<void> {
  const res = await fetch(`${API_BASE}/api/session`, {
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

export async function checkSession(): Promise<boolean> {
  const res = await fetch(`${API_BASE}/api/session`, {
    method: 'GET',
    credentials: 'include',
  });
  if (!res.ok) return false;
  const data = await res.json().catch(() => ({ active: false }));
  return !!data.active;
}

export async function clearSession(): Promise<void> {
  await fetch(`${API_BASE}/api/session`, {
    method: 'DELETE',
    credentials: 'include',
  });
}

export async function proxyGitHub(path: string): Promise<any> {
  const res = await fetch(`${API_BASE}/api/github/${path}`, {
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
