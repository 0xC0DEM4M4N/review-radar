'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import Link from 'next/link';
import Layout from '@/components/Layout';
import GitHubOAuthButton from '@/components/GitHubOAuthButton';
import { useTranslations, useLocale } from 'next-intl';
import { checkSession } from '@/lib/apiClient';
import {
  fetchRepo,
  fetchWorkflowRuns,
  fetchRunJobs,
  fetchCommitCheckRuns,
  WorkflowRun,
  WorkflowJob,
} from '@/lib/githubApi';

function loadJSON<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function formatDuration(started?: string, completed?: string): string | null {
  if (!started) return null;
  const start = new Date(started).getTime();
  const end = completed ? new Date(completed).getTime() : Date.now();
  const seconds = Math.floor((end - start) / 1000);
  if (seconds < 60) return `${seconds}s`;
  const mins = Math.floor(seconds / 60);
  if (mins < 60) return `${mins}m ${seconds % 60}s`;
  const hours = Math.floor(mins / 60);
  return `${hours}h ${mins % 60}m`;
}

function useTimeAgo(iso?: string, locale = 'en') {
  const [ago, setAgo] = useState('');
  useEffect(() => {
    if (!iso) {
      setAgo('');
      return;
    }
    const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });
    const update = () => {
      const diffSec = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
      if (diffSec < 60) setAgo(rtf.format(-diffSec, 'seconds'));
      else if (diffSec < 3600) setAgo(rtf.format(-Math.floor(diffSec / 60), 'minutes'));
      else if (diffSec < 86400) setAgo(rtf.format(-Math.floor(diffSec / 3600), 'hours'));
      else setAgo(rtf.format(-Math.floor(diffSec / 86400), 'days'));
    };
    update();
    const id = setInterval(update, 30000);
    return () => clearInterval(id);
  }, [iso, locale]);
  return ago;
}

function firstLine(message?: string): string {
  if (!message) return '';
  return message.split('\n')[0];
}

type TaskItem = {
  name: string;
  status: string;
  conclusion: string | null;
  started_at?: string;
  completed_at?: string;
  html_url?: string;
};

type BranchData = {
  branch: string;
  commitMessage: string;
  commitSha: string;
  commitTime: string;
  runNumber: number;
  runUrl: string;
  overallStatus: string;
  overallConclusion: string | null;
  jobs: TaskItem[];
  checks: TaskItem[];
};

const STATUS_THEME: Record<string, { bg: string; label: string }> = {
  success: { bg: 'var(--green)', label: 'Passing' },
  failure: { bg: 'var(--red)', label: 'Failing' },
  in_progress: { bg: 'var(--amber)', label: 'Running' },
  running: { bg: 'var(--amber)', label: 'Running' },
  queued: { bg: 'var(--muted)', label: 'Queued' },
  skipped: { bg: 'var(--muted-dim)', label: 'Skipped' },
  cancelled: { bg: 'var(--red)', label: 'Cancelled' },
  neutral: { bg: 'var(--muted)', label: 'Neutral' },
};

function getStatus(key?: string | null) {
  return STATUS_THEME[key || ''] || { bg: 'var(--muted)', label: key || 'Unknown' };
}

function computeOverallStatus(
  run: WorkflowRun,
  jobs: TaskItem[],
  checks: TaskItem[]
): { overallStatus: string; overallConclusion: string | null } {
  const allTasks = [...jobs, ...checks];

  const hasFailure = allTasks.some(
    (t) => t.conclusion === 'failure' || t.conclusion === 'cancelled' || t.conclusion === 'timed_out'
  );
  if (hasFailure) return { overallStatus: 'failure', overallConclusion: 'failure' };

  const hasRunning = allTasks.some(
    (t) => t.status === 'in_progress' || t.status === 'queued'
  );
  if (hasRunning) return { overallStatus: 'in_progress', overallConclusion: null };

  if (run.conclusion === 'failure' || run.conclusion === 'cancelled' || run.conclusion === 'timed_out') {
    return { overallStatus: 'failure', overallConclusion: run.conclusion };
  }
  if (run.status === 'in_progress' || run.status === 'queued') {
    return { overallStatus: 'in_progress', overallConclusion: null };
  }
  if (run.conclusion === 'success') {
    return { overallStatus: 'success', overallConclusion: 'success' };
  }

  return { overallStatus: run.status, overallConclusion: run.conclusion };
}

