import { PR } from './store';
import { getRepoFullNameFromUrl } from './utils';

export async function fetchReposPRs(repo: string, pat: string): Promise<PR[]> {
  const [owner, name] = repo.trim().split('/');
  const res = await fetch(
    `https://api.github.com/repos/${owner}/${name}/pulls?state=open&per_page=100`,
    {
      headers: {
        Authorization: `token ${pat}`,
        Accept: 'application/vnd.github.v3+json',
      },
    }
  );
  if (!res.ok) throw new Error(`Failed to fetch ${repo}: ${res.status}`);
  return res.json();
}

export async function fetchUserPRs(username: string, pat: string): Promise<PR[]> {
  const res = await fetch(
    `https://api.github.com/search/issues?q=type:pr+state:open+author:${username}&per_page=100`,
    {
      headers: {
        Authorization: `token ${pat}`,
        Accept: 'application/vnd.github.v3+json',
      },
    }
  );
  if (!res.ok) throw new Error(`Failed to fetch user PRs: ${res.status}`);
  const data = await res.json();
  return data.items || [];
}

export async function fetchPRFiles(prUrl: string, pat: string): Promise<{ files: any[]; additions: number; deletions: number; changed_files: number }> {
  const allFiles: any[] = [];
  let page = 1;
  try {
    while (page <= 5) {
      const res = await fetch(`${prUrl}/files?per_page=100&page=${page}`, {
        headers: {
          Authorization: `token ${pat}`,
          Accept: 'application/vnd.github.v3+json',
        },
      });
      if (!res.ok) {
        break;
      }
      const data = await res.json();
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

export async function fetchPRReviews(pr: PR, pat: string): Promise<PR> {
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

  // Fetch PR details for mergeable_state
  let mergeable_state = pr.mergeable_state || 'unknown';
  try {
    const prDetailsRes = await fetch(prUrl, {
      headers: {
        Authorization: `token ${pat}`,
        Accept: 'application/vnd.github.v3+json',
      },
    });
    if (prDetailsRes.ok) {
      const prDetails = await prDetailsRes.json();
      mergeable_state = prDetails.mergeable_state || 'unknown';
    }
  } catch (e) {
    console.warn('Error fetching PR details for mergeable_state:', e);
  }

  // Fetch reviews
  const reviewsRes = await fetch(`${prUrl}/reviews`, {
    headers: {
      Authorization: `token ${pat}`,
      Accept: 'application/vnd.github.v3+json',
    },
  });
  const reviews = reviewsRes.ok ? await reviewsRes.json() : [];

  // Fetch comments
  const commentsRes = await fetch(`${prUrl}/comments`, {
    headers: {
      Authorization: `token ${pat}`,
      Accept: 'application/vnd.github.v3+json',
    },
  });
  const comments = commentsRes.ok ? await commentsRes.json() : [];

  // Fetch build status via check-runs (avoids CORS issues with /statuses)
  let buildStatus: { state: string; conclusion?: string; checkRuns?: any[] } = { state: 'unknown' };
  try {
    if (pr.head && pr.head.sha) {
      const repoFullName =
        pr.head.repo?.full_name ||
        (pr.repository_url ? pr.repository_url.replace('https://api.github.com/repos/', '') : '');
      if (repoFullName) {
        const checksRes = await fetch(
          `https://api.github.com/repos/${repoFullName}/commits/${pr.head.sha}/check-runs`,
          {
            headers: {
              Authorization: `token ${pat}`,
              Accept: 'application/vnd.github.v3+json',
            },
          }
        );
        if (checksRes.ok) {
          const checksData = await checksRes.json();
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
    }
  } catch (error) {
    console.error('Error fetching build status:', error);
  }

  // Fetch files
  const { files, additions, deletions, changed_files } = await fetchPRFiles(prUrl, pat);

  return { ...pr, mergeable_state, reviews, comments, buildStatus, files, additions, deletions, changed_files };
}

export async function fetchCurrentUser(pat: string): Promise<string> {
  const res = await fetch('https://api.github.com/user', {
    headers: {
      Authorization: `token ${pat}`,
      Accept: 'application/vnd.github.v3+json',
    },
  });
  if (!res.ok) throw new Error(`GitHub API error: ${res.status}`);
  const data = await res.json();
  return data.login;
}
