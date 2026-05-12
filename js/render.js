import { state } from './state.js';
import {
  escapeHtml,
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

function getConsolidatedReviews(pr) {
  const reviews = pr.reviews || [];
  const reviewsByUser = {};
  reviews.forEach(review => {
    const userName = review.user?.login;
    if (!userName) return;
    if (review.state !== 'APPROVED' && review.state !== 'CHANGES_REQUESTED') return;
    if (!reviewsByUser[userName] ||
        new Date(review.submitted_at || review.created_at) >
        new Date(reviewsByUser[userName].submitted_at || reviewsByUser[userName].created_at)) {
      reviewsByUser[userName] = review;
    }
  });
  return Object.values(reviewsByUser);
}

function getConsolidatedApprovalCount(pr) {
  return getConsolidatedReviews(pr).filter(r => r.state === 'APPROVED').length;
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

function getStatusBadge(pr) {
  const latestReviews = getConsolidatedReviews(pr);
  const approvalCount = latestReviews.filter(r => r.state === 'APPROVED').length;
  const hasChanges = latestReviews.some(r => r.state === 'CHANGES_REQUESTED');
  const buildFailed = pr.buildStatus?.state === 'failure';
  const mergeConflict = pr.mergeable_state === 'dirty';
  if (hasChanges || buildFailed || mergeConflict) {
    const reason = hasChanges ? 'Changes req.' : buildFailed ? 'Build fail' : 'Needs rebase';
    return `<span class="rr-badge rr-badge-blocked"><span class="rr-badge-dot"></span>${escapeHtml(reason)}</span>`;
  }
  if (approvalCount >= 2) return `<span class="rr-badge rr-badge-approved"><span class="rr-badge-dot"></span>Approved</span>`;
  if (latestReviews.length > 0) return `<span class="rr-badge rr-badge-review"><span class="rr-badge-dot"></span>Awaiting approval</span>`;
  if (pr.draft) return `<span class="rr-badge rr-badge-draft"><span class="rr-badge-dot"></span>Draft</span>`;
  return `<span class="rr-badge rr-badge-open"><span class="rr-badge-dot"></span>Open</span>`;
}

function getAuthorAvatar(login, avatarUrl) {
  const colors = ['#0e7490','#7c3aed','#b45309','#0f766e','#be185d','#1d4ed8','#15803d','#9333ea'];
  let hash = 0;
  for (let i = 0; i < login.length; i++) hash = login.charCodeAt(i) + ((hash << 5) - hash);
  const color = colors[Math.abs(hash) % colors.length];
  const initials = login.slice(0, 2).toUpperCase();
  
  if (avatarUrl) {
    return `<img src="${avatarUrl}" alt="${escapeHtml(login)}" class="rr-avatar-img" title="${escapeHtml(login)}" onerror="this.style.display='none';"/>`;
  }
  
  return `<span class="rr-avatar" style="background:${color}" title="${escapeHtml(login)}">${initials}</span>`;
}

function getBuildText(buildStatus) {
  if (buildStatus.state === 'success') return '<span class="rr-build-ok">✓ pass</span>';
  if (buildStatus.state === 'failure') return '<span class="rr-build-fail">✗ fail</span>';
  if (buildStatus.state === 'in_progress') return '<span class="rr-build-run">⟳ running</span>';
  if (buildStatus.state === 'pending') return '<span class="rr-build-run">⟳ pending</span>';
  return '<span class="rr-build-na">—</span>';
}

function getStatusText(pr) {
  const latestReviews = getConsolidatedReviews(pr);
  const approvalCount = latestReviews.filter(r => r.state === 'APPROVED').length;
  const hasChanges = latestReviews.some(r => r.state === 'CHANGES_REQUESTED');
  const buildFailed = pr.buildStatus?.state === 'failure';
  const mergeConflict = pr.mergeable_state === 'dirty';
  
  if (hasChanges || buildFailed || mergeConflict) {
    return hasChanges ? 'Changes req.' : buildFailed ? 'Build fail' : 'Needs rebase';
  }
  if (approvalCount >= 2) return 'Approved';
  if (latestReviews.length > 0) return 'Awaiting approval';
  if (pr.draft) return 'Draft';
  return 'Open';
}

function getUserAction(pr) {
  const userReview = pr.reviews?.find(r => r.user?.login === state.currentUser);
  if (!userReview) return '';
  if (userReview.state === 'APPROVED') return '<span title="You approved">✓</span>';
  if (userReview.state === 'COMMENTED') return '<span title="You left comments">💬</span>';
  return '';
}

export function renderTable() {
  const tbody = document.getElementById('prTableBody');
  let filteredPRs = state.allPRs;

  // Clear PR data map
  state.prDataMap = {};

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
  } else if (state.currentFilter === 'approved') {
    filteredPRs = filteredPRs.filter((pr) =>
      getConsolidatedApprovalCount(pr) >= 2,
    );
  } else if (state.currentFilter === 'blocked') {
    filteredPRs = filteredPRs.filter((pr) =>
      pr.buildStatus?.state === 'failure' ||
      pr.mergeable_state === 'dirty' ||
      pr.reviews?.some((r) => r.state === 'CHANGES_REQUESTED'),
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

  // Apply field filters (label, status)
  if (state.activeFilters.label) {
    filteredPRs = filteredPRs.filter((pr) =>
      pr.labels?.some((l) => l.name === state.activeFilters.label),
    );
  }
  if (state.activeFilters.status) {
    filteredPRs = filteredPRs.filter((pr) =>
      getStatusText(pr) === state.activeFilters.status,
    );
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
        case 'approval':
          const aApproved = a.reviews?.some(r => r.state === 'APPROVED') ? 1 : 0;
          const bApproved = b.reviews?.some(r => r.state === 'APPROVED') ? 1 : 0;
          if (aApproved !== bApproved) {
            aVal = aApproved;
            bVal = bApproved;
          } else {
            const aChanges = a.reviews?.some(r => r.state === 'CHANGES_REQUESTED') ? 1 : 0;
            const bChanges = b.reviews?.some(r => r.state === 'CHANGES_REQUESTED') ? 1 : 0;
            aVal = aChanges;
            bVal = bChanges;
          }
          break;
        case 'status':
          aVal = getStatusText(a).toLowerCase();
          bVal = getStatusText(b).toLowerCase();
          break;
        case 'activity':
          const aSum = getReviewSummary(a);
          const bSum = getReviewSummary(b);
          aVal = (aSum.approved || 0) + (aSum.commented || 0);
          bVal = (bSum.approved || 0) + (bSum.commented || 0);
          break;
        case 'myaction':
          const aUserReview = a.reviews?.find(r => r.user?.login === state.currentUser);
          const bUserReview = b.reviews?.find(r => r.user?.login === state.currentUser);
          aVal = aUserReview ? (aUserReview.state === 'APPROVED' ? 2 : 1) : 0;
          bVal = bUserReview ? (bUserReview.state === 'APPROVED' ? 2 : 1) : 0;
          break;
        case 'approvals':
          const aSummary = getReviewSummary(a);
          const bSummary = getReviewSummary(b);
          aVal = aSummary.approved || 0;
          bVal = bSummary.approved || 0;
          break;
        case 'comments':
          const aComments = getReviewSummary(a);
          const bComments = getReviewSummary(b);
          aVal = aComments.commented || 0;
          bVal = bComments.commented || 0;
          break;
        case 'labels':
          aVal = a.labels?.length || 0;
          bVal = b.labels?.length || 0;
          break;
        case 'created':
          aVal = new Date(a.created_at || 0).getTime();
          bVal = new Date(b.created_at || 0).getTime();
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
  });

  if (state.currentSort.length === 1) {
    const sort = state.currentSort[0];
    const headers = Array.from(document.querySelectorAll('#prTable th')).filter(
      (th) => {
        const text = th.textContent.toLowerCase();
        return sort.column === text.toLowerCase();
      },
    );
    if (headers.length > 0) {
      headers[0].classList.add(
        sort.direction === 'asc' ? 'sorted-asc' : 'sorted-desc',
      );
    }
  }

  const totalCountEl = document.getElementById('totalCount');
  if (totalCountEl) totalCountEl.textContent = state.allPRs.length;

  if (filteredPRs.length === 0) {
    const hasPat = !!localStorage.getItem('github-pat');
    const savedRepos = JSON.parse(localStorage.getItem('github-repos') || '[]');
    const hasRepos = savedRepos.length > 0 || state.selectedRepos.size > 0;
    let title, message, actionHtml = '';
    if (!hasPat) {
      title = 'No GitHub PAT';
      message = 'Add a Personal Access Token in settings to start monitoring pull requests.';
      actionHtml = `<a href="/settings" class="rr-btn-primary" style="text-decoration:none;margin-top:16px;display:inline-block;">Go to Settings →</a>`;
    } else if (!hasRepos) {
      title = 'No Repositories Selected';
      message = 'Select a repository from the dropdown, or add one in Settings.';
      actionHtml = `<a href="/settings" class="rr-btn-primary" style="text-decoration:none;margin-top:16px;display:inline-block;">Add Repository →</a>`;
    } else {
      title = 'No Pull Requests Found';
      message = 'Try adjusting your filters or load PRs from a different repository.';
    }
    tbody.innerHTML = `
      <tr>
        <td colspan="10" style="padding:64px 32px;text-align:center;color:var(--muted-dim);">
          <div style="margin:0 auto 16px;width:48px;height:48px;border-radius:50%;background:var(--cyan-dim);display:flex;align-items:center;justify-content:center;">
            <svg style="color:var(--cyan);" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
          </div>
          <p style="font-family:'Space Mono',monospace;font-size:13px;color:var(--text-primary);margin-bottom:6px;">${title}</p>
          <p style="font-size:12px;color:var(--muted-dim);">${message}</p>
          ${actionHtml}
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = filteredPRs
    .map((pr) => {
      const authorLogin = pr.user?.login || 'unknown';
      const isOwned = authorLogin === state.currentUser;
      const repoUrl = pr.repository_url || pr.url;
      const fullRepoName = getRepoFullNameFromUrl(repoUrl);
      const prTitle = pr.title || 'Untitled PR';
      const prUrl = pr.html_url || '#';
      const buildStatus = pr.buildStatus || { state: 'unknown', conclusion: null, checkRuns: [] };
      const repoColorIdx = getRepoColorIndex(fullRepoName);
      const repoBgClass = `repo-bg-${repoColorIdx}`;

      const showRepo = state.selectedRepos.size !== 1;
      const repoMeta = showRepo
        ? `<div class="rr-pr-repo"><span class="rr-radar-blip-sm repo-color-${repoColorIdx}"></span>${escapeHtml(fullRepoName)}</div>`
        : '';

      const reviewSummary = getReviewSummary(pr);
      const approvalCount = reviewSummary.approved || 0;
      const commentCount = reviewSummary.commented || 0;
      const approvalsDisplay = approvalCount > 0 ? `<span>${approvalCount}</span>` : '<span class="rr-build-na">—</span>';
      const commentsDisplay = commentCount > 0 ? `<span>${commentCount}</span>` : '<span class="rr-build-na">—</span>';

      const labelsHTML = pr.labels && pr.labels.length > 0
        ? pr.labels.map(label =>
            `<span class="inline-block rounded px-2 py-[3px] text-[10px] font-medium mr-1 mb-0.5 border border-border-faint rr-label-clickable" style="background-color:#${label.color}33;border-color:#${label.color}44;" onclick="filterByLabel('${escapeHtml(label.name)}');event.stopPropagation();" title="Filter by label"><span class="rr-label-text">${escapeHtml(label.name)}</span></span>`
          ).join('')
        : '<span class="rr-build-na">—</span>';

      const userAction = getUserAction(pr);

      // Store PR data for drawer access
      state.prDataMap[pr.id] = pr;

      return `
      <tr class="${isOwned ? 'owned-pr' : ''} ${repoBgClass}">
        <td style="padding:11px 12px;vertical-align:middle;max-width:320px;display:flex;align-items:center;justify-content:space-between;gap:8px;">
          <div style="flex:1;min-width:0;">
            <a href="${prUrl}" target="_blank" class="rr-pr-title">${escapeHtml(prTitle)}</a>
            ${repoMeta}
          </div>
          <button onclick="openPRDrawer('${pr.id}')" 
            style="flex-shrink:0;background:none;border:none;cursor:pointer;padding:6px;color:var(--muted);transition:color 200ms;font-size:16px;" 
            onmouseover="this.style.color='var(--text-primary)'" 
            onmouseout="this.style.color='var(--muted)'"
            title="Details">⋯</button>
        </td>
        <td style="padding:11px 12px;vertical-align:middle;">${getAuthorAvatar(authorLogin, pr.user?.avatar_url)}</td>
        <td style="padding:11px 12px;vertical-align:middle;"><span class="rr-status-clickable" onclick="filterByStatus('${escapeHtml(getStatusText(pr))}');event.stopPropagation();" title="Filter by status">${getStatusBadge(pr)}</span></td>
        <td style="padding:11px 12px;vertical-align:middle;text-align:center;font-size:16px;">${userAction}</td>
        <td style="padding:11px 12px;vertical-align:middle;text-align:center;">${approvalsDisplay}</td>
        <td style="padding:11px 12px;vertical-align:middle;text-align:center;">${commentsDisplay}</td>
        <td style="padding:11px 12px;vertical-align:middle;max-width:180px;word-wrap:break-word;overflow-wrap:break-word;">${labelsHTML}</td>
        <td style="padding:11px 12px;vertical-align:middle;">${getBuildText(buildStatus)}</td>
        <td style="padding:11px 12px;vertical-align:middle;" class="rr-age">${formatLastUpdated(pr.created_at)}</td>
        <td style="padding:11px 12px;vertical-align:middle;" class="rr-age">${formatLastUpdated(pr.updated_at)}</td>
      </tr>
    `;
    })
    .join('');

  renderActiveFilters();
}

export function updateStats() {
  const visiblePRs = state.allPRs.filter((pr) => {
    const repoUrl = pr.repository_url || pr.url;
    if (!repoUrl || typeof repoUrl !== 'string') return false;
    const repoName = getRepoFullNameFromUrl(repoUrl);
    return state.selectedRepos.has(repoName);
  });
  const setEl = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
  setEl('statMine', visiblePRs.filter(pr => (pr.user?.login || '') === state.currentUser).length);
  setEl('statApproved', visiblePRs.filter(pr => getConsolidatedApprovalCount(pr) >= 2).length);
  setEl('statNeedsAttention', visiblePRs.filter(pr => {
    const isNotByMe = (pr.user?.login || '') !== state.currentUser;
    const isNotDraft = !pr.draft;
    const hasNotReviewedByMe = !pr.reviews?.some(r => r.user?.login === state.currentUser);
    const hasNoApprovals = !pr.reviews?.some(r => r.state === 'APPROVED');
    return isNotByMe && isNotDraft && hasNotReviewedByMe && hasNoApprovals;
  }).length);
  setEl('statBlocked', visiblePRs.filter(pr =>
    pr.buildStatus?.state === 'failure' ||
    pr.mergeable_state === 'dirty' ||
    pr.reviews?.some(r => r.state === 'CHANGES_REQUESTED')
  ).length);
  // Legacy compat
  setEl('statChanges', visiblePRs.filter(pr => pr.reviews?.some(r => r.state === 'CHANGES_REQUESTED')).length);
}

export function sortTable(column) {
  if (state.currentSort.length === 1 && state.currentSort[0].column === column) {
    // Cycle: asc → desc → unsorted
    const current = state.currentSort[0];
    if (current.direction === 'asc') {
      state.currentSort = [{ column, direction: 'desc' }];
    } else {
      state.currentSort = [];
    }
  } else {
    // New column sort — discard any existing sort
    state.currentSort = [{ column, direction: 'asc' }];
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
  const activeBtn = document.querySelector(`[data-filter="${filter}"]`);
  if (activeBtn) activeBtn.classList.add('active');
  renderTable();
}

export function filterByLabel(labelName) {
  state.activeFilters.label = labelName;
  state.activeFilters.status = null;
  renderTable();
}

export function filterByStatus(statusText) {
  state.activeFilters.status = statusText;
  state.activeFilters.label = null;
  renderTable();
}

export function clearLabelFilter() {
  state.activeFilters.label = null;
  renderTable();
}

export function clearStatusFilter() {
  state.activeFilters.status = null;
  renderTable();
}

function renderActiveFilters() {
  const pill = document.getElementById('activeFilterPill');
  if (!pill) return;

  if (state.activeFilters.label) {
    pill.innerHTML = `
      <span class="rr-pill active">
        Label: ${escapeHtml(state.activeFilters.label)}
        <button class="rr-filter-pill-close" onclick="clearLabelFilter();event.stopPropagation();" title="Remove label filter">×</button>
      </span>
    `;
    pill.style.display = 'inline-flex';
  } else if (state.activeFilters.status) {
    pill.innerHTML = `
      <span class="rr-pill active">
        Status: ${escapeHtml(state.activeFilters.status)}
        <button class="rr-filter-pill-close" onclick="clearStatusFilter();event.stopPropagation();" title="Remove status filter">×</button>
      </span>
    `;
    pill.style.display = 'inline-flex';
  } else {
    pill.innerHTML = '';
    pill.style.display = 'none';
  }
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

  // Blocked (includes build failures, dirty merge state, and changes requested)
  const blockedCount = prs.filter(pr =>
    pr.buildStatus?.state === 'failure' ||
    pr.mergeable_state === 'dirty' ||
    pr.reviews?.some(r => r.state === 'CHANGES_REQUESTED')
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
    blockedCount,
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
    return false;
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
      ${statCard('Blocked', data.blockedCount, 'text-red')}
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
  return true;
}
