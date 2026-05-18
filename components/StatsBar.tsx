'use client';

import { useMemo } from 'react';
import { useAppStore } from '@/lib/store';
import { getRepoFullNameFromUrl } from '@/lib/utils';

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

export default function StatsBar() {
  const { allPRs, currentUser, selectedRepos, setFilter, currentFilter } = useAppStore();

  const visiblePRs = useMemo(() => {
    return allPRs.filter((pr) => {
      const repoUrl = pr.repository_url || pr.url;
      if (!repoUrl || typeof repoUrl !== 'string') return false;
      const repoName = getRepoFullNameFromUrl(repoUrl);
      return selectedRepos.has(repoName);
    });
  }, [allPRs, selectedRepos]);

  const stats = useMemo(() => {
    const mine = visiblePRs.filter((pr) => (pr.user?.login || '') === currentUser).length;
    const approved = visiblePRs.filter((pr) => getConsolidatedApprovalCount(pr) >= 2).length;
    const needsAttention = visiblePRs.filter((pr) => {
      const isNotByMe = (pr.user?.login || '') !== currentUser;
      const isNotDraft = !pr.draft;
      const hasNotReviewedByMe = !pr.reviews?.some((r) => r.user?.login === currentUser);
      const hasNoApprovals = !pr.reviews?.some((r) => r.state === 'APPROVED');
      return isNotByMe && isNotDraft && hasNotReviewedByMe && hasNoApprovals;
    }).length;
    const blocked = visiblePRs.filter((pr) =>
      pr.buildStatus?.state === 'failure' ||
      pr.mergeable_state === 'dirty' ||
      pr.reviews?.some((r) => r.state === 'CHANGES_REQUESTED')
    ).length;
    return { total: visiblePRs.length, mine, approved, needsAttention, blocked };
  }, [visiblePRs, currentUser]);

  const cards = [
    { label: 'Total PRs', value: stats.total, color: 'var(--cyan)', filter: 'all' },
    { label: 'Mine', value: stats.mine, color: 'var(--cyan)', filter: 'owned' },
    { label: 'Needs Attention', value: stats.needsAttention, color: 'var(--amber)', filter: 'needs-attention' },
    { label: 'Approved', value: stats.approved, color: 'var(--green)', filter: 'approved' },
    { label: 'Blocked', value: stats.blocked, color: 'var(--red)', filter: 'blocked' },
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
          <div className="rr-stat-val" style={{ color: card.color }}>{card.value}</div>
        </div>
      ))}
    </div>
  );
}
