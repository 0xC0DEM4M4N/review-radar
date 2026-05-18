'use client';

import React, { useEffect, useRef, useState } from 'react';
import Layout from '@/components/Layout';

interface ColumnConfig {
  id: string;
  label: string;
  visible: boolean;
}

const DEFAULT_COLUMNS: ColumnConfig[] = [
  { id: 'pull-request', label: 'Pull request', visible: true },
  { id: 'author', label: 'Author', visible: true },
  { id: 'status', label: 'Status', visible: true },
  { id: 'my-action', label: 'My Action', visible: true },
  { id: 'approvals', label: 'Approvals', visible: true },
  { id: 'comments', label: 'Comments', visible: true },
  { id: 'labels', label: 'Labels', visible: true },
  { id: 'build', label: 'Build', visible: true },
  { id: 'created', label: 'Created', visible: true },
  { id: 'updated', label: 'Updated', visible: true },
  { id: 'details', label: 'Details', visible: true },
];

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
  const [columns, setColumns] = useState<ColumnConfig[]>(DEFAULT_COLUMNS);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const dragOverIdRef = useRef<string | null>(null);

  // Load from localStorage
  useEffect(() => {
    setMounted(true);

    const savedPat = localStorage.getItem('github-pat') || '';
    setPat(savedPat);
    setPatSaved(!!savedPat);

    setRepos(loadJSON<string[]>('github-repos', []));

    setAutoRefresh(loadJSON('reviewradar-auto-refresh', false));
    setRefreshInterval(loadJSON('reviewradar-refresh-interval', 5));
    setBrowserNotifs(loadJSON('reviewradar-browser-notifs', false));

    const light = document.documentElement.classList.contains('light-mode');
    setIsLight(light);

    setColumns(loadJSON<ColumnConfig[]>('reviewradar-columns', DEFAULT_COLUMNS));
  }, []);

  // Save handlers
  const savePat = () => {
    localStorage.setItem('github-pat', pat);
    setPatSaved(true);
    setTimeout(() => setPatSaved(false), 2000);
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

  const saveColumns = () => {
    saveJSON('reviewradar-columns', columns);
  };

  const resetColumns = () => {
    setColumns(DEFAULT_COLUMNS);
    saveJSON('reviewradar-columns', DEFAULT_COLUMNS);
  };

  // Data management
  const clearRepos = () => {
    if (!window.confirm('Clear all saved repositories?')) return;
    setRepos([]);
    localStorage.removeItem('github-repos');
  };

  const clearAllData = () => {
    if (!window.confirm('This will clear ALL locally stored data. Are you sure?')) return;
    localStorage.clear();
    setRepos([]);
    setPat('');
    setPatSaved(false);
    setAutoRefresh(false);
    setRefreshInterval(5);
    setBrowserNotifs(false);
    setColumns(DEFAULT_COLUMNS);
  };

  if (!mounted) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-full">
          <div className="text-muted">Loading settings…</div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
    <div className="px-6 py-8">
      <div className="mx-auto max-w-3xl space-y-6">
        <h1 className="text-2xl font-semibold tracking-tight text-cyan">Settings</h1>

        {/* GitHub Access Token */}
        <section className="rounded-xl border border-border-faint bg-surface p-5">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-muted">
            GitHub Access Token
          </h2>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <input
              type="password"
              value={pat}
              onChange={(e) => {
                setPat(e.target.value);
                setPatSaved(false);
              }}
              placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
              className="w-full flex-1 rounded-lg border border-border-faint bg-ink-light px-3 py-2 text-sm text-text-primary outline-none placeholder:text-muted-dim focus:border-cyan focus:ring-1 focus:ring-cyan"
            />
            <button
              onClick={savePat}
              className="shrink-0 rounded-lg bg-cyan-dim px-4 py-2 text-sm font-medium text-cyan transition hover:bg-cyan-mid"
            >
              Save
            </button>
          </div>
          {patSaved && (
            <p className="mt-2 text-xs text-green">Token saved successfully.</p>
          )}
        </section>

        {/* Saved Repositories */}
        <section className="rounded-xl border border-border-faint bg-surface p-5">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-muted">
            Saved Repositories
          </h2>
          <div className="flex gap-2">
            <input
              type="text"
              value={repoInput}
              onChange={(e) => setRepoInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addRepo()}
              placeholder="owner/repo"
              className="w-full flex-1 rounded-lg border border-border-faint bg-ink-light px-3 py-2 text-sm text-text-primary outline-none placeholder:text-muted-dim focus:border-cyan focus:ring-1 focus:ring-cyan"
            />
            <button
              onClick={addRepo}
              className="shrink-0 rounded-lg bg-cyan-dim px-4 py-2 text-sm font-medium text-cyan transition hover:bg-cyan-mid"
            >
              Add
            </button>
          </div>
          <div className="mt-3 space-y-2">
            {repos.length === 0 && (
              <p className="text-sm text-muted-dim">No repositories saved yet.</p>
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
                  ✕
                </button>
              </div>
            ))}
          </div>
        </section>

        {/* Auto Refresh & Notifications */}
        <section className="rounded-xl border border-border-faint bg-surface p-5">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-muted">
            Auto Refresh & Notifications
          </h2>
          <div className="space-y-4">
            <label className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={autoRefresh}
                onChange={(e) => handleAutoRefreshChange(e.target.checked)}
                className="h-4 w-4 accent-cyan"
              />
              <span className="text-sm text-text-primary">Enable auto-refresh</span>
            </label>

            <div className="flex items-center gap-3">
              <span className="text-sm text-muted">Refresh interval</span>
              <input
                type="number"
                min={1}
                max={60}
                value={refreshInterval}
                onChange={(e) => handleRefreshIntervalChange(Number(e.target.value))}
                className="w-20 rounded-lg border border-border-faint bg-ink-light px-3 py-2 text-sm text-text-primary outline-none focus:border-cyan focus:ring-1 focus:ring-cyan"
              />
              <span className="text-sm text-muted">minutes</span>
            </div>

            <label className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={browserNotifs}
                onChange={(e) => handleBrowserNotifsChange(e.target.checked)}
                className="h-4 w-4 accent-cyan"
              />
              <span className="text-sm text-text-primary">Browser notifications</span>
            </label>
          </div>
        </section>

        {/* Theme */}
        <section className="rounded-xl border border-border-faint bg-surface p-5">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-muted">Theme</h2>
          <div className="flex gap-2">
            <button
              onClick={() => toggleTheme(false)}
              className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
                !isLight
                  ? 'bg-cyan-dim text-cyan'
                  : 'border border-border-faint text-muted hover:text-text-primary'
              }`}
            >
              Dark
            </button>
            <button
              onClick={() => toggleTheme(true)}
              className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
                isLight
                  ? 'bg-cyan-dim text-cyan'
                  : 'border border-border-faint text-muted hover:text-text-primary'
              }`}
            >
              Light
            </button>
          </div>
        </section>

        {/* Table Columns */}
        <section className="rounded-xl border border-border-faint bg-surface p-5">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-muted">
            Table Columns
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
                <span className="select-none text-muted" title="Drag to reorder">
                  ☰
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
              Save
            </button>
            <button
              onClick={resetColumns}
              className="rounded-lg border border-border-faint px-4 py-2 text-sm font-medium text-muted transition hover:text-text-primary"
            >
              Reset
            </button>
          </div>
        </section>

        {/* Data Management */}
        <section className="rounded-xl border border-border-faint bg-surface p-5">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-muted">
            Data Management
          </h2>
          <div className="flex flex-wrap gap-3">
            <button
              onClick={clearRepos}
              className="rounded-lg border border-border-faint px-4 py-2 text-sm font-medium text-muted transition hover:text-text-primary"
            >
              Clear saved repositories
            </button>
            <button
              onClick={clearAllData}
              className="rounded-lg bg-red/10 px-4 py-2 text-sm font-medium text-red transition hover:bg-red/20"
            >
              Clear All Data
            </button>
          </div>
        </section>
      </div>
    </div>
    </Layout>
  );
}
