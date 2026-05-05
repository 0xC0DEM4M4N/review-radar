export async function fetchUserPRs(username, pat) {
  const prs = [];
  let page = 1;
  let hasMore = true;

  while (hasMore && page <= 5) {
    try {
      const response = await fetch(
        `https://api.github.com/search/issues?q=type:pr+involves:${username}+state:open&per_page=100&page=${page}&sort=updated&order=desc`,
        {
          headers: {
            Authorization: `token ${pat}`,
            Accept: 'application/vnd.github.v3+json',
          },
        },
      );

      if (!response.ok) {
        if (response.status === 422) {
          console.warn('Search API failed, using alternative method');
          break;
        }
        throw new Error(`GitHub API error: ${response.status}`);
      }

      const data = await response.json();
      if (!data.items || data.items.length === 0) {
        hasMore = false;
      } else {
        prs.push(...data.items);
        hasMore = data.items.length === 100;
      }
      page++;
    } catch (error) {
      console.error('Error fetching user PRs:', error);
      break;
    }
  }

  return prs;
}

export async function fetchReposPRs(repo, pat) {
  const prs = [];
  let page = 1;
  let hasMore = true;

  while (hasMore && page <= 5) {
    try {
      const response = await fetch(
        `https://api.github.com/repos/${repo}/pulls?state=open&per_page=100&page=${page}&sort=updated&direction=desc`,
        {
          headers: {
            Authorization: `token ${pat}`,
            Accept: 'application/vnd.github.v3+json',
          },
        },
      );

      if (!response.ok) {
        let errorMsg = '';
        if (response.status === 403) {
          errorMsg = `Access Denied (403): Your PAT doesn't have access to ${repo}.`;
        } else if (response.status === 404) {
          errorMsg = `Repository not found (404): ${repo} doesn't exist or is inaccessible`;
        } else {
          errorMsg = `GitHub API error: ${response.status}`;
        }
        throw new Error(errorMsg);
      }

      const data = await response.json();
      if (!Array.isArray(data) || data.length === 0) {
        hasMore = false;
      } else {
        prs.push(...data);
        hasMore = data.length === 100;
      }
      page++;
    } catch (error) {
      console.error('Error fetching repo PRs:', error);
      throw error;
    }
  }

  return prs;
}

export async function fetchPRReviews(pr, pat) {
  try {
    let prUrl = pr.url;
    if (pr.pull_request) {
      prUrl = pr.pull_request.url;
      if (prUrl.includes('{')) {
        prUrl = prUrl.replace('{/number}', '');
      }
    } else if (prUrl.includes('/issues/')) {
      prUrl = prUrl.replace('/issues/', '/pulls/');
    }

    let mergeable_state = pr.mergeable_state || 'unknown';
    try {
      const prDetailsResponse = await fetch(prUrl, {
        headers: {
          Authorization: `token ${pat}`,
          Accept: 'application/vnd.github.v3+json',
        },
      });
      if (prDetailsResponse.ok) {
        const prDetails = await prDetailsResponse.json();
        mergeable_state = prDetails.mergeable_state || 'unknown';
      }
    } catch (error) {
      console.warn('Error fetching PR details for mergeable_state:', error);
    }

    const reviewsResponse = await fetch(`${prUrl}/reviews`, {
      headers: {
        Authorization: `token ${pat}`,
        Accept: 'application/vnd.github.v3+json',
      },
    });

    let reviews = [];
    if (reviewsResponse.ok) {
      reviews = await reviewsResponse.json();
    }

    const commentsResponse = await fetch(`${prUrl}/comments`, {
      headers: {
        Authorization: `token ${pat}`,
        Accept: 'application/vnd.github.v3+json',
      },
    });

    let comments = [];
    if (commentsResponse.ok) {
      comments = await commentsResponse.json();
    }

    let buildStatus = { state: 'unknown', conclusion: null, checkRuns: [] };
    try {
      if (pr.head && pr.head.sha) {
        const repoFullName =
          pr.head.repo?.full_name ||
          pr.repository_url.replace('https://api.github.com/repos/', '');
        const checksResponse = await fetch(
          `https://api.github.com/repos/${repoFullName}/commits/${pr.head.sha}/check-runs`,
          {
            headers: {
              Authorization: `token ${pat}`,
              Accept: 'application/vnd.github.v3+json',
            },
          },
        );

        if (checksResponse.ok) {
          const checksData = await checksResponse.json();
          if (checksData.check_runs && checksData.check_runs.length > 0) {
            buildStatus.checkRuns = checksData.check_runs;
            const statuses = checksData.check_runs.map((run) => run.status);
            const conclusions = checksData.check_runs
              .map((run) => run.conclusion)
              .filter((c) => c);

            if (
              statuses.includes('in_progress') ||
              statuses.includes('queued')
            ) {
              buildStatus.state = 'in_progress';
            } else if (statuses.every((s) => s === 'completed')) {
              if (
                conclusions.includes('failure') ||
                conclusions.includes('cancelled')
              ) {
                buildStatus.state = 'failure';
              } else if (
                conclusions.every(
                  (c) => c === 'success' || c === 'neutral' || c === 'skipped',
                )
              ) {
                buildStatus.state = 'success';
              } else {
                buildStatus.state = 'pending';
              }
            } else {
              buildStatus.state = 'in_progress';
            }
            buildStatus.conclusion = conclusions[0] || null;
          }
        }
      }
    } catch (error) {
      console.error('Error fetching build status:', error);
    }

    return {
      ...pr,
      mergeable_state,
      reviews,
      comments,
      buildStatus,
    };
  } catch (error) {
    console.error('Error fetching reviews for PR:', error);
    return {
      ...pr,
      mergeable_state: pr.mergeable_state || 'unknown',
      reviews: [],
      comments: [],
      buildStatus: { state: 'unknown', conclusion: null, checkRuns: [] },
    };
  }
}
