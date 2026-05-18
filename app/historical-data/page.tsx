'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import Layout from '@/components/Layout';
import LoadingIllustration from '@/components/LoadingIllustration';

const SIZE_COLORS: Record<string, string> = {
  Small: '#22c55e',
  Medium: '#22d3ee',
  Large: '#f59e0b',
  Enormous: '#ef4444',
};

interface PRData {
  id: number;
  title: string;
  html_url: string;
  created_at: string;
  closed_at: string | null;
  merged_at: string | null;
  merged?: boolean;
  state: string;
  user?: { login: string };
  repository_url?: string;
  url?: string;
  number?: number;
}

interface Review {
  id: number;
  user?: { login: string };
  submitted_at?: string;
  state: string;
}

interface PRFile {
  additions: number;
  deletions: number;
}

interface UserStats {
  opened: number;
  closed: number;
  merged: number;
  reviews: number;
}

interface PRSizeDetail {
  title: string;
  author: string;
  files: number;
  lines: number;
  category: string;
  state: string;
  url: string;
}

function formatDate(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function parseDateInput(val: string): Date | null {
  if (!val) return null;
  const d = new Date(val);
  d.setHours(0, 0, 0, 0);
  return d;
}

function inRange(dateStr: string | null | undefined, range: { allTime: boolean; start?: Date | null; end?: Date | null }): boolean {
  if (range.allTime) return true;
  if (!dateStr) return false;
  const d = new Date(dateStr);
  if (range.start && d < range.start) return false;
  if (range.end && d > range.end) return false;
  return true;
}

async function ghFetch(url: string, pat: string): Promise<any> {
  const res = await fetch(url, {
    headers: {
      Authorization: `token ${pat}`,
      Accept: 'application/vnd.github.v3+json',
    },
  });
  if (!res.ok) throw new Error(`GitHub ${res.status}: ${url}`);
  return res.json();
}

async function fetchRepoPRsAll(repo: string, pat: string): Promise<PRData[]> {
  const prs: PRData[] = [];
  for (let page = 1; page <= 10; page++) {
    try {
      const data = await ghFetch(
        `https://api.github.com/repos/${repo}/pulls?state=all&per_page=100&page=${page}&sort=updated&direction=desc`,
        pat
      );
      if (!Array.isArray(data) || data.length === 0) break;
      prs.push(...data);
      if (data.length < 100) break;
    } catch (e) {
      console.warn('Repo fetch error', repo, (e as Error).message);
      break;
    }
  }
  return prs;
}

async function fetchReviews(pr: PRData, pat: string): Promise<Review[]> {
  try {
    const repoMatch = (pr.repository_url || pr.url || '').match(/repos\/([^/]+\/[^/]+)/);
    if (!repoMatch || !pr.number) return [];
    const data = await ghFetch(
      `https://api.github.com/repos/${repoMatch[1]}/pulls/${pr.number}/reviews`,
      pat
    );
    return Array.isArray(data) ? data : [];
  } catch (e) {
    return [];
  }
}

async function fetchPRFiles(pr: PRData, pat: string): Promise<PRFile[]> {
  try {
    const repoMatch = (pr.repository_url || pr.url || '').match(/repos\/([^/]+\/[^/]+)/);
    if (!repoMatch || !pr.number) return [];
    const files: PRFile[] = [];
    for (let page = 1; page <= 3; page++) {
      const data = await ghFetch(
        `https://api.github.com/repos/${repoMatch[1]}/pulls/${pr.number}/files?per_page=100&page=${page}`,
        pat
      );
      if (!Array.isArray(data) || data.length === 0) break;
      files.push(...data);
      if (data.length < 100) break;
    }
    return files;
  } catch (e) {
    return [];
  }
}

async function fetchBatch<T>(items: PRData[], fetchFn: (pr: PRData) => Promise<T>, statusFn?: (done: number, total: number) => void): Promise<T[]> {
  const results: T[] = [];
  const batchSize = 10;
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    const batchResults = await Promise.all(batch.map((item) => fetchFn(item)));
    results.push(...batchResults);
    if (statusFn) statusFn(Math.min(i + batchSize, items.length), items.length);
    if (i + batchSize < items.length) {
      await new Promise((r) => setTimeout(r, 200));
    }
  }
  return results;
}

