'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useAppStore, PR, DEFAULT_COLUMNS, ColumnKey } from '@/lib/store';
import { fetchReposPRs, fetchPRReviews, fetchCurrentUser } from '@/lib/githubApi';
import { getRepoFullNameFromUrl } from '@/lib/utils';
import PRTable from '@/components/PRTable';
import PRDrawer from '@/components/PRDrawer';
import StatsBar from '@/components/StatsBar';
import Layout from '@/components/Layout';
import LoadingIllustration from '@/components/LoadingIllustration';
import { useTranslations } from 'next-intl';

export default function DashboardPage() {
  const store = useAppStore();
  const {
    allPRs,
    pat,
    selectedRepos,
    activeFilters,
    setAllPRs,
    setCurrentUser,
    setPat,
    setSelectedRepos,
    setLastLoadedRepos,
    setActiveFilter,
  } = store;

  const t = useTranslations('dashboard');
  const tc = useTranslations('common');
  const tStatus = useTranslations('components.prtable.status');

  const [loading, setLoading] = useState(false);
  const [drawerPR, setDrawerPR] = useState<PR | null>(null);
  const [message, setMessage] = useState<{ text: string; type: string } | null>(null);
  const [repoDropdownOpen, setRepoDropdownOpen] = useState(false);
  const [repoSearch, setRepoSearch] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);

  const [savedRepos, setSavedRepos] = useState<string[]>([]);
  const hasAutoLoaded = useRef(false);
  const refreshTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [lastRefreshAt, setLastRefreshAt] = useState<number | null>(null);
  const [timeAgo, setTimeAgo] = useState('');
  const [autoRefreshEnabled, setAutoRefreshEnabled] = useState(false);

  // Migrate column order to include any new default columns
  useEffect(() => {
    const state = useAppStore.getState();
    const currentOrder = state.columnOrder;
    const missing = DEFAULT_COLUMNS.filter((k: ColumnKey) => !currentOrder.includes(k));
    if (missing.length > 0) {
      // Insert missing columns in their default positions
      const newOrder = [...currentOrder];
      for (const key of missing) {
        const defaultIndex = DEFAULT_COLUMNS.indexOf(key);
        // Find insertion point: after the nearest preceding column that exists
        let insertIndex = newOrder.length;
        for (let i = defaultIndex - 1; i >= 0; i--) {
          const idx = newOrder.indexOf(DEFAULT_COLUMNS[i]);
          if (idx !== -1) {
            insertIndex = idx + 1;
            break;
          }
        }
        newOrder.splice(insertIndex, 0, key);
      }
      state.setColumnOrder(newOrder);
    }
  }, []);

  useEffect(() => {
    setSavedRepos(JSON.parse(localStorage.getItem('github-repos') || '[]'));
  }, []);

  useEffect(() => {
    const savedPat = localStorage.getItem('github-pat');
    if (savedPat) setPat(savedPat);
    const savedSelections = JSON.parse(localStorage.getItem('selected-repos') || '[]');
    setSelectedRepos(new Set(savedSelections));
  }, [setPat, setSelectedRepos]);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setRepoDropdownOpen(false);
      }
    }
    document.addEventListener('click', onClick);
    return () => document.removeEventListener('click', onClick);
  }, []);

  const showMsg = useCallback((text: string, type: string) => {
    setMessage({ text, type });
    if (type === 'success') setTimeout(() => setMessage(null), 3000);
  }, []);

  const loadPRs = useCallback(async ({ silent = false }: { silent?: boolean } = {}) => {
    const token = pat || localStorage.getItem('github-pat');
    if (!token) {
      showMsg(t('pleaseEnterPat'), 'error');
      return;
    }

    if (!silent) setLoading(true);

    try {
      const user = await fetchCurrentUser(token);
      setCurrentUser(user);

      let allPRsData: PR[] = [];
      if (selectedRepos.size > 0) {
        for (const repo of selectedRepos) {
          try {
            const parts = repo.trim().split('/');
            if (parts.length === 2 && parts[0] && parts[1]) {
              const repoPRs = await fetchReposPRs(repo.trim(), token);
              allPRsData.push(...repoPRs);
            }
          } catch (e) {
            console.warn(`Failed to load ${repo}:`, e);
          }
        }
      }

      const prsWithReviews = await Promise.all(
        allPRsData.map((pr) => fetchPRReviews(pr, token))
      );

      setAllPRs(prsWithReviews);
      // Strip large fields before caching to avoid localStorage quota errors
      const stripped = prsWithReviews.map((pr) => {
        const { body, comments, reviews, buildStatus, files, ...rest } = pr as any;
        return {
          ...rest,
          body: body ? body.substring(0, 200) : undefined,
          comments: [],
          reviews: (reviews || []).map((r: any) => ({
            state: r.state,
            user: r.user ? { login: r.user.login, avatar_url: r.user.avatar_url } : undefined,
            submitted_at: r.submitted_at,
            created_at: r.created_at,
          })),
          buildStatus: buildStatus
            ? { state: buildStatus.state, conclusion: buildStatus.conclusion }
            : undefined,
          // Keep file metadata but strip patches to save space
          files: (files || []).map((f: any) => ({
            filename: f.filename,
            additions: f.additions,
            deletions: f.deletions,
            changes: f.changes,
            status: f.status,
          })),
          additions: pr.additions,
          deletions: pr.deletions,
          changed_files: pr.changed_files,
        };
      });
      try {
        localStorage.setItem('reviewradar-prs', JSON.stringify(stripped));
      } catch (e) {
        console.warn('Failed to cache PRs to localStorage (quota exceeded):', e);
      }

      const discoveredRepos = new Set<string>();
      prsWithReviews.forEach((pr) => {
        const repoUrl = pr.repository_url || pr.url || '';
        const repoName = getRepoFullNameFromUrl(repoUrl);
        if (repoName && repoName !== 'unknown/unknown') {
          discoveredRepos.add(repoName);
        }
      });

      setLastLoadedRepos(new Set(Array.from(discoveredRepos)));
      setLastRefreshAt(Date.now());

      if (silent) {
        showMsg(t('refreshedMessage', { count: prsWithReviews.length, repoCount: discoveredRepos.size }), 'success');
      } else {
        showMsg(t('loadedMessage', { count: prsWithReviews.length, repoCount: discoveredRepos.size }), 'success');
      }
    } catch (error: any) {
      showMsg(tc('errorWithMessage', { message: error.message }), 'error');
    } finally {
      if (!silent) setLoading(false);
    }
  }, [pat, selectedRepos, setAllPRs, setCurrentUser, setLastLoadedRepos, showMsg, t, tc]);

  const setupAutoRefresh = useCallback(() => {
    if (refreshTimerRef.current) {
      clearInterval(refreshTimerRef.current);
      refreshTimerRef.current = null;
    }
    const enabled = localStorage.getItem('reviewradar-auto-refresh') === 'true';
    setAutoRefreshEnabled(enabled);
    if (!enabled) return;

    const intervalMinutes = parseInt(localStorage.getItem('reviewradar-refresh-interval') || '5', 10);
    const intervalMs = Math.max(intervalMinutes, 1) * 60 * 1000;

    refreshTimerRef.current = setInterval(() => {
      const token = pat || localStorage.getItem('github-pat');
      if (!token) return;
      if (selectedRepos.size === 0) return;
      loadPRs({ silent: true });
    }, intervalMs);
  }, [pat, selectedRepos.size, loadPRs]);

  // Auto-load PRs when repos are already selected and PAT is available
  useEffect(() => {
    const token = pat || localStorage.getItem('github-pat');
    if (hasAutoLoaded.current) return;
    if (!token) return;
    if (selectedRepos.size === 0) return;
    if (allPRs.length > 0) return;
    hasAutoLoaded.current = true;
    loadPRs();
  }, [pat, selectedRepos, allPRs.length, loadPRs]);

  // Auto-refresh timer
  useEffect(() => {
    setupAutoRefresh();
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        setupAutoRefresh();
      }
    };
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      if (refreshTimerRef.current) clearInterval(refreshTimerRef.current);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [setupAutoRefresh]);

  // Time-since-last-refresh updater
  useEffect(() => {
    if (!lastRefreshAt) return;
    const update = () => {
      const diffSec = Math.floor((Date.now() - lastRefreshAt) / 1000);
      if (diffSec < 60) setTimeAgo(`${diffSec}s`);
      else if (diffSec < 3600) setTimeAgo(`${Math.floor(diffSec / 60)}m`);
      else setTimeAgo(`${Math.floor(diffSec / 3600)}h`);
    };
    update();
    const id = setInterval(update, 30000);
    return () => clearInterval(id);
  }, [lastRefreshAt]);

  const toggleRepo = (repo: string) => {
    const next = new Set(selectedRepos);
    if (next.has(repo)) next.delete(repo);
    else next.add(repo);
    setSelectedRepos(next);
    localStorage.setItem('selected-repos', JSON.stringify(Array.from(next)));
  };

  const selectAll = () => {
    const next = new Set(savedRepos);
    setSelectedRepos(next);
    localStorage.setItem('selected-repos', JSON.stringify(Array.from(next)));
  };

  const clearSelection = () => {
    setSelectedRepos(new Set());
    localStorage.setItem('selected-repos', JSON.stringify([]));
  };

  const filteredRepos = savedRepos.filter((r: string) =>
    r.toLowerCase().includes(repoSearch.toLowerCase())
  );

  const activeFilterPill = activeFilters.label
    ? t('filterPillLabel', { label: activeFilters.label })
    : activeFilters.status
    ? t('filterPillStatus', { status: tStatus(activeFilters.status as any) })
    : activeFilters.author
    ? t('filterPillAuthor', { author: activeFilters.author })
    : null;

  return (
    <Layout>
      <div className="max-w-[1400px] mx-auto">
        {/* Header */}
        <div className="rr-header-row">
          <div className="rr-radar-bg">
            <svg width="28" height="28" viewBox="0 0 40 40" fill="none">
              <circle cx="20" cy="20" r="18" stroke="var(--cyan)" strokeWidth="0.5" opacity="0.3" />
              <circle cx="20" cy="20" r="12" stroke="var(--cyan)" strokeWidth="0.5" opacity="0.2" />
              <circle cx="20" cy="20" r="6" stroke="var(--cyan)" strokeWidth="0.5" opacity="0.15" />
              <line x1="20" y1="2" x2="20" y2="38" stroke="var(--cyan)" strokeWidth="0.5" opacity="0.15" />
              <line x1="2" y1="20" x2="38" y2="20" stroke="var(--cyan)" strokeWidth="0.5" opacity="0.15" />
              <circle cx="20" cy="20" r="2" fill="var(--cyan)" opacity="0.6" />
              <circle cx="28" cy="12" r="1.5" fill="var(--cyan)" opacity="0.8" className="rr-radar-blip1" />
              <circle cx="10" cy="26" r="1" fill="var(--cyan)" opacity="0.6" className="rr-radar-blip2" />
              <path d="M20 20 L38 2" stroke="var(--cyan)" strokeWidth="1" opacity="0.4" className="rr-radar-sweep" />
            </svg>
          </div>
          <div>
            <h1 className="rr-header-title">{t('title')}</h1>
            <div className="rr-header-sub">{t('subtitle')}</div>
            {lastRefreshAt && (
              <div
                style={{
                  fontFamily: "'Space Mono', monospace",
                  fontSize: 11,
                  color: 'var(--muted-dim)',
                  marginTop: 4,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                }}
              >
                <span>{t('updatedAgo', { time: timeAgo })}</span>
                {autoRefreshEnabled && (
                  <span className="inline-flex items-center gap-1.5">
                    <span className="h-1.5 w-1.5 rounded-full bg-green animate-pulse"></span>
                    {t('autoRefreshOn')}
                  </span>
                )}
              </div>
            )}
          </div>
          <div className="rr-header-actions">
            <div style={{ position: 'relative' }} ref={dropdownRef}>
              <button
                onClick={() => setRepoDropdownOpen(!repoDropdownOpen)}
                className="rr-btn-ghost"
              >
                <span>{t('selectReposIcon')}</span>
                <span>{selectedRepos.size === 0 ? t('selectRepos') : t('selectedCount', { count: selectedRepos.size })}</span>
                <span>{t('dropdownArrow')}</span>
              </button>
              {repoDropdownOpen && (
                <div className="absolute top-full left-0 mt-1 w-64 bg-ink-light border border-border-faint rounded-lg shadow-xl z-50 p-2">
                  <input
                    type="text"
                    placeholder={t('searchReposPlaceholder')}
                    value={repoSearch}
                    onChange={(e) => setRepoSearch(e.target.value)}
                    className="w-full px-3 py-2 mb-2 rounded-md bg-surface border border-border-faint text-sm text-text-primary placeholder-muted focus:outline-none focus:border-cyan"
                  />
                  <div className="flex gap-2 mb-2">
                    <button onClick={selectAll} className="text-xs text-cyan hover:underline">{t('selectAll')}</button>
                    <button onClick={clearSelection} className="text-xs text-cyan hover:underline">{t('clear')}</button>
                  </div>
                  <div className="max-h-48 overflow-y-auto space-y-1">
                    {filteredRepos.map((repo: string) => (
                      <label key={repo} className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-white/[0.03] cursor-pointer text-sm">
                        <input
                          type="checkbox"
                          checked={selectedRepos.has(repo)}
                          onChange={() => toggleRepo(repo)}
                          className="accent-cyan"
                        />
                        <span className="text-text-primary font-mono text-xs">{repo}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <button
              onClick={() => loadPRs({ silent: true })}
              disabled={loading}
              className="rr-btn-primary"
            >
              {loading ? t('loadIconLoading') : t('loadIconIdle')} {t('loadPRs')}
            </button>

            {activeFilterPill && (
              <span className="rr-pill active">
                {activeFilterPill}
                <button
                  onClick={() => {
                    setActiveFilter('label', null);
                    setActiveFilter('status', null);
                    setActiveFilter('author', null);
                  }}
                  className="rr-filter-pill-close"
                >
                  {t('filterPillClose')}
                </button>
              </span>
            )}
          </div>
        </div>

        {/* Stats */}
        <StatsBar />

        {/* Loading state */}
        {loading && allPRs.length === 0 && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '80px 32px', flexDirection: 'column' }}>
            <LoadingIllustration width={240} height={160} />
            <p style={{ fontFamily: "'Space Mono',monospace", fontSize: '12px', color: 'var(--muted)', marginTop: '16px', letterSpacing: '0.05em', textAlign: 'center' }}>
              {t('fetchingPRs')}
            </p>
          </div>
        )}

        {/* Table */}
        {loading && allPRs.length === 0 ? null : <PRTable onOpenDrawer={setDrawerPR} />}

        {/* Drawer */}
        {drawerPR && <PRDrawer pr={drawerPR} onClose={() => setDrawerPR(null)} />}

        {/* Toast */}
        {message && (
          <div
            className={`fixed bottom-6 right-6 z-[100] max-w-[420px] rounded-lg border-l-[3px] px-4 py-3.5 text-[13px] shadow-md backdrop-blur-sm animate-slide-in`}
            style={{
              borderLeftColor: message.type === 'error' ? 'var(--red)' : message.type === 'success' ? 'var(--green)' : 'var(--cyan)',
              background: message.type === 'error' ? 'rgba(239,68,68,0.08)' : message.type === 'success' ? 'rgba(34,197,94,0.08)' : 'rgba(34,211,238,0.08)',
              color: message.type === 'error' ? 'var(--red)' : message.type === 'success' ? 'var(--green)' : 'var(--cyan)',
            }}
          >
            {message.text}
          </div>
        )}
      </div>
    </Layout>
  );
}
