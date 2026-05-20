'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import Chart from 'chart.js/auto';
import Layout from '@/components/Layout';
import LoadingIllustration from '@/components/LoadingIllustration';
import { useTranslations } from 'next-intl';
import { computeComplexity } from '@/lib/complexity';

const CHART_COLORS = ['#22d3ee', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#10b981', '#f97316'];

type BuildStatus = { state: string; conclusion: string | null };

type Review = { state: string; user?: { login: string }; submitted_at?: string };

type PRFile = { filename: string; additions: number; deletions: number; changes: number; status: string };

type PR = {
  id: number;
  title: string;
  html_url: string;
  created_at: string;
  updated_at: string;
  user?: { login: string; avatar_url?: string };
  repository_url?: string;
  url?: string;
  number?: number;
  draft?: boolean;
  labels?: { name: string; color: string }[];
  reviews?: Review[];
  buildStatus?: BuildStatus;
  mergeable_state?: string;
  mergeable?: boolean;
  head?: { sha: string };
  files?: PRFile[];
  additions?: number;
  deletions?: number;
  changed_files?: number;
};

function loadJSON<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}



function getStoredRepos(): string[] {
  return loadJSON<string[]>('github-repos', []);
}

function getSelectedRepos(): string[] {
  return loadJSON<string[]>('selected-repos', []);
}

function filterPRsBySelectedRepos(prs: PR[]): PR[] {
  const selectedRepos = getSelectedRepos();
  if (selectedRepos.length === 0) return prs;
  return prs.filter((pr) => {
    const url = pr.repository_url || pr.url || '';
    const match = url.match(/repos\/([^/]+\/[^/]+)/);
    const repoName = match ? match[1] : null;
    return repoName && selectedRepos.includes(repoName);
  });
}

function stripLargeDataForStorage(prs: PR[]): PR[] {
  return prs.map((pr) => ({
    ...pr,
    buildStatus: pr.buildStatus ? { state: pr.buildStatus.state, conclusion: pr.buildStatus.conclusion } : undefined,
  }));
}

import { proxyGitHub } from '@/lib/apiClient';

