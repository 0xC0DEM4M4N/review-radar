'use client';

import { useMemo, useCallback, useRef, useState, useEffect } from 'react';
import { useAppStore, COLUMN_META, ColumnKey, PR } from '@/lib/store';
import {
  escapeHtml,
  formatDateSplit,
  formatRelativeTime,
  getRepoFullNameFromUrl,
  getRepoNameFromUrl,
  getRepoColorIndex,
  withOpacity,
} from '@/lib/utils';
import { formatSize, computeComplexityBreakdown, computeEffort, formatEffort } from '@/lib/complexity';
import { useTranslations, useLocale } from 'next-intl';

function getReviewSummary(pr: PR) {
  const reviews = pr.reviews || [];
  const statusMap: Record<string, number> = {};
  reviews.forEach((review) => {
    if (review.state === 'APPROVED') statusMap.approved = (statusMap.approved || 0) + 1;
    else if (review.state === 'CHANGES_REQUESTED') statusMap.changes = (statusMap.changes || 0) + 1;
    else if (review.state === 'COMMENTED') statusMap.commented = (statusMap.commented || 0) + 1;
    else if (review.state === 'PENDING') statusMap.pending = (statusMap.pending || 0) + 1;
  });
  return statusMap;
}

function getConsolidatedReviews(pr: PR) {
  const reviews = pr.reviews || [];
  const byUser: Record<string, any> = {};
  reviews.forEach((review) => {
    const userName = review.user?.login;
    if (!userName) return;
    if (review.state !== 'APPROVED' && review.state !== 'CHANGES_REQUESTED') return;
    const existing = byUser[userName];
    const newDate = new Date(review.submitted_at || review.created_at || 0);
    if (!existing || newDate > new Date(existing.submitted_at || existing.created_at || 0)) {
      byUser[userName] = review;
    }
  });
  return Object.values(byUser);
}

type StatusKey = 'changesRequested' | 'buildFail' | 'approved' | 'awaitingApproval' | 'draft' | 'open';

function getStatusKey(pr: PR): StatusKey {
  const latest = getConsolidatedReviews(pr);
  const approvalCount = latest.filter((r: any) => r.state === 'APPROVED').length;
  const hasChanges = latest.some((r: any) => r.state === 'CHANGES_REQUESTED');
  const buildFailed = pr.buildStatus?.state === 'failure';
  if (hasChanges || buildFailed) {
    return hasChanges ? 'changesRequested' : 'buildFail';
  }
  if (approvalCount >= 2) return 'approved';
  if (latest.length > 0) return 'awaitingApproval';
  if (pr.draft) return 'draft';
  return 'open';
}

const STATUS_BADGE_MAP: Record<StatusKey, string> = {
  changesRequested: 'rr-badge-blocked',
  buildFail: 'rr-badge-blocked',
  approved: 'rr-badge-approved',
  awaitingApproval: 'rr-badge-review',
  draft: 'rr-badge-draft',
  open: 'rr-badge-open',
};

type BuildKey = 'pass' | 'fail' | 'running' | 'pending' | 'na';

function getBuildKey(pr: PR): BuildKey {
  const state = pr.buildStatus?.state;
  if (state === 'success') return 'pass';
  if (state === 'failure') return 'fail';
  if (state === 'in_progress') return 'running';
  if (state === 'pending') return 'pending';
  return 'na';
}

function getBuildFilterKey(pr: PR): BuildKey | 'rebase' {
  if (pr.mergeable_state === 'dirty') return 'rebase';
  return getBuildKey(pr);
}

function getUserAction(pr: PR, currentUser: string | null): '' | 'approved' | 'changesRequested' | 'commented' {
  if (!currentUser) return '';
  if (pr.user?.login === currentUser) return '';
  const myReviews = (pr.reviews || []).filter((r) => r.user?.login === currentUser);
  if (myReviews.length === 0) return '';
  // Sort by most recent review first
  const sorted = myReviews.sort((a, b) => {
    const aDate = new Date(a.submitted_at || a.created_at || 0).getTime();
    const bDate = new Date(b.submitted_at || b.created_at || 0).getTime();
    return bDate - aDate;
  });
  const latest = sorted[0];
  if (latest.state === 'APPROVED') return 'approved';
  if (latest.state === 'CHANGES_REQUESTED') return 'changesRequested';
  if (latest.state === 'COMMENTED') return 'commented';
  return '';
}

