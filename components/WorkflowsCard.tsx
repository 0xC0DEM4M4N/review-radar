'use client';

import React, { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import {
  fetchRepo,
  fetchWorkflowRuns,
  fetchRunJobs,
  fetchCommitCheckRuns,
  WorkflowRun,
  WorkflowJob,
} from '@/lib/githubApi';
import { checkSession } from '@/lib/apiClient';

function loadJSON<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function firstLine(message?: string): string {
  if (!message) return '';
  return message.split('\n')[0];
}

const FAIL_STATUS_THEME: Record<string, { bg: string; label: string }> = {
  success: { bg: 'var(--green)', label: 'Passing' },
  failure: { bg: 'var(--red)', label: 'Failing' },
  in_progress: { bg: 'var(--amber)', label: 'Running' },
  queued: { bg: 'var(--muted)', label: 'Queued' },
};

function StatusDot({ status }: { status: string }) {
  const t = FAIL_STATUS_THEME[status] || FAIL_STATUS_THEME.queued;
  return <span className="inline-block h-2 w-2 shrink-0 rounded-full" style={{ background: t.bg }} />;
}

function getFailingNames(jobs: WorkflowJob[], checks: any[]): string {
  const names = [...jobs, ...checks]
    .filter((t) => t.conclusion === 'failure' || t.conclusion === 'cancelled')
    .map((t) => t.name);
  if (names.length === 0) return '';
  if (names.length <= 2) return names.join(', ');
  return `${names[0]}, ${names[1]} (+${names.length - 2} more)`;
}

type BranchSummary = {
  name: string;
  status: string;
  failingSummary: string;
};

export default function WorkflowsCard() {
  const t = useTranslations('workflows');
  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [branches, setBranches] = useState<BranchSummary[]>([]);
  const [repo, setRepo] = useState('');
  const [authenticated, setAuthenticated] = useState(false);

  useEffect(() => {
    setMounted(true);
    checkSession().then((s) => {
      setAuthenticated(s.active);
      if (!s.active) {
        setLoading(false);
        return;
      }
      const repos = loadJSON<string[]>('github-repos', []);
      if (repos.length === 0) {
        setLoading(false);
        return;
      }
      const repoName = loadJSON<string[]>('selected-repos', [])[0] || repos[0];
      setRepo(repoName);

      (async () => {
        try {
          const repoInfo = await fetchRepo(repoName);
          const repoBranches = loadJSON<Record<string, string>>('reviewradar-repo-branches', {});
          const mainBranchName = repoBranches[repoName] || repoInfo.default_branch;

          const runsData = await fetchWorkflowRuns(repoName, { limit: 100 });
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
            setLoading(false);
            return;
          }

          const results = await Promise.all(
            Array.from(branchMap.entries()).slice(0, 8).map(async ([branchName, run]) => {
              const [jobsData, checksData] = await Promise.all([
                fetchRunJobs(repoName, run.id).catch(() => ({ jobs: [] as WorkflowJob[] })),
                fetchCommitCheckRuns(repoName, run.head_sha).catch(() => ({ check_runs: [] })),
              ]);
              const jobs = jobsData.jobs || [];
              const checks = checksData.check_runs || [];
              const allTasks = [...jobs, ...checks];
              let status = run.conclusion === 'success' ? 'success' : 'failure';
              if (allTasks.some((t) => t.conclusion === 'failure' || t.conclusion === 'cancelled')) status = 'failure';
              else if (allTasks.some((t) => t.status === 'in_progress' || t.status === 'queued')) status = 'in_progress';
              else if (run.conclusion === 'success' || run.conclusion === null) status = 'success';
              return {
                name: branchName,
                status,
                failingSummary: status === 'failure' ? getFailingNames(jobs, checks) : '',
              };
            })
          );

          const main = results.find((b) => b.name === mainBranchName);
          const failing = results.filter((b) => b.name !== mainBranchName && b.status === 'failure');
          const passing = results.filter((b) => b.name !== mainBranchName && b.status === 'success');
          const running = results.filter((b) => b.name !== mainBranchName && b.status === 'in_progress');
          const sorted = [
            ...(main ? [main] : []),
            ...failing,
            ...running,
            ...passing.slice(0, 3),
          ];
          setBranches(sorted);
        } catch {
          // fall back to empty
        } finally {
          setLoading(false);
        }
      })();
    });
  }, []);

  if (!mounted) return null;

  if (!authenticated) {
    return (
      <div className="rounded-2xl border border-border-faint bg-surface p-7">
        <div className="mb-4 font-mono text-[11px] uppercase tracking-widest text-cyan">Workflows</div>
        <h3 className="mb-4 font-mono text-lg font-bold text-text-primary">Failing workflows at a glance</h3>
        <p className="mb-5 text-sm leading-relaxed text-white/45">
          See which branches have failing checks immediately — main branch status, failing feature branches, and inline summaries of what broke.
        </p>
        <div className="space-y-2">
          <DemoBranch name="main" status="success" />
          <DemoBranch name="feat/new-auth" status="failure" summary="Npm.Build.Publish.Scan, Jest Unit Tests" />
          <DemoBranch name="fix/header-bug" status="failure" summary="Lint Check" />
        </div>
        <div className="mt-5">
          <Link href="/dashboard" className="inline-flex items-center gap-1.5 rounded-full bg-cyan px-5 py-2.5 font-mono text-xs font-bold text-ink-light no-underline transition-all hover:opacity-90">
            Open Dashboard
          </Link>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="rounded-2xl border border-border-faint bg-surface p-7">
        <div className="flex items-center justify-center py-8">
          <svg className="rr-spinner h-5 w-5 text-muted" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <circle cx="12" cy="12" r="10" opacity="0.25" />
            <path d="M12 2a10 10 0 0 1 10 10" />
          </svg>
        </div>
      </div>
    );
  }

  if (branches.length === 0) {
    return (
      <div className="rounded-2xl border border-border-faint bg-surface p-7">
        <div className="mb-4 font-mono text-[11px] uppercase tracking-widest text-cyan">Workflows</div>
        <h3 className="mb-4 font-mono text-lg font-bold text-text-primary">Failing workflows at a glance</h3>
        <p className="text-sm leading-relaxed text-white/45">
          No workflow runs found for <code className="rounded bg-white/[0.06] px-1.5 py-0.5 font-mono text-xs text-cyan">{repo}</code>. Push a commit to see workflows here.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-border-faint bg-surface p-7">
      <div className="mb-4 font-mono text-[11px] uppercase tracking-widest text-cyan">Workflows</div>
      <h3 className="mb-4 font-mono text-lg font-bold text-text-primary">Failing workflows at a glance</h3>
      <div className="space-y-2">
        {branches.map((b) => (
          <div key={b.name} className="flex items-center gap-3 rounded-lg border border-border-faint bg-ink-light px-4 py-2.5">
            <StatusDot status={b.status} />
            <span className="min-w-0 flex-1 truncate text-sm font-medium text-text-primary">
              {b.name}
            </span>
            <span
              className="inline-flex shrink-0 items-center rounded px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white"
              style={{ background: FAIL_STATUS_THEME[b.status]?.bg || 'var(--muted)' }}
            >
              {FAIL_STATUS_THEME[b.status]?.label || b.status}
            </span>
            {b.failingSummary && (
              <span className="hidden max-w-[220px] truncate text-xs sm:block" style={{ color: 'var(--red)' }}>
                {b.failingSummary}
              </span>
            )}
          </div>
        ))}
      </div>
      <div className="mt-4 text-right">
        <Link
          href={`/workflows`}
          className="inline-flex items-center gap-1 font-mono text-xs text-cyan no-underline hover:underline"
        >
          View all workflows →
        </Link>
      </div>
    </div>
  );
}

function DemoBranch({ name, status, summary }: { name: string; status: string; summary?: string }) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-border-faint bg-ink-light/60 px-4 py-2.5">
      <StatusDot status={status} />
      <span className="min-w-0 flex-1 truncate text-sm font-medium text-text-primary">{name}</span>
      <span
        className="inline-flex shrink-0 items-center rounded px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white"
        style={{ background: FAIL_STATUS_THEME[status]?.bg || 'var(--muted)' }}
      >
        {FAIL_STATUS_THEME[status]?.label || status}
      </span>
      {summary && (
        <span className="hidden max-w-[220px] truncate text-xs sm:block" style={{ color: 'var(--red)' }}>
          {summary}
        </span>
      )}
    </div>
  );
}
