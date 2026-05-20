'use client';

import React, { useEffect, useRef, useState } from 'react';
import Layout from '@/components/Layout';
import { useTranslations } from 'next-intl';
import { useAppStore, ColumnKey } from '@/lib/store';
import { saveSession, clearSession, checkSession } from '@/lib/apiClient';
import GitHubOAuthButton from '@/components/GitHubOAuthButton';

interface ColumnConfig {
  id: string;
  label: string;
  visible: boolean;
}

function loadJSON<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function saveJSON(key: string, value: unknown) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // ignore
  }
}

export default function SettingsPage() {
  const [mounted, setMounted] = useState(false);
  const t = useTranslations('settings');

  // GitHub PAT
  const [pat, setPat] = useState('');
  const [patSaved, setPatSaved] = useState(false);

  // Repositories
  const [repoInput, setRepoInput] = useState('');
  const [repos, setRepos] = useState<string[]>([]);

  // Auto refresh & notifications
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [refreshInterval, setRefreshInterval] = useState(5);
  const [browserNotifs, setBrowserNotifs] = useState(false);

  // Theme
  const [isLight, setIsLight] = useState(false);

  // Columns
  const [columns, setColumns] = useState<ColumnConfig[]>([]);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const dragOverIdRef = useRef<string | null>(null);
  const storeColumnOrder = useAppStore((s) => s.columnOrder);
  const setStoreColumnOrder = useAppStore((s) => s.setColumnOrder);

  const SETTINGS_TO_STORE_KEY: Record<string, ColumnKey> = {
    'pull-request': 'title',
    'author': 'author',
    'status': 'status',
    'my-action': 'myaction',
    'approvals': 'approvals',
    'comments': 'comments',
    'labels': 'labels',
    'build': 'build',
    'files': 'files',
    'size': 'size',
    'complexity': 'complexity',
    'created': 'created',
    'updated': 'updated',
    'details': 'details',
  };

  const STORE_TO_SETTINGS_KEY: Record<ColumnKey, string> = {
    'title': 'pull-request',
    'author': 'author',
    'status': 'status',
    'myaction': 'my-action',
    'approvals': 'approvals',
    'comments': 'comments',
    'labels': 'labels',
    'build': 'build',
    'files': 'files',
    'size': 'size',
    'complexity': 'complexity',
    'created': 'created',
    'updated': 'updated',
    'details': 'details',
  };

  // Build default columns with translated labels
  useEffect(() => {
    const defaultColumns: ColumnConfig[] = [
      { id: 'pull-request', label: t('colPullRequest'), visible: true },
      { id: 'author', label: t('colAuthor'), visible: true },
      { id: 'status', label: t('colStatus'), visible: true },
      { id: 'my-action', label: t('colMyAction'), visible: true },
      { id: 'approvals', label: t('colApprovals'), visible: true },
      { id: 'comments', label: t('colComments'), visible: true },
      { id: 'labels', label: t('colLabels'), visible: true },
      { id: 'build', label: t('colBuild'), visible: true },
      { id: 'files', label: t('colFiles'), visible: true },
      { id: 'size', label: t('colSize'), visible: true },
      { id: 'complexity', label: t('colComplexity'), visible: true },
      { id: 'created', label: t('colCreated'), visible: true },
      { id: 'updated', label: t('colUpdated'), visible: true },
      { id: 'details', label: t('colDetails'), visible: true },
    ];

    // Load saved visibility from localStorage, but sync order from Zustand store
    const saved = loadJSON<ColumnConfig[]>('reviewradar-columns', defaultColumns);

    // Reorder to match store's columnOrder
    const ordered: ColumnConfig[] = [];
    const seen = new Set<string>();
    for (const key of storeColumnOrder) {
      const settingsId = STORE_TO_SETTINGS_KEY[key];
      const found = saved.find((c) => c.id === settingsId);
      if (found) {
        ordered.push({ ...found, id: settingsId });
        seen.add(settingsId);
      }
    }
    // Append any missing columns
    for (const col of saved) {
      if (!seen.has(col.id)) {
        ordered.push(col);
      }
    }

    setColumns(ordered);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [t]);

  // Load from localStorage
  useEffect(() => {
    setMounted(true);

    checkSession().then((active) => {
      setPatSaved(active);
    });

    setRepos(loadJSON<string[]>('github-repos', []));

    setAutoRefresh(loadJSON('reviewradar-auto-refresh', false));
    setRefreshInterval(loadJSON('reviewradar-refresh-interval', 5));
    setBrowserNotifs(loadJSON('reviewradar-browser-notifs', false));

    const light = document.documentElement.classList.contains('light-mode');
    setIsLight(light);
  }, []);

  // Save handlers
  const savePat = async () => {
    try {
      await saveSession(pat);
      setPatSaved(true);
      setPat('');
      setTimeout(() => setPatSaved(false), 2000);
    } catch (e: any) {
      alert(e.message || 'Failed to save PAT');
    }
  };

  const addRepo = () => {
    const trimmed = repoInput.trim();
    if (!trimmed) return;
    if (!trimmed.includes('/')) return;
    if (repos.includes(trimmed)) return;
    const next = [...repos, trimmed];
    setRepos(next);
    saveJSON('github-repos', next);
    // Also auto-select the newly added repo
    const selected = loadJSON<string[]>('selected-repos', []);
    if (!selected.includes(trimmed)) {
      const nextSelected = [...selected, trimmed];
      saveJSON('selected-repos', nextSelected);
    }
    setRepoInput('');
  };

  const removeRepo = (repo: string) => {
    const next = repos.filter((r) => r !== repo);
    setRepos(next);
    saveJSON('github-repos', next);
    // Also deselect the removed repo
    const selected = loadJSON<string[]>('selected-repos', []);
    const nextSelected = selected.filter((r) => r !== repo);
    saveJSON('selected-repos', nextSelected);
  };

  const handleAutoRefreshChange = (v: boolean) => {
    setAutoRefresh(v);
    saveJSON('reviewradar-auto-refresh', v);
  };

  const handleRefreshIntervalChange = (v: number) => {
    const clamped = Math.min(60, Math.max(1, v));
    setRefreshInterval(clamped);
    saveJSON('reviewradar-refresh-interval', clamped);
  };

  const handleBrowserNotifsChange = async (v: boolean) => {
    if (v && typeof window !== 'undefined' && 'Notification' in window) {
      const perm = await Notification.requestPermission();
      if (perm !== 'granted') {
        setBrowserNotifs(false);
        saveJSON('reviewradar-browser-notifs', false);
        return;
      }
    }
    setBrowserNotifs(v);
    saveJSON('reviewradar-browser-notifs', v);
  };

  const toggleTheme = (light: boolean) => {
    setIsLight(light);
    if (light) {
      document.documentElement.classList.add('light-mode');
    } else {
      document.documentElement.classList.remove('light-mode');
    }
  };

  // Column drag and drop
  const handleDragStart = (e: React.DragEvent, id: string) => {
    setDraggingId(id);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', id);
  };

  const handleDragOver = (e: React.DragEvent, id: string) => {
    e.preventDefault();
    dragOverIdRef.current = id;
  };

  const handleDrop = (e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    const sourceId = e.dataTransfer.getData('text/plain') || draggingId;
    if (!sourceId || sourceId === targetId) {
      setDraggingId(null);
      dragOverIdRef.current = null;
      return;
    }
    setColumns((prev) => {
      const fromIndex = prev.findIndex((c) => c.id === sourceId);
      const toIndex = prev.findIndex((c) => c.id === targetId);
      if (fromIndex === -1 || toIndex === -1) return prev;
      const next = [...prev];
      const [moved] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, moved);
      return next;
    });
    setDraggingId(null);
    dragOverIdRef.current = null;
  };

  const handleDragEnd = () => {
    setDraggingId(null);
    dragOverIdRef.current = null;
  };

  const toggleColumnVisibility = (id: string) => {
    setColumns((prev) =>
      prev.map((c) => (c.id === id ? { ...c, visible: !c.visible } : c))
    );
  };

  const applyColumnsToStore = (next: ColumnConfig[]) => {
    const visibleKeys: ColumnKey[] = [];
    for (const col of next) {
      if (col.visible) {
        const key = SETTINGS_TO_STORE_KEY[col.id];
        if (key) visibleKeys.push(key);
      }
    }
    setStoreColumnOrder(visibleKeys);
  };

  const saveColumns = () => {
    saveJSON('reviewradar-columns', columns);
    applyColumnsToStore(columns);
  };

  const resetColumns = () => {
    const defaultColumns: ColumnConfig[] = [
      { id: 'pull-request', label: t('colPullRequest'), visible: true },
      { id: 'author', label: t('colAuthor'), visible: true },
      { id: 'status', label: t('colStatus'), visible: true },
      { id: 'my-action', label: t('colMyAction'), visible: true },
      { id: 'approvals', label: t('colApprovals'), visible: true },
      { id: 'comments', label: t('colComments'), visible: true },
      { id: 'labels', label: t('colLabels'), visible: true },
      { id: 'build', label: t('colBuild'), visible: true },
      { id: 'files', label: t('colFiles'), visible: true },
      { id: 'size', label: t('colSize'), visible: true },
      { id: 'complexity', label: t('colComplexity'), visible: true },
      { id: 'created', label: t('colCreated'), visible: true },
      { id: 'updated', label: t('colUpdated'), visible: true },
      { id: 'details', label: t('colDetails'), visible: true },
    ];
    setColumns(defaultColumns);
    saveJSON('reviewradar-columns', defaultColumns);
    applyColumnsToStore(defaultColumns);
  };

  // Data management
  const clearRepos = () => {
    if (!window.confirm(t('confirmClearRepos'))) return;
    setRepos([]);
    localStorage.removeItem('github-repos');
  };

  const clearAllData = async () => {
    if (!window.confirm(t('confirmClearAll'))) return;
    localStorage.clear();
    await clearSession();
    setRepos([]);
    setPat('');
    setPatSaved(false);
    setAutoRefresh(false);
    setRefreshInterval(5);
    setBrowserNotifs(false);
    resetColumns();
  };

  if (!mounted) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-full">
          <div className="text-muted">{t('loading')}</div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
    <div className="px-6 py-8">
      <div className="mx-auto max-w-3xl space-y-6">
        <h1 className="text-2xl font-semibold tracking-tight text-cyan">{t('title')}</h1>

        {/* GitHub Authentication */}
        <section className="rounded-xl border border-border-faint bg-surface p-5">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-muted">
            {t('patTitle')}
          </h2>

          <div className="flex flex-col gap-3">
            <GitHubOAuthButton returnTo={typeof window !== 'undefined' ? window.location.pathname : '/'} />

            <div className="flex items-center gap-3 py-1">
              <div className="h-px flex-1 bg-border-faint" />
              <span className="text-xs text-muted-dim">or enter token manually</span>
              <div className="h-px flex-1 bg-border-faint" />
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <input
                type="password"
                value={pat}
                onChange={(e) => {
                  setPat(e.target.value);
                  setPatSaved(false);
                }}
                placeholder={t('patPlaceholder')}
                className="w-full flex-1 rounded-lg border border-border-faint bg-ink-light px-3 py-2 text-sm text-text-primary outline-none placeholder:text-muted-dim focus:border-cyan focus:ring-1 focus:ring-cyan"
              />
              <button
                onClick={savePat}
                className="shrink-0 rounded-lg bg-cyan-dim px-4 py-2 text-sm font-medium text-cyan transition hover:bg-cyan-mid"
              >
                {t('save')}
              </button>
            </div>
          </div>
          {patSaved && (
            <p className="mt-2 text-xs text-green">{t('patSaved')}</p>
          )}
        </section>

        {/* Saved Repositories */}
        <section className="rounded-xl border border-border-faint bg-surface p-5">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-muted">
            {t('reposTitle')}
          </h2>
          <div className="flex gap-2">
            <input
              type="text"
              value={repoInput}
              onChange={(e) => setRepoInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addRepo()}
              placeholder={t('repoPlaceholder')}
              className="w-full flex-1 rounded-lg border border-border-faint bg-ink-light px-3 py-2 text-sm text-text-primary outline-none placeholder:text-muted-dim focus:border-cyan focus:ring-1 focus:ring-cyan"
            />
            <button
              onClick={addRepo}
              className="shrink-0 rounded-lg bg-cyan-dim px-4 py-2 text-sm font-medium text-cyan transition hover:bg-cyan-mid"
            >
              {t('add')}
            </button>
          </div>
          <div className="mt-3 space-y-2">
            {repos.length === 0 && (
              <p className="text-sm text-muted-dim">{t('noRepos')}</p>
            )}
            {repos.map((repo) => (
              <div
                key={repo}
                className="flex items-center justify-between rounded-lg border border-border-faint bg-ink-light px-3 py-2"
              >
                <span className="text-sm text-text-primary">{repo}</span>
                <button
                  onClick={() => removeRepo(repo)}
                  className="ml-3 rounded-md px-2 py-1 text-xs font-medium text-red transition hover:bg-red/10"
                  aria-label={`Remove ${repo}`}
                  title="Remove"
                >
                  {t('remove')}
                </button>
              </div>
            ))}
          </div>
        </section>

        {/* Auto Refresh & Notifications */}
        <section className="rounded-xl border border-border-faint bg-surface p-5">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-muted">
            {t('autoRefreshTitle')}
          </h2>
          <div className="space-y-4">
            <label className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={autoRefresh}
                onChange={(e) => handleAutoRefreshChange(e.target.checked)}
                className="h-4 w-4 accent-cyan"
              />
              <span className="text-sm text-text-primary">{t('enableAutoRefresh')}</span>
            </label>

            <div className="flex items-center gap-3">
              <span className="text-sm text-muted">{t('refreshInterval')}</span>
              <input
                type="number"
                min={1}
                max={60}
                value={refreshInterval}
                onChange={(e) => handleRefreshIntervalChange(Number(e.target.value))}
                className="w-20 rounded-lg border border-border-faint bg-ink-light px-3 py-2 text-sm text-text-primary outline-none focus:border-cyan focus:ring-1 focus:ring-cyan"
              />
              <span className="text-sm text-muted">{t('minutes')}</span>
            </div>

            <label className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={browserNotifs}
                onChange={(e) => handleBrowserNotifsChange(e.target.checked)}
                className="h-4 w-4 accent-cyan"
              />
              <span className="text-sm text-text-primary">{t('browserNotifications')}</span>
            </label>
          </div>
        </section>

        {/* Theme */}
        <section className="rounded-xl border border-border-faint bg-surface p-5">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-muted">{t('themeTitle')}</h2>
          <div className="flex gap-2">
            <button
              onClick={() => toggleTheme(false)}
              className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
                !isLight
                  ? 'bg-cyan-dim text-cyan'
                  : 'border border-border-faint text-muted hover:text-text-primary'
              }`}
            >
              {t('dark')}
            </button>
            <button
              onClick={() => toggleTheme(true)}
              className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
                isLight
                  ? 'bg-cyan-dim text-cyan'
                  : 'border border-border-faint text-muted hover:text-text-primary'
              }`}
            >
              {t('light')}
            </button>
          </div>
        </section>

        {/* Table Columns */}
        <section className="rounded-xl border border-border-faint bg-surface p-5">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-muted">
            {t('columnsTitle')}
          </h2>
          <div className="space-y-1">
            {columns.map((col) => (
              <div
                key={col.id}
                draggable
                onDragStart={(e) => handleDragStart(e, col.id)}
                onDragOver={(e) => handleDragOver(e, col.id)}
                onDrop={(e) => handleDrop(e, col.id)}
                onDragEnd={handleDragEnd}
                className={`flex cursor-move items-center gap-3 rounded-lg border px-3 py-2 transition ${
                  draggingId === col.id
                    ? 'border-cyan bg-cyan-dim opacity-70'
                    : 'border-border-faint bg-ink-light hover:border-border-subtle'
                }`}
              >
                <span className="select-none text-muted" title={t('dragHandleTitle')}>
                  {t('dragHandle')}
                </span>
                <input
                  type="checkbox"
                  checked={col.visible}
                  onChange={() => toggleColumnVisibility(col.id)}
                  className="h-4 w-4 accent-cyan"
                />
                <span className="text-sm text-text-primary">{col.label}</span>
              </div>
            ))}
          </div>
          <div className="mt-4 flex gap-2">
            <button
              onClick={saveColumns}
              className="rounded-lg bg-cyan-dim px-4 py-2 text-sm font-medium text-cyan transition hover:bg-cyan-mid"
            >
              {t('saveColumns')}
            </button>
            <button
              onClick={resetColumns}
              className="rounded-lg border border-border-faint px-4 py-2 text-sm font-medium text-muted transition hover:text-text-primary"
            >
              {t('resetColumns')}
            </button>
          </div>
        </section>

        {/* Data Management */}
        <section className="rounded-xl border border-border-faint bg-surface p-5">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-muted">
            {t('dataManagementTitle')}
          </h2>
          <div className="flex flex-wrap gap-3">
            <button
              onClick={clearRepos}
              className="rounded-lg border border-border-faint px-4 py-2 text-sm font-medium text-muted transition hover:text-text-primary"
            >
              {t('clearRepos')}
            </button>
            <button
              onClick={clearAllData}
              className="rounded-lg bg-red/10 px-4 py-2 text-sm font-medium text-red transition hover:bg-red/20"
            >
              {t('clearAllData')}
            </button>
          </div>
        </section>
      </div>
    </div>
    </Layout>
  );
}