function getFailingSummary(jobs: TaskItem[], checks: TaskItem[]): string | null {
  const failing = [...jobs, ...checks].filter(
    (t) => t.conclusion === 'failure' || t.conclusion === 'cancelled' || t.conclusion === 'timed_out'
  );
  if (failing.length === 0) return null;
  const names = failing.map((t) => t.name);
  if (names.length <= 2) return names.join(', ');
  return `${names[0]}, ${names[1]} (+${names.length - 2} more)`;
}

function getRunningSummary(jobs: TaskItem[], checks: TaskItem[]): string | null {
  const running = [...jobs, ...checks].find(
    (t) => t.status === 'in_progress' || t.status === 'queued'
  );
  return running?.name || null;
}

function isFailing(status: string) {
  return status === 'failure' || status === 'cancelled' || status === 'timed_out';
}

function isRunning(status: string) {
  return status === 'in_progress' || status === 'queued' || status === 'running';
}

function StatusBadge({ status, conclusion }: { status: string; conclusion?: string | null }) {
  const { bg, label } = getStatus(conclusion || status);
  return (
    <span
      className="inline-flex shrink-0 items-center gap-1 rounded px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-white"
      style={{ background: bg }}
    >
      {label}
    </span>
  );
}

function TaskRow({ task }: { task: TaskItem }) {
  const duration = formatDuration(task.started_at, task.completed_at);
  const status = getStatus(task.conclusion || task.status);
  const isFailed = task.conclusion === 'failure' || task.conclusion === 'cancelled' || task.conclusion === 'timed_out';
  return (
    <div
      className={`flex items-center justify-between gap-4 rounded-md border px-3 py-2 ${
        isFailed ? 'border-red/30' : 'border-border-faint'
      }`}
      style={isFailed ? { background: 'rgba(239,68,68,0.06)' } : { background: 'var(--surface)' }}
    >
      <div className="min-w-0 flex-1 truncate text-sm font-medium text-text-primary">
        {task.name}
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <span
          className="inline-flex items-center rounded px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-white"
          style={{ background: status.bg }}
        >
          {status.label}
        </span>
        {duration && <span className="text-xs text-muted-dim">{duration}</span>}
      </div>
    </div>
  );
}

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      className={`h-4 w-4 text-muted transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      viewBox="0 0 24 24"
    >
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}

function BranchIcon() {
  return (
    <svg className="h-4 w-4 shrink-0 text-muted" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
      <path d="M6 3v12a3 3 0 0 0 3 3h6" />
      <path d="M6 3a3 3 0 1 0 0-6 3 3 0 0 0 0 6z" />
      <path d="M18 9a3 3 0 1 0 0-6 3 3 0 0 0 0 6z" />
      <path d="M18 21a3 3 0 1 0 0-6 3 3 0 0 0 0 6z" />
      <path d="M6 15v6" />
      <path d="M9 18h6" />
    </svg>
  );
}

function PinIcon() {
  return (
    <svg className="h-3.5 w-3.5 text-cyan" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
      <path d="M12 2v10l4 4v2H8v-2l4-4V2z" />
      <path d="M8 22h8" />
    </svg>
  );
}

function SpinnerIcon() {
  return (
    <svg className="rr-spinner h-3.5 w-3.5 text-amber" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
      <circle cx="12" cy="12" r="10" opacity="0.25" />
      <path d="M12 2a10 10 0 0 1 10 10" />
    </svg>
  );
}

export default function WorkflowsPage() {
  const t = useTranslations('workflows');
  const locale = useLocale();
  const [mounted, setMounted] = useState(false);
  const [sessionChecked, setSessionChecked] = useState(false);
  const [currentUser, setCurrentUser] = useState<string | null>(null);
  const [savedRepos, setSavedRepos] = useState<string[]>([]);
  const [repo, setRepo] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mainBranch, setMainBranch] = useState<string | null>(null);
  const [branchesData, setBranchesData] = useState<BranchData[]>([]);
  const [expandedBranches, setExpandedBranches] = useState<Set<string>>(new Set());
  const hasAutoLoaded = useRef(false);

  const toggleBranch = useCallback((branch: string) => {
    setExpandedBranches((prev) => {
      const next = new Set(prev);
      if (next.has(branch)) next.delete(branch);
      else next.add(branch);
      return next;
    });
  }, []);

  useEffect(() => {
    setMounted(true);
    checkSession()
      .then((session) => setCurrentUser(session.active ? session.user : null))
      .catch(() => setCurrentUser(null))
      .finally(() => setSessionChecked(true));

    const repos = loadJSON<string[]>('github-repos', []);
    setSavedRepos(repos);
    const selected = loadJSON<string[]>('selected-repos', []);
    const defaultRepo = selected[0] || repos[0] || '';
    setRepo(defaultRepo);
  }, []);

  const load = useCallback(async () => {
    if (!repo) return;
    setLoading(true);
    setError(null);
    setMainBranch(null);
    setBranchesData([]);
    setExpandedBranches(new Set());

    try {
      const repoInfo = await fetchRepo(repo);
      const repoBranches = loadJSON<Record<string, string>>('reviewradar-repo-branches', {});
      const defaultBranch = repoBranches[repo] || repoInfo.default_branch;

      const runsData = await fetchWorkflowRuns(repo, { limit: 100 });
      const allRuns: WorkflowRun[] = runsData.workflow_runs || [];

      const branchMap = new Map<string, WorkflowRun>();
      for (const run of allRuns) {
        if (!run.head_branch) continue;
        const existing = branchMap.get(run.head_branch);
        if (!existing || new Date(run.run_started_at) > new Date(existing.run_started_at)) {
          branchMap.set(run.head_branch, run);
        }
      }

      if (branchMap.size === 0) {
        setMainBranch(defaultBranch);
        setLoading(false);
        return;
      }

      const results = await Promise.all(
        Array.from(branchMap.entries()).map(async ([branchName, run]) => {
          const [jobsData, checksData] = await Promise.all([
            fetchRunJobs(repo, run.id).catch(() => ({ jobs: [] as WorkflowJob[] })),
            fetchCommitCheckRuns(repo, run.head_sha).catch(() => ({ check_runs: [] })),
          ]);
          return {
            branchName,
            run,
            jobs: jobsData.jobs || [],
            checks: checksData.check_runs || [],
          };
        })
      );

      const branchDataList: BranchData[] = results.map(({ branchName, run, jobs, checks }) => {
        const { overallStatus, overallConclusion } = computeOverallStatus(run, jobs, checks);
        return {
          branch: branchName,
          commitMessage: run.head_commit?.message || '',
          commitSha: run.head_sha,
          commitTime: run.run_started_at,
          runNumber: run.run_number,
          runUrl: run.html_url,
          overallStatus,
          overallConclusion,
          jobs,
          checks,
        };
      });

      branchDataList.sort((a, b) => {
        const order: Record<string, number> = { failure: 0, in_progress: 1, queued: 1 };
        const ao = order[a.overallStatus] ?? 2;
        const bo = order[b.overallStatus] ?? 2;
        if (ao !== bo) return ao - bo;
        return a.branch.localeCompare(b.branch);
      });

      setBranchesData(branchDataList);
      setMainBranch(defaultBranch);
    } catch (e: any) {
      setError(e.message || t('error', { message: 'Unknown error' }));
    } finally {
      setLoading(false);
    }
  }, [repo, t]);

  useEffect(() => {
    if (!mounted || !sessionChecked || !currentUser || !repo) return;
    if (!hasAutoLoaded.current) {
      hasAutoLoaded.current = true;
      load();
    }
  }, [mounted, sessionChecked, currentUser, repo, load]);

  const mainData = branchesData.find((b) => b.branch === mainBranch);
  const otherBranches = branchesData.filter((b) => b.branch !== mainBranch && isFailing(b.overallStatus));

  if (!mounted || !sessionChecked) {
    return (
      <Layout>
        <div className="flex h-full items-center justify-center">
          <div className="text-muted">{t('loading')}</div>
        </div>
      </Layout>
    );
  }

  if (!currentUser) {
    return (
      <Layout>
        <div className="px-6 py-8">
          <div className="mx-auto max-w-xl space-y-6 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full" style={{ background: 'rgba(245,158,11,0.1)' }}>
              <svg className="text-amber" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
            </div>
            <h1 className="text-2xl font-semibold tracking-tight text-text-primary">{t('notLoggedInTitle')}</h1>
            <p className="text-sm text-muted">{t('notLoggedInDescription')}</p>
            <div className="flex flex-col items-center justify-center gap-3 sm:flex-row">
              <GitHubOAuthButton returnTo={typeof window !== 'undefined' ? window.location.pathname : '/'} />
              <Link href={`/${locale}/settings`} className="rr-btn-primary" style={{ textDecoration: 'none' }}>
                {t('goToSettings')}
              </Link>
            </div>
          </div>
        </div>
      </Layout>
    );
  }

  if (savedRepos.length === 0) {
    return (
      <Layout>
        <div className="px-6 py-8">
          <div className="mx-auto max-w-xl space-y-6 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full" style={{ background: 'var(--cyan-dim)' }}>
              <svg className="text-cyan" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4" />
              </svg>
            </div>
            <h1 className="text-2xl font-semibold tracking-tight text-text-primary">{t('noReposTitle')}</h1>
            <p className="text-sm text-muted">{t('noReposDescription')}</p>
            <Link href={`/${locale}/settings`} className="rr-btn-primary" style={{ textDecoration: 'none' }}>
              {t('goToSettings')}
            </Link>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="px-6 py-8">
        <div className="mx-auto max-w-4xl space-y-6">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-cyan">{t('title')}</h1>
            <p className="text-sm text-muted">{t('subtitle')}</p>
          </div>

          {/* Controls */}
          <section className="rounded-xl border border-border-faint bg-surface p-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
              <div className="flex-1">
                <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-muted">
                  {t('repoLabel')}
                </label>
                <select
                  value={repo}
                  onChange={(e) => {
                    setRepo(e.target.value);
                    hasAutoLoaded.current = false;
                  }}
                  className="w-full rounded-lg border border-border-faint bg-ink-light px-3 py-2 text-sm text-text-primary outline-none focus:border-cyan focus:ring-1 focus:ring-cyan"
                >
                  {savedRepos.map((r) => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
              </div>
              <button
                onClick={load}
                disabled={loading || !repo}
                className="rr-btn-primary shrink-0"
                style={{
                  opacity: loading || !repo ? 0.5 : 1,
                  cursor: loading ? 'not-allowed' : 'pointer',
                }}
              >
                {loading ? (
                  <>
                    <svg className="rr-spinner" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                      <circle cx="12" cy="12" r="10" opacity="0.25" />
                      <path d="M12 2a10 10 0 0 1 10 10" />
                    </svg>
                    {t('loading')}
                  </>
                ) : (
                  t('loadWorkflows')
                )}
              </button>
            </div>
            {error && <p className="mt-3 text-xs text-red">{t('error', { message: error })}</p>}
          </section>

          {/* Results */}
          {loading && !mainBranch && (
            <div className="rounded-xl border border-border-faint bg-surface p-8 text-center">
              <svg className="rr-spinner mx-auto h-6 w-6 text-muted" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <circle cx="12" cy="12" r="10" opacity="0.25" />
                <path d="M12 2a10 10 0 0 1 10 10" />
              </svg>
            </div>
          )}

          {!loading && branchesData.length === 0 && !error && (
            <div className="rounded-xl border border-border-faint bg-surface p-8 text-center">
              <p className="text-sm text-muted">{t('noWorkflowsOrChecks')}</p>
            </div>
          )}

          {branchesData.length > 0 && (
            <section className="space-y-6">
              {/* Main branch card */}
              {mainData && (
                <MainBranchCard
                  data={mainData}
                  expanded={expandedBranches.has(mainData.branch)}
                  onToggle={toggleBranch}
                  locale={locale}
                />
              )}

              {/* Other branches */}
              {otherBranches.length > 0 && (
                <div className="space-y-3">
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-muted">
                    {t('featureBranches', { count: otherBranches.length })}
                  </h3>
                  {otherBranches.map((bd) => (
                    <BranchCard
                      key={bd.branch}
                      data={bd}
                      expanded={expandedBranches.has(bd.branch)}
                      onToggle={toggleBranch}
                      locale={locale}
                    />
                  ))}
                </div>
              )}
            </section>
          )}
        </div>
      </div>
    </Layout>
  );
}

function MainBranchCard({
  data,
  expanded,
  onToggle,
  locale,
}: {
  data: BranchData;
  expanded: boolean;
  onToggle: (branch: string) => void;
  locale: string;
}) {
  const t = useTranslations('workflows');
  const timeAgo = useTimeAgo(data.commitTime, locale);
  const sha = data.commitSha.slice(0, 7);
  const failing = isFailing(data.overallStatus);
  const running = isRunning(data.overallStatus);
  const failingSummary = failing ? getFailingSummary(data.jobs, data.checks) : null;
  const runningSummary = running ? getRunningSummary(data.jobs, data.checks) : null;

  return (
    <div className="rounded-xl border-2 border-cyan bg-surface" style={{ boxShadow: '0 0 0 1px rgba(0,0,0,0.02)' }}>
      <div
        className="flex cursor-pointer items-center justify-between gap-4 px-5 pt-5 select-none"
        onClick={() => onToggle(data.branch)}
      >
        <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-widest text-cyan">
          <PinIcon />
          {t('pinned')}
        </div>
        <ChevronIcon open={expanded} />
      </div>

      <div
        className="cursor-pointer px-5 pb-1 select-none"
        onClick={() => onToggle(data.branch)}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <div className="truncate text-base font-semibold text-text-primary">
              {firstLine(data.commitMessage)}
            </div>
            <div className="mt-0.5 pb-4 text-xs text-muted">
              {sha} &middot; Run #{data.runNumber} &middot; {timeAgo}
            </div>
          </div>
          <StatusBadge status={data.overallStatus} conclusion={data.overallConclusion} />
        </div>
      </div>

      {!expanded && failingSummary && (
        <div className="border-t border-cyan/30 px-5 pb-4 pt-2">
          <div className="flex items-center gap-1.5 text-xs" style={{ color: 'var(--red)' }}>
            <svg className="h-3.5 w-3.5 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <circle cx="12" cy="12" r="10" />
              <line x1="15" y1="9" x2="9" y2="15" />
              <line x1="9" y1="9" x2="15" y2="15" />
            </svg>
            <span className="font-medium">{t('failingPrefix')}</span>
            <span className="truncate">{failingSummary}</span>
          </div>
        </div>
      )}
      {!expanded && runningSummary && (
        <div className="border-t border-cyan/30 px-5 pb-4 pt-2">
          <div className="flex items-center gap-1.5 text-xs" style={{ color: 'var(--amber)' }}>
            <SpinnerIcon />
            <span className="font-medium">{t('runningPrefix')}</span>
            <span className="truncate">{runningSummary}</span>
          </div>
        </div>
      )}

      <div
        className="overflow-hidden transition-all duration-300"
        style={{ maxHeight: expanded ? '2000px' : '0' }}
      >
        {expanded && (
          <div className="border-t border-cyan/30 px-5 pb-5 pt-4">
            <TaskListSection label={t('jobs')} tasks={data.jobs} />
            <div className="mt-3" />
            <TaskListSection label={t('checks')} tasks={data.checks} />
          </div>
        )}
      </div>
    </div>
  );
}

function BranchCard({
  data,
  expanded,
  onToggle,
  locale,
}: {
  data: BranchData;
  expanded: boolean;
  onToggle: (branch: string) => void;
  locale: string;
}) {
  const t = useTranslations('workflows');
  const timeAgo = useTimeAgo(data.commitTime, locale);
  const failing = isFailing(data.overallStatus);
  const running = isRunning(data.overallStatus);
  const passing = !failing && !running;

  let cardBg = '';
  let borderColor = 'var(--border-faint)';
  if (failing) { cardBg = 'rgba(239,68,68,0.015)'; borderColor = 'var(--red)'; }
  else if (running) { cardBg = 'rgba(245,158,11,0.015)'; borderColor = 'var(--amber)'; }

  const failingSummary = failing ? getFailingSummary(data.jobs, data.checks) : null;
  const runningSummary = running ? getRunningSummary(data.jobs, data.checks) : null;

  return (
    <div
      className="rounded-xl border bg-surface"
      style={{ borderColor, background: cardBg || undefined }}
    >
      {/* Clickable header */}
      <div
        className="flex cursor-pointer items-center gap-2 px-4 py-3 select-none"
        onClick={() => onToggle(data.branch)}
      >
        <ChevronIcon open={expanded} />
        <BranchIcon />
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2">
            <span className="truncate text-sm font-semibold text-text-primary">{data.branch}</span>
            <span className="hidden truncate text-xs text-muted sm:inline">
              {firstLine(data.commitMessage)}
            </span>
            <span className="shrink-0 text-xs text-muted-dim">{timeAgo}</span>
          </div>
        </div>
        <StatusBadge status={data.overallStatus} conclusion={data.overallConclusion} />
      </div>

      {/* Inline summary shown even when collapsed */}
      {!expanded && failingSummary && (
        <div className="border-t border-border-faint px-4 pb-3 pt-2">
          <div className="flex items-center gap-1.5 text-xs" style={{ color: 'var(--red)' }}>
            <svg className="h-3.5 w-3.5 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <circle cx="12" cy="12" r="10" />
              <line x1="15" y1="9" x2="9" y2="15" />
              <line x1="9" y1="9" x2="15" y2="15" />
            </svg>
            <span className="font-medium">{t('failingPrefix')}</span>
            <span className="truncate">{failingSummary}</span>
          </div>
        </div>
      )}
      {!expanded && runningSummary && (
        <div className="border-t border-border-faint px-4 pb-3 pt-2">
          <div className="flex items-center gap-1.5 text-xs" style={{ color: 'var(--amber)' }}>
            <SpinnerIcon />
            <span className="font-medium">{t('runningPrefix')}</span>
            <span className="truncate">{runningSummary}</span>
          </div>
        </div>
      )}

      {/* Expanded panel */}
      <div
        className="overflow-hidden transition-all duration-300"
        style={{ maxHeight: expanded ? '2000px' : '0' }}
      >
        {expanded && (
          <div className="border-t border-border-faint px-4 pb-4 pt-3">
            {passing ? (
              <p className="text-xs text-muted-dim">
                {t('checksPassing', {
                  passed: data.checks.filter((c) => c.conclusion === 'success').length,
                  total: data.checks.length,
                })}
              </p>
            ) : (
              <>
                <TaskListSection label={t('jobs')} tasks={data.jobs} />
                <div className="mt-3" />
                <TaskListSection label={t('checks')} tasks={data.checks} />
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function TaskListSection({ label, tasks }: { label: string; tasks: TaskItem[] }) {
  if (tasks.length === 0) return null;
  return (
    <div>
      <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">{label}</h4>
      <div className="space-y-1.5">
        {tasks.map((task, i) => (
          <TaskRow key={task.name + i} task={task} />
        ))}
      </div>
    </div>
  );
}
