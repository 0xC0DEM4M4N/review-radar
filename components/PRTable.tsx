'use client';

import { useMemo, useCallback, useRef, useState, useEffect } from 'react';
import { useAppStore, COLUMN_META, ColumnKey, PR } from '@/lib/store';
import {
  escapeHtml,
  formatDateSplit,
  getRepoFullNameFromUrl,
  getRepoNameFromUrl,
  getRepoColorIndex,
} from '@/lib/utils';
import { computeComplexity, formatSize, computeComplexityBreakdown } from '@/lib/complexity';
import { useTranslations } from 'next-intl';

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

type StatusKey = 'changesRequested' | 'buildFail' | 'needsRebase' | 'approved' | 'awaitingApproval' | 'draft' | 'open';

function getStatusKey(pr: PR): StatusKey {
  const latest = getConsolidatedReviews(pr);
  const approvalCount = latest.filter((r: any) => r.state === 'APPROVED').length;
  const hasChanges = latest.some((r: any) => r.state === 'CHANGES_REQUESTED');
  const buildFailed = pr.buildStatus?.state === 'failure';
  const mergeConflict = pr.mergeable_state === 'dirty';
  if (hasChanges || buildFailed || mergeConflict) {
    return hasChanges ? 'changesRequested' : buildFailed ? 'buildFail' : 'needsRebase';
  }
  if (approvalCount >= 2) return 'approved';
  if (latest.length > 0) return 'awaitingApproval';
  if (pr.draft) return 'draft';
  return 'open';
}