export default function HistoricalDataPage() {
  const [dateFrom, setDateFrom] = useState<string>('');
  const [dateTo, setDateTo] = useState<string>('');
  const [allTime, setAllTime] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const [statusMsg, setStatusMsg] = useState<string>('');
  const [isError, setIsError] = useState<boolean>(false);
  const [hasData, setHasData] = useState<boolean>(false);
  const [showGrid, setShowGrid] = useState<boolean>(false);

  const [openedCount, setOpenedCount] = useState<number>(0);
  const [closedCount, setClosedCount] = useState<number>(0);
  const [mergedCount, setMergedCount] = useState<number>(0);
  const [reviewsCount, setReviewsCount] = useState<number>(0);
  const [userStats, setUserStats] = useState<[string, UserStats][]>([]);
  const [sizeCategories, setSizeCategories] = useState<Record<string, number>>({ Small: 0, Medium: 0, Large: 0, Enormous: 0 });
  const [sizeDetails, setSizeDetails] = useState<PRSizeDetail[]>([]);
  const [subtitle, setSubtitle] = useState<string>('Pull request activity over time');

  const [noPat, setNoPat] = useState<boolean>(false);
  const [noRepos, setNoRepos] = useState<boolean>(false);
  const [noData, setNoData] = useState<boolean>(false);

  useEffect(() => {
    const now = new Date();
    const firstDay = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastDay = new Date(now.getFullYear(), now.getMonth(), 0);
    setDateFrom(formatDate(firstDay));
    setDateTo(formatDate(lastDay));
  }, []);

  const getStoredPat = useCallback((): string => {
    return localStorage.getItem('github-pat') || '';
  }, []);

  const getStoredRepos = useCallback((): string[] => {
    try {
      const v = localStorage.getItem('github-repos');
      return v ? JSON.parse(v) : [];
    } catch (e) {
      return [];
    }
  }, []);

  const getSelectedRepos = useCallback((): string[] => {
    try {
      const v = localStorage.getItem('selected-repos');
      return v ? JSON.parse(v) : [];
    } catch (e) {
      return [];
    }
  }, []);

  const loadHistoricalData = useCallback(async () => {
    setLoading(true);
    setStatusMsg('');
    setIsError(false);
    setShowGrid(false);
    setNoData(false);
    setNoPat(false);
    setNoRepos(false);

    const pat = getStoredPat();
    const repos = getSelectedRepos().length > 0 ? getSelectedRepos() : getStoredRepos();

    const start = allTime ? null : parseDateInput(dateFrom);
    const end = allTime ? null : parseDateInput(dateTo);
    if (end) end.setHours(23, 59, 59, 999);
    const range = { allTime, start, end };

    if (!pat) {
      setLoading(false);
      setNoPat(true);
      setNoRepos(false);
      setNoData(false);
      return;
    }

    if (repos.length === 0) {
      setLoading(false);
      setNoRepos(true);
      setNoPat(false);
      setNoData(false);
      return;
    }

    try {
      setStatusMsg(`Fetching PRs from ${repos.length} repo${repos.length !== 1 ? 's' : ''}…`);
      let allPRs: PRData[] = [];
      for (const repo of repos) {
        const repoPRs = await fetchRepoPRsAll(repo, pat);
        allPRs.push(...repoPRs);
      }

      if (allPRs.length === 0) {
        setStatusMsg('No PRs found');
        setLoading(false);
        setNoData(true);
        return;
      }

      setStatusMsg(`Fetching reviews for ${allPRs.length} PRs…`);
      const reviewsList = await fetchBatch(allPRs, (pr) => fetchReviews(pr, pat), (done, total) => {
        setStatusMsg(`Fetched reviews ${done} / ${total}…`);
      });
      const reviewsMap: Record<number, Review[]> = {};
      allPRs.forEach((pr, i) => {
        reviewsMap[pr.id] = reviewsList[i] || [];
      });

      setStatusMsg(`Fetching file sizes for ${allPRs.length} PRs…`);
      const filesList = await fetchBatch(allPRs, (pr) => fetchPRFiles(pr, pat), (done, total) => {
        setStatusMsg(`Fetched files ${done} / ${total}…`);
      });
      const filesMap: Record<number, PRFile[]> = {};
      allPRs.forEach((pr, i) => {
        filesMap[pr.id] = filesList[i] || [];
      });

      setStatusMsg('');
      setLoading(false);
      showData(allPRs, reviewsMap, filesMap, range);
    } catch (e: any) {
      console.error('Load error:', e);
      setStatusMsg('Error: ' + e.message);
      setIsError(true);
      setLoading(false);
      setNoData(true);
    }
  }, [allTime, dateFrom, dateTo, getStoredPat, getStoredRepos, getSelectedRepos]);

  const showData = useCallback((prs: PRData[], reviewsMap: Record<number, Review[]>, filesMap: Record<number, PRFile[]>, range: { allTime: boolean; start?: Date | null; end?: Date | null }) => {
    setNoData(false);
    setNoPat(false);
    setNoRepos(false);
    setShowGrid(true);
    setHasData(true);

    const opened = prs.filter((p) => inRange(p.created_at, range));
    const closed = prs.filter((p) => p.closed_at && inRange(p.closed_at, range));
    const merged = prs.filter((p) => p.merged_at && inRange(p.merged_at, range));

    let totalReviews = 0;
    const reviewsByPerson: Record<string, number> = {};
    Object.values(reviewsMap).forEach((reviews) => {
      reviews.forEach((r) => {
        if (inRange(r.submitted_at, range)) {
          totalReviews++;
          const name = r.user?.login || 'unknown';
          reviewsByPerson[name] = (reviewsByPerson[name] || 0) + 1;
        }
      });
    });

    setOpenedCount(opened.length);
    setClosedCount(closed.length);
    setMergedCount(merged.length);
    setReviewsCount(totalReviews);

    const users: Record<string, UserStats> = {};
    opened.forEach((p) => {
      const name = p.user?.login || 'unknown';
      if (!users[name]) users[name] = { opened: 0, closed: 0, merged: 0, reviews: 0 };
      users[name].opened++;
    });
    closed.forEach((p) => {
      const name = p.user?.login || 'unknown';
      if (!users[name]) users[name] = { opened: 0, closed: 0, merged: 0, reviews: 0 };
      users[name].closed++;
    });
    merged.forEach((p) => {
      const name = p.user?.login || 'unknown';
      if (!users[name]) users[name] = { opened: 0, closed: 0, merged: 0, reviews: 0 };
      users[name].merged++;
    });
    Object.entries(reviewsByPerson).forEach(([name, count]) => {
      if (!users[name]) users[name] = { opened: 0, closed: 0, merged: 0, reviews: 0 };
      users[name].reviews = count;
    });

    const sortedUsers = Object.entries(users).sort((a, b) => {
      const scoreA = a[1].opened + a[1].reviews;
      const scoreB = b[1].opened + b[1].reviews;
      return scoreB - scoreA;
    });
    setUserStats(sortedUsers);

    const sizeCats: Record<string, number> = { Small: 0, Medium: 0, Large: 0, Enormous: 0 };
    const prSizeDetails: PRSizeDetail[] = [];

    opened.forEach((pr) => {
      const files = filesMap[pr.id] || [];
      const fileCount = files.length;
      const lineCount = files.reduce((sum, f) => sum + (f.additions || 0) + (f.deletions || 0), 0);

      let category: string;
      if (lineCount <= 50) category = 'Small';
      else if (lineCount <= 250) category = 'Medium';
      else if (lineCount <= 1000) category = 'Large';
      else category = 'Enormous';

      sizeCats[category]++;
      prSizeDetails.push({
        title: pr.title || 'Untitled',
        author: pr.user?.login || 'unknown',
        files: fileCount,
        lines: lineCount,
        category,
        state: pr.merged ? 'Merged' : pr.state === 'closed' ? 'Closed' : 'Open',
        url: pr.html_url || '#',
      });
    });

    setSizeCategories(sizeCats);
    setSizeDetails(prSizeDetails.sort((a, b) => b.lines - a.lines));

    const repoNames = [...new Set(
      prs
        .map((p) => {
          const m = (p.repository_url || '').match(/repos\/([^/]+\/[^/]+)/);
          return m ? m[1] : null;
        })
        .filter(Boolean)
    )] as string[];
    const rangeLabel = range.allTime ? 'all time' : `${formatDate(range.start!)} – ${formatDate(range.end!)}`;
    const repoLabel = repoNames.join(', ');
    setSubtitle(`${opened.length} PRs opened · ${rangeLabel} · ${repoLabel.slice(0, 60)}${repoLabel.length > 60 ? '…' : ''}`);
  }, []);

  const totalSized = useMemo(() => Object.values(sizeCategories).reduce((a, b) => a + b, 0), [sizeCategories]);
  const sizeEntries = useMemo(() => Object.entries(sizeCategories).filter(([, v]) => v > 0), [sizeCategories]);
  const maxSizeCount = useMemo(() => Math.max(...Object.values(sizeCategories)), [sizeCategories]);

  return (
    <Layout>
      {/* Header */}
      <div className="rr-header-row">
        <div className="rr-radar-bg" style={{ background: 'var(--ink-light)' }}>
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="var(--cyan)" strokeWidth="1.5">
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 16 14" />
          </svg>
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h1 className="rr-header-title">Historical Data</h1>
          <p className="rr-header-sub">{subtitle}</p>
        </div>
        <div className="rr-header-actions">
          <button onClick={loadHistoricalData} disabled={loading} className="rr-btn-primary">
            {!loading ? (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.3" />
              </svg>
            ) : (
              <span className="loading" />
            )}
            Load Data
          </button>
        </div>
      </div>

      {/* Date Filter Bar */}
      <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-end', marginBottom: '16px', flexWrap: 'wrap' }}>
        <div>
          <label style={{ display: 'block', fontFamily: "'Space Mono',monospace", fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--muted)', marginBottom: '6px' }}>
            From
          </label>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            disabled={allTime}
            className="rounded-lg border border-border-subtle bg-ink-light px-3 py-2 font-space-mono text-[13px] text-text-primary focus:border-cyan focus:outline-none"
            style={{ colorScheme: 'dark' }}
          />
        </div>
        <div>
          <label style={{ display: 'block', fontFamily: "'Space Mono',monospace", fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--muted)', marginBottom: '6px' }}>
            To
          </label>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            disabled={allTime}
            className="rounded-lg border border-border-subtle bg-ink-light px-3 py-2 font-space-mono text-[13px] text-text-primary focus:border-cyan focus:outline-none"
            style={{ colorScheme: 'dark' }}
          />
        </div>
        <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontFamily: "'Space Mono',monospace", fontSize: '12px', color: 'var(--muted)', cursor: 'pointer', paddingBottom: '2px' }}>
          <input type="checkbox" checked={allTime} onChange={(e) => setAllTime(e.target.checked)} className="accent-cyan" />
          All time
        </label>
      </div>

      {/* Status bar */}
      {statusMsg && (
        <div
          style={{
            display: 'block',
            fontFamily: "'Space Mono',monospace",
            fontSize: '12px',
            color: isError ? 'var(--red)' : 'var(--muted)',
            marginBottom: '12px',
            padding: '8px 12px',
            borderRadius: '6px',
            background: 'rgba(255,255,255,0.03)',
            border: '0.5px solid var(--border-faint)',
          }}
        >
          {statusMsg}
        </div>
      )}

      {/* No data / no PAT / no repos states */}
      {noData && !noPat && !noRepos && (
        <div style={{ textAlign: 'center', padding: '80px 32px' }}>
          <div style={{ width: '56px', height: '56px', borderRadius: '50%', background: 'var(--cyan-dim)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
            <svg style={{ color: 'var(--cyan)' }} width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
          </div>
          <p style={{ fontFamily: "'Space Mono',monospace", fontSize: '14px', color: 'var(--text-primary)', marginBottom: '8px' }}>No data found</p>
          <p style={{ fontSize: '13px', color: 'var(--muted)' }}>Select a date range and click Load Data to fetch historical PR data.</p>
        </div>
      )}

      {noPat && (
        <div style={{ textAlign: 'center', padding: '80px 32px' }}>
          <div style={{ width: '56px', height: '56px', borderRadius: '50%', background: 'rgba(245,158,11,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
            <svg style={{ color: 'var(--amber)' }} width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
          </div>
          <p style={{ fontFamily: "'Space Mono',monospace", fontSize: '14px', color: 'var(--text-primary)', marginBottom: '8px' }}>No GitHub token configured</p>
          <p style={{ fontSize: '13px', color: 'var(--muted)', marginBottom: '20px' }}>Add your Personal Access Token in Settings to fetch live data.</p>
          <a href="/settings" className="rr-btn-primary" style={{ textDecoration: 'none' }}>
            Go to Settings
          </a>
        </div>
      )}

      {noRepos && (
        <div style={{ textAlign: 'center', padding: '80px 32px' }}>
          <div style={{ width: '56px', height: '56px', borderRadius: '50%', background: 'var(--cyan-dim)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
            <svg style={{ color: 'var(--cyan)' }} width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4" />
            </svg>
          </div>
          <p style={{ fontFamily: "'Space Mono',monospace", fontSize: '14px', color: 'var(--text-primary)', marginBottom: '8px' }}>No repositories selected</p>
          <p style={{ fontSize: '13px', color: 'var(--muted)', marginBottom: '20px' }}>Add repositories in Settings to start tracking pull requests.</p>
          <a href="/settings" className="rr-btn-primary" style={{ textDecoration: 'none' }}>
            Add Repositories →
          </a>
        </div>
      )}

      {/* Typing Loader */}
      {loading && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '80px 32px', flexDirection: 'column' }}>
          <LoadingIllustration width={240} height={160} />
          <p style={{ fontFamily: "'Space Mono',monospace", fontSize: '12px', color: 'var(--muted)', marginTop: '16px', letterSpacing: '0.05em', textAlign: 'center' }}>
            Fetching historical data…
            <br />
            Please be patient, this could take some time if you have been busy!
          </p>
        </div>
      )}

      {/* Main content */}
      {showGrid && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '16px', maxWidth: '1200px', margin: '0 auto' }}>
          {/* Overview Metrics */}
          <h3 className="mb-1 font-space-mono text-[10px] font-bold uppercase tracking-wider text-white/40">Overview</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px' }}>
            <div className="rr-stat" style={{ background: 'var(--ink-light)', border: '0.5px solid var(--border-faint)', borderRadius: '12px', padding: '16px', textAlign: 'center' }}>
              <div style={{ fontFamily: "'Space Mono',monospace", fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--muted)', marginBottom: '8px' }}>Opened</div>
              <div style={{ fontFamily: "'Space Mono',monospace", fontSize: '28px', fontWeight: 700, color: 'var(--cyan)' }}>{openedCount}</div>
            </div>
            <div className="rr-stat" style={{ background: 'var(--ink-light)', border: '0.5px solid var(--border-faint)', borderRadius: '12px', padding: '16px', textAlign: 'center' }}>
              <div style={{ fontFamily: "'Space Mono',monospace", fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--muted)', marginBottom: '8px' }}>Closed</div>
              <div style={{ fontFamily: "'Space Mono',monospace", fontSize: '28px', fontWeight: 700, color: 'var(--amber)' }}>{closedCount}</div>
            </div>
            <div className="rr-stat" style={{ background: 'var(--ink-light)', border: '0.5px solid var(--border-faint)', borderRadius: '12px', padding: '16px', textAlign: 'center' }}>
              <div style={{ fontFamily: "'Space Mono',monospace", fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--muted)', marginBottom: '8px' }}>Merged</div>
              <div style={{ fontFamily: "'Space Mono',monospace", fontSize: '28px', fontWeight: 700, color: 'var(--green)' }}>{mergedCount}</div>
            </div>
            <div className="rr-stat" style={{ background: 'var(--ink-light)', border: '0.5px solid var(--border-faint)', borderRadius: '12px', padding: '16px', textAlign: 'center' }}>
              <div style={{ fontFamily: "'Space Mono',monospace", fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--muted)', marginBottom: '8px' }}>Reviews</div>
              <div style={{ fontFamily: "'Space Mono',monospace", fontSize: '28px', fontWeight: 700, color: 'var(--purple)' }}>{reviewsCount}</div>
            </div>
          </div>

          {/* User Metrics */}
          <h3 className="mb-1 font-space-mono text-[10px] font-bold uppercase tracking-wider text-white/40">Activity by Person</h3>
          <div className="rr-stat" style={{ background: 'var(--ink-light)', border: '0.5px solid var(--border-faint)', borderRadius: '12px', padding: '20px', overflowX: 'auto' }}>
            <table className="w-full border-collapse text-[13px]">
              <thead className="border-b border-border-faint">
                <tr>
                  <th className="px-3 py-2 text-left font-space-mono text-[10px] font-semibold uppercase tracking-wider text-white/35">Person</th>
                  <th className="px-3 py-2 text-center font-space-mono text-[10px] font-semibold uppercase tracking-wider text-white/35">Opened</th>
                  <th className="px-3 py-2 text-center font-space-mono text-[10px] font-semibold uppercase tracking-wider text-white/35">Closed</th>
                  <th className="px-3 py-2 text-center font-space-mono text-[10px] font-semibold uppercase tracking-wider text-white/35">Merged</th>
                  <th className="px-3 py-2 text-center font-space-mono text-[10px] font-semibold uppercase tracking-wider text-white/35">Reviews</th>
                </tr>
              </thead>
              <tbody>
                {userStats.length === 0 ? (
                  <tr>
                    <td colSpan={5} style={{ padding: '32px', textAlign: 'center', color: 'var(--muted-dim)' }}>
                      No activity in selected period
                    </td>
                  </tr>
                ) : (
                  userStats.map(([name, stats]) => (
                    <tr key={name} style={{ borderBottom: '0.5px solid var(--border-faint)' }}>
                      <td style={{ padding: '10px 12px', fontFamily: "'Space Mono',monospace", fontSize: '12px', color: 'var(--text-primary)' }}>{name}</td>
                      <td style={{ padding: '10px 12px', textAlign: 'center', fontFamily: "'Space Mono',monospace", fontSize: '12px', color: 'var(--cyan)' }}>{stats.opened}</td>
                      <td style={{ padding: '10px 12px', textAlign: 'center', fontFamily: "'Space Mono',monospace", fontSize: '12px', color: 'var(--amber)' }}>{stats.closed}</td>
                      <td style={{ padding: '10px 12px', textAlign: 'center', fontFamily: "'Space Mono',monospace", fontSize: '12px', color: 'var(--green)' }}>{stats.merged}</td>
                      <td style={{ padding: '10px 12px', textAlign: 'center', fontFamily: "'Space Mono',monospace", fontSize: '12px', color: 'var(--purple)' }}>{stats.reviews}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* PR Size Distribution */}
          <h3 className="mb-1 font-space-mono text-[10px] font-bold uppercase tracking-wider text-white/40">PR Size Distribution</h3>
          <div className="rr-stat" style={{ background: 'var(--ink-light)', border: '0.5px solid var(--border-faint)', borderRadius: '12px', padding: '20px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {sizeEntries.length === 0 ? (
                <p style={{ textAlign: 'center', padding: '40px', fontSize: '12px', color: 'var(--muted-dim)' }}>No PRs opened in selected period</p>
              ) : (
                sizeEntries.map(([cat, count]) => {
                  const pct = totalSized > 0 ? Math.round((count / totalSized) * 100) : 0;
                  const barWidth = maxSizeCount > 0 ? (count / maxSizeCount) * 100 : 0;
                  const color = SIZE_COLORS[cat];
                  return (
                    <div key={cat} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div style={{ fontFamily: "'Space Mono',monospace", fontSize: '11px', color: 'var(--muted-dim)', minWidth: '80px', textAlign: 'right' }}>{cat}</div>
                      <div style={{ flex: 1, height: '18px', background: `${color}33`, borderRadius: '3px', overflow: 'hidden', position: 'relative' }}>
                        <div style={{ height: '100%', background: color, width: `${barWidth}%`, borderRadius: '3px' }} />
                      </div>
                      <div style={{ fontFamily: "'Space Mono',monospace", fontSize: '11px', color: 'var(--text-primary)', minWidth: '50px', textAlign: 'right' }}>{count}</div>
                      <div style={{ fontFamily: "'Space Mono',monospace", fontSize: '10px', color: 'var(--muted)', minWidth: '36px', textAlign: 'right' }}>{pct}%</div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* PR Size Details */}
          <h3 className="mb-1 font-space-mono text-[10px] font-bold uppercase tracking-wider text-white/40">PR Size Details</h3>
          <div className="rr-stat" style={{ background: 'var(--ink-light)', border: '0.5px solid var(--border-faint)', borderRadius: '12px', padding: '20px', overflowX: 'auto' }}>
            <table className="w-full border-collapse text-[13px]">
              <thead className="border-b border-border-faint">
                <tr>
                  <th className="px-3 py-2 text-left font-space-mono text-[10px] font-semibold uppercase tracking-wider text-white/35">Pull Request</th>
                  <th className="px-3 py-2 text-left font-space-mono text-[10px] font-semibold uppercase tracking-wider text-white/35">Author</th>
                  <th className="px-3 py-2 text-center font-space-mono text-[10px] font-semibold uppercase tracking-wider text-white/35">Files</th>
                  <th className="px-3 py-2 text-center font-space-mono text-[10px] font-semibold uppercase tracking-wider text-white/35">Lines</th>
                  <th className="px-3 py-2 text-center font-space-mono text-[10px] font-semibold uppercase tracking-wider text-white/35">Size</th>
                  <th className="px-3 py-2 text-center font-space-mono text-[10px] font-semibold uppercase tracking-wider text-white/35">Status</th>
                </tr>
              </thead>
              <tbody>
                {sizeDetails.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ padding: '32px', textAlign: 'center', color: 'var(--muted-dim)' }}>
                      No PRs opened in selected period
                    </td>
                  </tr>
                ) : (
                  sizeDetails.map((pr, idx) => {
                    const color = SIZE_COLORS[pr.category];
                    return (
                      <tr key={idx} style={{ borderBottom: '0.5px solid var(--border-faint)' }}>
                        <td style={{ padding: '10px 12px', maxWidth: '300px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          <a href={pr.url} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--cyan)', textDecoration: 'none', fontSize: '12px' }} title={pr.title}>
                            {pr.title.substring(0, 60)}{pr.title.length > 60 ? '…' : ''}
                          </a>
                        </td>
                        <td style={{ padding: '10px 12px', fontFamily: "'Space Mono',monospace", fontSize: '12px', color: 'var(--text-primary)' }}>{pr.author}</td>
                        <td style={{ padding: '10px 12px', textAlign: 'center', fontFamily: "'Space Mono',monospace", fontSize: '12px', color: 'var(--text-primary)' }}>{pr.files}</td>
                        <td style={{ padding: '10px 12px', textAlign: 'center', fontFamily: "'Space Mono',monospace", fontSize: '12px', color: 'var(--text-primary)' }}>{pr.lines}</td>
                        <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                          <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: '4px', fontSize: '10px', fontWeight: 700, color, background: `${color}22` }}>
                            {pr.category}
                          </span>
                        </td>
                        <td style={{ padding: '10px 12px', textAlign: 'center', fontFamily: "'Space Mono',monospace", fontSize: '11px', color: 'var(--muted)' }}>{pr.state}</td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </Layout>
  );
}
