import type { PR } from './store';
import { getRepoFullNameFromUrl } from './utils';
import { proxyGitHub } from './apiClient';
import { computeComplexityBreakdown, computeEffort } from './complexity';

const REPO_REGEX = /^[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+$/;

function validateRepo(repo: string): void {
  if (!REPO_REGEX.test(repo.trim())) {
    throw new Error(`Invalid repo format: ${repo}`);
  }
}

function stripApiBase(url: string): string {
  return url.replace(/^https:\/\/api\.github\.com\//, '');
}

export async function fetchReposPRs(repo: string): Promise<PR[]> {
  validateRepo(repo);
  const [owner, name] = repo.trim().split('/');
  const t = `      ⏱️ repo ${owner}/${name}`;
  console.time(t);
  const data = await proxyGitHub(`repos/${owner}/${name}/pulls?state=open&per_page=100`);
  console.timeEnd(t);
  return data;
}

export async function fetchUserPRs(username: string): Promise<PR[]> {
  const data = await proxyGitHub(
    `search/issues?q=type:pr+state:open+author:${encodeURIComponent(username)}&per_page=100`
  );
  return data.items || [];
}

export async function fetchPRFiles(prUrl: string): Promise<{ files: any[]; additions: number; deletions: number; changed_files: number }> {
  const basePath = stripApiBase(prUrl);
  const allFiles: any[] = [];
  let page = 1;
  const prNum = basePath.match(/\/(\d+)$/)?.[1] || '?';
  const t = `        ⏱️ files-pages #${prNum}`;
  console.time(t);
  try {
    while (page <= 5) {
      const data = await proxyGitHub(`${basePath}/files?per_page=100&page=${page}`);
      if (!Array.isArray(data) || data.length === 0) {
        break;
      }
      allFiles.push(...data);
      if (data.length < 100) break;
      page++;
    }
  } catch (e) {
    console.warn('Error fetching PR files:', e);
  }
  console.timeEnd(t);

  let additions = 0;
  let deletions = 0;
  for (const f of allFiles) {
    additions += f.additions || 0;
    deletions += f.deletions || 0;
  }

  return {
    files: allFiles,
    additions,
    deletions,
    changed_files: allFiles.length,
  };
}

function processCheckRuns(checksData: any): { state: string; conclusion?: string; checkRuns?: any[] } {
  if (!checksData?.check_runs?.length) return { state: 'unknown' };
  const runs = checksData.check_runs;
  const runStatuses = runs.map((run: any) => run.status);
  const conclusions = runs
    .map((run: any) => run.conclusion)
    .filter((c: any) => c);
  let state = 'unknown';
  if (runStatuses.includes('in_progress') || runStatuses.includes('queued')) {
    state = 'in_progress';
  } else if (runStatuses.every((s: string) => s === 'completed')) {
    if (conclusions.includes('failure') || conclusions.includes('cancelled')) {
      state = 'failure';
    } else if (
      conclusions.every(
        (c: string) => c === 'success' || c === 'neutral' || c === 'skipped'
      )
    ) {
      state = 'success';
    } else {
      state = 'pending';
    }
  } else {
    state = 'in_progress';
  }
  return { state, conclusion: conclusions[0] || undefined, checkRuns: runs };
}

export async function fetchPRReviews(pr: PR): Promise<PR> {
  const prNum = pr.number || (pr as any).id;
  const t = `      ⏱️ pr #${prNum}`;
  console.time(t);

  const repoFullName =
    pr.head?.repo?.full_name ||
    (pr.repository_url ? getRepoFullNameFromUrl(pr.repository_url) : '');

  let reviews: any[] = [];
  let comments: any[] = [];
  let buildStatus: { state: string; conclusion?: string; checkRuns?: any[] } = { state: 'unknown' };
  let files: any[] = [];
  let fileAdditions = 0;
  let fileDeletions = 0;

  if (repoFullName && prNum) {
    const sha = pr.head?.sha || '';
    try {
      const batch = await proxyGitHub(
        `batch/pr/${repoFullName}/${prNum}${sha ? `?sha=${sha}` : ''}`
      );
      if (Array.isArray(batch.reviews)) reviews = batch.reviews;
      if (Array.isArray(batch.comments)) comments = batch.comments;
      if (Array.isArray(batch.files)) {
        files = batch.files;
        fileAdditions = files.reduce((sum: number, f: any) => sum + (f.additions || 0), 0);
        fileDeletions = files.reduce((sum: number, f: any) => sum + (f.deletions || 0), 0);
      }
      if (batch.checks) buildStatus = processCheckRuns(batch.checks);
    } catch (e) {
      console.warn(`Batch fetch failed for #${prNum}, falling back to individual calls:`, e);
      const basePath = stripApiBase(
        `repos/${repoFullName}/pulls/${prNum}`
      );
      const [reviewsRes, commentsRes, filesRes, checksRes] = await Promise.all([
        proxyGitHub(`${basePath}/reviews`).catch(() => []),
        proxyGitHub(`${basePath}/comments`).catch(() => []),
        fetchPRFiles(`https://api.github.com/${basePath}`).catch(() => ({ files: [], additions: 0, deletions: 0, changed_files: 0 })),
        sha ? proxyGitHub(`repos/${repoFullName}/commits/${sha}/check-runs`).catch(() => null) : Promise.resolve(null),
      ]);
      reviews = reviewsRes;
      comments = commentsRes;
      files = filesRes?.files || [];
      fileAdditions = filesRes?.additions || 0;
      fileDeletions = filesRes?.deletions || 0;
      if (checksRes) buildStatus = processCheckRuns(checksRes);
    }
  }

  console.timeEnd(t);

  const complexityBreakdown = computeComplexityBreakdown(files);
  const effort = computeEffort({ ...pr, reviews, files, body: pr.body });

  // GitHub's list endpoint may omit additions/deletions; fall back to values from files.
  const additions = pr.additions || fileAdditions || 0;
  const deletions = pr.deletions || fileDeletions || 0;

  return {
    ...pr,
    mergeable_state: pr.mergeable_state || 'unknown',
    reviews,
    comments,
    buildStatus,
    files,
    additions,
    deletions,
    changed_files: pr.changed_files || files.length,
    complexity: complexityBreakdown.score,
    effort,
    complexityBreakdown,
  };
}

export async function fetchCurrentUser(): Promise<string> {
  const data = await proxyGitHub('user');
  return data.login;
}
