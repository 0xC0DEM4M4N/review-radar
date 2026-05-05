import { state } from './state.js';
import {
  escapeHtml,
  getContrastColor,
  formatLastUpdated,
  getRepoNameFromUrl,
  getRepoFullNameFromUrl,
} from './utils.js';
import { getRepoColorIndex } from './repoSelector.js';

function getReviewSummary(pr) {
  const reviews = pr.reviews || [];
  const statusMap = {};

  reviews.forEach((review) => {
    if (review.state === 'APPROVED') {
      statusMap.approved = (statusMap.approved || 0) + 1;
    } else if (review.state === 'CHANGES_REQUESTED') {
      statusMap.changes = (statusMap.changes || 0) + 1;
    } else if (review.state === 'COMMENTED') {
      statusMap.commented = (statusMap.commented || 0) + 1;
    } else if (review.state === 'PENDING') {
      statusMap.pending = (statusMap.pending || 0) + 1;
    }
  });

  return statusMap;
}

function getMentions(pr) {
  const mentions = new Set();
  const bodyAndTitle = (pr.body || '') + ' ' + (pr.title || '');
  const mentionRegex = /@([\w-]+)/g;
  let match;

  while ((match = mentionRegex.exec(bodyAndTitle)) !== null) {
    if (match[1] !== state.currentUser) {
      mentions.add('@' + match[1]);
    }
  }

  return Array.from(mentions).slice(0, 3);
}