const STATUS_BADGE_MAP: Record<StatusKey, string> = {
  changesRequested: 'rr-badge-blocked',
  buildFail: 'rr-badge-blocked',
  needsRebase: 'rr-badge-blocked',
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

export default function PRTable({ onOpenDrawer }: { onOpenDrawer: (pr: PR) => void }) {
  const {
    allPRs,
    currentUser,
    currentFilter,
    currentSort,
    activeFilters,
    selectedRepos,
    columnOrder,
    setActiveFilter,
  } = useAppStore();

  const t = useTranslations('components.prtable');
  const tc = useTranslations('common');

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
    created: t('columns.created'),
    updated: t('columns.updated'),
    details: t('columns.details'),
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
        pr.mergeable_state === 'dirty' ||
        pr.reviews?.some((r) => r.state === 'CHANGES_REQUESTED')
      );
    } else if (currentFilter === 'needs-attention') {
      prs = prs.filter((pr) => {
        const isNotByMe = (pr.user?.login || '') !== currentUser;
        const isNotDraft = !pr.draft;
        const hasNotReviewedByMe = !pr.reviews?.some((r) => r.user?.login === currentUser);
        const hasNoApprovals = !pr.reviews?.some((r) => r.state === 'APPROVED');
        return isNotByMe && isNotDraft && hasNotReviewedByMe && hasNoApprovals;
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
              aVal = computeComplexity(a.files || []);
              bVal = computeComplexity(b.files || []);
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
  }, [allPRs, currentUser, currentFilter, currentSort, activeFilters, selectedRepos]);

  const renderCell = useCallback((pr: PR, key: ColumnKey) => {
    const authorLogin = pr.user?.login || tc('unknown');
    const isOwned = authorLogin === currentUser;
    const repoUrl = pr.repository_url || pr.url || '';
    const fullRepoName = getRepoFullNameFromUrl(repoUrl);
    const prTitle = pr.title || tc('untitledPR');
    const prUrl = pr.html_url || '#';
    const repoColorIdx = getRepoColorIndex(fullRepoName);
    const showRepo = selectedRepos.size !== 1;
    const repoMeta = showRepo ? (
      <div className="rr-pr-repo">
        <span className={`rr-radar-blip-sm repo-color-${repoColorIdx}`} />{fullRepoName}
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
        <span title={t('userActionApproved')}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="var(--green)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 8L6.5 11.5L13 4.5" />
          </svg>
        </span>
      ) : userActionKey === 'changesRequested' ? (
        <span title={t('userActionChangesRequested')}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="var(--amber)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M13 8H3M3 8L7 4M3 8L7 12" />
          </svg>
        </span>
      ) : userActionKey === 'commented' ? (
        <span title={t('userActionCommented')}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="var(--cyan)" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14 7.5C14 10.5376 11.5376 13 8.5 13H8L3.5 15V13H3C2.17157 13 1.5 12.3284 1.5 11.5V4.5C1.5 3.67157 2.17157 3 3 3H13C13.8284 3 14.5 3.67157 14.5 4.5V7.5Z" />
          </svg>
        </span>
      ) : '';
    const todayLabel = tc('today');
    const { dateStr: createdDate, timeStr: createdTime } = formatDateSplit(pr.created_at, todayLabel);
    const { dateStr: updatedDate, timeStr: updatedTime } = formatDateSplit(pr.updated_at, todayLabel);
    const statusKey = getStatusKey(pr);
    const buildKey = getBuildKey(pr);

    switch (key) {
      case 'title':
        return (
          <td key={key} style={{ padding: '11px 12px', verticalAlign: 'middle' }}>
            <div>
              <a href={prUrl} target="_blank" className="rr-pr-title" title={prTitle}>{prTitle}</a>
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
      case 'status':
        return (
          <td key={key} className="rr-col-narrow" style={{ verticalAlign: 'middle' }}>
            <span
              className="rr-status-clickable"
              onClick={(e) => { e.stopPropagation(); setActiveFilter('status', statusKey); }}
              title={tc('filterByStatus')}
            >
              <span className={`rr-badge ${STATUS_BADGE_MAP[statusKey] || 'rr-badge-open'}`}>{t(`status.${statusKey}`)}</span>
            </span>
          </td>
        );
      case 'myaction':
        return <td key={key} className="rr-col-narrow" style={{ verticalAlign: 'middle', fontSize: 16, textAlign: 'center' }}>{userAction}</td>;
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
      case 'build':
        return (
          <td key={key} style={{ padding: '11px 12px', verticalAlign: 'middle' }}>
            <span className={buildKey === 'pass' ? 'rr-build-ok' : buildKey === 'fail' ? 'rr-build-fail' : buildKey === 'running' || buildKey === 'pending' ? 'rr-build-run' : 'rr-build-na'}>
              {t(`build.${buildKey}`)}
            </span>
          </td>
        );
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
        const breakdown = computeComplexityBreakdown(pr.files || []);
        const score = breakdown.score;
        let complexityColor = 'var(--muted-dim)';
        if (score >= 70) complexityColor = 'var(--red)';
        else if (score >= 50) complexityColor = 'var(--amber)';
        else if (score >= 30) complexityColor = 'var(--cyan)';
        else if (score >= 15) complexityColor = 'var(--green)';

        const tooltipLines = [
          `${breakdown.label} (${score})`,
          ``,
          `${t('complexityFiles', { relevant: breakdown.relevantFiles, ignored: breakdown.ignoredFiles })}`,
          `${t('complexityChurn', { weighted: breakdown.weightedChurn, additions: breakdown.totalAdditions, deletions: breakdown.totalDeletions })}`,
          `${t('complexitySpread', { spread: breakdown.fileSpread })}`,
          `${t('complexityIntensity', { intensity: breakdown.intensity })}`,
        ];
        if (breakdown.topFiles.length > 0) {
          tooltipLines.push('', t('complexityTopFiles'));
          breakdown.topFiles.slice(0, 3).forEach((f) => {
            tooltipLines.push(`  • ${f.filename.split('/').pop()} (+${f.churn} × ${f.weight})`);
          });
        }

        return (
          <td key={key} className="rr-col-narrow" style={{ verticalAlign: 'middle', textAlign: 'center' }}>
            <span
              style={{
                fontSize: 12,
                fontWeight: 600,
                color: complexityColor,
                fontFamily: "'Space Mono', monospace",
              }}
              title={tooltipLines.join('\n')}
            >
              {score}
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
      case 'updated':
        return (
          <td key={key} className="rr-age" style={{ verticalAlign: 'middle' }}>
            <div style={{ lineHeight: 1.3, textAlign: 'center' }}>
              <div>{updatedDate}</div>
              <div style={{ fontSize: 10, color: 'var(--muted-dim)' }}>{updatedTime}</div>
            </div>
          </td>
        );
      case 'details':
        return (
          <td key={key} className="rr-col-narrow" style={{ verticalAlign: 'middle' }}>
            <button
              onClick={(e) => { e.stopPropagation(); onOpenDrawer(pr); }}
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 6, color: 'var(--muted)', transition: 'color 200ms', fontSize: 16 }}
              onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--text-primary)')}
              onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--muted)')}
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

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('reviewradar-column-widths') || '{}');
      setColWidths(saved);
    } catch {
      setColWidths({});
    }
  }, []);

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

      setTimeout(() => {
        draggingRef.current = null;
      }, 100);
    };

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }, [columnOrder]);

  return (
    <div className="rr-table-wrap">
      <table>
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
          {filteredPRs.length === 0 ? (
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
            filteredPRs.map((pr) => {
              const authorLogin = pr.user?.login || tc('unknown');
              const isOwned = authorLogin === currentUser;
              const repoUrl = pr.repository_url || pr.url || '';
              const fullRepoName = getRepoFullNameFromUrl(repoUrl);
              const repoColorIdx = getRepoColorIndex(fullRepoName);
              return (
                <tr key={pr.id} className={`${isOwned ? 'owned-pr' : ''} repo-bg-${repoColorIdx}`}>
                  {columnOrder.map((key) => renderCell(pr, key))}
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}
