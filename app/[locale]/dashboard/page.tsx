'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useAppStore, PR, DEFAULT_COLUMNS, ColumnKey } from '@/lib/store';
import { getRepoFullNameFromUrl } from '@/lib/utils';
import { usePRLoader } from '@/workers/usePRLoader';
import PRTable from '@/components/PRTable';
import PRDrawer from '@/components/PRDrawer';
import StatsBar from '@/components/StatsBar';
import Layout from '@/components/Layout';
import GitHubOAuthButton from '@/components/GitHubOAuthButton';
import Link from 'next/link';
import { useTranslations, useLocale } from 'next-intl';
import { checkSession } from '@/lib/apiClient';

export default function DashboardPage() {
  const store = useAppStore();
  const {
    allPRs,
    currentUser,
    selectedRepos,
    activeFilters,
    setAllPRs,
    setCurrentUser,
    setSelectedRepos,
    setLastLoadedRepos,
    setActiveFilter,
  } = store;

  const t = useTranslations('dashboard');
  const tc = useTranslations('common');
  const locale = useLocale();

  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState<{ phase: 'repos' | 'prs'; current: number; total: number } | null>(null);
  const [drawerPR, setDrawerPR] = useState<PR | null>(null);
  const [message, setMessage] = useState<{ text: string; type: string } | null>(null);
  const [repoDropdownOpen, setRepoDropdownOpen] = useState(false);
  const [repoSearch, setRepoSearch] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);
  const userDropdownRef = useRef<HTMLDivElement>(null);

  const [savedRepos, setSavedRepos] = useState<string[]>([]);
  const hasAutoLoaded = useRef(false);
  const refreshTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const { load: loadPRsInWorker } = usePRLoader();

  const [lastRefreshAt, setLastRefreshAt] = useState<number | null>(null);
  const [timeAgo, setTimeAgo] = useState('');
  const [autoRefreshEnabled, setAutoRefreshEnabled] = useState(false);
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);
  const [userSearch, setUserSearch] = useState('');
  const [apiCalls, setApiCalls] = useState(0);
  const [sessionChecked, setSessionChecked] = useState(false);

  // Restore cached PRs on mount so filters (users) are available immediately
  useEffect(() => {
    try {
      const cached = localStorage.getItem('reviewradar-prs');
      if (cached) {
        let parsed = JSON.parse(cached) as PR[];
        if (parsed.length > 0 && allPRs.length === 0) {
          // Recompute additions/deletions from cached files if the stored values are missing.
          parsed = parsed.map((pr) => {
            if ((pr.additions === undefined || pr.additions === 0) && pr.files?.length) {
              const additions = pr.files.reduce((sum, f) => sum + (f.additions || 0), 0);
              const deletions = pr.files.reduce((sum, f) => sum + (f.deletions || 0), 0);
              return { ...pr, additions, deletions };
            }
            return pr;
          });
          setAllPRs(parsed);
        }
      }
    } catch {
      // ignore parse errors
    }
  }, []);

  // Check session on mount to show user immediately without waiting for the worker
  useEffect(() => {
    checkSession().then((session) => {
      if (session.active && session.user) {
        setCurrentUser(session.user);
      }
      setSessionChecked(true);
    }).catch(() => {
      setSessionChecked(true);
    });
  }, []);

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
    const savedSelections = JSON.parse(localStorage.getItem('selected-repos') || '[]');
    setSelectedRepos(new Set(savedSelections));
  }, [setSelectedRepos]);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setRepoDropdownOpen(false);
      }
      if (userDropdownRef.current && !userDropdownRef.current.contains(e.target as Node)) {
        setUserDropdownOpen(false);
      }
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setRepoDropdownOpen(false);
        setUserDropdownOpen(false);
      }
    }
    document.addEventListener('click', onClick);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('click', onClick);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, []);

  const showMsg = useCallback((text: string, type: string) => {
    setMessage({ text, type });
    if (type === 'success') setTimeout(() => setMessage(null), 3000);
  }, []);

  const loadPRs = useCallback(({ silent = false }: { silent?: boolean } = {}) => {
    if (!currentUser) return;
    if (!silent) setLoading(true);

    const repos = Array.from(selectedRepos);
    if (repos.length === 0) {
      if (!silent) setLoading(false);
      return;
    }

    const t0 = Date.now();

    loadPRsInWorker(repos, {
      onProgress: (phase, current, total) => {
        setProgress({ phase, current, total });
      },
      onResult: (prs, errors, user, complete, apiCalls) => {
        setCurrentUser(user);
        if (apiCalls !== undefined) setApiCalls(apiCalls);

        // On silent background refresh, don't overwrite good cached data with empty results
        if (silent && prs.length === 0) {
          let hasCachedData = false;
          try {
            const cached = localStorage.getItem('reviewradar-prs');
            if (cached) {
              const parsed = JSON.parse(cached);
              hasCachedData = Array.isArray(parsed) && parsed.length > 0;
            }
          } catch {}
          if (hasCachedData) {
            if (!silent) setLoading(false);
            return;
          }
        }

        // Show PRs immediately for user-initiated loads so mobile users see data without delay
        if (!silent) setAllPRs(prs);

        if (complete) {
          setProgress(null);

          const elapsed = Date.now() - t0;
          const elapsedStr = elapsed < 60000
            ? `${Math.round(elapsed / 1000)}s`
            : `${Math.floor(elapsed / 60000)}m ${Math.round((elapsed % 60000) / 1000)}s`;

          const stripped = prs.map((pr) => {
            const { body, comments, reviews, buildStatus, files, complexityBreakdown, ...rest } = pr as any;
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
              complexity: pr.complexity,
              effort: pr.effort,
              complexityBreakdown: complexityBreakdown
                ? {
                    score: complexityBreakdown.score,
                    label: complexityBreakdown.label,
                    totalFiles: complexityBreakdown.totalFiles,
                    relevantFiles: complexityBreakdown.relevantFiles,
                    ignoredFiles: complexityBreakdown.ignoredFiles,
                    totalAdditions: complexityBreakdown.totalAdditions,
                    totalDeletions: complexityBreakdown.totalDeletions,
                    weightedChurn: complexityBreakdown.weightedChurn,
                    fileSpread: complexityBreakdown.fileSpread,
                    intensity: complexityBreakdown.intensity,
                    topFiles: (complexityBreakdown.topFiles || []).slice(0, 3).map((f: any) => ({
                      filename: f.filename,
                      weight: f.weight,
                      churn: f.churn,
                      contribution: f.contribution,
                    })),
                  }
                : undefined,
            };
          });
          try {
            localStorage.setItem('reviewradar-prs', JSON.stringify(stripped));
          } catch (e) {
            console.warn('Failed to cache PRs to localStorage (quota exceeded):', e);
          }

          const discoveredRepos = new Set<string>();
          prs.forEach((pr) => {
            const repoUrl = pr.repository_url || pr.url || '';
            const repoName = getRepoFullNameFromUrl(repoUrl);
            if (repoName && repoName !== 'unknown/unknown') {
              discoveredRepos.add(repoName);
            }
          });

          setLastLoadedRepos(new Set(Array.from(discoveredRepos)));
          setLastRefreshAt(Date.now());

          if (!silent) {
            showMsg(t('loadedMessage', { count: prs.length, repoCount: discoveredRepos.size, time: elapsedStr }), 'success');
          }

          if (errors.length > 0) {
            setTimeout(() => {
              showMsg(
                `Some repos failed to load:\n${errors.map((e) => `• ${e}`).join('\n')}`,
                'error'
              );
            }, 100);
          }

          if (!silent) setLoading(false);
        }
      },
      onError: (message) => {
        setProgress(null);
        showMsg(tc('errorWithMessage', { message }), 'error');
        if (!silent) setLoading(false);
      },
    });
  }, [selectedRepos, setAllPRs, setCurrentUser, setLastLoadedRepos, showMsg, t, tc, loadPRsInWorker, currentUser]);

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
      if (selectedRepos.size === 0) return;
      loadPRs({ silent: true });
    }, intervalMs);
  }, [selectedRepos.size, loadPRs]);

  // Auto-load PRs when selected repos change (only if authenticated)
  useEffect(() => {
    if (selectedRepos.size === 0) return;
    if (!sessionChecked) return;
    if (!currentUser) return;

    // On very first load, use cached data silently; on repo changes, show loading
    const isFirstLoad = !hasAutoLoaded.current;
    hasAutoLoaded.current = true;

    let hasCachedData = false;
    if (isFirstLoad) {
      try {
        const cached = localStorage.getItem('reviewradar-prs');
        if (cached) {
          const parsed = JSON.parse(cached);
          hasCachedData = Array.isArray(parsed) && parsed.length > 0;
        }
      } catch {}
    }

    loadPRs({ silent: isFirstLoad && hasCachedData });
  }, [selectedRepos, loadPRs, sessionChecked, currentUser]);

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
    const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });
    const update = () => {
      const diffSec = Math.floor((Date.now() - lastRefreshAt) / 1000);
      if (diffSec < 60) setTimeAgo(rtf.format(-diffSec, 'seconds'));
      else if (diffSec < 3600) setTimeAgo(rtf.format(-Math.floor(diffSec / 60), 'minutes'));
      else setTimeAgo(rtf.format(-Math.floor(diffSec / 3600), 'hours'));
    };
    update();
    const id = setInterval(update, 30000);
    return () => clearInterval(id);
  }, [lastRefreshAt, locale]);

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

  const allUsers = useMemo(() => {
    const set = new Set<string>();
    allPRs.forEach((pr) => {
      if (selectedRepos.size > 0) {
        const repo = getRepoFullNameFromUrl(pr.repository_url || pr.url || '');
        if (!selectedRepos.has(repo)) return;
      }
      const login = pr.user?.login;
      if (login) set.add(login);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [allPRs, selectedRepos]);

  // Sync selectedUsers with the users from selected repos
  useEffect(() => {
    const current = useAppStore.getState().selectedUsers;
    if (current.length === 0 && allUsers.length > 0) {
      useAppStore.setState({ selectedUsers: [...allUsers] });
    } else if (allUsers.length > 0) {
      const valid = current.filter((u) => allUsers.includes(u));
      if (valid.length !== current.length) {
        useAppStore.setState({ selectedUsers: valid.length > 0 ? valid : [...allUsers] });
      }
    }
  }, [allUsers]);

  const filteredUsers = allUsers.filter((u) =>
    u.toLowerCase().includes(userSearch.toLowerCase())
  );

  return (
    <Layout>
      <div className="max-w-[1400px] mx-auto">
        {/* Diagnostic status bar */}
        <div style={{ display: 'flex', gap: 16, marginBottom: 8, fontSize: 11, fontFamily: "'Space Mono', monospace", color: 'var(--muted)' }}>
          <span>PRs: <strong style={{ color: 'var(--text-primary)' }}>{allPRs.length}</strong></span>
          <span>User: <strong style={{ color: currentUser ? 'var(--green)' : 'var(--red)' }}>{currentUser || 'none'}</strong></span>
          <span>Repos: <strong style={{ color: 'var(--text-primary)' }}>{selectedRepos.size}</strong></span>
          <span>API: <strong style={{ color: 'var(--text-primary)' }}>{apiCalls}</strong></span>
          {message?.type === 'error' && (
            <span style={{ color: 'var(--red)' }}>Error: {message.text.slice(0, 60)}</span>
          )}
        </div>
        {sessionChecked && !currentUser && (
          <div
            style={{
              background: 'var(--color-background-warning, #fff3cd)',
              border: '0.5px solid var(--color-border-warning, #ffc107)',
              borderRadius: 8,
              padding: '12px 16px',
              marginBottom: 16,
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              flexWrap: 'wrap',
              fontSize: 13,
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, color: '#856404' }}>
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
              <line x1="12" y1="9" x2="12" y2="13" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
            <span style={{ color: '#856404', flex: 1 }}>
              Not signed in — set a <strong>PAT</strong> in{' '}
              <Link href={`/${locale}/settings`} style={{ textDecoration: 'underline', color: '#856404', fontWeight: 600 }}>Settings</Link>
              {' '}or sign in with GitHub to load PRs. Unauthenticated requests fail and waste your API quota.
            </span>
            <GitHubOAuthButton label="Log in with GitHub" className="text-xs py-1.5 px-3" />
          </div>
        )}
        {/* ── SECTION 1: HEADER TOP ── */}
        <div className="rr-header-row">
          <div className="rr-header-title-group flex items-center gap-3">
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
            </div>
          </div>
          {lastRefreshAt && (
            <Link href={`/${locale}/settings`} style={{ textDecoration: 'none' }}>
              <div className="rr-time-badge" style={{ fontFamily: "'Space Mono', monospace", fontSize: 11, color: 'var(--muted-dim)', padding: '8px 12px', borderRadius: 6, background: 'var(--surface)', border: '0.5px solid var(--border-faint)', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                <span style={{ fontSize: 9, lineHeight: 1, marginBottom: 3, opacity: 0.6 }}>{t('lastRefreshed')}</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <span>{timeAgo}</span>
                  {autoRefreshEnabled && (
                    <span className="inline-flex items-center gap-1.5 ml-2">
                      <span className="h-1.5 w-1.5 rounded-full bg-green animate-pulse"></span>
                    </span>
                  )}
                </div>
              </div>
            </Link>
          )}
          {currentUser && (
            <div
              className="rr-time-badge"
              style={{
                fontSize: 11,
                color: 'var(--muted-dim)',
                padding: '8px 12px',
                borderRadius: 6,
                background: 'var(--surface)',
                border: '0.5px solid var(--border-faint)',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                marginLeft: 'auto',
              }}
            >
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--green)' }} />
              <span>{t('signedInAs', { user: currentUser })}</span>
            </div>
          )}
          <button
            onClick={() => loadPRs({ silent: false })}
            disabled={loading || !currentUser}
            className="rr-btn-primary"
            style={{ marginLeft: 'auto', borderRadius: 6, opacity: !currentUser ? 0.5 : 1, cursor: !currentUser ? 'not-allowed' : 'pointer' }}
            title={!currentUser ? 'Sign in to load PRs' : undefined}
          >
            {loading ? (
              <>
                <svg className="rr-spinner" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <circle cx="12" cy="12" r="10" opacity="0.25" />
                  <path d="M12 2a10 10 0 0 1 10 10" />
                </svg>
                {t('refreshing')}
              </>
            ) : (
              t('loadPRs')
            )}
          </button>
        </div>

        {progress && progress.total > 0 && (
          <div style={{ marginBottom: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
              <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                {progress.phase === 'repos'
                  ? t('progressRepos', { current: progress.current, total: progress.total })
                  : t('progressPRs', { current: progress.current, total: progress.total })}
              </span>
              <span style={{ fontSize: 11, color: 'var(--muted-dim)', fontFamily: "'Space Mono', monospace" }}>
                {Math.round((progress.current / progress.total) * 100)}%
              </span>
            </div>
            <div style={{ height: 4, background: 'var(--surface)', borderRadius: 2, overflow: 'hidden' }}>
              <div
                style={{
                  height: '100%',
                  width: `${(progress.current / progress.total) * 100}%`,
                  background: 'var(--cyan)',
                  transition: 'width 200ms ease-out',
                }}
              />
            </div>
          </div>
        )}

        <div style={{ height: 1, background: 'var(--border-faint)', marginBottom: 16 }} />

        {/* ── SECTION 2: SEARCH & FILTERS ── */}
        <div className="rr-search-filter-row" style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 24 }}>
          {/* Search Input Wrapper */}
          <div className="rr-search-input-wrap" style={{
            flex: 1, display: 'flex', alignItems: 'center', height: 36,
            background: 'var(--surface)', borderRadius: 8, padding: '0 12px',
          }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--text-secondary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: 8, flexShrink: 0 }} aria-hidden="true">
              <circle cx="11" cy="11" r="8" />
              <path d="M21 21l-4.35-4.35" />
            </svg>
            <input
              type="text"
              placeholder={t('searchPlaceholder') || 'Search PRs by title or number...'}
              value={store.searchQuery}
              onChange={(e) => store.setSearchQuery(e.target.value)}
              style={{
                flex: 1, height: '100%', background: 'transparent', border: 'none',
                color: 'var(--text-primary)', fontSize: 13, outline: 'none', padding: 0,
              }}
              onFocus={(e) => { e.currentTarget.parentElement!.style.outline = '2px solid var(--cyan)'; e.currentTarget.parentElement!.style.outlineOffset = '2px'; }}
              onBlur={(e) => { e.currentTarget.parentElement!.style.outline = 'none'; }}
            />
            {(activeFilters.label || activeFilters.status || activeFilters.author || activeFilters.build) && (
              <span style={{
                display: 'inline-flex', alignItems: 'center',
                background: 'var(--color-background-info)', color: 'var(--color-text-info)',
                fontSize: 12, fontWeight: 500, padding: '4px 10px', borderRadius: 8, whiteSpace: 'nowrap',
              }}>
                {activeFilters.author && t('filterPillAuthor', { author: activeFilters.author })}
                {activeFilters.label && t('filterPillLabel', { label: activeFilters.label })}
                {activeFilters.status && t('filterPillStatus', { status: activeFilters.status })}
                {activeFilters.build && t('filterPillBuild', { build: activeFilters.build })}
                <button
                  onClick={() => setActiveFilter(
                    (activeFilters.label && 'label') || (activeFilters.status && 'status') || (activeFilters.author && 'author') || 'build',
                    null
                  )}
                  aria-label={t('clear')}
                  style={{
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                    marginLeft: 6, padding: 0, border: 'none', background: 'none',
                    color: 'inherit', cursor: 'pointer', lineHeight: 1,
                  }}
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </span>
            )}
          </div>

          {/* Users Dropdown */}
          <div className="rr-filter-wrapper" style={{ position: 'relative', flexShrink: 0 }} ref={userDropdownRef}>
            <button
              onClick={() => setUserDropdownOpen(!userDropdownOpen)}
              style={{
                display: 'flex', alignItems: 'center', gap: 8, height: 36, minWidth: 200,
                background: 'var(--ink-light)', border: '0.5px solid var(--border-faint)',
                borderRadius: 8, padding: '0 12px', cursor: 'pointer',
                color: 'var(--text-primary)', fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--surface)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--ink-light)'; }}
            >
              <span>{t('usersLabel') || 'Users:'}</span>
              <span style={{ color: 'var(--muted)', fontWeight: 400 }}>
                {store.selectedUsers.length === allUsers.length
                  ? t('all')
                  : t('selected', { count: store.selectedUsers.length })}
              </span>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.6, marginLeft: 'auto' }}>
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </button>
            {userDropdownOpen && (
              <div
                className="rr-filter-dropdown"
                style={{
                  position: 'absolute', top: '100%', left: 0, marginTop: 4, minWidth: 245,
                  background: 'var(--surface)', border: '0.5px solid var(--border-faint)',
                  borderRadius: 8, boxShadow: '0 4px 12px rgba(0,0,0,0.3)', zIndex: 60, padding: 4,
                }}
              >
                <input
                  type="text"
                  placeholder="Search users..."
                  value={userSearch}
                  onChange={(e) => setUserSearch(e.target.value)}
                  style={{
                    width: '100%', padding: '8px 10px', marginBottom: 4,
                    background: 'var(--ink-light)', border: '0.5px solid var(--border-faint)',
                    borderRadius: 6, color: 'var(--text-primary)', fontSize: 13, outline: 'none', boxSizing: 'border-box',
                  }}
                />
                <div style={{ display: 'flex', gap: 8, padding: '2px 4px 6px' }}>
                  <button onClick={() => { useAppStore.setState({ selectedUsers: [...allUsers] }); setUserDropdownOpen(false); }} style={{ fontSize: 12, color: 'var(--cyan)', background: 'none', border: 'none', cursor: 'pointer' }}>{t('selectAll')}</button>
                  <button onClick={() => { store.clearSelectedUsers(); setUserDropdownOpen(false); }} style={{ fontSize: 12, color: 'var(--cyan)', background: 'none', border: 'none', cursor: 'pointer' }}>{t('clear')}</button>
                </div>
                <div style={{ maxHeight: 200, overflowY: 'auto' }}>
                  {filteredUsers.map((user) => {
                    const userChecked = store.selectedUsers.includes(user);
                    return (
                    <label
                      key={user}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px',
                        cursor: 'pointer', borderRadius: 4,
                        background: userChecked ? 'rgba(0,217,255,0.05)' : 'transparent',
                        color: userChecked ? 'var(--cyan)' : 'var(--text-primary)',
                        fontWeight: userChecked ? 500 : 400,
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--ink-light)'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = userChecked ? 'rgba(0,217,255,0.05)' : 'transparent'; }}
                    >
                      <input
                        type="checkbox"
                        checked={userChecked}
                        onChange={() => store.toggleSelectedUser(user)}
                        style={{ margin: 0, flexShrink: 0, accentColor: 'var(--cyan)' }}
                      />
                      <span style={{ fontSize: 13 }}>{user}</span>
                    </label>
                    );
                  })}
                  {filteredUsers.length === 0 && (
                    <div style={{ padding: '20px 10px', textAlign: 'center', fontSize: 12, color: 'var(--muted-dim)' }}>
                      {allPRs.length === 0 ? t('loadPRsFirst') : t('noUsers')}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Repos Dropdown */}
          <div className="rr-filter-wrapper" style={{ position: 'relative', flexShrink: 0 }} ref={dropdownRef}>
            <button
              onClick={() => setRepoDropdownOpen(!repoDropdownOpen)}
              style={{
                display: 'flex', alignItems: 'center', gap: 8, height: 36, minWidth: 200,
                background: 'var(--ink-light)', border: '0.5px solid var(--border-faint)',
                borderRadius: 8, padding: '0 12px', cursor: 'pointer',
                color: 'var(--text-primary)', fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--surface)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--ink-light)'; }}
            >
              <span>{t('reposLabel') || 'Repos:'}</span>
              <span style={{ color: 'var(--muted)', fontWeight: 400 }}>
                {selectedRepos.size === savedRepos.length
                  ? t('all')
                  : t('selected', { count: selectedRepos.size })}
              </span>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.6, marginLeft: 'auto' }}>
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </button>
            {repoDropdownOpen && (
              <div
                className="rr-filter-dropdown"
                style={{
                  position: 'absolute', top: '100%', left: 0, marginTop: 4, minWidth: 245,
                  background: 'var(--surface)', border: '0.5px solid var(--border-faint)',
                  borderRadius: 8, boxShadow: '0 4px 12px rgba(0,0,0,0.3)', zIndex: 60, padding: 4,
                }}
              >
                <input
                  type="text"
                  placeholder={t('searchReposPlaceholder')}
                  value={repoSearch}
                  onChange={(e) => setRepoSearch(e.target.value)}
                  style={{
                    width: '100%', padding: '8px 10px', marginBottom: 4,
                    background: 'var(--ink-light)', border: '0.5px solid var(--border-faint)',
                    borderRadius: 6, color: 'var(--text-primary)', fontSize: 13, outline: 'none', boxSizing: 'border-box',
                  }}
                />
                <div style={{ display: 'flex', gap: 8, padding: '2px 4px 6px' }}>
                  <button onClick={selectAll} style={{ fontSize: 12, color: 'var(--cyan)', background: 'none', border: 'none', cursor: 'pointer' }}>{t('selectAll')}</button>
                  <button onClick={clearSelection} style={{ fontSize: 12, color: 'var(--cyan)', background: 'none', border: 'none', cursor: 'pointer' }}>{t('clear')}</button>
                </div>
                <div style={{ maxHeight: 200, overflowY: 'auto' }}>
                  {filteredRepos.map((repo: string) => {
                    const repoChecked = selectedRepos.has(repo);
                    return (
                    <label
                      key={repo}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px',
                        cursor: 'pointer', borderRadius: 4,
                        background: repoChecked ? 'rgba(0,217,255,0.05)' : 'transparent',
                        color: repoChecked ? 'var(--cyan)' : 'var(--text-primary)',
                        fontWeight: repoChecked ? 500 : 400,
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--ink-light)'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = repoChecked ? 'rgba(0,217,255,0.05)' : 'transparent'; }}
                    >
                      <input
                        type="checkbox"
                        checked={repoChecked}
                        onChange={() => toggleRepo(repo)}
                        style={{ margin: 0, flexShrink: 0, accentColor: 'var(--cyan)' }}
                      />
                      <span style={{ fontSize: 13, fontFamily: "'Space Mono', monospace" }}>{repo}</span>
                    </label>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── SECTION 3: STATS LABEL ── */}
        <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--muted)', marginBottom: 12 }}>
          {t('prStatusOverview') || 'PR Status Overview'}
        </div>

        {/* ── SECTION 4: STATS CARDS ── */}
        <StatsBar />

        {/* Table */}
        <PRTable onOpenDrawer={setDrawerPR} loading={loading} />

        {/* Drawer */}
        {drawerPR && <PRDrawer pr={drawerPR} onClose={() => setDrawerPR(null)} />}

        {/* Toast */}
        <div aria-live="polite" aria-atomic="true" className="sr-only">
          {message?.text}
        </div>
        {message && (
          <div
            role="status"
            aria-live="polite"
            className={`fixed bottom-6 right-6 z-[100] max-w-[420px] rounded-lg border-l-[3px] px-4 py-3.5 text-[13px] shadow-md backdrop-blur-sm animate-slide-in`}
            style={{
              borderLeftColor: message.type === 'error' ? 'var(--red)' : message.type === 'success' ? 'var(--green)' : 'var(--cyan)',
              background: message.type === 'error' ? 'rgba(239,68,68,0.08)' : message.type === 'success' ? 'rgba(34,197,94,0.08)' : 'rgba(34,211,238,0.08)',
              color: message.type === 'error' ? 'var(--red)' : message.type === 'success' ? 'var(--green)' : 'var(--cyan)',
            }}
          >
            <div className="mb-2">{message.text}</div>
            {message.type === 'error' && message.text.includes('Unauthorized') && (
              <GitHubOAuthButton label="Log in with GitHub" className="text-xs py-1.5 px-3" />
            )}
          </div>
        )}

        {/* Debug panel */}
        <DebugPanel
          loading={loading}
          message={message}
          lastRefreshAt={lastRefreshAt}
          allPRs={allPRs}
          currentUser={currentUser}
          selectedReposSize={selectedRepos.size}
          apiCalls={apiCalls}
        />
      </div>

    </Layout>
  );
}

function DebugPanel({ loading, message, lastRefreshAt, allPRs, currentUser, selectedReposSize, apiCalls }: {
  loading: boolean;
  message: { type: string; text: string } | null;
  lastRefreshAt: number | null;
  allPRs: any[];
  currentUser: string | null;
  selectedReposSize: number;
  apiCalls: number;
}) {
  const [open, setOpen] = useState(false);
  const [netInfo, setNetInfo] = useState({ online: true, type: 'unknown' });

  useEffect(() => {
    setNetInfo({
      online: navigator.onLine,
      type: (navigator as any).connection?.effectiveType || 'unknown',
    });
    const onOnline = () => setNetInfo(p => ({ ...p, online: true }));
    const onOffline = () => setNetInfo(p => ({ ...p, online: false }));
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, []);

  return (
    <div style={{ position: 'fixed', bottom: 80, right: 16, zIndex: 99999 }}>
      <button
        onClick={() => setOpen(!open)}
        style={{
          background: 'var(--surface)',
          border: '0.5px solid var(--border-faint)',
          borderRadius: 8,
          padding: '6px 12px',
          fontSize: 11,
          color: 'var(--muted)',
          cursor: 'pointer',
        }}
      >
        {open ? 'Close Debug' : 'Debug'}
      </button>
      {open && (
        <div
          style={{
            position: 'absolute',
            bottom: '100%',
            right: 0,
            marginBottom: 8,
            width: 320,
            maxHeight: 400,
            overflowY: 'auto',
            background: 'var(--ink-light)',
            border: '0.5px solid var(--border-faint)',
            borderRadius: 8,
            padding: 12,
            fontSize: 11,
            fontFamily: "'Space Mono', monospace",
            color: 'var(--text-primary)',
            boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
          }}
        >
          <div style={{ fontWeight: 700, marginBottom: 8, fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Debug
          </div>
          <div className="flex flex-col gap-1.5">
            <div><span style={{ color: 'var(--muted)' }}>Network:</span> {netInfo.online ? '✅ Online' : '❌ Offline'} ({netInfo.type})</div>
            <div><span style={{ color: 'var(--muted)' }}>UA:</span> {typeof navigator !== 'undefined' ? navigator.userAgent.slice(0, 60) : 'N/A'}</div>
            <div><span style={{ color: 'var(--muted)' }}>Auth User:</span> {currentUser || 'Not signed in'}</div>
            <div><span style={{ color: 'var(--muted)' }}>PRs in store:</span> {allPRs.length}</div>
            <div><span style={{ color: 'var(--muted)' }}>Selected repos:</span> {selectedReposSize}</div>
            <div><span style={{ color: 'var(--muted)' }}>API calls:</span> {apiCalls}</div>
            <div><span style={{ color: 'var(--muted)' }}>Loading:</span> {loading ? 'Yes' : 'No'}</div>
            <div><span style={{ color: 'var(--muted)' }}>Last Refresh:</span> {lastRefreshAt ? new Date(lastRefreshAt).toLocaleTimeString() : 'Never'}</div>
            <div><span style={{ color: 'var(--muted)' }}>Last Error:</span> {message?.type === 'error' ? message.text : 'None'}</div>
            <div><span style={{ color: 'var(--muted)' }}>Sample PRs (first 3):</span></div>
            <div style={{ paddingLeft: 8, maxHeight: 120, overflowY: 'auto', fontSize: 10 }}>
              {allPRs.slice(0, 3).map((pr, i) => (
                <div key={i} style={{ marginBottom: 4, borderBottom: '0.5px solid var(--border-faint)', paddingBottom: 4 }}>
                  <div>#{pr.number} {pr.title?.slice(0, 40)}</div>
                  <div style={{ color: 'var(--muted-dim)' }}>repo: {pr.repository_url?.slice(0, 40)} user: {pr.user?.login}</div>
                </div>
              ))}
              {allPRs.length === 0 && <div style={{ color: 'var(--muted-dim)' }}>No PRs in store</div>}
            </div>
            <div><span style={{ color: 'var(--muted)' }}>Local Storage keys:</span></div>
            <div style={{ paddingLeft: 8, maxHeight: 80, overflowY: 'auto' }}>
              {(() => {
                const keys: string[] = [];
                for (let i = 0; i < localStorage.length; i++) {
                  const k = localStorage.key(i);
                  if (k) keys.push(k);
                }
                return keys.length > 0
                  ? keys.map(k => <div key={k} style={{ color: 'var(--muted-dim)' }}>{k}</div>)
                  : <div style={{ color: 'var(--muted-dim)' }}>Empty</div>;
              })()}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
