'use client';

import { useMemo } from 'react';
import { useAppStore } from '@/lib/store';
import { getRepoFullNameFromUrl } from '@/lib/utils';
import { useTranslations } from 'next-intl';

function getConsolidatedApprovalCount(pr: any) {
  const reviews = pr.reviews || [];
  const byUser: Record<string, any> = {};
  reviews.forEach((review: any) => {
    const userName = review.user?.login;
    if (!userName) return;
    if (review.state !== 'APPROVED') return;
    const existing = byUser[userName];
    const newDate = new Date(review.submitted_at || review.created_at || 0);
    if (!existing || newDate > new Date(existing.submitted_at || existing.created_at || 0)) {
      byUser[userName] = review;
    }
  });
  return Object.values(byUser).length;
}

function computeStats(prs: any[], currentUser: string | null) {
  const mine = prs.filter((pr) => (pr.user?.login || '') === currentUser).length;
  const approved = prs.filter((pr) => getConsolidatedApprovalCount(pr) >= 2).length;
  const needsAttention = prs.filter((pr) => {
    const isNotByMe = (pr.user?.login || '') !== currentUser;
    const isNotDraft = !pr.draft;
    const hasNotReviewedByMe = !pr.reviews?.some((r: any) => r.user?.login === currentUser);
    const hasFewerThanTwoApprovals = getConsolidatedApprovalCount(pr) < 2;
    return isNotByMe && isNotDraft && hasNotReviewedByMe && hasFewerThanTwoApprovals;
  }).length;
  const blocked = prs.filter((pr) =>
    pr.buildStatus?.state === 'failure' ||
    pr.mergeable_state === 'dirty'
  ).length;
  return { total: prs.length, mine, approved, needsAttention, blocked };
}

export default function StatsBar() {
  const {
    allPRs,
    currentUser,
    selectedRepos,
    setFilter,
    currentFilter,
    searchQuery,
    selectedUsers,
    activeFilters,
  } = useAppStore();

  const t = useTranslations('components.statsbar');

  const visiblePRs = useMemo(() => {
    return allPRs.filter((pr) => {
      const repoUrl = pr.repository_url || pr.url;
      if (!repoUrl || typeof repoUrl !== 'string') return false;
      const repoName = getRepoFullNameFromUrl(repoUrl);
      return selectedRepos.has(repoName);
    });
  }, [allPRs, selectedRepos]);

  const allUserLogins = useMemo(() => {
    const set = new Set<string>();
    visiblePRs.forEach((pr) => { if (pr.user?.login) set.add(pr.user.login); });
    return set;
  }, [visiblePRs]);

  const filteredVisiblePRs = useMemo(() => {
    let prs = visiblePRs;

    if (activeFilters.label) {
      prs = prs.filter((pr) => pr.labels?.some((l) => l.name === activeFilters.label));
    }
    if (activeFilters.status) {
      // status filtering is complex in PRTable; for stats we approximate by not filtering here
      // since status is derived from reviews/build and would require duplicating PRTable logic
    }
    if (activeFilters.author) {
      prs = prs.filter((pr) => (pr.user?.login || '') === activeFilters.author);
    }
    if (activeFilters.build) {
      prs = prs.filter((pr) => {
        const needsRebase = pr.mergeable_state === 'dirty';
        const bKey = needsRebase ? 'rebase' : (pr.buildStatus?.state === 'success' ? 'pass' : pr.buildStatus?.state === 'failure' ? 'fail' : pr.buildStatus?.state === 'in_progress' ? 'running' : pr.buildStatus?.state === 'pending' ? 'pending' : 'na');
        return bKey === activeFilters.build;
      });
    }

    if (selectedUsers.length > 0) {
      prs = prs.filter((pr) => selectedUsers.includes(pr.user?.login || ''));
    } else {
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

    return prs;
  }, [visiblePRs, searchQuery, selectedUsers, activeFilters]);

  const baseStats = useMemo(() => computeStats(visiblePRs, currentUser), [visiblePRs, currentUser]);
  const filteredStats = useMemo(() => computeStats(filteredVisiblePRs, currentUser), [filteredVisiblePRs, currentUser]);

  const hasActiveFilter =
    searchQuery.trim().length > 0 ||
    selectedUsers.length < allUserLogins.size ||
    activeFilters.label !== null ||
    activeFilters.status !== null ||
    activeFilters.author !== null ||
    activeFilters.build !== null;

  const cards = [
    { label: t('totalPRs'), subtitle: t('totalPRsSub'), total: baseStats.total, filtered: filteredStats.total, color: 'var(--cyan)', filter: 'all' },
    { label: t('mine'), subtitle: t('mineSub'), total: baseStats.mine, filtered: filteredStats.mine, color: 'var(--cyan)', filter: 'owned' },
    { label: t('needsAttention'), subtitle: t('needsAttentionSub'), total: baseStats.needsAttention, filtered: filteredStats.needsAttention, color: 'var(--amber)', filter: 'needs-attention' },
    { label: t('approved'), subtitle: t('approvedSub'), total: baseStats.approved, filtered: filteredStats.approved, color: 'var(--green)', filter: 'approved' },
    { label: t('blocked'), subtitle: t('blockedSub'), total: baseStats.blocked, filtered: filteredStats.blocked, color: 'var(--red)', filter: 'blocked' },
  ];

  return (
    <div className="rr-stats">
      {cards.map((card) => (
        <div
          key={card.label}
          data-filter={card.filter}
          onClick={() => setFilter(currentFilter === card.filter ? 'all' : card.filter)}
          className={`rr-stat ${currentFilter === card.filter ? 'active' : ''}`}
        >
          <div className="rr-stat-label">{card.label}</div>
          <div className="rr-stat-val-row">
            <div className="rr-stat-val" style={{ color: card.color }}>
              {hasActiveFilter ? (
                <span>
                  {card.filtered}
                  <span style={{ color: 'var(--muted-dim)', fontSize: 14, marginLeft: 4, fontWeight: 500 }}>
                    / {card.total}
                  </span>
                </span>
              ) : (
                card.total
              )}
            </div>
            <div className="rr-stat-sub">{card.subtitle}</div>
          </div>
        </div>
      ))}
    </div>
  );
}
