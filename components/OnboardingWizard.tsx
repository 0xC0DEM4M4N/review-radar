'use client';

import { useState, useEffect, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { useAppStore } from '@/lib/store';
import GitHubOAuthButton from './GitHubOAuthButton';
import { checkSession, saveSession } from '@/lib/apiClient';

const TOTAL = 5;

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
    /* noop */
  }
}

export default function OnboardingWizard() {
  const onboardingStep = useAppStore((s) => s.onboardingStep);
  const setOnboardingStep = useAppStore((s) => s.setOnboardingStep);
  const setColumnOrder = useAppStore((s) => s.setColumnOrder);

  const [authed, setAuthed] = useState(false);
  const [patInput, setPatInput] = useState('');
  const [patSaving, setPatSaving] = useState(false);
  const [patError, setPatError] = useState('');

  const [repoInput, setRepoInput] = useState('');
  const [savedRepos, setSavedRepos] = useState<string[]>(() =>
    loadJSON<string[]>('github-repos', [])
  );

  const [dashboardView, setDashboardView] = useState<'all' | 'urgent' | 'custom'>('urgent');
  const [showAdvanced, setShowAdvanced] = useState(true);

  const [notifMentioned, setNotifMentioned] = useState(true);
  const [notifComments, setNotifComments] = useState(true);
  const [notifBuildFail, setNotifBuildFail] = useState(true);

  useEffect(() => {
    if (onboardingStep === 1) {
      checkSession().then(({ active }) => setAuthed(active));
    }
  }, [onboardingStep]);

  useEffect(() => {
    if (onboardingStep === 2) {
      setSavedRepos(loadJSON<string[]>('github-repos', []));
    }
  }, [onboardingStep]);

  const handleClose = useCallback(() => {
    setOnboardingStep(null);
  }, [setOnboardingStep]);

  const handleSavePat = useCallback(async () => {
    if (!patInput.trim()) return;
    setPatSaving(true);
    setPatError('');
    try {
      await saveSession(patInput.trim());
      setAuthed(true);
      setPatInput('');
    } catch (e: any) {
      setPatError(e.message || 'Failed to save token');
    } finally {
      setPatSaving(false);
    }
  }, [patInput]);

  const handleAddRepo = useCallback(() => {
    const trimmed = repoInput.trim();
    if (!trimmed || !trimmed.includes('/')) return;
    if (savedRepos.includes(trimmed)) {
      setRepoInput('');
      return;
    }
    const next = [...savedRepos, trimmed];
    setSavedRepos(next);
    saveJSON('github-repos', next);
    saveJSON('selected-repos', next);
    setRepoInput('');
  }, [repoInput, savedRepos]);

  const handleRemoveRepo = useCallback((repo: string) => {
    const next = savedRepos.filter((r) => r !== repo);
    setSavedRepos(next);
    saveJSON('github-repos', next);
    saveJSON('selected-repos', next);
  }, [savedRepos]);

  const suggestedRepos = [
    { name: 'facebook/react', stars: '228k' },
    { name: 'torvalds/linux', stars: '183k' },
  ];

  const handleNext = useCallback(() => {
    if (onboardingStep === null) return;

    if (onboardingStep === 2) {
      const selected = loadJSON<string[]>('selected-repos', []);
      if (selected.length === 0) return;
    }

    if (onboardingStep === 3) {
      if (dashboardView === 'urgent') {
        const prioritized: import('@/lib/store').ColumnKey[] = [
          'title', 'status', 'myaction', 'complexity', 'approvals', 'build', 'author', 'comments', 'labels', 'files', 'size', 'effort', 'created', 'updated',
        ];
        setColumnOrder(prioritized);
      } else if (dashboardView === 'all') {
        const allCols: import('@/lib/store').ColumnKey[] = [
          'title', 'author', 'status', 'myaction', 'approvals', 'comments', 'labels', 'build', 'files', 'size', 'complexity', 'effort', 'created', 'updated',
        ];
        setColumnOrder(allCols);
      }

      const colConfig = loadJSON<{ id: string; visible: boolean }[]>('reviewradar-columns', []);
      if (colConfig.length > 0 && !showAdvanced) {
        const updated = colConfig.map((c) => {
          if (c.id === 'complexity' || c.id === 'size' || c.id === 'files') {
            return { ...c, visible: false };
          }
          return c;
        });
        saveJSON('reviewradar-columns', updated);
      }
    }

    if (onboardingStep === TOTAL - 1) {
      if (notifMentioned || notifComments || notifBuildFail) {
        saveJSON('reviewradar-browser-notifs', true);
        if (typeof window !== 'undefined' && 'Notification' in window) {
          Notification.requestPermission();
        }
      }
    }

    if (onboardingStep < TOTAL) {
      setOnboardingStep(onboardingStep + 1);
    }
  }, [onboardingStep, dashboardView, showAdvanced, notifMentioned, notifComments, notifBuildFail, setColumnOrder, setOnboardingStep]);

  const handleSkip = useCallback(() => {
    setOnboardingStep(TOTAL + 1);
  }, [setOnboardingStep]);

  const handleFinish = useCallback(() => {
    handleNext();
  }, [handleNext]);

  const handleComplete = useCallback(() => {
    setOnboardingStep(null);
  }, [setOnboardingStep]);

  if (onboardingStep === null) return null;

  const isLastConfigStep = onboardingStep === TOTAL - 1;
  const isSuccess = onboardingStep === TOTAL + 1;
  const isWelcome = onboardingStep === 0;
  const showStepIndicator = !isWelcome && !isSuccess;

  const canNext = (() => {
    if (onboardingStep === 0) return true;
    if (onboardingStep === 1) return authed;
    if (onboardingStep === 2) return savedRepos.length > 0;
    if (onboardingStep === 3) return true;
    if (onboardingStep === 4) return true;
    return true;
  })();

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center" style={{ fontFamily: "'DM Sans', system-ui, sans-serif" }}>
      <div
        className="absolute inset-0 cursor-pointer"
        style={{ background: 'rgba(0, 0, 0, 0.65)', backdropFilter: 'blur(6px)' }}
        onClick={handleClose}
      />

      <div
          className="relative w-full max-w-lg mx-4 rounded-2xl border overflow-hidden shadow-2xl animate-wizard-enter"
          style={{
          background: 'var(--surface)',
          borderColor: 'var(--border-subtle)',
          boxShadow: '0 25px 60px rgba(0, 0, 0, 0.5)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={handleClose}
          className="absolute top-4 right-4 z-10 flex items-center justify-center rounded-full border-0"
          style={{
            width: 28,
            height: 28,
            background: 'rgba(255,255,255,0.06)',
            color: 'var(--muted)',
            fontSize: 16,
            cursor: 'pointer',
            transition: 'all 0.15s',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.12)'; e.currentTarget.style.color = 'var(--text-primary)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; e.currentTarget.style.color = 'var(--muted)'; }}
          aria-label="Close"
        >
          ✕
        </button>

        {showStepIndicator && (
          <div className="px-8 pt-8 pb-2">
            <div className="flex items-center justify-between mb-3">
              <span
                className="font-mono text-xs tracking-wider uppercase"
                style={{ color: 'var(--muted)' }}
              >
                Step {onboardingStep} of {TOTAL}
              </span>
            </div>
            <div className="flex gap-2">
              {Array.from({ length: TOTAL }).map((_, i) => {
                const stepNum = i + 1;
                const isActive = stepNum === onboardingStep;
                const isDone = stepNum < onboardingStep;
                return (
                  <div
                    key={i}
                    className="h-1 flex-1 rounded-full transition-all duration-300"
                    style={{
                      background: isActive
                        ? 'var(--cyan)'
                        : isDone
                        ? 'var(--cyan-mid)'
                        : 'rgba(255,255,255,0.08)',
                    }}
                  />
                );
              })}
            </div>
          </div>
        )}

        <div className="px-8 py-8" style={{ minHeight: 320 }}>
          {isWelcome && (
            <div className="flex flex-col items-center text-center">
              <div
                className="w-16 h-16 rounded-2xl flex items-center justify-center mb-6"
                style={{ background: 'var(--cyan-dim)', border: '1px solid var(--cyan-mid)' }}
              >
                <svg width="32" height="32" viewBox="0 0 40 40" fill="none">
                  <circle cx="20" cy="20" r="18" stroke="var(--cyan)" strokeWidth="0.5" opacity="0.3" />
                  <circle cx="20" cy="20" r="12" stroke="var(--cyan)" strokeWidth="0.5" opacity="0.2" />
                  <circle cx="20" cy="20" r="6" stroke="var(--cyan)" strokeWidth="0.5" opacity="0.15" />
                  <circle cx="20" cy="20" r="2" fill="var(--cyan)" opacity="0.6" />
                  <circle cx="28" cy="12" r="1.5" fill="var(--cyan)" opacity="0.8" className="rr-radar-blip1" />
                  <path d="M20 20 L38 2" stroke="var(--cyan)" strokeWidth="1" opacity="0.4" className="rr-radar-sweep" />
                </svg>
              </div>
              <h1
                className="text-2xl font-bold mb-2"
                style={{ color: 'var(--text-primary)', fontFamily: "'Space Mono', monospace" }}
              >
                Let&apos;s get ReviewRadar set up
              </h1>
              <p className="mb-8 text-sm max-w-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                We&apos;ll connect to GitHub, add your repos, and customize your dashboard in a few quick steps.
              </p>
            </div>
          )}

          {onboardingStep === 1 && (
            <div>
              <h2
                className="text-xl font-bold mb-2"
                style={{ color: 'var(--text-primary)', fontFamily: "'Space Mono', monospace" }}
              >
                Connect to GitHub
              </h2>
              <p className="mb-6 text-sm" style={{ color: 'var(--text-secondary)' }}>
                ReviewRadar needs access to read your pull requests.
              </p>

              {authed ? (
                <div
                  className="flex items-center gap-3 p-4 rounded-xl mb-4"
                  style={{ background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.2)' }}
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--green)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                  <span className="text-sm font-medium" style={{ color: 'var(--green)' }}>
                    Connected to GitHub
                  </span>
                </div>
              ) : (
                <div className="space-y-4">
                  <GitHubOAuthButton className="w-full justify-center py-3" />
                  <div className="flex items-center gap-3 py-1">
                    <div className="h-px flex-1" style={{ background: 'var(--border-faint)' }} />
                    <span className="text-xs" style={{ color: 'var(--muted-dim)' }}>or enter token manually</span>
                    <div className="h-px flex-1" style={{ background: 'var(--border-faint)' }} />
                  </div>
                  <div className="flex flex-col gap-2">
                    <div className="flex gap-2">
                      <input
                        type="password"
                        value={patInput}
                        onChange={(e) => { setPatInput(e.target.value); setPatError(''); }}
                        onKeyDown={(e) => e.key === 'Enter' && handleSavePat()}
                        placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
                        className="flex-1 rounded-lg border px-3 py-2 text-sm outline-none transition"
                        style={{
                          background: 'var(--ink-light)',
                          borderColor: patError ? 'var(--red)' : 'var(--border-faint)',
                          color: 'var(--text-primary)',
                        }}
                        onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--cyan)'; }}
                        onBlur={(e) => { e.currentTarget.style.borderColor = patError ? 'var(--red)' : 'var(--border-faint)'; }}
                      />
                      <button
                        onClick={handleSavePat}
                        disabled={patSaving || !patInput.trim()}
                        className="shrink-0 rounded-lg px-4 py-2 text-sm font-medium transition disabled:opacity-50"
                        style={{ background: 'var(--cyan-dim)', color: 'var(--cyan)' }}
                        onMouseEnter={(e) => { if (!patSaving && patInput.trim()) e.currentTarget.style.background = 'var(--cyan-mid)'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--cyan-dim)'; }}
                      >
                        {patSaving ? 'Saving...' : 'Save'}
                      </button>
                    </div>
                    {patError && (
                      <p className="text-xs" style={{ color: 'var(--red)' }}>{patError}</p>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {onboardingStep === 2 && (
            <div>
              <h2
                className="text-xl font-bold mb-2"
                style={{ color: 'var(--text-primary)', fontFamily: "'Space Mono', monospace" }}
              >
                Which repos do you review?
              </h2>
              <p className="mb-6 text-sm" style={{ color: 'var(--text-secondary)' }}>
                Start with 1–3. You can add more later.
              </p>

              <div className="flex gap-2 mb-4">
                <input
                  type="text"
                  value={repoInput}
                  onChange={(e) => setRepoInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAddRepo()}
                  placeholder="owner/repo"
                  className="flex-1 rounded-lg border px-3 py-2 text-sm outline-none transition font-mono"
                  style={{
                    background: 'var(--ink-light)',
                    borderColor: 'var(--border-faint)',
                    color: 'var(--text-primary)',
                  }}
                  onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--cyan)'; }}
                  onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--border-faint)'; }}
                />
                <button
                  onClick={handleAddRepo}
                  disabled={!repoInput.trim() || !repoInput.includes('/')}
                  className="shrink-0 rounded-lg px-4 py-2 text-sm font-medium transition disabled:opacity-40"
                  style={{ background: 'var(--cyan-dim)', color: 'var(--cyan)' }}
                  onMouseEnter={(e) => { if (repoInput.includes('/')) e.currentTarget.style.background = 'var(--cyan-mid)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--cyan-dim)'; }}
                >
                  Add
                </button>
              </div>

              <div className="mb-4">
                <p className="text-xs mb-2 font-mono uppercase tracking-wider" style={{ color: 'var(--muted-dim)' }}>
                  Suggestions
                </p>
                <div className="flex flex-wrap gap-2">
                  {suggestedRepos.map((r) => {
                    const alreadyAdded = savedRepos.includes(r.name);
                    return (
                      <button
                        key={r.name}
                        onClick={() => {
                          if (!alreadyAdded) {
                            const next = [...savedRepos, r.name];
                            setSavedRepos(next);
                            saveJSON('github-repos', next);
                            saveJSON('selected-repos', next);
                          }
                        }}
                        disabled={alreadyAdded}
                        className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-mono transition disabled:opacity-40"
                        style={{
                          background: alreadyAdded ? 'var(--cyan-dim)' : 'rgba(255,255,255,0.04)',
                          borderColor: alreadyAdded ? 'var(--cyan-mid)' : 'var(--border-faint)',
                          color: alreadyAdded ? 'var(--cyan)' : 'var(--text-secondary)',
                        }}
                      >
                        {r.name}
                        <span style={{ color: 'var(--muted-dim)', fontSize: 10 }}>⭐{r.stars}</span>
                        {alreadyAdded && (
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {savedRepos.length > 0 && (
                <div>
                  <p className="text-xs mb-2 font-mono uppercase tracking-wider" style={{ color: 'var(--muted-dim)' }}>
                    Selected ({savedRepos.length})
                  </p>
                  <div className="space-y-1.5 max-h-32 overflow-y-auto">
                    {savedRepos.map((repo) => (
                      <div
                        key={repo}
                        className="flex items-center justify-between rounded-lg border px-3 py-1.5"
                        style={{ background: 'var(--ink-light)', borderColor: 'var(--border-faint)' }}
                      >
                        <span className="text-sm font-mono" style={{ color: 'var(--text-primary)' }}>{repo}</span>
                        <button
                          onClick={() => handleRemoveRepo(repo)}
                          className="ml-2 rounded px-1.5 py-0.5 text-xs transition"
                          style={{ color: 'var(--red)' }}
                          onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(239,68,68,0.1)'; }}
                          onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {onboardingStep === 3 && (
            <div>
              <h2
                className="text-xl font-bold mb-2"
                style={{ color: 'var(--text-primary)', fontFamily: "'Space Mono', monospace" }}
              >
                How do you like to review?
              </h2>
              <p className="mb-6 text-sm" style={{ color: 'var(--text-secondary)' }}>
                Choose a view that matches your workflow.
              </p>

              <div className="space-y-3 mb-6">
                {([
                  { value: 'all', label: 'All PRs at a glance', desc: 'See everything — status, author, approvals, build, and more.' },
                  { value: 'urgent', label: 'Prioritize urgent/risky', desc: 'Complexity and status come first. Catch issues fast.' },
                  { value: 'custom', label: "I'll configure columns", desc: 'Start with defaults and customize later in Settings.' },
                ] as const).map((opt) => (
                  <label
                    key={opt.value}
                    className="flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition"
                    style={{
                      background: dashboardView === opt.value ? 'var(--cyan-dim)' : 'var(--ink-light)',
                      borderColor: dashboardView === opt.value ? 'var(--cyan-mid)' : 'var(--border-faint)',
                    }}
                  >
                    <div
                      className="mt-0.5 w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 transition"
                      style={{
                        borderColor: dashboardView === opt.value ? 'var(--cyan)' : 'var(--muted-dim)',
                      }}
                    >
                      {dashboardView === opt.value && (
                        <div className="w-2 h-2 rounded-full" style={{ background: 'var(--cyan)' }} />
                      )}
                    </div>
                    <div>
                      <div className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{opt.label}</div>
                      <div className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>{opt.desc}</div>
                    </div>
                    <input
                      type="radio"
                      name="dashboardView"
                      value={opt.value}
                      checked={dashboardView === opt.value}
                      onChange={() => setDashboardView(opt.value)}
                      className="sr-only"
                    />
                  </label>
                ))}
              </div>

              <label className="flex items-center gap-3 py-2 border-t pt-4" style={{ borderColor: 'var(--border-faint)' }}>
                <div
                  className="relative w-9 h-5 rounded-full cursor-pointer transition-colors"
                  style={{
                    background: showAdvanced ? 'var(--cyan)' : 'rgba(255,255,255,0.1)',
                  }}
                  onClick={() => setShowAdvanced(!showAdvanced)}
                >
                  <div
                    className="absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform"
                    style={{ left: showAdvanced ? 18 : 2 }}
                  />
                </div>
                <input
                  type="checkbox"
                  checked={showAdvanced}
                  onChange={() => setShowAdvanced(!showAdvanced)}
                  className="sr-only"
                />
                <span className="text-sm" style={{ color: 'var(--text-primary)' }}>
                  Show complexity, size, and files columns
                </span>
              </label>
            </div>
          )}

          {onboardingStep === 4 && (
            <div>
              <h2
                className="text-xl font-bold mb-2"
                style={{ color: 'var(--text-primary)', fontFamily: "'Space Mono', monospace" }}
              >
                Stay in the loop
              </h2>
              <p className="mb-6 text-sm" style={{ color: 'var(--text-secondary)' }}>
                We can notify you about important changes.
              </p>

              <div className="space-y-3">
                {[
                  { key: 'mentioned', label: "Reviews I'm mentioned in", state: notifMentioned, setter: setNotifMentioned },
                  { key: 'comments', label: 'Comments on my PRs', state: notifComments, setter: setNotifComments },
                  { key: 'build', label: 'Build failures on risky PRs', state: notifBuildFail, setter: setNotifBuildFail },
                ].map((item) => (
                  <label
                    key={item.key}
                    className="flex items-center gap-3 p-3 rounded-xl cursor-pointer transition"
                    style={{
                      background: item.state ? 'var(--cyan-dim)' : 'var(--ink-light)',
                      border: `1px solid ${item.state ? 'var(--cyan-mid)' : 'var(--border-faint)'}`,
                    }}
                  >
                    <div
                      className="w-5 h-5 rounded flex items-center justify-center shrink-0 transition"
                      style={{
                        background: item.state ? 'var(--cyan)' : 'rgba(255,255,255,0.06)',
                      }}
                    >
                      {item.state && (
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      )}
                    </div>
                    <span className="text-sm" style={{ color: 'var(--text-primary)' }}>{item.label}</span>
                    <input
                      type="checkbox"
                      checked={item.state}
                      onChange={() => item.setter(!item.state)}
                      className="sr-only"
                    />
                  </label>
                ))}
              </div>
            </div>
          )}

          {isSuccess && (
            <div className="flex flex-col items-center text-center">
              <div
                className="w-16 h-16 rounded-2xl flex items-center justify-center mb-6"
                style={{ background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.25)' }}
              >
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--green)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                  <polyline points="22 4 12 14.01 9 11.01" />
                </svg>
              </div>
              <h1
                className="text-2xl font-bold mb-2"
                style={{ color: 'var(--text-primary)', fontFamily: "'Space Mono', monospace" }}
              >
                You&apos;re all set!
              </h1>
              <p className="mb-8 text-sm max-w-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                Your dashboard is ready. Start reviewing your pull requests.
              </p>
            </div>
          )}
        </div>

        <div
          className="px-8 py-5 flex items-center justify-between"
          style={{ borderTop: '1px solid var(--border-faint)' }}
        >
          {isWelcome ? (
            <div />
          ) : (
            !isSuccess && (
              <button
                onClick={() => setOnboardingStep(onboardingStep - 1)}
                className="rounded-lg px-4 py-2 text-sm font-medium transition"
                style={{
                  background: 'rgba(255,255,255,0.04)',
                  color: 'var(--text-secondary)',
                  border: '1px solid var(--border-faint)',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.08)'; e.currentTarget.style.color = 'var(--text-primary)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; e.currentTarget.style.color = 'var(--text-secondary)'; }}
              >
                Back
              </button>
            )
          )}

          <div className="flex gap-2 ml-auto">
            {isWelcome && (
              <button
                onClick={handleNext}
                className="rr-btn-primary"
                style={{ padding: '10px 28px', fontSize: 14 }}
              >
                Next
              </button>
            )}

            {!isWelcome && !isSuccess && (
              <>
                {isLastConfigStep && (
                  <button
                    onClick={handleSkip}
                    className="rounded-lg px-4 py-2 text-sm font-medium transition"
                    style={{
                      color: 'var(--muted)',
                      background: 'transparent',
                      border: '1px solid transparent',
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--text-primary)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--muted)'; }}
                  >
                    Skip
                  </button>
                )}
                <button
                  onClick={isLastConfigStep ? handleFinish : handleNext}
                  disabled={!canNext}
                  className="rounded-lg px-5 py-2 text-sm font-medium transition disabled:opacity-40"
                  style={{
                    background: 'var(--cyan)',
                    color: 'var(--ink-light)',
                    border: 'none',
                    fontFamily: "'Space Mono', monospace",
                    fontWeight: 600,
                    cursor: canNext ? 'pointer' : 'not-allowed',
                  }}
                  onMouseEnter={(e) => { if (canNext) e.currentTarget.style.opacity = '0.85'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.opacity = '1'; }}
                >
                  {isLastConfigStep ? 'Finish' : 'Next'}
                </button>
              </>
            )}

            {isSuccess && (
              <button
                onClick={handleComplete}
                className="rounded-lg px-6 py-2.5 text-sm font-bold transition"
                style={{
                  background: 'var(--cyan)',
                  color: 'var(--ink-light)',
                  border: 'none',
                  fontFamily: "'Space Mono', monospace",
                }}
                onMouseEnter={(e) => { e.currentTarget.style.opacity = '0.85'; }}
                onMouseLeave={(e) => { e.currentTarget.style.opacity = '1'; }}
              >
                Open Dashboard
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
