import { PR } from './store';
import { getRepoFullNameFromUrl } from './utils';
import { proxyGitHub } from './apiClient';

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
  return proxyGitHub(`repos/${owner}/${name}/pulls?state=open&per_page=100`);
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

export async function fetchPRReviews(pr: PR): Promise<PR> {
  // Resolve the correct PR URL
  let prUrl = pr.url || pr.html_url || '';
  if (pr.pull_request?.url) {
    prUrl = pr.pull_request.url;
    if (prUrl.includes('{')) {
      prUrl = prUrl.replace('{/number}', '');
    }
  } else if (prUrl.includes('/issues/')) {
    prUrl = prUrl.replace('/issues/', '/pulls/');
  }
  if (!prUrl) {
    return { ...pr, mergeable_state: pr.mergeable_state || 'unknown', reviews: [], comments: [], buildStatus: { state: 'unknown', conclusion: undefined, checkRuns: [] } };
  }

  const basePath = stripApiBase(prUrl);

  // Fetch PR details for mergeable_state
  let mergeable_state = pr.mergeable_state || 'unknown';
  try {
    const prDetails = await proxyGitHub(basePath);
    mergeable_state = prDetails.mergeable_state || 'unknown';
  } catch (e) {
    console.warn('Error fetching PR details for mergeable_state:', e);
  }

  // Fetch reviews
  let reviews: any[] = [];
  try {
    reviews = await proxyGitHub(`${basePath}/reviews`);
  } catch (e) {
    console.warn('Error fetching reviews:', e);
  }

  // Fetch comments
  let comments: any[] = [];
  try {
    comments = await proxyGitHub(`${basePath}/comments`);
  } catch (e) {
    console.warn('Error fetching comments:', e);
  }

  // Fetch build status via check-runs (avoids CORS issues with /statuses)
  let buildStatus: { state: string; conclusion?: string; checkRuns?: any[] } = { state: 'unknown' };
  try {
    if (pr.head && pr.head.sha) {
      const repoFullName =
        pr.head.repo?.full_name ||
        (pr.repository_url ? getRepoFullNameFromUrl(pr.repository_url) : '');
      if (repoFullName) {
        const checksData = await proxyGitHub(
          `repos/${repoFullName}/commits/${pr.head.sha}/check-runs`
        );
        if (checksData.check_runs && checksData.check_runs.length > 0) {
          buildStatus.checkRuns = checksData.check_runs;
          const runStatuses = checksData.check_runs.map((run: any) => run.status);
          const conclusions = checksData.check_runs
            .map((run: any) => run.conclusion)
            .filter((c: any) => c);

          if (runStatuses.includes('in_progress') || runStatuses.includes('queued')) {
            buildStatus.state = 'in_progress';
          } else if (runStatuses.every((s: string) => s === 'completed')) {
            if (conclusions.includes('failure') || conclusions.includes('cancelled')) {
              buildStatus.state = 'failure';
            } else if (
              conclusions.every(
                (c: string) => c === 'success' || c === 'neutral' || c === 'skipped'
              )
            ) {
              buildStatus.state = 'success';
            } else {
              buildStatus.state = 'pending';
            }
          } else {
            buildStatus.state = 'in_progress';
          }
          buildStatus.conclusion = conclusions[0] || undefined;
        }
      }
    }
  } catch (error) {
    console.error('Error fetching build status:', error);
  }

  // Fetch files
  const { files, additions, deletions, changed_files } = await fetchPRFiles(prUrl);

  return { ...pr, mergeable_state, reviews, comments, buildStatus, files, additions, deletions, changed_files };
}

export async function fetchCurrentUser(): Promise<string> {
  const data = await proxyGitHub('user');
  return data.login;
}