export function renderTable() {
  const tbody = document.getElementById('prTableBody');
  let filteredPRs = state.allPRs;

  // Always filter by selected repos — if none selected, show nothing
  filteredPRs = filteredPRs.filter((pr) => {
    const repoUrl = pr.repository_url || pr.url;
    if (!repoUrl || typeof repoUrl !== 'string') return false;
    const repoName = getRepoFullNameFromUrl(repoUrl);
    return state.selectedRepos.has(repoName);
  });

  if (state.currentFilter === 'owned') {
    filteredPRs = filteredPRs.filter(
      (pr) => (pr.user?.login || '') === state.currentUser,
    );
  } else if (state.currentFilter === 'not-owned') {
    filteredPRs = filteredPRs.filter(
      (pr) => (pr.user?.login || '') !== state.currentUser,
    );
  } else if (state.currentFilter === 'needs-attention') {
    filteredPRs = filteredPRs.filter((pr) => {
      const isNotByMe = (pr.user?.login || '') !== state.currentUser;
      const isNotDraft = !pr.draft;
      const hasNotReviewedByMe = !pr.reviews?.some(
        (r) => r.user?.login === state.currentUser,
      );
      const hasNoApprovals = !pr.reviews?.some((r) => r.state === 'APPROVED');
      return isNotByMe && isNotDraft && hasNotReviewedByMe && hasNoApprovals;
    });
    if (state.currentSort.length === 0) {
      filteredPRs.sort((a, b) => {
        const aPass = a.buildStatus?.state === 'success' ? 1 : 0;
        const bPass = b.buildStatus?.state === 'success' ? 1 : 0;
        if (bPass !== aPass) {
          return bPass - aPass;
        }
        const aDate = new Date(a.created_at || 0).getTime();
        const bDate = new Date(b.created_at || 0).getTime();
        return aDate - bDate;
      });
    }
  }

  filteredPRs.sort((a, b) => {
    if (state.currentSort.length === 0) return 0;

    for (const { column, direction } of state.currentSort) {
      let aVal;
      let bVal;

      switch (column) {
        case 'title':
          aVal = (a.title || '').toLowerCase();
          bVal = (b.title || '').toLowerCase();
          break;
        case 'repo':
          aVal = getRepoNameFromUrl(a.repository_url || '');
          bVal = getRepoNameFromUrl(b.repository_url || '');
          aVal = aVal.toLowerCase();
          bVal = bVal.toLowerCase();
          break;
        case 'author':
          aVal = (a.user?.login || '').toLowerCase();
          bVal = (b.user?.login || '').toLowerCase();
          break;
        case 'reviews':
          aVal = (a.reviews || []).length;
          bVal = (b.reviews || []).length;
          break;
        case 'mentions':
          aVal = getMentions(a).length;
          bVal = getMentions(b).length;
          break;
        case 'buildStatus':
          aVal = a.buildStatus?.state || 'unknown';
          bVal = b.buildStatus?.state || 'unknown';
          break;
        case 'mergeStatus':
          aVal = a.mergeable_state || 'unknown';
          bVal = b.mergeable_state || 'unknown';
          break;
        case 'reviewedByMe':
          aVal = a.reviews?.some(
            (r) => r.user?.login === state.currentUser && r.state !== 'PENDING',
          )
            ? 1
            : 0;
          bVal = b.reviews?.some(
            (r) => r.user?.login === state.currentUser && r.state !== 'PENDING',
          )
            ? 1
            : 0;
          break;
        case 'labels':
          aVal = a.labels?.length || 0;
          bVal = b.labels?.length || 0;
          break;
        case 'updated':
          aVal = new Date(a.updated_at || 0).getTime();
          bVal = new Date(b.updated_at || 0).getTime();
          break;
        default:
          continue;
      }

      let comparison = 0;
      if (typeof aVal === 'string') {
        comparison = aVal.localeCompare(bVal);
      } else {
        comparison = aVal - bVal;
      }

      if (comparison !== 0) {
        return direction === 'asc' ? comparison : -comparison;
      }
    }
    return 0;
  });

  document.querySelectorAll('#prTable th').forEach((th) => {
    th.classList.remove('sorted-asc', 'sorted-desc');
    const match = th.textContent.match(/^(.+?)\s*\(\d+\s*[↑↓]\)$/);
    if (match) {
      th.textContent = match[1];
    }
  });

  state.currentSort.forEach((sort, index) => {
    const headers = Array.from(document.querySelectorAll('#prTable th')).filter(
      (th) => {
        const text = th.textContent.toLowerCase();
        return (
          sort.column === text.replace(/\s*\(\d+\s*[↑↓]\)$/, '').toLowerCase()
        );
      },
    );
    if (headers.length > 0) {
      const header = headers[0];
      const arrow = sort.direction === 'asc' ? '↑' : '↓';
      header.textContent += ` (${index + 1} ${arrow})`;
      header.classList.add(
        sort.direction === 'asc' ? 'sorted-asc' : 'sorted-desc',
      );
    }
  });

  document.getElementById('totalCount').textContent = state.allPRs.length;
  document.getElementById('filteredCount').textContent = filteredPRs.length;

  if (filteredPRs.length === 0) {
    const hasPat = !!localStorage.getItem('github-pat');
    const hasRepos = state.selectedRepos.size > 0;
    let title, message;
    if (!hasPat) {
      title = 'No GitHub PAT';
      message = 'Add a Personal Access Token in settings to start monitoring pull requests.';
    } else if (!hasRepos) {
      title = 'No Repositories Selected';
      message = 'Try selecting a repository from the dropdown above.';
    } else {
      title = 'No Pull Requests Found';
      message = 'Try adjusting your filters or load PRs from a different repository.';
    }
    tbody.innerHTML = `
      <tr>
        <td colspan="9" class="px-8 py-16 text-center text-white/40">
          <div class="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-cyan/10">
            <svg class="h-6 w-6 text-cyan" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10"/>
              <line x1="12" y1="8" x2="12" y2="12"/>
              <line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
          </div>
          <p class="mb-2 font-space-mono text-sm text-text-primary">${title}</p>
          <p class="help-box-desc">${message}</p>
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = filteredPRs
    .map((pr) => {
      const reviewSummary = getReviewSummary(pr);
      const mentions = getMentions(pr);
      const authorLogin = pr.user?.login || 'unknown';
      const isOwned = authorLogin === state.currentUser;
      const reviewedByMe =
        pr.reviews?.some(
          (r) => r.user?.login === state.currentUser && r.state !== 'PENDING',
        ) || false;
      const repoUrl = pr.repository_url || pr.url;
      const repoName = getRepoNameFromUrl(repoUrl);
      const fullRepoName = getRepoFullNameFromUrl(repoUrl);
      const prTitle = pr.title || 'Untitled PR';
      const prUrl = pr.html_url || '#';
      const buildStatus = pr.buildStatus || {
        state: 'unknown',
        conclusion: null,
        checkRuns: [],
      };

      const repoColorIdx = getRepoColorIndex(fullRepoName);
      const repoBgClass = `repo-bg-${repoColorIdx}`;
      const repoColorClass = `repo-color-${repoColorIdx}`;

      const badgeBase =
        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-space-mono text-[11px] font-medium';
      let reviewsHTML = '';
      if (reviewSummary.approved)
        reviewsHTML += `<span class="${badgeBase} border-green/30 bg-green/[0.12] text-green">✓ Approved (${reviewSummary.approved})</span>`;
      if (reviewSummary.changes)
        reviewsHTML += `<span class="${badgeBase} border-red/30 bg-red/[0.12] text-red">⚠ Changes (${reviewSummary.changes})</span>`;
      if (reviewSummary.commented)
        reviewsHTML += `<span class="${badgeBase} border-cyan/20 bg-cyan/[0.08] text-cyan">💬 Commented (${reviewSummary.commented})</span>`;
      if (!reviewsHTML)
        reviewsHTML = `<span class="${badgeBase} border-amber/30 bg-amber/[0.12] text-amber">⏳ No reviews</span>`;

      const mentionsHTML =
        mentions.length > 0
          ? `<div class="mentions">${mentions.join(', ')}</div>`
          : '<span class="muted-dash font-space-mono text-xs">—</span>';

      let buildStatusHTML = '';
      if (buildStatus.state === 'in_progress') {
        buildStatusHTML = `<span class="${badgeBase} border-amber/30 bg-amber/[0.12] text-amber">🔄 In Progress</span>`;
      } else if (buildStatus.state === 'failure') {
        buildStatusHTML = `<span class="${badgeBase} border-red/30 bg-red/[0.12] text-red">❌ Failed</span>`;
      } else if (buildStatus.state === 'success') {
        buildStatusHTML = `<span class="${badgeBase} border-green/30 bg-green/[0.12] text-green">✅ Passed</span>`;
      } else if (buildStatus.state === 'pending') {
        buildStatusHTML = `<span class="${badgeBase} border-amber/30 bg-amber/[0.12] text-amber">⏳ Pending</span>`;
      } else {
        buildStatusHTML =
          '<span class="muted-dash font-space-mono text-xs">—</span>';
      }

      let mergeStatusHTML = '';
      const mergeState = pr.mergeable_state || 'unknown';
      const badges = [];

      if (mergeState === 'dirty') {
        badges.push(
          `<span class="${badgeBase} border-red/30 bg-red/[0.12] text-red">↻ Needs Rebase</span>`,
        );
      } else if (mergeState === 'unstable') {
        badges.push(
          `<span class="${badgeBase} border-amber/30 bg-amber/[0.12] text-amber">🔄 CI Pending</span>`,
        );
      }

      if (buildStatus.state === 'in_progress') {
        badges.push(
          `<span class="${badgeBase} border-amber/30 bg-amber/[0.12] text-amber">🔄 CI Running</span>`,
        );
      } else if (buildStatus.state === 'pending') {
        badges.push(
          `<span class="${badgeBase} border-amber/30 bg-amber/[0.12] text-amber">⏳ CI Pending</span>`,
        );
      }

      mergeStatusHTML =
        badges.length > 0
          ? badges.join(' ')
          : '<span class="muted-dash font-space-mono text-xs">—</span>';

      const labelsHTML =
        pr.labels && pr.labels.length > 0
          ? pr.labels
              .map(
                (label) =>
                  `<span class="inline-block rounded px-2 py-[3px] text-[10px] font-medium mr-1 mb-0.5 border border-border-faint" style="background-color: #${label.color}; color: ${getContrastColor(label.color)}">${escapeHtml(label.name)}</span>`,
              )
              .join('')
          : '<span class="muted-dash font-space-mono text-xs">—</span>';

      const showRepo = state.selectedRepos.size !== 1;
      const repoMeta = showRepo
        ? `<div class="mt-1 flex items-center gap-1.5 text-[11px] text-white/40">
             <span class="inline-block h-2 w-2 shrink-0 rounded-full ${repoColorClass}"></span>
             <span>${escapeHtml(fullRepoName)}</span>
           </div>`
        : '';

      return `
      <tr class="${isOwned ? 'owned-pr' : ''} ${repoBgClass} transition-colors duration-150 hover:bg-cyan/[0.03]">
        <td class="px-3 py-3 align-middle text-[13px] text-white/70 border-b border-white/[0.04]">
          <a href="${prUrl}" target="_blank" class="font-semibold text-cyan no-underline hover:underline">${escapeHtml(prTitle)}</a>
          ${repoMeta}
        </td>
        <td class="px-3 py-3 align-middle text-[13px] text-white/70 border-b border-white/[0.04]">${escapeHtml(authorLogin)}</td>
        <td class="px-3 py-3 align-middle text-[13px] text-white/70 border-b border-white/[0.04]"><div class="flex flex-wrap gap-1">${reviewsHTML}</div></td>
        <td class="px-3 py-3 align-middle text-center text-[13px] text-white/70 border-b border-white/[0.04]">${reviewedByMe ? '✓' : ''}</td>
        <td class="px-3 py-3 align-middle text-[13px] text-white/70 border-b border-white/[0.04]">${mentionsHTML}</td>
        <td class="px-3 py-3 align-middle text-[13px] text-white/70 border-b border-white/[0.04]">${labelsHTML}</td>
        <td class="px-3 py-3 align-middle text-[13px] text-white/70 border-b border-white/[0.04]"><div class="flex flex-wrap gap-1">${buildStatusHTML}</div></td>
        <td class="px-3 py-3 align-middle text-[13px] text-white/70 border-b border-white/[0.04]"><div class="flex flex-wrap gap-1">${mergeStatusHTML}</div></td>
        <td class="pr-updated px-3 py-3 align-middle border-b border-white/[0.04]">${formatLastUpdated(pr.updated_at)}</td>
      </tr>
    `;
    })
    .join('');
}

export function updateStats() {
  // Stats should reflect only PRs from selected repos
  const visiblePRs = state.allPRs.filter((pr) => {
    const repoUrl = pr.repository_url || pr.url;
    if (!repoUrl || typeof repoUrl !== 'string') return false;
    const repoName = getRepoFullNameFromUrl(repoUrl);
    return state.selectedRepos.has(repoName);
  });
  document.getElementById('statApproved').textContent = visiblePRs.filter(
    (pr) => pr.reviews?.some((r) => r.state === 'APPROVED'),
  ).length;
  document.getElementById('statChanges').textContent = visiblePRs.filter((pr) =>
    pr.reviews?.some((r) => r.state === 'CHANGES_REQUESTED'),
  ).length;
}

export function sortTable(column) {
  const existingIndex = state.currentSort.findIndex((s) => s.column === column);

  if (existingIndex !== -1) {
    state.currentSort[existingIndex].direction =
      state.currentSort[existingIndex].direction === 'asc' ? 'desc' : 'asc';
  } else {
    state.currentSort.push({ column, direction: 'asc' });
  }
  renderTable();
}

export function clearSort() {
  state.currentSort = [];
  renderTable();
}

export function setFilter(filter) {
  state.currentFilter = filter;
  document.querySelectorAll('[data-filter]').forEach((btn) => {
    btn.classList.remove('active');
  });
  document.querySelector(`[data-filter="${filter}"]`).classList.add('active');
  renderTable();
}

function getVisiblePRs() {
  return state.allPRs.filter((pr) => {
    const repoUrl = pr.repository_url || pr.url;
    if (!repoUrl || typeof repoUrl !== 'string') return false;
    const repoName = getRepoFullNameFromUrl(repoUrl);
    return state.selectedRepos.has(repoName);
  });
}

export function computeStatusReport() {
  const prs = getVisiblePRs();

  // PRs open by person
  const byAuthor = {};
  prs.forEach((pr) => {
    const author = pr.user?.login || 'Unknown';
    byAuthor[author] = (byAuthor[author] || 0) + 1;
  });

  // PRs by label
  const byLabel = {};
  prs.forEach((pr) => {
    (pr.labels || []).forEach((label) => {
      const name = label.name || 'Unknown';
      byLabel[name] = (byLabel[name] || 0) + 1;
    });
  });

  // Review buckets
  let none = 0, one = 0, twoPlus = 0;
  prs.forEach((pr) => {
    const count = (pr.reviews || []).length;
    if (count === 0) none++;
    else if (count === 1) one++;
    else twoPlus++;
  });

  // Approved
  const approvedCount = prs.filter((pr) =>
    pr.reviews?.some((r) => r.state === 'APPROVED'),
  ).length;

  // Failing builds
  const failingBuilds = prs.filter(
    (pr) => pr.buildStatus?.state === 'failure',
  ).length;

  // Updated recency
  const now = Date.now();
  const ms24h = 24 * 60 * 60 * 1000;
  const ms7d = 7 * ms24h;
  let last24h = 0, last7d = 0, stale = 0;
  prs.forEach((pr) => {
    const updated = new Date(pr.updated_at || 0).getTime();
    const diff = now - updated;
    if (diff <= ms24h) last24h++;
    else if (diff <= ms7d) last7d++;
    else stale++;
  });

  return {
    total: prs.length,
    byAuthor,
    byLabel,
    reviewBuckets: { none, one, twoPlus },
    approvedCount,
    failingBuilds,
    updatedBuckets: { last24h, last7d, stale },
  };
}

function statCard(label, value, colorClass = 'text-cyan') {
  return `
    <div class="flex flex-col items-center justify-center rounded-xl border border-border-faint bg-surface p-3">
      <div class="font-space-mono text-[10px] uppercase tracking-wider text-white/40">${escapeHtml(label)}</div>
      <div class="font-space-mono text-[22px] font-bold ${colorClass}">${value}</div>
    </div>
  `;
}

function barRow(label, value, max, color = 'bg-cyan') {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return `
    <div class="flex items-center gap-3">
      <div class="w-[120px] shrink-0 truncate font-space-mono text-[11px] text-white/60">${escapeHtml(label)}</div>
      <div class="flex-1">
        <div class="h-2 w-full rounded-full bg-white/[0.06]">
          <div class="h-2 rounded-full ${color}" style="width: ${pct}%"></div>
        </div>
      </div>
      <div class="w-6 text-right font-space-mono text-[11px] font-bold text-white/70">${value}</div>
    </div>
  `;
}

export function renderStatusReport() {
  const container = document.getElementById('statusReportContent');
  const data = computeStatusReport();

  if (data.total === 0) {
    container.innerHTML = `
      <div class="text-center py-8">
        <div class="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-cyan/10">
          <svg class="h-5 w-5 text-cyan" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10"/>
            <line x1="12" y1="8" x2="12" y2="12"/>
            <line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
        </div>
        <p class="font-space-mono text-sm text-text-primary">No PRs to report on</p>
        <p class="mt-1 text-[12px] text-white/40">Load PRs from your selected repositories first.</p>
      </div>
    `;
    return;
  }

  const authorEntries = Object.entries(data.byAuthor).sort((a, b) => b[1] - a[1]);
  const labelEntries = Object.entries(data.byLabel).sort((a, b) => b[1] - a[1]);
  const maxAuthor = authorEntries.length > 0 ? authorEntries[0][1] : 0;
  const maxLabel = labelEntries.length > 0 ? labelEntries[0][1] : 0;

  const authorsHTML = authorEntries.length
    ? authorEntries.map(([name, count]) => barRow(name, count, maxAuthor, 'bg-cyan')).join('')
    : '<p class="text-[11px] text-white/30">No authors</p>';

  const labelsHTML = labelEntries.length
    ? labelEntries.map(([name, count]) => barRow(name, count, maxLabel, 'bg-amber')).join('')
    : '<p class="text-[11px] text-white/30">No labels</p>';

  container.innerHTML = `
    <!-- Top summary cards -->
    <div class="grid grid-cols-3 gap-3">
      ${statCard('Total PRs', data.total)}
      ${statCard('Approved', data.approvedCount, 'text-green')}
      ${statCard('Failing Builds', data.failingBuilds, 'text-red')}
    </div>

    <!-- Review distribution -->
    <div>
      <h3 class="mb-3 font-space-mono text-[10px] font-bold uppercase tracking-wider text-white/40">Reviews</h3>
      <div class="grid grid-cols-3 gap-3">
        ${statCard('No Reviews', data.reviewBuckets.none, 'text-amber')}
        ${statCard('1 Review', data.reviewBuckets.one)}
        ${statCard('2+ Reviews', data.reviewBuckets.twoPlus, 'text-green')}
      </div>
    </div>

    <!-- Updated recency -->
    <div>
      <h3 class="mb-3 font-space-mono text-[10px] font-bold uppercase tracking-wider text-white/40">Last Updated</h3>
      <div class="grid grid-cols-3 gap-3">
        ${statCard('< 24 hrs', data.updatedBuckets.last24h, 'text-green')}
        ${statCard('< 7 days', data.updatedBuckets.last7d)}
        ${statCard('> 7 days', data.updatedBuckets.stale, 'text-amber')}
      </div>
    </div>

    <!-- By author -->
    <div>
      <h3 class="mb-3 font-space-mono text-[10px] font-bold uppercase tracking-wider text-white/40">Open PRs by Person</h3>
      <div class="space-y-2 rounded-xl border border-border-faint bg-surface p-4">
        ${authorsHTML}
      </div>
    </div>

    <!-- By label -->
    <div>
      <h3 class="mb-3 font-space-mono text-[10px] font-bold uppercase tracking-wider text-white/40">PRs by Label</h3>
      <div class="space-y-2 rounded-xl border border-border-faint bg-surface p-4">
        ${labelsHTML}
      </div>
    </div>
  `;
}