function AuthorAvatar({ login, avatarUrl }: { login: string; avatarUrl?: string }) {
  const colors = ['#0e7490', '#7c3aed', '#b45309', '#0f766e', '#be185d', '#1d4ed8', '#15803d', '#9333ea'];
  let hash = 0;
  for (let i = 0; i < login.length; i++) hash = login.charCodeAt(i) + ((hash << 5) - hash);
  const color = colors[Math.abs(hash) % colors.length];
  const initials = login.slice(0, 2).toUpperCase();
  if (avatarUrl) {
    return <img src={avatarUrl} alt={login} className="rr-avatar-img" title={login} onError={(e) => ((e.target as HTMLImageElement).style.display = 'none')} />;
  }
  return <span className="rr-avatar" style={{ background: color }} title={login}>{initials}</span>;
}

export default function PRTable({ onOpenDrawer, loading }: { onOpenDrawer: (pr: PR) => void; loading?: boolean }) {
  const {
    allPRs,
    currentUser,
    currentFilter,
    currentSort,
    activeFilters,
    selectedRepos,
    searchQuery,
    selectedUsers,
    columnOrder,
    repoColors,
    setActiveFilter,
  } = useAppStore();

  const t = useTranslations('components.prtable');
  const tc = useTranslations('common');
  const locale = useLocale();

  const columnLabels: Record<ColumnKey, string> = {
    title: t('columns.pullRequest'),
    author: t('columns.author'),
    status: t('columns.status'),
    myaction: t('columns.myAction'),
    approvals: t('columns.approvals'),
    comments: t('columns.comments'),
    labels: t('columns.labels'),
    build: t('columns.build'),
    files: t('columns.files'),
    size: t('columns.size'),
    complexity: t('columns.complexity'),
    effort: t('columns.effort'),
    created: t('columns.created'),
    updated: t('columns.updated'),
    details: '',
  };

  const [pageSize, setPageSize] = useState(() => {
    try {
      const saved = localStorage.getItem('reviewradar-page-size');
      const n = parseInt(saved || '25', 10);
      return n >= 0 ? n : 25;
    } catch { return 25; }
  });
  const [currentPage, setCurrentPage] = useState(1);

  const handlePageSize = (val: number) => {
    setPageSize(val);
    setCurrentPage(1);
    try { localStorage.setItem('reviewradar-page-size', String(val)); } catch {}
  };

  const filteredPRs = useMemo(() => {
    let prs = allPRs.filter((pr) => {
      const repoUrl = pr.repository_url || pr.url;
      if (!repoUrl || typeof repoUrl !== 'string') return false;
      const repoName = getRepoFullNameFromUrl(repoUrl);
      return selectedRepos.has(repoName);
    });

    if (currentFilter === 'owned') {
      prs = prs.filter((pr) => (pr.user?.login || '') === currentUser);
    } else if (currentFilter === 'not-owned') {
      prs = prs.filter((pr) => (pr.user?.login || '') !== currentUser);
    } else if (currentFilter === 'approved') {
      prs = prs.filter((pr) => getConsolidatedReviews(pr).filter((r: any) => r.state === 'APPROVED').length >= 2);
    } else if (currentFilter === 'blocked') {
      prs = prs.filter((pr) =>
        pr.buildStatus?.state === 'failure' ||
        pr.mergeable_state === 'dirty'
      );
    } else if (currentFilter === 'needs-attention') {
      prs = prs.filter((pr) => {
        const isNotByMe = (pr.user?.login || '') !== currentUser;
        const isNotDraft = !pr.draft;
        const hasNotReviewedByMe = !pr.reviews?.some((r) => r.user?.login === currentUser);
        const hasFewerThanTwoApprovals = getConsolidatedReviews(pr).filter((r: any) => r.state === 'APPROVED').length < 2;
        return isNotByMe && isNotDraft && hasNotReviewedByMe && hasFewerThanTwoApprovals;
      });
      if (currentSort.length === 0) {
        prs.sort((a, b) => {
          const aPass = a.buildStatus?.state === 'success' ? 1 : 0;
          const bPass = b.buildStatus?.state === 'success' ? 1 : 0;
          if (bPass !== aPass) return bPass - aPass;
          return new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime();
        });
      }
    }

    if (activeFilters.label) {
      prs = prs.filter((pr) => pr.labels?.some((l) => l.name === activeFilters.label));
    }
    if (activeFilters.status) {
      prs = prs.filter((pr) => getStatusKey(pr) === activeFilters.status);
    }
    if (activeFilters.author) {
      prs = prs.filter((pr) => (pr.user?.login || '') === activeFilters.author);
    }
    if (activeFilters.build) {
      prs = prs.filter((pr) => getBuildFilterKey(pr) === activeFilters.build);
    }

    if (selectedUsers.length > 0) {
      prs = prs.filter((pr) => selectedUsers.includes(pr.user?.login || ''));
    } else if (selectedUsers.length === 0) {
      prs = [];
    }

    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      prs = prs.filter(
        (pr) =>
          (pr.title || '').toLowerCase().includes(q) ||
          String(pr.number || '').includes(q)
      );
    }

    if (currentSort.length > 0) {
      prs.sort((a, b) => {
        for (const { column, direction } of currentSort) {
          let aVal: any;
          let bVal: any;
          switch (column) {
            case 'title':
              aVal = (a.title || '').toLowerCase();
              bVal = (b.title || '').toLowerCase();
              break;
            case 'repo':
              aVal = getRepoNameFromUrl(a.repository_url || '').toLowerCase();
              bVal = getRepoNameFromUrl(b.repository_url || '').toLowerCase();
              break;
            case 'author':
              aVal = (a.user?.login || '').toLowerCase();
              bVal = (b.user?.login || '').toLowerCase();
              break;
            case 'status':
              aVal = getStatusKey(a);
              bVal = getStatusKey(b);
              break;
            case 'approvals':
              aVal = getReviewSummary(a).approved || 0;
              bVal = getReviewSummary(b).approved || 0;
              break;
            case 'comments':
              aVal = getReviewSummary(a).commented || 0;
              bVal = getReviewSummary(b).commented || 0;
              break;
            case 'labels':
              aVal = a.labels?.length || 0;
              bVal = b.labels?.length || 0;
              break;
            case 'buildStatus':
              aVal = a.buildStatus?.state || 'unknown';
              bVal = b.buildStatus?.state || 'unknown';
              break;
            case 'files': {
              aVal = a.changed_files || (a.files?.length ?? 0);
              bVal = b.changed_files || (b.files?.length ?? 0);
              break;
            }
            case 'size': {
              const aTotal = (a.additions || 0) + (a.deletions || 0);
              const bTotal = (b.additions || 0) + (b.deletions || 0);
              aVal = aTotal;
              bVal = bTotal;
              break;
            }
            case 'complexity': {
              aVal = a.complexity ?? computeComplexityBreakdown(a.files || []).score;
              bVal = b.complexity ?? computeComplexityBreakdown(b.files || []).score;
              break;
            }
            case 'effort': {
              aVal = a.effort ?? computeEffort(a);
              bVal = b.effort ?? computeEffort(b);
              break;
            }
            case 'created':
              aVal = new Date(a.created_at || 0).getTime();
              bVal = new Date(b.created_at || 0).getTime();
              break;
            case 'updated':
              aVal = new Date(a.updated_at || 0).getTime();
              bVal = new Date(b.updated_at || 0).getTime();
              break;
            case 'myaction': {
              aVal = getUserAction(a, currentUser);
              bVal = getUserAction(b, currentUser);
              const order: Record<string, number> = { 'approved': 3, 'changesRequested': 2, 'commented': 1, '': 0 };
              aVal = order[aVal as string] ?? 0;
              bVal = order[bVal as string] ?? 0;
              break;
            }
            default:
              continue;
          }
          let cmp = 0;
          if (typeof aVal === 'string') cmp = aVal.localeCompare(bVal);
          else cmp = aVal - bVal;
          if (cmp !== 0) return direction === 'asc' ? cmp : -cmp;
        }
        return 0;
      });
    }

    return prs;
  }, [allPRs, currentUser, currentFilter, currentSort, activeFilters, selectedRepos, searchQuery, selectedUsers]);

  const totalPages = pageSize > 0 ? Math.max(1, Math.ceil(filteredPRs.length / pageSize)) : 1;
  useEffect(() => { if (currentPage > totalPages) setCurrentPage(totalPages); }, [totalPages, currentPage]);
  const displayPRs = useMemo(() => {
    if (pageSize <= 0) return filteredPRs;
    const start = (currentPage - 1) * pageSize;
    return filteredPRs.slice(start, start + pageSize);
  }, [filteredPRs, currentPage, pageSize]);

  const renderCell = useCallback((pr: PR, key: ColumnKey) => {
    const authorLogin = pr.user?.login || tc('unknown');
    const isOwned = authorLogin === currentUser;
    const repoUrl = pr.repository_url || pr.url || '';
    const fullRepoName = getRepoFullNameFromUrl(repoUrl);
    const prTitle = pr.title || tc('untitledPR');
    const prUrl = pr.html_url || '#';
    const repoColorIdx = getRepoColorIndex(fullRepoName);
    const customRepoColor = repoColors[fullRepoName];
    const showRepo = selectedRepos.size !== 1;
    const repoMeta = showRepo ? (
      <div className="rr-pr-repo">
        <span
          className={`rr-radar-blip-sm ${customRepoColor ? '' : `repo-color-${repoColorIdx}`}`}
          style={customRepoColor ? { background: customRepoColor } : undefined}
        />
        {fullRepoName}
      </div>
    ) : null;
    const reviewSummary = getReviewSummary(pr);
    const approvalCount = reviewSummary.approved || 0;
    const commentCount = reviewSummary.commented || 0;
    const approvalsDisplay = approvalCount > 0 ? <span>{approvalCount}</span> : <span className="rr-build-na">{t('build.na')}</span>;
    const commentsDisplay = commentCount > 0 ? <span>{commentCount}</span> : <span className="rr-build-na">{t('build.na')}</span>;
    const userActionKey = getUserAction(pr, currentUser);
    const userAction =
      userActionKey === 'approved' ? (
        <span title={t('userActionApproved')} style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="var(--green)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 8L6.5 11.5L13 4.5" />
          </svg>
        </span>
      ) : userActionKey === 'changesRequested' ? (
        <span title={t('userActionChangesRequested')} style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="var(--amber)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M13 8H3M3 8L7 4M3 8L7 12" />
          </svg>
        </span>
      ) : userActionKey === 'commented' ? (
        <span title={t('userActionCommented')} style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="var(--cyan)" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14 7.5C14 10.5376 11.5376 13 8.5 13H8L3.5 15V13H3C2.17157 13 1.5 12.3284 1.5 11.5V4.5C1.5 3.67157 2.17157 3 3 3H13C13.8284 3 14.5 3.67157 14.5 4.5V7.5Z" />
          </svg>
        </span>
      ) : '';
    const todayLabel = tc('today');
    const { dateStr: createdDate, timeStr: createdTime } = formatDateSplit(pr.created_at, todayLabel, locale);
    const { dateStr: updatedDate, timeStr: updatedTime } = formatDateSplit(pr.updated_at, todayLabel, locale);
    const statusKey = getStatusKey(pr);
    const buildKey = getBuildKey(pr);

    switch (key) {
      case 'title':
        return (
          <td key={key} style={{ padding: '11px 12px', verticalAlign: 'middle', cursor: 'pointer' }} onClick={() => onOpenDrawer(pr)}>
            <div>
              <a href={prUrl} target="_blank" className="rr-pr-title" title={prTitle} onClick={(e) => e.stopPropagation()}>{prTitle}</a>
              {repoMeta}
            </div>
          </td>
        );
      case 'author':
        return (
          <td key={key} className="rr-col-narrow" style={{ verticalAlign: 'middle' }}>
            <span
              className="rr-author-clickable"
              onClick={(e) => { e.stopPropagation(); setActiveFilter('author', authorLogin); }}
              title={tc('filterByAuthor', { author: authorLogin })}
            >
              <AuthorAvatar login={authorLogin} avatarUrl={pr.user?.avatar_url} />
            </span>
          </td>
        );
      case 'status': {
        const needsRebase = pr.mergeable_state === 'dirty';
        const badgeClass =
          statusKey === 'approved' && needsRebase
            ? 'rr-badge-review'
            : STATUS_BADGE_MAP[statusKey] || 'rr-badge-open';
        return (
          <td key={key} className="rr-col-narrow" style={{ verticalAlign: 'middle' }}>
            <span
              className="rr-status-clickable"
              onClick={(e) => { e.stopPropagation(); setActiveFilter('status', statusKey); }}
              title={tc('filterByStatus')}
            >
              <span className={`rr-badge ${badgeClass}`}>{t(`status.${statusKey}`)}</span>
            </span>
          </td>
        );
      }
      case 'myaction':
        return <td key={key} className="rr-col-narrow" style={{ verticalAlign: 'middle', textAlign: 'center', fontSize: 16 }}>{userAction}</td>;
      case 'approvals':
        return <td key={key} className="rr-col-narrow" style={{ verticalAlign: 'middle', textAlign: 'center' }}>{approvalsDisplay}</td>;
      case 'comments':
        return <td key={key} className="rr-col-narrow" style={{ verticalAlign: 'middle', textAlign: 'center' }}>{commentsDisplay}</td>;
      case 'labels':
        return (
          <td key={key} className="rr-col-narrow" style={{ verticalAlign: 'middle', wordWrap: 'break-word', overflowWrap: 'break-word' }}>
            {pr.labels && pr.labels.length > 0 ? pr.labels.map((label) => (
              <span
                key={label.name}
                className="inline-block rounded px-2 py-[3px] text-[10px] font-medium mr-1 mb-0.5 border border-border-faint rr-label-clickable"
                style={{ backgroundColor: `#${label.color}33`, borderColor: `#${label.color}44` }}
                onClick={(e) => { e.stopPropagation(); setActiveFilter('label', label.name); }}
                title={tc('filterByLabel')}
              >
                <span className="rr-label-text">{label.name}</span>
              </span>
            )) : <span className="rr-build-na">{t('build.na')}</span>}
          </td>
        );
      case 'build': {
        const needsRebase = pr.mergeable_state === 'dirty';
        const bKey = needsRebase ? 'rebase' : buildKey;
        const bClass = needsRebase ? 'rr-build-run' : buildKey === 'pass' ? 'rr-build-ok' : buildKey === 'fail' ? 'rr-build-fail' : buildKey === 'running' || buildKey === 'pending' ? 'rr-build-run' : 'rr-build-na';
        return (
          <td key={key} style={{ padding: '11px 12px', verticalAlign: 'middle' }}>
            <span
              className="rr-build-clickable"
              onClick={(e) => { e.stopPropagation(); setActiveFilter('build', bKey); }}
              title={tc('filterByBuild')}
            >
              <span className={bClass}>
                {t(`build.${bKey}`)}
              </span>
            </span>
          </td>
        );
      }
      case 'files': {
        const fileCount = pr.changed_files ?? pr.files?.length ?? 0;
        return (
          <td key={key} className="rr-col-narrow" style={{ verticalAlign: 'middle', textAlign: 'center', fontSize: 12, fontFamily: "'Space Mono', monospace" }}>
            <span title={`${fileCount} files changed`}>{fileCount}</span>
          </td>
        );
      }
      case 'size': {
        const sizeText = pr.additions !== undefined && pr.deletions !== undefined
          ? formatSize(pr.additions, pr.deletions)
          : '—';
        return (
          <td key={key} className="rr-col-narrow" style={{ verticalAlign: 'middle', textAlign: 'center', fontSize: 11, fontFamily: "'Space Mono', monospace", whiteSpace: 'nowrap' }}>
            <span title={`${pr.changed_files || 0} files changed`}>{sizeText}</span>
          </td>
        );
      }
      case 'complexity': {
        const breakdown = pr.complexityBreakdown || computeComplexityBreakdown(pr.files || []);
        const score = pr.complexity ?? breakdown.score;
        const level = score <= 20 ? 'low' : score <= 50 ? 'medium' : 'high';

        return (
          <td key={key} className="rr-col-narrow" style={{ verticalAlign: 'middle', textAlign: 'center' }}>
            <span
              className="complexity-badge"
              data-level={level}
            >
              {score}
            </span>
          </td>
        );
      }
      case 'effort': {
        const effort = pr.effort ?? computeEffort(pr);
        const effortStr = formatEffort(effort);
        let color = 'var(--muted-dim)';
        if (effort >= 120) color = 'var(--red)';
        else if (effort >= 60) color = 'var(--amber)';
        else if (effort >= 30) color = 'var(--cyan)';
        else if (effort > 0) color = 'var(--green)';
        return (
          <td key={key} className="rr-col-narrow" style={{ verticalAlign: 'middle', textAlign: 'center' }}>
            <span style={{ fontSize: 12, fontWeight: 600, color, fontFamily: "'Space Mono', monospace" }}>
              {effortStr}
            </span>
          </td>
        );
      }
      case 'created':
        return (
          <td key={key} className="rr-age" style={{ verticalAlign: 'middle' }}>
            <div style={{ lineHeight: 1.3, textAlign: 'center' }}>
              <div>{createdDate}</div>
              <div style={{ fontSize: 10, color: 'var(--muted-dim)' }}>{createdTime}</div>
            </div>
          </td>
        );
      case 'updated': {
        const daysSinceUpdate = pr.updated_at
          ? Math.floor((Date.now() - new Date(pr.updated_at).getTime()) / (1000 * 60 * 60 * 24))
          : 0;
        const staleColor = daysSinceUpdate >= 5 ? 'var(--red)' : daysSinceUpdate >= 2 ? 'var(--amber)' : undefined;
        return (
          <td key={key} className="rr-age" style={{ verticalAlign: 'middle' }}>
            <div style={{ lineHeight: 1.3, textAlign: 'center' }}>
              <div style={staleColor ? { color: staleColor, fontWeight: 600 } : undefined}>{updatedDate}</div>
              <div style={{ fontSize: 10, color: staleColor || 'var(--muted-dim)' }}>{updatedTime}</div>
            </div>
          </td>
        );
      }
      case 'details':
        return (
          <td key={key} className="rr-col-narrow" style={{ verticalAlign: 'middle' }}>
            <button
              onClick={(e) => { e.stopPropagation(); onOpenDrawer(pr); }}
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 6, color: 'var(--muted)', transition: 'color 200ms', fontSize: 16 }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-primary)'; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = 'var(--muted)'; }}
              title={tc('moreDetails')}
            >
              ⋯
            </button>
          </td>
        );
      default:
        return null;
    }
  }, [currentUser, selectedRepos, setActiveFilter, onOpenDrawer, t, tc]);

  const activeSort = currentSort[0];
  const [colWidths, setColWidths] = useState<Record<string, number>>({});
  const draggingRef = useRef<string | null>(null);
  const startXRef = useRef(0);
  const startWidthRef = useRef(0);
  const thRefs = useRef<Record<string, HTMLTableCellElement | null>>({});
  const tableRef = useRef<HTMLTableElement>(null);

  const updateTableWidth = useCallback(() => {
    if (!tableRef.current) return;
    let total = 0;
    columnOrder.forEach((k) => {
      const cell = thRefs.current[k];
      if (cell && cell.style.width) {
        total += parseInt(cell.style.width, 10);
      }
    });
    if (total > 0) {
      const gap = (columnOrder.length + 1) * 2;
      tableRef.current.style.width = total + gap + 'px';
    }
  }, [columnOrder]);

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('reviewradar-column-widths') || '{}');
      setColWidths(saved);
    } catch {
      setColWidths({});
    }
  }, []);

  useEffect(() => {
    if (Object.keys(colWidths).length > 0 || columnOrder.length > 0) {
      requestAnimationFrame(updateTableWidth);
    }
  }, [colWidths, columnOrder, updateTableWidth]);

  const beginResize = useCallback((e: React.MouseEvent, key: string) => {
    e.stopPropagation();
    e.preventDefault();
    const th = thRefs.current[key];
    if (!th) return;
    draggingRef.current = key;
    startXRef.current = e.pageX;
    startWidthRef.current = th.offsetWidth;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    th.classList.add('rr-resizing');

    const onMove = (ev: MouseEvent) => {
      const delta = ev.pageX - startXRef.current;
      const newWidth = Math.max(30, startWidthRef.current + delta);
      th.style.width = newWidth + 'px';
    };

    const onUp = () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      th.classList.remove('rr-resizing');

      const widths: Record<string, number> = {};
      columnOrder.forEach((k) => {
        const cell = thRefs.current[k];
        if (cell && cell.style.width) {
          widths[k] = parseInt(cell.style.width, 10);
        }
      });
      setColWidths(widths);
      localStorage.setItem('reviewradar-column-widths', JSON.stringify(widths));
      updateTableWidth();

      setTimeout(() => {
        draggingRef.current = null;
      }, 100);
    };

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }, [columnOrder]);

  return (
    <div className="rr-table-wrap">
      <div className="rr-desktop-table">
      <table ref={tableRef}>
        <thead>
          <tr>
            {columnOrder.map((key) => {
              const meta = COLUMN_META[key];
              if (!meta) return null;
              const isSorted = activeSort?.column === meta.sortKey;
              const classes = ['sortable', meta.narrow ? 'rr-col-narrow' : '', meta.sortKey ? '' : ''].filter(Boolean);
              const savedWidth = colWidths[key];
              const style: React.CSSProperties = { position: 'relative' };
              if (savedWidth) style.width = savedWidth;
              else if (meta.width) style.width = meta.width;

              return (
                <th
                  key={key}
                  ref={(el) => { thRefs.current[key] = el; }}
                  data-col={key}
                  className={`${classes.join(' ')} ${isSorted ? (activeSort.direction === 'asc' ? 'sorted-asc' : 'sorted-desc') : ''}`}
                  style={style}
                  onClick={() => {
                    if (draggingRef.current) return;
                    meta.sortKey && useAppStore.getState().toggleSort(meta.sortKey);
                  }}
                >
                  {columnLabels[key]}
                  <div
                    className="rr-resize-handle"
                    onMouseDown={(e) => beginResize(e, key)}
                  />
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {loading ? (
            Array.from({ length: 8 }).map((_, rowIdx) => (
              <tr key={rowIdx} style={{ opacity: 0.4 }}>
                {columnOrder.map((key) => {
                  const meta = COLUMN_META[key];
                  return (
                    <td key={key} className={meta?.narrow ? 'rr-col-narrow' : ''} style={{ padding: '11px 12px', verticalAlign: 'middle' }}>
                      <div className="rr-skeleton" style={{ height: 12, width: meta?.narrow ? 24 : '60%' }} />
                    </td>
                  );
                })}
              </tr>
            ))
          ) : filteredPRs.length === 0 ? (
            <tr>
              <td colSpan={columnOrder.length} style={{ padding: '64px 32px', textAlign: 'center', color: 'var(--muted-dim)' }}>
                <div style={{ margin: '0 auto 16px', width: 48, height: 48, borderRadius: '50%', background: 'var(--cyan-dim)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <svg style={{ color: 'var(--cyan)' }} width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg>
                </div>
                <p style={{ fontFamily: "'Space Mono', monospace", fontSize: 13, color: 'var(--text-primary)', marginBottom: 6 }}>{t('noPRsTitle')}</p>
                <p style={{ fontSize: 12, color: 'var(--muted-dim)' }}>{t('noPRsDescription')}</p>
              </td>
            </tr>
          ) : (
            displayPRs.map((pr) => {
              const authorLogin = pr.user?.login || tc('unknown');
              const isOwned = authorLogin === currentUser;
              const repoUrl = pr.repository_url || pr.url || '';
              const fullRepoName = getRepoFullNameFromUrl(repoUrl);
              const repoColorIdx = getRepoColorIndex(fullRepoName);
              const rowCustomColor = repoColors[fullRepoName];
              return (
                <tr
                  key={pr.id}
                  className={`${isOwned ? 'owned-pr' : ''} ${rowCustomColor ? 'repo-bg-custom' : `repo-bg-${repoColorIdx}`}`}
                  style={rowCustomColor ? {
                    ['--repo-custom-bg' as any]: withOpacity(rowCustomColor, 0.04),
                    ['--repo-custom-bg-hover' as any]: withOpacity(rowCustomColor, 0.07),
                    outline: 'none',
                  } : { outline: 'none' }}
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      onOpenDrawer(pr);
                    }
                  }}
                >
                  {columnOrder.map((key) => renderCell(pr, key))}
                </tr>
              );
            })
          )}
        </tbody>
      </table>

      {filteredPRs.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', fontSize: 12, borderTop: '0.5px solid var(--border-faint)', background: 'var(--surface)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {pageSize > 0 ? (
              <span style={{ color: 'var(--muted)' }}>
                {`${(currentPage - 1) * pageSize + 1}–${Math.min(currentPage * pageSize, filteredPRs.length)} of ${filteredPRs.length}`}
              </span>
            ) : (
              <span style={{ color: 'var(--muted)' }}>{`${filteredPRs.length} PRs`}</span>
            )}
            <span style={{ color: 'var(--border-faint)' }}>|</span>
            <span style={{ color: 'var(--muted-dim)', fontSize: 11 }}>per page:</span>
            {[10, 25, 50, 100, 0].map((n) => (
              <button
                key={n}
                onClick={() => handlePageSize(n)}
                style={{
                  background: pageSize === n ? 'var(--cyan)' : 'transparent',
                  color: pageSize === n ? '#fff' : 'var(--muted)',
                  border: '0.5px solid', borderColor: pageSize === n ? 'var(--cyan)' : 'var(--border-faint)',
                  borderRadius: 4, padding: '2px 8px', cursor: 'pointer', fontSize: 11,
                  fontWeight: pageSize === n ? 600 : 400,
                }}
              >{n === 0 ? 'All' : n}</button>
            ))}
          </div>
          {pageSize > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <button
                disabled={currentPage <= 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                aria-label={tc('previous')}
                style={{
                  background: 'transparent', border: '0.5px solid var(--border-faint)', borderRadius: 4,
                  padding: '4px 10px', cursor: currentPage <= 1 ? 'default' : 'pointer',
                  opacity: currentPage <= 1 ? 0.3 : 1, fontSize: 12, color: 'var(--muted)',
                }}
              >‹ Prev</button>
              {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
                let pageNum: number;
                if (totalPages <= 7) {
                  pageNum = i + 1;
                } else if (currentPage <= 4) {
                  pageNum = i + 1;
                } else if (currentPage >= totalPages - 3) {
                  pageNum = totalPages - 6 + i;
                } else {
                  pageNum = currentPage - 3 + i;
                }
                return (
                  <button
                    key={pageNum}
                    onClick={() => setCurrentPage(pageNum)}
                    style={{
                      background: currentPage === pageNum ? 'var(--cyan)' : 'transparent',
                      color: currentPage === pageNum ? '#fff' : 'var(--muted)',
                      border: '0.5px solid', borderColor: currentPage === pageNum ? 'var(--cyan)' : 'transparent',
                      borderRadius: 4, padding: '4px 8px', cursor: 'pointer', fontSize: 12,
                      fontWeight: currentPage === pageNum ? 600 : 400, minWidth: 28, textAlign: 'center',
                    }}
                  >{pageNum}</button>
                );
              })}
              <button
                disabled={currentPage >= totalPages}
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                aria-label={tc('next')}
                style={{
                  background: 'transparent', border: '0.5px solid var(--border-faint)', borderRadius: 4,
                  padding: '4px 10px', cursor: currentPage >= totalPages ? 'default' : 'pointer',
                  opacity: currentPage >= totalPages ? 0.3 : 1, fontSize: 12, color: 'var(--muted)',
                }}
              >Next ›</button>
            </div>
          )}
        </div>
      )}
      </div>{/* end rr-desktop-table */}

      {/* ── Mobile cards ── */}
      <div className="rr-mobile-cards">
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="rr-pr-card rr-pr-card-skeleton">
              <div className="rr-pr-card-row">
                <div className="rr-skeleton" style={{ width: '70%', height: 14 }} />
              </div>
              <div className="rr-pr-card-row">
                <div className="rr-skeleton" style={{ width: '40%', height: 12 }} />
              </div>
            </div>
          ))
        ) : filteredPRs.length === 0 ? (
          <div className="rr-pr-card-empty">
            <div style={{ margin: '0 auto 16px', width: 48, height: 48, borderRadius: '50%', background: 'var(--cyan-dim)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg style={{ color: 'var(--cyan)' }} width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg>
            </div>
            <p style={{ fontFamily: "'Space Mono', monospace", fontSize: 13, color: 'var(--text-primary)', marginBottom: 6 }}>{t('noPRsTitle')}</p>
            <p style={{ fontSize: 12, color: 'var(--muted-dim)' }}>{t('noPRsDescription')}</p>
          </div>
        ) : (
          displayPRs.map((pr) => {
            const repoUrl = pr.repository_url || pr.url || '';
            const repoName = getRepoNameFromUrl(repoUrl);
            const statusKey = getStatusKey(pr);
            const buildKey = getBuildKey(pr);
            const breakdown = computeComplexityBreakdown(pr.files || []);
            const complexityScore = pr.complexity ?? breakdown.score;
            const complexityLevel = complexityScore <= 20 ? 'low' : complexityScore <= 50 ? 'medium' : 'high';
            const relTime = formatRelativeTime(pr.updated_at, locale);
            return (
              <div
                key={pr.id}
                className="rr-pr-card"
                onClick={() => onOpenDrawer(pr)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpenDrawer(pr); } }}
              >
                {/* Title + Author */}
                <div className="rr-pr-card-section rr-pr-card-main">
                  <a
                    href={pr.html_url}
                    target="_blank"
                    className="rr-pr-card-title"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {pr.title}
                  </a>
                  <div className="rr-pr-card-meta">
                    <span className="rr-pr-card-author">{pr.user?.login || tc('unknown')}</span>
                    {repoName && <span className="rr-pr-card-repo">{repoName}</span>}
                  </div>
                </div>

                {/* Status + Complexity + Time */}
                <div className="rr-pr-card-section rr-pr-card-stats">
                  <span className={`rr-badge ${STATUS_BADGE_MAP[statusKey] || 'rr-badge-open'}`}>
                    {t(`status.${statusKey}`)}
                  </span>
                  <span className={`complexity-badge rr-pr-card-complexity`} data-level={complexityLevel}>
                    {complexityScore}
                  </span>
                  <span className="rr-pr-card-time">{relTime}</span>
                </div>

                {/* Labels */}
                {pr.labels && pr.labels.length > 0 && (
                  <div className="rr-pr-card-section rr-pr-card-labels">
                    {pr.labels.map((label) => (
                      <span
                        key={label.name}
                        className="rr-pr-card-label"
                        style={{ backgroundColor: `#${label.color}33`, borderColor: `#${label.color}44` }}
                      >
                        {label.name}
                      </span>
                    ))}
                  </div>
                )}

                {/* Actions */}
                <div className="rr-pr-card-section rr-pr-card-actions">
                  <button
                    className="rr-pr-card-btn rr-pr-card-btn-primary"
                    onClick={(e) => { e.stopPropagation(); onOpenDrawer(pr); }}
                  >
                    {tc('moreDetails')} ▼
                  </button>
                  <a
                    href={pr.html_url}
                    target="_blank"
                    className="rr-pr-card-btn rr-pr-card-btn-secondary"
                    onClick={(e) => e.stopPropagation()}
                  >
                    GitHub →
                  </a>
                </div>
              </div>
            );
          })
        )}
        {/* Mobile pagination */}
        {filteredPRs.length > 0 && (
          <div className="rr-mobile-pagination">
            <span className="rr-mobile-page-info">
              {(currentPage - 1) * pageSize + 1}–{Math.min(currentPage * pageSize, filteredPRs.length)} of {filteredPRs.length}
            </span>
            <div className="rr-mobile-page-btns">
              <button
                disabled={currentPage <= 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                className="rr-mobile-page-btn"
              >‹ Prev</button>
              <button
                disabled={currentPage >= totalPages}
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                className="rr-mobile-page-btn"
              >Next ›</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