async function fetchRepoPRs(repo: string): Promise<PR[]> {
  const prs: PR[] = [];
  for (let page = 1; page <= 5; page++) {
    try {
      const data = await proxyGitHub(
        `repos/${repo}/pulls?state=open&per_page=100&page=${page}&sort=updated&direction=desc`
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

async function fetchUserSearchPRs(): Promise<PR[]> {
  const prs: PR[] = [];
  try {
    const user = await proxyGitHub('user');
    for (let page = 1; page <= 3; page++) {
      const data = await proxyGitHub(
        `search/issues?q=type:pr+involves:${encodeURIComponent(user.login)}+state:open&per_page=100&page=${page}&sort=updated&order=desc`
      );
      if (!data.items || data.items.length === 0) break;
      prs.push(...data.items);
      if (data.items.length < 100) break;
    }
  } catch (e) {
    console.warn('User search error', (e as Error).message);
  }
  return prs;
}

async function fetchReviews(pr: PR): Promise<Review[]> {
  try {
    const repoMatch = (pr.repository_url || pr.url || '').match(/repos\/([^/]+\/[^/]+)/);
    if (!repoMatch || !pr.number) return [];
    const data = await proxyGitHub(`repos/${repoMatch[1]}/pulls/${pr.number}/reviews`);
    return Array.isArray(data) ? data : [];
  } catch (e) {
    return [];
  }
}

async function fetchBuildStatus(pr: PR): Promise<BuildStatus> {
  try {
    if (!pr.head || !pr.head.sha) return { state: 'unknown', conclusion: null };
    const repoMatch = (pr.repository_url || pr.url || '').match(/repos\/([^/]+\/[^/]+)/);
    if (!repoMatch) return { state: 'unknown', conclusion: null };

    const checksData = await proxyGitHub(`repos/${repoMatch[1]}/commits/${pr.head.sha}/check-runs`);

    let buildStatus: BuildStatus = { state: 'unknown', conclusion: null };
    if (checksData.check_runs && checksData.check_runs.length > 0) {
      const statuses: string[] = checksData.check_runs.map((run: any) => run.status);
      const conclusions: string[] = checksData.check_runs.map((run: any) => run.conclusion).filter((c: any) => c);

      if (statuses.includes('in_progress') || statuses.includes('queued')) {
        buildStatus.state = 'in_progress';
      } else if (statuses.every((s) => s === 'completed')) {
        if (conclusions.includes('failure') || conclusions.includes('cancelled')) {
          buildStatus.state = 'failure';
        } else if (conclusions.every((c) => c === 'success' || c === 'neutral' || c === 'skipped')) {
          buildStatus.state = 'success';
        } else {
          buildStatus.state = 'pending';
        }
      } else {
        buildStatus.state = 'in_progress';
      }
      buildStatus.conclusion = conclusions[0] || null;
    }
    return buildStatus;
  } catch (e) {
    return { state: 'unknown', conclusion: null };
  }
}

async function fetchPRFiles(pr: PR): Promise<{ files: PRFile[]; additions: number; deletions: number; changed_files: number }> {
  try {
    const repoMatch = (pr.repository_url || pr.url || '').match(/repos\/([^/]+\/[^/]+)/);
    if (!repoMatch || !pr.number) return { files: [], additions: 0, deletions: 0, changed_files: 0 };

    const allFiles: PRFile[] = [];
    let page = 1;
    while (page <= 5) {
      const data = await proxyGitHub(`repos/${repoMatch[1]}/pulls/${pr.number}/files?per_page=100&page=${page}`);
      if (!Array.isArray(data) || data.length === 0) break;
      allFiles.push(...data);
      if (data.length < 100) break;
      page++;
    }

    let additions = 0;
    let deletions = 0;
    for (const f of allFiles) {
      additions += f.additions || 0;
      deletions += f.deletions || 0;
    }

    return {
      files: allFiles.map((f: any) => ({
        filename: f.filename,
        additions: f.additions,
        deletions: f.deletions,
        changes: f.changes,
        status: f.status,
      })),
      additions,
      deletions,
      changed_files: allFiles.length,
    };
  } catch (e) {
    return { files: [], additions: 0, deletions: 0, changed_files: 0 };
  }
}

async function fetchLivePRs(setStatusMsg: (msg: string) => void, t: any): Promise<PR[]> {
  const allRepos = getStoredRepos();
  const selectedRepos = getSelectedRepos();
  const repos = selectedRepos.length > 0 ? selectedRepos : allRepos;
  let rawPRs: PR[] = [];

  if (repos.length > 0) {
    setStatusMsg(t('fetchingPRs', { count: repos.length }));
    const chunks = await Promise.all(repos.map((r) => fetchRepoPRs(r)));
    rawPRs = chunks.flat();
  } else {
    setStatusMsg(t('fetchingYourPRs'));
    rawPRs = await fetchUserSearchPRs();
  }

  if (rawPRs.length === 0) return [];

  setStatusMsg(t('fetchingReviews', { count: rawPRs.length }));
  const withReviews: PR[] = [];
  for (let i = 0; i < rawPRs.length; i += 10) {
    const batch = rawPRs.slice(i, i + 10);
    const resolved = await Promise.all(
      batch.map((pr) => fetchReviews(pr).then((reviews) => ({ ...pr, reviews })))
    );
    withReviews.push(...resolved);
    if (i + 10 < rawPRs.length) setStatusMsg(t('fetchedReviews', { done: Math.min(i + 10, rawPRs.length), total: rawPRs.length }));
  }

  setStatusMsg(t('fetchingBuildStatus', { count: withReviews.length }));
  const withBuildStatus: PR[] = [];
  for (let i = 0; i < withReviews.length; i += 10) {
    const batch = withReviews.slice(i, i + 10);
    const resolved = await Promise.all(
      batch.map((pr) => fetchBuildStatus(pr).then((buildStatus) => ({ ...pr, buildStatus })))
    );
    withBuildStatus.push(...resolved);
    if (i + 10 < withReviews.length)
      setStatusMsg(t('fetchedBuildStatus', { done: Math.min(i + 10, withReviews.length), total: withReviews.length }));
  }

  setStatusMsg(t('fetchingFileSizes', { count: withBuildStatus.length }));
  const withFiles: PR[] = [];
  for (let i = 0; i < withBuildStatus.length; i += 10) {
    const batch = withBuildStatus.slice(i, i + 10);
    const resolved = await Promise.all(
      batch.map((pr) => fetchPRFiles(pr).then((fileData) => ({ ...pr, ...fileData })))
    );
    withFiles.push(...resolved);
    if (i + 10 < withFiles.length)
      setStatusMsg(t('fetchedFiles', { done: Math.min(i + 10, withFiles.length), total: withFiles.length }));
  }

  return withFiles;
}

function getRepoNames(prs: PR[]): string[] {
  const repos = prs
    .map((pr) => {
      const url = pr.repository_url || pr.url || '';
      const m = url.match(/repos\/([^/]+\/[^/]+)/);
      return m ? m[1] : null;
    })
    .filter(Boolean) as string[];
  return [...new Set(repos)];
}

function getSubtitle(prs: PR[]): string {
  const repos = getRepoNames(prs);
  const repoLabel =
    repos.length > 0
      ? repos.join(', ').slice(0, 80) + (repos.join(', ').length > 80 ? '…' : '')
      : 'all repos';
  return `${prs.length} open PRs · ${repoLabel}`;
}

export default function ReportsPage() {
  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [statusMsg, setStatusMsg] = useState('');
  const [statusError, setStatusError] = useState(false);
  const [prs, setPRs] = useState<PR[]>([]);
  const [view, setView] = useState<'grid' | 'noData' | 'noPat' | 'noRepos' | 'initial'>('initial');
  const [subtitle, setSubtitle] = useState('');

  const params = useParams();
  const locale = (params?.locale as string) || 'en';
  const t = useTranslations('reports');
  const tc = useTranslations('common');

  const chartStatusRef = useRef<HTMLCanvasElement | null>(null);
  const chartStatusInstance = useRef<Chart | null>(null);

  // Configure Chart.js theme
  useEffect(() => {
    const savedTheme = localStorage.getItem('reviewradar-theme');
    const prefersLight = window.matchMedia('(prefers-color-scheme: light)').matches;
    const theme = savedTheme || (prefersLight ? 'light' : 'dark');
    if (theme === 'light') {
      Chart.defaults.color = 'rgba(0,0,0,0.5)';
      Chart.defaults.borderColor = 'rgba(0,0,0,0.06)';
    } else {
      Chart.defaults.color = 'rgba(255,255,255,0.45)';
      Chart.defaults.borderColor = 'rgba(255,255,255,0.06)';
    }
    Chart.defaults.font.family = "'Space Mono', monospace";
    Chart.defaults.font.size = 11;
    setSubtitle(t('defaultSubtitle'));
  }, [t]);

  const destroyCharts = useCallback(() => {
    if (chartStatusInstance.current) {
      try {
        chartStatusInstance.current.destroy();
      } catch (e) {
        // ignore
      }
      chartStatusInstance.current = null;
    }
  }, []);

  const setStatus = useCallback((msg: string, isError: boolean) => {
    setStatusMsg(msg);
    setStatusError(isError);
  }, []);

  const showData = useCallback(
    (data: PR[]) => {
      setPRs(data);
      setSubtitle(getSubtitle(data));
      setView('grid');
    },
    []
  );

  const renderStatusChart = useCallback(
    (data: PR[]) => {
      destroyCharts();
      const statusCounts: Record<string, number> = { open: 0, inReview: 0, approved: 0, blocked: 0, draft: 0 };
      data.forEach((pr) => {
        const reviews = pr.reviews || [];
        const hasApproval = reviews.some((r) => r.state === 'APPROVED');
        const hasChanges = reviews.some((r) => r.state === 'CHANGES_REQUESTED');
        const mergeConflict = pr.mergeable_state === 'dirty' || pr.mergeable === false;

        if (hasChanges || mergeConflict) statusCounts['blocked']++;
        else if (hasApproval) statusCounts['approved']++;
        else if (reviews.length > 0) statusCounts['inReview']++;
        else if (pr.draft) statusCounts['draft']++;
        else statusCounts['open']++;
      });

      const statusEntries = Object.entries(statusCounts).filter(([, v]) => v > 0);
      if (statusEntries.length === 0) return;

      const el = chartStatusRef.current;
      if (!el) return;

      chartStatusInstance.current = new Chart(el, {
        type: 'pie',
        data: {
          labels: statusEntries.map((e) => t(`statusLabel.${e[0]}`)),
          datasets: [
            {
              data: statusEntries.map((e) => e[1]),
              backgroundColor: CHART_COLORS.slice(0, statusEntries.length).map((c) => c + 'cc'),
              borderColor: 'rgba(255,255,255,0.06)',
              borderWidth: 1,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              position: 'right',
              labels: { boxWidth: 10, padding: 12 },
            },
          },
        },
      });
    },
    [destroyCharts, t]
  );

  const renderMetrics = useCallback((data: PR[]) => {
    const now = Date.now();
    const total = data.length;
    const approved = data.filter((p) => p.reviews?.some((r) => r.state === 'APPROVED')).length;
    const failingBuilds = data.filter((p) => p.buildStatus?.state === 'failure').length;
    const noReviews = data.filter((p) => !p.reviews || p.reviews.length === 0).length;
    const oneReview = data.filter((p) => p.reviews && p.reviews.length === 1).length;
    const manyReviews = data.filter((p) => p.reviews && p.reviews.length >= 2).length;
    const lt24h = data.filter((p) => (now - new Date(p.updated_at || 0).getTime()) / (1000 * 60 * 60) < 24).length;
    const lt7d = data.filter((p) => {
      const diff = (now - new Date(p.updated_at || 0).getTime()) / (1000 * 60 * 60);
      return diff >= 24 && diff < 168;
    }).length;
    const gt7d = data.filter((p) => (now - new Date(p.updated_at || 0).getTime()) / (1000 * 60 * 60) >= 168).length;

    // Complexity metrics
    const complexityScores = data
      .filter((p) => (p.files?.length ?? 0) > 0)
      .map((p) => computeComplexity(p.files!));
    const avgComplexity = complexityScores.length > 0
      ? Math.round((complexityScores.reduce((a, b) => a + b, 0) / complexityScores.length) * 10) / 10
      : 0;

    const complexitySpread = {
      trivial: complexityScores.filter((s) => s < 15).length,
      small: complexityScores.filter((s) => s >= 15 && s < 30).length,
      medium: complexityScores.filter((s) => s >= 30 && s < 50).length,
      large: complexityScores.filter((s) => s >= 50 && s < 70).length,
      complex: complexityScores.filter((s) => s >= 70 && s < 90).length,
      veryComplex: complexityScores.filter((s) => s >= 90).length,
    };

    return { total, approved, failingBuilds, noReviews, oneReview, manyReviews, lt24h, lt7d, gt7d, avgComplexity, complexitySpread };
  }, []);

  const renderPersonChart = useCallback((data: PR[]) => {
    const byPerson: Record<string, number> = {};
    data.forEach((pr) => {
      const author = pr.user?.login || tc('unknown');
      byPerson[author] = (byPerson[author] || 0) + 1;
    });
    const sorted = Object.entries(byPerson)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 16);
    return sorted;
  }, [tc]);

  const renderLabelsChart = useCallback((data: PR[]) => {
    const byLabel: Record<string, number> = {};
    data.forEach((pr) => (pr.labels || []).forEach((l) => {
      byLabel[l.name] = (byLabel[l.name] || 0) + 1;
    }));
    const sorted = Object.entries(byLabel)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10);
    return sorted;
  }, []);

  const renderComplexityChart = useCallback((data: Record<string, number>) => {
    const entries = [
      ['trivial', data.trivial || 0],
      ['small', data.small || 0],
      ['medium', data.medium || 0],
      ['large', data.large || 0],
      ['complex', data.complex || 0],
      ['veryComplex', data.veryComplex || 0],
    ] as [string, number][];
    const total = entries.reduce((sum, [, v]) => sum + v, 0);
    return { entries, total };
  }, []);

  const loadData = useCallback(async () => {
    setLoading(true);
    setStatus('', false);
    destroyCharts();

    const raw = localStorage.getItem('reviewradar-prs');
    let cached: PR[] = [];
    try {
      cached = raw ? JSON.parse(raw) : [];
    } catch (e) {
      cached = [];
    }

    // If we have cached data and no session, show it immediately
    if (cached.length > 0) {
      const filteredCached = filterPRsBySelectedRepos(cached);
      if (filteredCached.length > 0) {
        showData(filteredCached);
        setLoading(false);
        setStatus(t('cachedData'), false);
        return;
      } else {
        setView('noRepos');
        setLoading(false);
        return;
      }
    } else if (getSelectedRepos().length === 0 && getStoredRepos().length === 0) {
      setLoading(false);
      setView('noRepos');
      return;
    }

    // Fetch fresh data
    try {
      const fetched = await fetchLivePRs(setStatusMsg, t);
      if (fetched.length > 0) {
        try {
          const stripped = stripLargeDataForStorage(fetched);
          localStorage.setItem('reviewradar-prs', JSON.stringify(stripped));
        } catch (storageError) {
          console.warn('Storage quota exceeded, using fetched data without caching:', (storageError as Error).message);
        }
        showData(fetched);
      } else {
        setStatus(t('noOpenPRs'), false);
        setView('noData');
      }
    } catch (e) {
      console.error('Load error:', e);
      setStatus(t('errorLoading', { message: (e as Error).message }), true);
      setView('noData');
    }

    setLoading(false);
  }, [destroyCharts, setStatus, showData, t]);

  // Re-render charts whenever PRs change
  useEffect(() => {
    if (view === 'grid' && prs.length > 0) {
      renderStatusChart(prs);
    }
    return () => {
      destroyCharts();
    };
  }, [view, prs, renderStatusChart, destroyCharts]);

  useEffect(() => {
    setMounted(true);
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!mounted) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-full">
          <div style={{ color: 'var(--muted)' }}>{t('loading')}</div>
        </div>
      </Layout>
    );
  }

  const metrics = view === 'grid' ? renderMetrics(prs) : null;
  const personData = view === 'grid' ? renderPersonChart(prs) : [];
  const labelsData = view === 'grid' ? renderLabelsChart(prs) : [];
  const complexityData = view === 'grid' && metrics?.complexitySpread ? renderComplexityChart(metrics.complexitySpread) : { entries: [], total: 0 };

  return (
    <Layout>
      <div className="max-w-[1400px] mx-auto">
        {/* Header */}
        <div className="rr-header-row">
          <div className="rr-radar-bg" style={{ background: 'var(--ink-light)' }}>
            <svg width="26" height="26" viewBox="0 0 16 16" fill="none">
              <circle cx="8" cy="8" r="6" stroke="var(--cyan)" strokeWidth="1.5" fill="none" />
              <circle cx="8" cy="8" r="3" fill="var(--cyan)" opacity="0.3" />
            </svg>
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h1 className="rr-header-title">{t('title')}</h1>
            <p className="rr-header-sub">{subtitle}</p>
          </div>
          <div className="rr-header-actions">
            <button onClick={loadData} disabled={loading} className="rr-btn-primary">
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{ opacity: loading ? 0.5 : 1 }}
              >
                <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.3" />
              </svg>
              {t('refresh')}
            </button>
          </div>
        </div>

        {/* Status bar */}
        {statusMsg && (
          <div
            style={{
              display: 'block',
              fontFamily: "'Space Mono', monospace",
              fontSize: 12,
              color: statusError ? 'var(--red)' : 'var(--muted)',
              marginBottom: 12,
              padding: '8px 12px',
              borderRadius: 6,
              background: 'rgba(255,255,255,0.03)',
              border: '0.5px solid var(--border-faint)',
            }}
          >
            {statusMsg}
          </div>
        )}

        {/* No data / no PAT / no repos / loading states */}
        {loading && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '80px 32px', flexDirection: 'column' }}>
            <LoadingIllustration width={240} height={160} />
            <p
              style={{
                fontFamily: "'Space Mono', monospace",
                fontSize: 12,
                color: 'var(--muted)',
                marginTop: 16,
                letterSpacing: '0.05em',
              }}
            >
              {t('fetchingData')}
            </p>
          </div>
        )}

        {!loading && view === 'noData' && (
          <div style={{ textAlign: 'center', padding: '80px 32px' }}>
            <div
              style={{
                width: 56,
                height: 56,
                borderRadius: '50%',
                background: 'var(--cyan-dim)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 16px',
              }}
            >
              <svg style={{ color: 'var(--cyan)' }} width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21.21 15.89A10 10 0 1 1 8 2.83" />
                <path d="M22 12A10 10 0 0 0 12 2v10z" />
              </svg>
            </div>
            <p style={{ fontFamily: "'Space Mono', monospace", fontSize: 14, color: 'var(--text-primary)', marginBottom: 8 }}>
              {t('noDataTitle')}
            </p>
            <p style={{ fontSize: 13, color: 'var(--muted)' }}>{t('noDataDescription')}</p>
          </div>
        )}

        {!loading && view === 'noPat' && (
          <div style={{ textAlign: 'center', padding: '80px 32px' }}>
            <div
              style={{
                width: 56,
                height: 56,
                borderRadius: '50%',
                background: 'rgba(245,158,11,0.1)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 16px',
              }}
            >
              <svg
                style={{ color: 'var(--amber)' }}
                width="28"
                height="28"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
            </div>
            <p style={{ fontFamily: "'Space Mono', monospace", fontSize: 14, color: 'var(--text-primary)', marginBottom: 8 }}>
              {t('noPatTitle')}
            </p>
            <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 20 }}>
              {t('noPatDescription')}
            </p>
            <Link href={`/${locale}/settings`} className="rr-btn-primary" style={{ textDecoration: 'none' }}>
              {t('goToSettings')}
            </Link>
          </div>
        )}

        {!loading && view === 'noRepos' && (
          <div style={{ textAlign: 'center', padding: '80px 32px' }}>
            <div
              style={{
                width: 56,
                height: 56,
                borderRadius: '50%',
                background: 'var(--cyan-dim)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 16px',
              }}
            >
              <svg
                style={{ color: 'var(--cyan)' }}
                width="28"
                height="28"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4" />
              </svg>
            </div>
            <p style={{ fontFamily: "'Space Mono', monospace", fontSize: 14, color: 'var(--text-primary)', marginBottom: 8 }}>
              {t('noReposTitle')}
            </p>
            <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 20 }}>
              {t('noReposDescription')}
            </p>
            <Link href={`/${locale}/settings`} className="rr-btn-primary" style={{ textDecoration: 'none' }}>
              {t('addRepos')}
            </Link>
          </div>
        )}

        {/* Main content grid */}
        {!loading && view === 'grid' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 16, maxWidth: '100%' }}>
            {/* Top Metrics Row: Total PRs, Approved, Failing Builds, Avg Complexity */}
            <h3 className="mb-1 font-space-mono text-[10px] font-bold uppercase tracking-wider text-white/40">{t('overview')}</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
              <div
                className="rr-stat"
                style={{
                  background: 'var(--ink-light)',
                  border: '0.5px solid var(--border-faint)',
                  borderRadius: 12,
                  padding: 16,
                  textAlign: 'center',
                }}
              >
                <div
                  style={{
                    fontFamily: "'Space Mono', monospace",
                    fontSize: 11,
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    color: 'var(--muted)',
                    marginBottom: 8,
                  }}
                >
                  {t('totalPRs')}
                </div>
                <div style={{ fontFamily: "'Space Mono', monospace", fontSize: 28, fontWeight: 700, color: 'var(--cyan)' }}>
                  {metrics?.total ?? '—'}
                </div>
              </div>
              <div
                className="rr-stat"
                style={{
                  background: 'var(--ink-light)',
                  border: '0.5px solid var(--border-faint)',
                  borderRadius: 12,
                  padding: 16,
                  textAlign: 'center',
                }}
              >
                <div
                  style={{
                    fontFamily: "'Space Mono', monospace",
                    fontSize: 11,
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    color: 'var(--muted)',
                    marginBottom: 8,
                  }}
                >
                  {t('approved')}
                </div>
                <div style={{ fontFamily: "'Space Mono', monospace", fontSize: 28, fontWeight: 700, color: 'var(--green)' }}>
                  {metrics?.approved ?? '—'}
                </div>
              </div>
              <div
                className="rr-stat"
                style={{
                  background: 'var(--ink-light)',
                  border: '0.5px solid var(--border-faint)',
                  borderRadius: 12,
                  padding: 16,
                  textAlign: 'center',
                }}
              >
                <div
                  style={{
                    fontFamily: "'Space Mono', monospace",
                    fontSize: 11,
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    color: 'var(--muted)',
                    marginBottom: 8,
                  }}
                >
                  {t('failed')}
                </div>
                <div style={{ fontFamily: "'Space Mono', monospace", fontSize: 28, fontWeight: 700, color: 'var(--red)' }}>
                  {metrics?.failingBuilds ?? '—'}
                </div>
              </div>
              <div
                className="rr-stat"
                style={{
                  background: 'var(--ink-light)',
                  border: '0.5px solid var(--border-faint)',
                  borderRadius: 12,
                  padding: 16,
                  textAlign: 'center',
                }}
              >
                <div
                  style={{
                    fontFamily: "'Space Mono', monospace",
                    fontSize: 11,
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    color: 'var(--muted)',
                    marginBottom: 8,
                  }}
                >
                  {t('avgComplexity')}
                </div>
                <div
                  style={{
                    fontFamily: "'Space Mono', monospace",
                    fontSize: 28,
                    fontWeight: 700,
                    color:
                      (metrics?.avgComplexity ?? 0) < 30
                        ? 'var(--green)'
                        : (metrics?.avgComplexity ?? 0) < 55
                        ? 'var(--cyan)'
                        : (metrics?.avgComplexity ?? 0) < 70
                        ? 'var(--amber)'
                        : 'var(--red)',
                  }}
                >
                  {metrics?.avgComplexity ?? '—'}
                </div>
              </div>
            </div>

            {/* Reviews Row: No Reviews, 1 Review, 2+ Reviews */}
            <h3 className="mb-1 font-space-mono text-[10px] font-bold uppercase tracking-wider text-white/40">{t('reviewStatus')}</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
              <div
                className="rr-stat"
                style={{
                  background: 'var(--ink-light)',
                  border: '0.5px solid var(--border-faint)',
                  borderRadius: 12,
                  padding: 16,
                  textAlign: 'center',
                }}
              >
                <div
                  style={{
                    fontFamily: "'Space Mono', monospace",
                    fontSize: 11,
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    color: 'var(--muted)',
                    marginBottom: 8,
                  }}
                >
                  {t('noReviews')}
                </div>
                <div style={{ fontFamily: "'Space Mono', monospace", fontSize: 28, fontWeight: 700, color: 'var(--amber)' }}>
                  {metrics?.noReviews ?? '—'}
                </div>
              </div>
              <div
                className="rr-stat"
                style={{
                  background: 'var(--ink-light)',
                  border: '0.5px solid var(--border-faint)',
                  borderRadius: 12,
                  padding: 16,
                  textAlign: 'center',
                }}
              >
                <div
                  style={{
                    fontFamily: "'Space Mono', monospace",
                    fontSize: 11,
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    color: 'var(--muted)',
                    marginBottom: 8,
                  }}
                >
                  {t('oneReview')}
                </div>
                <div style={{ fontFamily: "'Space Mono', monospace", fontSize: 28, fontWeight: 700, color: 'var(--cyan)' }}>
                  {metrics?.oneReview ?? '—'}
                </div>
              </div>
              <div
                className="rr-stat"
                style={{
                  background: 'var(--ink-light)',
                  border: '0.5px solid var(--border-faint)',
                  borderRadius: 12,
                  padding: 16,
                  textAlign: 'center',
                }}
              >
                <div
                  style={{
                    fontFamily: "'Space Mono', monospace",
                    fontSize: 11,
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    color: 'var(--muted)',
                    marginBottom: 8,
                  }}
                >
                  {t('manyReviews')}
                </div>
                <div style={{ fontFamily: "'Space Mono', monospace", fontSize: 28, fontWeight: 700, color: 'var(--green)' }}>
                  {metrics?.manyReviews ?? '—'}
                </div>
              </div>
            </div>

            {/* Last Updated Row: <24hrs, <7 days, >7 days */}
            <h3 className="mb-1 font-space-mono text-[10px] font-bold uppercase tracking-wider text-white/40">{t('lastUpdated')}</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
              <div
                className="rr-stat"
                style={{
                  background: 'var(--ink-light)',
                  border: '0.5px solid var(--border-faint)',
                  borderRadius: 12,
                  padding: 16,
                  textAlign: 'center',
                }}
              >
                <div
                  style={{
                    fontFamily: "'Space Mono', monospace",
                    fontSize: 11,
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    color: 'var(--muted)',
                    marginBottom: 8,
                  }}
                >
                  {t('lt24h')}
                </div>
                <div style={{ fontFamily: "'Space Mono', monospace", fontSize: 28, fontWeight: 700, color: 'var(--green)' }}>
                  {metrics?.lt24h ?? '—'}
                </div>
              </div>
              <div
                className="rr-stat"
                style={{
                  background: 'var(--ink-light)',
                  border: '0.5px solid var(--border-faint)',
                  borderRadius: 12,
                  padding: 16,
                  textAlign: 'center',
                }}
              >
                <div
                  style={{
                    fontFamily: "'Space Mono', monospace",
                    fontSize: 11,
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    color: 'var(--muted)',
                    marginBottom: 8,
                  }}
                >
                  {t('lt7d')}
                </div>
                <div style={{ fontFamily: "'Space Mono', monospace", fontSize: 28, fontWeight: 700, color: 'var(--cyan)' }}>
                  {metrics?.lt7d ?? '—'}
                </div>
              </div>
              <div
                className="rr-stat"
                style={{
                  background: 'var(--ink-light)',
                  border: '0.5px solid var(--border-faint)',
                  borderRadius: 12,
                  padding: 16,
                  textAlign: 'center',
                }}
              >
                <div
                  style={{
                    fontFamily: "'Space Mono', monospace",
                    fontSize: 11,
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    color: 'var(--muted)',
                    marginBottom: 8,
                  }}
                >
                  {t('gt7d')}
                </div>
                <div style={{ fontFamily: "'Space Mono', monospace", fontSize: 28, fontWeight: 700, color: 'var(--amber)' }}>
                  {metrics?.gt7d ?? '—'}
                </div>
              </div>
            </div>

            <h3 className="mb-1 font-space-mono text-[10px] font-bold uppercase tracking-wider text-white/40">{t('visualisations')}</h3>
            {/* Two column layout for charts */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              {/* Open PRs by Person (Horizontal Bar Chart) */}
              <div
                className="rr-stat"
                style={{
                  background: 'var(--ink-light)',
                  border: '0.5px solid var(--border-faint)',
                  borderRadius: 12,
                  padding: 20,
                }}
              >
                <div className="rr-stat-label" style={{ marginBottom: 14 }}>
                  {t('openPRsByPerson')}
                </div>
                <div style={{ minHeight: 240 }}>
                  {personData.length === 0 ? (
                    <p style={{ textAlign: 'center', padding: '60px', fontSize: 12, color: 'var(--muted-dim)' }}>
                      {t('noAuthors')}
                    </p>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {personData.map((entry, i) => {
                        const pct = (entry[1] / Math.max(...personData.map((x) => x[1]))) * 100;
                        return (
                          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                            <div
                              style={{
                                fontFamily: "'Space Mono', monospace",
                                fontSize: 11,
                                color: 'var(--muted-dim)',
                                minWidth: 140,
                                textAlign: 'right',
                                whiteSpace: 'nowrap',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                              }}
                            >
                              {entry[0].substring(0, 20)}
                            </div>
                            <div
                              style={{
                                flex: 1,
                                height: 18,
                                background: 'rgba(34,211,238,0.2)',
                                borderRadius: 3,
                                overflow: 'hidden',
                                position: 'relative',
                              }}
                            >
                              <div
                                style={{
                                  height: '100%',
                                  background: 'var(--cyan)',
                                  width: `${pct}%`,
                                  borderRadius: 3,
                                }}
                              />
                            </div>
                            <div
                              style={{
                                fontFamily: "'Space Mono', monospace",
                                fontSize: 11,
                                color: 'var(--text-primary)',
                                minWidth: 30,
                                textAlign: 'right',
                              }}
                            >
                              {entry[1]}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              {/* PR by Status (Pie Chart) */}
              <div
                className="rr-stat"
                style={{
                  background: 'var(--ink-light)',
                  border: '0.5px solid var(--border-faint)',
                  borderRadius: 12,
                  padding: 20,
                }}
              >
                <div className="rr-stat-label" style={{ marginBottom: 14 }}>
                  {t('prByStatus')}
                </div>
                <div style={{ position: 'relative', height: 200 }}>
                  <canvas ref={chartStatusRef} id="chartStatus" />
                </div>
              </div>
            </div>

            {/* PRs by Label (Horizontal Bar Chart) - Full Width */}
            <div
              className="rr-stat"
              style={{
                background: 'var(--ink-light)',
                border: '0.5px solid var(--border-faint)',
                borderRadius: 12,
                padding: 20,
              }}
            >
              <div className="rr-stat-label" style={{ marginBottom: 14 }}>
                {t('prsByLabel')}
              </div>
              <div>
                {labelsData.length === 0 ? (
                  <p style={{ textAlign: 'center', padding: '40px', fontSize: 12, color: 'var(--muted-dim)' }}>
                    {t('noLabels')}
                  </p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {labelsData.map((entry, i) => {
                      const pct = (entry[1] / Math.max(...labelsData.map((x) => x[1]))) * 100;
                      return (
                        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                          <div
                            style={{
                              fontFamily: "'Space Mono', monospace",
                              fontSize: 11,
                              color: 'var(--muted-dim)',
                              minWidth: 140,
                              textAlign: 'right',
                              whiteSpace: 'nowrap',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                            }}
                          >
                            {entry[0].substring(0, 16)}
                          </div>
                          <div
                            style={{
                              flex: 1,
                              height: 18,
                              background: 'rgba(34,211,238,0.2)',
                              borderRadius: 3,
                              overflow: 'hidden',
                              position: 'relative',
                            }}
                          >
                            <div
                              style={{
                                height: '100%',
                                background: 'var(--cyan)',
                                width: `${pct}%`,
                                borderRadius: 3,
                              }}
                            />
                          </div>
                          <div
                            style={{
                              fontFamily: "'Space Mono', monospace",
                              fontSize: 11,
                              color: 'var(--text-primary)',
                              minWidth: 30,
                              textAlign: 'right',
                            }}
                          >
                            {entry[1]}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Complexity Spread (Horizontal Bar Chart) - Full Width */}
            <div
              className="rr-stat"
              style={{
                background: 'var(--ink-light)',
                border: '0.5px solid var(--border-faint)',
                borderRadius: 12,
                padding: 20,
              }}
            >
              <div className="rr-stat-label" style={{ marginBottom: 14 }}>
                {t('complexitySpread')}
              </div>
              <div>
                {complexityData.total === 0 ? (
                  <p style={{ textAlign: 'center', padding: '40px', fontSize: 12, color: 'var(--muted-dim)' }}>
                    {t('noComplexityData')}
                  </p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {complexityData.entries.map(([key, value], i) => {
                      const pct = complexityData.total > 0 ? (value / complexityData.total) * 100 : 0;
                      const barColor =
                        key === 'trivial'
                          ? 'var(--green)'
                          : key === 'small'
                          ? 'rgba(34,211,238,0.6)'
                          : key === 'medium'
                          ? 'var(--cyan)'
                          : key === 'large'
                          ? 'var(--amber)'
                          : key === 'complex'
                          ? 'rgba(239,68,68,0.6)'
                          : 'var(--red)';
                      return (
                        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                          <div
                            style={{
                              fontFamily: "'Space Mono', monospace",
                              fontSize: 11,
                              color: 'var(--muted-dim)',
                              minWidth: 140,
                              textAlign: 'right',
                              whiteSpace: 'nowrap',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                            }}
                          >
                            {t(`complexityLabel.${key}`)}
                          </div>
                          <div
                            style={{
                              flex: 1,
                              height: 18,
                              background: 'rgba(255,255,255,0.04)',
                              borderRadius: 3,
                              overflow: 'hidden',
                              position: 'relative',
                            }}
                          >
                            <div
                              style={{
                                height: '100%',
                                background: barColor,
                                width: `${pct}%`,
                                borderRadius: 3,
                              }}
                            />
                          </div>
                          <div
                            style={{
                              fontFamily: "'Space Mono', monospace",
                              fontSize: 11,
                              color: 'var(--text-primary)',
                              minWidth: 30,
                              textAlign: 'right',
                            }}
                          >
                            {value}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
