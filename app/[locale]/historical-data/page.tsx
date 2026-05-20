'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import Chart from 'chart.js/auto';
import Layout from '@/components/Layout';
import LoadingIllustration from '@/components/LoadingIllustration';
import { useTranslations } from 'next-intl';
import { useParams } from 'next/navigation';
import GitHubOAuthButton from '@/components/GitHubOAuthButton';
import { proxyGitHub, checkSession } from '@/lib/apiClient';

const SIZE_COLORS: Record<string, string> = {
  Small: '#22c55e',
  Medium: '#22d3ee',
  Large: '#f59e0b',
  Enormous: '#ef4444',
};

const USER_LINE_COLORS = [
  '#22d3ee', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6',
  '#06b6d4', '#10b981', '#f97316', '#ec4899', '#6366f1',
];

interface PRData {
  id: number;
  title: string;
  html_url: string;
  created_at: string;
  closed_at: string | null;
  merged_at: string | null;
  merged?: boolean;
  state: string;
  user?: { login: string };
  repository_url?: string;
  url?: string;
  number?: number;
}

interface Review {
  id: number;
  user?: { login: string };
  submitted_at?: string;
  state: string;
}

interface PRFile {
  additions: number;
  deletions: number;
}

interface UserStats {
  opened: number;
  closed: number;
  merged: number;
  reviews: number;
}

interface PRSizeDetail {
  title: string;
  author: string;
  files: number;
  lines: number;
  category: string;
  state: string;
  url: string;
}

function getWeekStart(dateStr: string): string {
  const d = new Date(dateStr);
  const day = d.getDay(); // 0=Sun, 1=Mon
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(d.getFullYear(), d.getMonth(), diff);
  return formatDate(monday);
}

function formatEta(ms: number): string {
  const seconds = Math.ceil(ms / 1000);
  if (seconds < 1) return '<1s';
  if (seconds < 60) return `${seconds}s`;
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}m ${secs.toString().padStart(2, '0')}s`;
}

function formatDate(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function parseDateInput(val: string): Date | null {
  if (!val) return null;
  const d = new Date(val);
  d.setHours(0, 0, 0, 0);
  return d;
}

function inRange(dateStr: string | null | undefined, range: { allTime: boolean; start?: Date | null; end?: Date | null }): boolean {
  if (range.allTime) return true;
  if (!dateStr) return false;
  const d = new Date(dateStr);
  if (range.start && d < range.start) return false;
  if (range.end && d > range.end) return false;
  return true;
}

async function fetchRepoPRsAll(repo: string): Promise<PRData[]> {
  const prs: PRData[] = [];
  for (let page = 1; page <= 10; page++) {
    try {
      const data = await proxyGitHub(
        `repos/${repo}/pulls?state=all&per_page=100&page=${page}&sort=updated&direction=desc`
      );
      if (!Array.isArray(data) || data.length === 0) break;
      prs.push(...data);
      if (data.length < 100) break;
    } catch (e) {
      console.warn('Repo fetch error', repo, (e as Error).message);
      break;
    }
  }
  return prs;
}

async function fetchReviews(pr: PRData): Promise<Review[]> {
  try {
    const repoMatch = (pr.repository_url || pr.url || '').match(/repos\/([^/]+\/[^/]+)/);
    if (!repoMatch || !pr.number) return [];
    const data = await proxyGitHub(`repos/${repoMatch[1]}/pulls/${pr.number}/reviews`);
    return Array.isArray(data) ? data : [];
  } catch (e) {
    return [];
  }
}

async function fetchPRFiles(pr: PRData): Promise<PRFile[]> {
  try {
    const repoMatch = (pr.repository_url || pr.url || '').match(/repos\/([^/]+\/[^/]+)/);
    if (!repoMatch || !pr.number) return [];
    const files: PRFile[] = [];
    for (let page = 1; page <= 3; page++) {
      const data = await proxyGitHub(`repos/${repoMatch[1]}/pulls/${pr.number}/files?per_page=100&page=${page}`);
      if (!Array.isArray(data) || data.length === 0) break;
      files.push(...data);
      if (data.length < 100) break;
    }
    return files;
  } catch (e) {
    return [];
  }
}

async function fetchBatch<T>(items: PRData[], fetchFn: (pr: PRData) => Promise<T>, statusFn?: (done: number, total: number) => void): Promise<T[]> {
  const results: T[] = [];
  const batchSize = 10;
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    const batchResults = await Promise.all(batch.map((item) => fetchFn(item)));
    results.push(...batchResults);
    if (statusFn) statusFn(Math.min(i + batchSize, items.length), items.length);
    if (i + batchSize < items.length) {
      await new Promise((r) => setTimeout(r, 50));
    }
  }
  return results;
}

export default function HistoricalDataPage() {
  const [dateFrom, setDateFrom] = useState<string>('');
  const [dateTo, setDateTo] = useState<string>('');
  const [allTime, setAllTime] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const [statusMsg, setStatusMsg] = useState<string>('');
  const [progress, setProgress] = useState<number>(0);
  const [etaText, setEtaText] = useState<string>('');
  const [isError, setIsError] = useState<boolean>(false);
  const [hasData, setHasData] = useState<boolean>(false);
  const [showGrid, setShowGrid] = useState<boolean>(false);

  const [openedCount, setOpenedCount] = useState<number>(0);
  const [closedCount, setClosedCount] = useState<number>(0);
  const [mergedCount, setMergedCount] = useState<number>(0);
  const [reviewsCount, setReviewsCount] = useState<number>(0);
  const [userStats, setUserStats] = useState<[string, UserStats][]>([]);
  const [sizeCategories, setSizeCategories] = useState<Record<string, number>>({ Small: 0, Medium: 0, Large: 0, Enormous: 0 });
  const [sizeDetails, setSizeDetails] = useState<PRSizeDetail[]>([]);
  const [subtitle, setSubtitle] = useState<string>('');

  const [openedOverTime, setOpenedOverTime] = useState<{ labels: string[]; opened: number[]; closed: number[] }>({ labels: [], opened: [], closed: [] });
  const [durationBuckets, setDurationBuckets] = useState<{ labels: string[]; values: number[]; avg: number }>({ labels: [], values: [], avg: 0 });
  const [approvalBuckets, setApprovalBuckets] = useState<{ labels: string[]; values: number[]; avg: number }>({ labels: [], values: [], avg: 0 });
  const [sizeSpreadFiles, setSizeSpreadFiles] = useState<{ labels: string[]; values: number[]; avg: number }>({ labels: [], values: [], avg: 0 });
  const [sizeSpreadLines, setSizeSpreadLines] = useState<{ labels: string[]; values: number[]; avg: number }>({ labels: [], values: [], avg: 0 });
  const [sizeToggle, setSizeToggle] = useState<'files' | 'lines'>('files');

  const [weeklyData, setWeeklyData] = useState<{ labels: string[]; opened: number[]; merged: number[]; closed: number[] }>({ labels: [], opened: [], merged: [], closed: [] });
  const [userWeeklyData, setUserWeeklyData] = useState<{ labels: string[]; users: { name: string; data: number[] }[] }>({ labels: [], users: [] });
  const [userMetric, setUserMetric] = useState<'opened' | 'reviews' | 'lines'>('opened');
  const [reviewHealth, setReviewHealth] = useState<{ avgTimeToReview: number; avgTimeToMerge: number; pctReviewed: number; avgReviewRounds: number }>({ avgTimeToReview: 0, avgTimeToMerge: 0, pctReviewed: 0, avgReviewRounds: 0 });
  const [reviewMatrix, setReviewMatrix] = useState<{ reviewer: string; author: string; count: number }[]>([]);
  const [heaviestPRs, setHeaviestPRs] = useState<PRSizeDetail[]>([]);

  const [noPat, setNoPat] = useState<boolean>(false);
  const [noRepos, setNoRepos] = useState<boolean>(false);
  const [noData, setNoData] = useState<boolean>(false);

  const params = useParams();
  const locale = (params?.locale as string) || 'en';
  const t = useTranslations('historical');
  const tc = useTranslations('common');

  const chartOverTimeRef = useRef<HTMLCanvasElement | null>(null);
  const chartOverTimeInstance = useRef<any>(null);
  const chartDurationRef = useRef<HTMLCanvasElement | null>(null);
  const chartDurationInstance = useRef<any>(null);
  const chartApprovalRef = useRef<HTMLCanvasElement | null>(null);
  const chartApprovalInstance = useRef<any>(null);
  const chartSizeRef = useRef<HTMLCanvasElement | null>(null);
  const chartSizeInstance = useRef<any>(null);
  const chartWeeklyRef = useRef<HTMLCanvasElement | null>(null);
  const chartWeeklyInstance = useRef<any>(null);
  const chartUserRef = useRef<HTMLCanvasElement | null>(null);
  const chartUserInstance = useRef<any>(null);

  useEffect(() => {
    const now = new Date();
    const firstDay = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastDay = new Date(now.getFullYear(), now.getMonth(), 0);
    setDateFrom(formatDate(firstDay));
    setDateTo(formatDate(lastDay));
    setSubtitle(t('defaultSubtitle'));

    const savedTheme = localStorage.getItem('reviewradar-theme');
    const prefersLight = window.matchMedia('(prefers-color-scheme: light)').matches;
    const theme = savedTheme || (prefersLight ? 'light' : 'dark');
    if (theme === 'light') {
      Chart.defaults.color = 'rgba(0,0,0,0.5)';
      Chart.defaults.borderColor = 'rgba(0,0,0,0.06)';
    } else {
      Chart.defaults.color = 'rgba(255,255,255,0.45)';
      Chart.defaults.borderColor = 'rgba(255,255,255,0.06)';
    }
    Chart.defaults.font.family = "'Space Mono', monospace";
    Chart.defaults.font.size = 11;
  }, [t]);

  const getStoredRepos = useCallback((): string[] => {
    try {
      const v = localStorage.getItem('github-repos');
      return v ? JSON.parse(v) : [];
    } catch (e) {
      return [];
    }
  }, []);

  const getSelectedRepos = useCallback((): string[] => {
    try {
      const v = localStorage.getItem('selected-repos');
      return v ? JSON.parse(v) : [];
    } catch (e) {
      return [];
    }
  }, []);

  const destroyCharts = useCallback(() => {
    [
      chartOverTimeInstance,
      chartDurationInstance,
      chartApprovalInstance,
      chartSizeInstance,
      chartWeeklyInstance,
      chartUserInstance,
    ].forEach((ref) => {
      if (ref.current) {
        try { ref.current.destroy(); } catch (e) { /* ignore */ }
        ref.current = null;
      }
    });
  }, []);

  const loadHistoricalData = useCallback(async () => {
    setLoading(true);
    setStatusMsg('');
    setProgress(0);
    setEtaText('');
    setIsError(false);
    setShowGrid(false);
    setNoData(false);
    setNoPat(false);
    setNoRepos(false);

    const repos = getSelectedRepos().length > 0 ? getSelectedRepos() : getStoredRepos();

    const start = allTime ? null : parseDateInput(dateFrom);
    const end = allTime ? null : parseDateInput(dateTo);
    if (end) end.setHours(23, 59, 59, 999);
    const range = { allTime, start, end };

    const hasSession = await checkSession();
    if (!hasSession) {
      setLoading(false);
      setNoPat(true);
      setNoRepos(false);
      setNoData(false);
      return;
    }

    if (repos.length === 0) {
      setLoading(false);
      setNoRepos(true);
      setNoPat(false);
      setNoData(false);
      return;
    }

    const loadStart = Date.now();
    const updateEta = (pct: number) => {
      if (pct <= 1) { setEtaText(''); return; }
      const elapsed = Date.now() - loadStart;
      const totalEst = elapsed / (pct / 100);
      const remaining = Math.max(0, totalEst - elapsed);
      setEtaText(formatEta(remaining));
    };

    try {
      setStatusMsg(t('fetchingPRs', { count: repos.length }));
      let allPRs: PRData[] = [];
      for (let i = 0; i < repos.length; i++) {
        const repoPRs = await fetchRepoPRsAll(repos[i]);
        allPRs.push(...repoPRs);
        const pct = Math.round(((i + 1) / repos.length) * 10);
        setProgress(pct);
        updateEta(pct);
      }

      if (allPRs.length === 0) {
        setStatusMsg(t('noPRsFound'));
        setLoading(false);
        setNoData(true);
        return;
      }

      // Only fetch reviews for PRs created on or before the range end
      const prsForReviews = range.allTime
        ? allPRs
        : allPRs.filter((pr) => !range.end || !pr.created_at || new Date(pr.created_at) <= range.end);

      setStatusMsg(t('fetchingReviews', { count: prsForReviews.length }));
      const reviewsList = await fetchBatch(prsForReviews, (pr) => fetchReviews(pr), (done, total) => {
        const pct = 10 + Math.round((done / total) * 45);
        setProgress(pct);
        updateEta(pct);
        setStatusMsg(t('fetchedReviews', { done, total }));
      });
      const reviewsMap: Record<number, Review[]> = {};
      prsForReviews.forEach((pr, i) => {
        reviewsMap[pr.id] = reviewsList[i] || [];
      });

      // Only fetch files for PRs opened within the selected range
      const prsForFiles = range.allTime
        ? allPRs
        : allPRs.filter((pr) => inRange(pr.created_at, range));

      setStatusMsg(t('fetchingFileSizes', { count: prsForFiles.length }));
      const filesList = await fetchBatch(prsForFiles, (pr) => fetchPRFiles(pr), (done, total) => {
        const pct = 55 + Math.round((done / total) * 45);
        setProgress(pct);
        updateEta(pct);
        setStatusMsg(t('fetchedFiles', { done, total }));
      });
      const filesMap: Record<number, PRFile[]> = {};
      prsForFiles.forEach((pr, i) => {
        filesMap[pr.id] = filesList[i] || [];
      });

      setProgress(100);
      setEtaText('');
      setStatusMsg('');
      setLoading(false);
      showData(allPRs, reviewsMap, filesMap, range);
    } catch (e: any) {
      console.error('Load error:', e);
      setStatusMsg(tc('errorWithMessage', { message: e.message }));
      setIsError(true);
      setLoading(false);
      setNoData(true);
    }
  }, [allTime, dateFrom, dateTo, getStoredRepos, getSelectedRepos, t, tc]);

  const showData = useCallback((prs: PRData[], reviewsMap: Record<number, Review[]>, filesMap: Record<number, PRFile[]>, range: { allTime: boolean; start?: Date | null; end?: Date | null }) => {
    setNoData(false);
    setNoPat(false);
    setNoRepos(false);
    setShowGrid(true);
    setHasData(true);

    const opened = prs.filter((p) => inRange(p.created_at, range));
    const closed = prs.filter((p) => p.closed_at && inRange(p.closed_at, range));
    const merged = prs.filter((p) => p.merged_at && inRange(p.merged_at, range));

    let totalReviews = 0;
    const reviewsByPerson: Record<string, number> = {};
    Object.values(reviewsMap).forEach((reviews) => {
      reviews.forEach((r) => {
        if (inRange(r.submitted_at, range)) {
          totalReviews++;
          const name = r.user?.login || tc('unknown');
          reviewsByPerson[name] = (reviewsByPerson[name] || 0) + 1;
        }
      });
    });

    setOpenedCount(opened.length);
    setClosedCount(closed.length);
    setMergedCount(merged.length);
    setReviewsCount(totalReviews);

    const users: Record<string, UserStats> = {};
    opened.forEach((p) => {
      const name = p.user?.login || tc('unknown');
      if (!users[name]) users[name] = { opened: 0, closed: 0, merged: 0, reviews: 0 };
      users[name].opened++;
    });
    closed.forEach((p) => {
      const name = p.user?.login || tc('unknown');
      if (!users[name]) users[name] = { opened: 0, closed: 0, merged: 0, reviews: 0 };
      users[name].closed++;
    });
    merged.forEach((p) => {
      const name = p.user?.login || tc('unknown');
      if (!users[name]) users[name] = { opened: 0, closed: 0, merged: 0, reviews: 0 };
      users[name].merged++;
    });
    Object.entries(reviewsByPerson).forEach(([name, count]) => {
      if (!users[name]) users[name] = { opened: 0, closed: 0, merged: 0, reviews: 0 };
      users[name].reviews = count;
    });

    const sortedUsers = Object.entries(users).sort((a, b) => {
      const scoreA = a[1].opened + a[1].reviews;
      const scoreB = b[1].opened + b[1].reviews;
      return scoreB - scoreA;
    });
    setUserStats(sortedUsers);

    const sizeCats: Record<string, number> = { Small: 0, Medium: 0, Large: 0, Enormous: 0 };
    const prSizeDetails: PRSizeDetail[] = [];

    opened.forEach((pr) => {
      const files = filesMap[pr.id] || [];
      const fileCount = files.length;
      const lineCount = files.reduce((sum, f) => sum + (f.additions || 0) + (f.deletions || 0), 0);

      let category: string;
      if (lineCount <= 50) category = 'Small';
      else if (lineCount <= 250) category = 'Medium';
      else if (lineCount <= 1000) category = 'Large';
      else category = 'Enormous';

      sizeCats[category]++;
      prSizeDetails.push({
        title: pr.title || tc('untitledPR'),
        author: pr.user?.login || tc('unknown'),
        files: fileCount,
        lines: lineCount,
        category,
        state: pr.merged ? tc('stateMerged') : pr.state === 'closed' ? tc('stateClosed') : tc('stateOpen'),
        url: pr.html_url || '#',
      });
    });

    setSizeCategories(sizeCats);
    setSizeDetails(prSizeDetails.sort((a, b) => b.lines - a.lines));

    // Chart 1: Opened vs Closed over time
    const dateOpened: Record<string, number> = {};
    const dateClosed: Record<string, number> = {};
    const allDates = new Set<string>();
    opened.forEach((pr) => {
      const key = pr.created_at?.split('T')[0] || '';
      if (key) { dateOpened[key] = (dateOpened[key] || 0) + 1; allDates.add(key); }
    });
    closed.forEach((pr) => {
      const key = pr.closed_at?.split('T')[0] || '';
      if (key) { dateClosed[key] = (dateClosed[key] || 0) + 1; allDates.add(key); }
    });
    let sortedDates = Array.from(allDates).sort();
    if (sortedDates.length > 1) {
      const startDate = new Date(sortedDates[0]);
      const endDate = new Date(sortedDates[sortedDates.length - 1]);
      const filledDates: string[] = [];
      for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
        filledDates.push(formatDate(d));
      }
      sortedDates = filledDates;
    }
    setOpenedOverTime({
      labels: sortedDates,
      opened: sortedDates.map((d) => dateOpened[d] || 0),
      closed: sortedDates.map((d) => dateClosed[d] || 0),
    });

    // Chart 2: PR open duration
    const durations: number[] = [];
    prs.forEach((pr) => {
      if (pr.closed_at && pr.created_at) {
        const days = (new Date(pr.closed_at).getTime() - new Date(pr.created_at).getTime()) / (1000 * 60 * 60 * 24);
        if (days >= 0) durations.push(days);
      }
    });
    const durBuckets = [0, 0, 0, 0, 0, 0];
    durations.forEach((d) => {
      if (d < 1) durBuckets[0]++;
      else if (d < 3) durBuckets[1]++;
      else if (d < 7) durBuckets[2]++;
      else if (d < 14) durBuckets[3]++;
      else if (d < 30) durBuckets[4]++;
      else durBuckets[5]++;
    });
    setDurationBuckets({
      labels: ['<1', '1–3', '3–7', '7–14', '14–30', '30+'],
      values: durBuckets,
      avg: durations.length > 0 ? Math.round((durations.reduce((a, b) => a + b, 0) / durations.length) * 10) / 10 : 0,
    });

    // Chart 3: Time to first approval
    const approvalTimes: number[] = [];
    prs.forEach((pr) => {
      const reviews = reviewsMap[pr.id] || [];
      const approvals = reviews
        .filter((r) => r.state === 'APPROVED' && r.submitted_at)
        .map((r) => new Date(r.submitted_at!).getTime());
      if (approvals.length > 0 && pr.created_at) {
        const firstApproval = Math.min(...approvals);
        const days = (firstApproval - new Date(pr.created_at).getTime()) / (1000 * 60 * 60 * 24);
        if (days >= 0) approvalTimes.push(days);
      }
    });
    const appBuckets = [0, 0, 0, 0, 0, 0];
    approvalTimes.forEach((d) => {
      if (d < 1) appBuckets[0]++;
      else if (d < 3) appBuckets[1]++;
      else if (d < 7) appBuckets[2]++;
      else if (d < 14) appBuckets[3]++;
      else if (d < 30) appBuckets[4]++;
      else appBuckets[5]++;
    });
    setApprovalBuckets({
      labels: ['<1', '1–3', '3–7', '7–14', '14–30', '30+'],
      values: appBuckets,
      avg: approvalTimes.length > 0 ? Math.round((approvalTimes.reduce((a, b) => a + b, 0) / approvalTimes.length) * 10) / 10 : 0,
    });

    // Chart 4: PR size spread
    const fileCounts: number[] = [];
    const lineCounts: number[] = [];
    opened.forEach((pr) => {
      const files = filesMap[pr.id] || [];
      fileCounts.push(files.length);
      lineCounts.push(files.reduce((sum, f) => sum + (f.additions || 0) + (f.deletions || 0), 0));
    });
    const fileBucks = [0, 0, 0, 0, 0];
    fileCounts.forEach((c) => {
      if (c === 1) fileBucks[0]++;
      else if (c <= 5) fileBucks[1]++;
      else if (c <= 10) fileBucks[2]++;
      else if (c <= 20) fileBucks[3]++;
      else fileBucks[4]++;
    });
    const lineBucks = [0, 0, 0, 0, 0];
    lineCounts.forEach((c) => {
      if (c <= 50) lineBucks[0]++;
      else if (c <= 250) lineBucks[1]++;
      else if (c <= 500) lineBucks[2]++;
      else if (c <= 1000) lineBucks[3]++;
      else lineBucks[4]++;
    });
    setSizeSpreadFiles({
      labels: ['1', '2–5', '6–10', '11–20', '20+'],
      values: fileBucks,
      avg: fileCounts.length > 0 ? Math.round((fileCounts.reduce((a, b) => a + b, 0) / fileCounts.length) * 10) / 10 : 0,
    });
    setSizeSpreadLines({
      labels: ['≤50', '51–250', '251–500', '501–1000', '1000+'],
      values: lineBucks,
      avg: lineCounts.length > 0 ? Math.round((lineCounts.reduce((a, b) => a + b, 0) / lineCounts.length) * 10) / 10 : 0,
    });

    // Weekly PR throughput
    const weekOpened: Record<string, number> = {};
    const weekMerged: Record<string, number> = {};
    const weekClosed: Record<string, number> = {};
    const allWeeks = new Set<string>();
    opened.forEach((pr) => {
      const key = getWeekStart(pr.created_at);
      weekOpened[key] = (weekOpened[key] || 0) + 1;
      allWeeks.add(key);
    });
    merged.forEach((pr) => {
      const key = getWeekStart(pr.merged_at!);
      weekMerged[key] = (weekMerged[key] || 0) + 1;
      allWeeks.add(key);
    });
    closed.forEach((pr) => {
      const key = getWeekStart(pr.closed_at!);
      weekClosed[key] = (weekClosed[key] || 0) + 1;
      allWeeks.add(key);
    });
    const sortedWeeks = Array.from(allWeeks).sort();
    setWeeklyData({
      labels: sortedWeeks,
      opened: sortedWeeks.map((w) => weekOpened[w] || 0),
      merged: sortedWeeks.map((w) => weekMerged[w] || 0),
      closed: sortedWeeks.map((w) => weekClosed[w] || 0),
    });

    // User weekly data: opened PRs, reviews given, lines changed
    const userWeekOpened: Record<string, Record<string, number>> = {};
    const userWeekReviewed: Record<string, Record<string, number>> = {};
    const userWeekLines: Record<string, Record<string, number>> = {};
    opened.forEach((pr) => {
      const week = getWeekStart(pr.created_at);
      const author = pr.user?.login || tc('unknown');
      if (!userWeekOpened[author]) userWeekOpened[author] = {};
      userWeekOpened[author][week] = (userWeekOpened[author][week] || 0) + 1;
    });
    prs.forEach((pr) => {
      const reviews = reviewsMap[pr.id] || [];
      reviews.forEach((r) => {
        if (!r.submitted_at) return;
        const week = getWeekStart(r.submitted_at);
        const reviewer = r.user?.login || tc('unknown');
        if (!userWeekReviewed[reviewer]) userWeekReviewed[reviewer] = {};
        userWeekReviewed[reviewer][week] = (userWeekReviewed[reviewer][week] || 0) + 1;
      });
    });
    opened.forEach((pr) => {
      const week = getWeekStart(pr.created_at);
      const author = pr.user?.login || tc('unknown');
      const files = filesMap[pr.id] || [];
      const lines = files.reduce((sum, f) => sum + (f.additions || 0) + (f.deletions || 0), 0);
      if (!userWeekLines[author]) userWeekLines[author] = {};
      userWeekLines[author][week] = (userWeekLines[author][week] || 0) + lines;
    });
    const allUserWeeks = sortedWeeks;
    const allUserNames = [...new Set([...Object.keys(userWeekOpened), ...Object.keys(userWeekReviewed), ...Object.keys(userWeekLines)])].sort();
    const topUsers = allUserNames.slice(0, 10);
    const buildUserSeries = (source: Record<string, Record<string, number>>) =>
      topUsers.map((name) => ({
        name,
        data: allUserWeeks.map((w) => source[name]?.[w] || 0),
      }));
    setUserWeeklyData({
      labels: allUserWeeks,
      users: buildUserSeries(userMetric === 'opened' ? userWeekOpened : userMetric === 'reviews' ? userWeekReviewed : userWeekLines),
    });

    // Review health
    let totalTimeToReview = 0;
    let reviewedPRCount = 0;
    let totalTimeToMerge = 0;
    let mergedPRCount = 0;
    let totalReviewRounds = 0;
    prs.forEach((pr) => {
      const reviews = reviewsMap[pr.id] || [];
      const approvals = reviews.filter((r) => r.submitted_at).sort((a, b) => new Date(a.submitted_at!).getTime() - new Date(b.submitted_at!).getTime());
      if (approvals.length > 0 && pr.created_at) {
        const firstReview = new Date(approvals[0].submitted_at!).getTime();
        const created = new Date(pr.created_at).getTime();
        const days = (firstReview - created) / (1000 * 60 * 60 * 24);
        if (days >= 0) { totalTimeToReview += days; reviewedPRCount++; }
      }
      if (pr.merged_at && pr.created_at) {
        const days = (new Date(pr.merged_at).getTime() - new Date(pr.created_at).getTime()) / (1000 * 60 * 60 * 24);
        if (days >= 0) { totalTimeToMerge += days; mergedPRCount++; }
      }
      totalReviewRounds += approvals.length;
    });
    setReviewHealth({
      avgTimeToReview: reviewedPRCount > 0 ? Math.round((totalTimeToReview / reviewedPRCount) * 10) / 10 : 0,
      avgTimeToMerge: mergedPRCount > 0 ? Math.round((totalTimeToMerge / mergedPRCount) * 10) / 10 : 0,
      pctReviewed: prs.length > 0 ? Math.round((reviewedPRCount / prs.length) * 100) : 0,
      avgReviewRounds: prs.length > 0 ? Math.round((totalReviewRounds / prs.length) * 10) / 10 : 0,
    });

    // Review matrix
    const matrixMap: Record<string, Record<string, number>> = {};
    prs.forEach((pr) => {
      const author = pr.user?.login || tc('unknown');
      const reviews = reviewsMap[pr.id] || [];
      const uniqueReviewers = [...new Set(reviews.map((r) => r.user?.login).filter((login): login is string => !!login))];
      uniqueReviewers.forEach((reviewer) => {
        if (!matrixMap[reviewer]) matrixMap[reviewer] = {};
        matrixMap[reviewer][author] = (matrixMap[reviewer][author] || 0) + 1;
      });
    });
    const matrixFlat: { reviewer: string; author: string; count: number }[] = [];
    Object.entries(matrixMap).forEach(([reviewer, authors]) => {
      Object.entries(authors).forEach(([author, count]) => {
        matrixFlat.push({ reviewer, author, count });
      });
    });
    setReviewMatrix(matrixFlat.sort((a, b) => b.count - a.count));

    // Heaviest PRs
    const heavy: PRSizeDetail[] = [];
    opened.forEach((pr) => {
      const files = filesMap[pr.id] || [];
      const lineCount = files.reduce((sum, f) => sum + (f.additions || 0) + (f.deletions || 0), 0);
      const fileCount = files.length;
      let category: string;
      if (lineCount <= 50) category = 'Small';
      else if (lineCount <= 250) category = 'Medium';
      else if (lineCount <= 1000) category = 'Large';
      else category = 'Enormous';
      heavy.push({
        title: pr.title || tc('untitledPR'),
        author: pr.user?.login || tc('unknown'),
        files: fileCount,
        lines: lineCount,
        category,
        state: pr.merged ? tc('stateMerged') : pr.state === 'closed' ? tc('stateClosed') : tc('stateOpen'),
        url: pr.html_url || '#',
      });
    });
    setHeaviestPRs(heavy.sort((a, b) => b.lines - a.lines).slice(0, 20));

    const repoNames = [...new Set(
      prs
        .map((p) => {
          const m = (p.repository_url || '').match(/repos\/([^/]+\/[^/]+)/);
          return m ? m[1] : null;
        })
        .filter(Boolean)
    )] as string[];
    const rangeLabel = range.allTime ? t('allTime') : `${formatDate(range.start!)} – ${formatDate(range.end!)}`;
    const repoLabel = repoNames.join(', ');
    setSubtitle(`${opened.length} PRs opened · ${rangeLabel} · ${repoLabel.slice(0, 60)}${repoLabel.length > 60 ? '…' : ''}`);
  }, [tc, t, userMetric]);

  const totalSized = useMemo(() => Object.values(sizeCategories).reduce((a, b) => a + b, 0), [sizeCategories]);
  const sizeEntries = useMemo(() => Object.entries(sizeCategories).filter(([, v]) => v > 0), [sizeCategories]);
  const maxSizeCount = useMemo(() => Math.max(...Object.values(sizeCategories)), [sizeCategories]);

  // Chart 1: Opened vs Closed over time
  useEffect(() => {
    if (!chartOverTimeRef.current || openedOverTime.labels.length === 0) return;
    if (chartOverTimeInstance.current) { chartOverTimeInstance.current.destroy(); chartOverTimeInstance.current = null; }

    chartOverTimeInstance.current = new Chart(chartOverTimeRef.current, {
      type: 'line',
      data: {
        labels: openedOverTime.labels,
        datasets: [
          {
            label: t('opened'),
            data: openedOverTime.opened,
            borderColor: '#22d3ee',
            backgroundColor: 'rgba(34,211,238,0.08)',
            fill: true,
            tension: 0.3,
            pointRadius: 2,
            pointHoverRadius: 5,
          },
          {
            label: t('closed'),
            data: openedOverTime.closed,
            borderColor: '#f59e0b',
            backgroundColor: 'rgba(245,158,11,0.08)',
            fill: true,
            tension: 0.3,
            pointRadius: 2,
            pointHoverRadius: 5,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: { position: 'top', labels: { usePointStyle: true, boxWidth: 8, padding: 16 } },
          tooltip: {
            backgroundColor: 'rgba(0,0,0,0.85)',
            titleFont: { family: "'Space Mono', monospace", size: 11 },
            bodyFont: { family: "'Space Mono', monospace", size: 11 },
            padding: 10,
            cornerRadius: 6,
          },
        },
        scales: {
          x: { grid: { display: false }, ticks: { maxRotation: 45, minRotation: 0, maxTicksLimit: 12 } },
          y: { beginAtZero: true, grid: { color: 'rgba(128,128,128,0.08)' } },
        },
      },
    });
    return () => { if (chartOverTimeInstance.current) { chartOverTimeInstance.current.destroy(); chartOverTimeInstance.current = null; }};
  }, [openedOverTime, t]);

  // Chart 2: PR open duration
  useEffect(() => {
    if (!chartDurationRef.current || durationBuckets.labels.length === 0) return;
    if (chartDurationInstance.current) { chartDurationInstance.current.destroy(); chartDurationInstance.current = null; }

    chartDurationInstance.current = new Chart(chartDurationRef.current, {
      type: 'bar',
      data: {
        labels: durationBuckets.labels.map((l) => `${l} ${tc('days')}`),
        datasets: [{
          label: t('closed'),
          data: durationBuckets.values,
          backgroundColor: '#f59e0b',
          borderRadius: 4,
          barPercentage: 0.65,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: 'rgba(0,0,0,0.85)',
            titleFont: { family: "'Space Mono', monospace", size: 11 },
            bodyFont: { family: "'Space Mono', monospace", size: 11 },
            padding: 10,
            cornerRadius: 6,
          },
        },
        scales: {
          x: { grid: { display: false } },
          y: { beginAtZero: true, grid: { color: 'rgba(128,128,128,0.08)' } },
        },
      },
    });
    return () => { if (chartDurationInstance.current) { chartDurationInstance.current.destroy(); chartDurationInstance.current = null; }};
  }, [durationBuckets, t, tc]);

  // Chart 3: Time to first approval
  useEffect(() => {
    if (!chartApprovalRef.current || approvalBuckets.labels.length === 0) return;
    if (chartApprovalInstance.current) { chartApprovalInstance.current.destroy(); chartApprovalInstance.current = null; }

    chartApprovalInstance.current = new Chart(chartApprovalRef.current, {
      type: 'bar',
      data: {
        labels: approvalBuckets.labels.map((l) => `${l} ${tc('days')}`),
        datasets: [{
          label: t('reviews'),
          data: approvalBuckets.values,
          backgroundColor: '#8b5cf6',
          borderRadius: 4,
          barPercentage: 0.65,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: 'rgba(0,0,0,0.85)',
            titleFont: { family: "'Space Mono', monospace", size: 11 },
            bodyFont: { family: "'Space Mono', monospace", size: 11 },
            padding: 10,
            cornerRadius: 6,
          },
        },
        scales: {
          x: { grid: { display: false } },
          y: { beginAtZero: true, grid: { color: 'rgba(128,128,128,0.08)' } },
        },
      },
    });
    return () => { if (chartApprovalInstance.current) { chartApprovalInstance.current.destroy(); chartApprovalInstance.current = null; }};
  }, [approvalBuckets, t, tc]);

  // Chart 4: PR size spread
  useEffect(() => {
    if (!chartSizeRef.current) return;
    const data = sizeToggle === 'files' ? sizeSpreadFiles : sizeSpreadLines;
    if (data.labels.length === 0) return;
    if (chartSizeInstance.current) { chartSizeInstance.current.destroy(); chartSizeInstance.current = null; }

    chartSizeInstance.current = new Chart(chartSizeRef.current, {
      type: 'bar',
      data: {
        labels: data.labels,
        datasets: [{
          label: sizeToggle === 'files' ? tc('files') : tc('lines'),
          data: data.values,
          backgroundColor: '#22c55e',
          borderRadius: 4,
          barPercentage: 0.65,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: 'rgba(0,0,0,0.85)',
            titleFont: { family: "'Space Mono', monospace", size: 11 },
            bodyFont: { family: "'Space Mono', monospace", size: 11 },
            padding: 10,
            cornerRadius: 6,
          },
        },
        scales: {
          x: { grid: { display: false } },
          y: { beginAtZero: true, grid: { color: 'rgba(128,128,128,0.08)' } },
        },
      },
    });
    return () => { if (chartSizeInstance.current) { chartSizeInstance.current.destroy(); chartSizeInstance.current = null; }};
  }, [sizeSpreadFiles, sizeSpreadLines, sizeToggle, tc]);

  // Chart: Weekly PR throughput
  useEffect(() => {
    if (!chartWeeklyRef.current || weeklyData.labels.length === 0) return;
    if (chartWeeklyInstance.current) { chartWeeklyInstance.current.destroy(); chartWeeklyInstance.current = null; }

    chartWeeklyInstance.current = new Chart(chartWeeklyRef.current, {
      type: 'bar',
      data: {
        labels: weeklyData.labels,
        datasets: [
          {
            label: t('opened'),
            data: weeklyData.opened,
            backgroundColor: '#22d3ee',
            borderRadius: 3,
            barPercentage: 0.7,
          },
          {
            label: t('merged'),
            data: weeklyData.merged,
            backgroundColor: '#22c55e',
            borderRadius: 3,
            barPercentage: 0.7,
          },
          {
            label: t('closed'),
            data: weeklyData.closed,
            backgroundColor: '#f59e0b',
            borderRadius: 3,
            barPercentage: 0.7,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'top', labels: { usePointStyle: true, boxWidth: 8, padding: 16 } },
          tooltip: {
            backgroundColor: 'rgba(0,0,0,0.85)',
            titleFont: { family: "'Space Mono', monospace", size: 11 },
            bodyFont: { family: "'Space Mono', monospace", size: 11 },
            padding: 10,
            cornerRadius: 6,
          },
        },
        scales: {
          x: { grid: { display: false }, stacked: false },
          y: { beginAtZero: true, grid: { color: 'rgba(128,128,128,0.08)' } },
        },
      },
    });
    return () => { if (chartWeeklyInstance.current) { chartWeeklyInstance.current.destroy(); chartWeeklyInstance.current = null; }};
  }, [weeklyData, t]);

  // Chart: Per-user activity over time
  useEffect(() => {
    if (!chartUserRef.current || userWeeklyData.labels.length === 0) return;
    if (chartUserInstance.current) { chartUserInstance.current.destroy(); chartUserInstance.current = null; }

    chartUserInstance.current = new Chart(chartUserRef.current, {
      type: 'line',
      data: {
        labels: userWeeklyData.labels,
        datasets: userWeeklyData.users.map((u, i) => ({
          label: u.name,
          data: u.data,
          borderColor: USER_LINE_COLORS[i % USER_LINE_COLORS.length],
          backgroundColor: 'transparent',
          borderWidth: 2,
          pointRadius: 2,
          pointHoverRadius: 5,
          tension: 0.3,
        })),
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: { position: 'top', labels: { usePointStyle: true, boxWidth: 8, padding: 12 } },
          tooltip: {
            backgroundColor: 'rgba(0,0,0,0.85)',
            titleFont: { family: "'Space Mono', monospace", size: 11 },
            bodyFont: { family: "'Space Mono', monospace", size: 11 },
            padding: 10,
            cornerRadius: 6,
          },
        },
        scales: {
          x: { grid: { display: false }, ticks: { maxRotation: 45, minRotation: 0, maxTicksLimit: 12 } },
          y: { beginAtZero: true, grid: { color: 'rgba(128,128,128,0.08)' } },
        },
      },
    });
    return () => { if (chartUserInstance.current) { chartUserInstance.current.destroy(); chartUserInstance.current = null; }};
  }, [userWeeklyData, t]);

  useEffect(() => {
    return () => { destroyCharts(); };
  }, [destroyCharts]);

  return (
    <Layout>
      {/* Header */}
      <div className="rr-header-row">
        <div className="rr-radar-bg" style={{ background: 'var(--ink-light)' }}>
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="var(--cyan)" strokeWidth="1.5">
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 16 14" />
          </svg>
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h1 className="rr-header-title">{t('title')}</h1>
          <p className="rr-header-sub">{subtitle}</p>
        </div>
        <div className="rr-header-actions">
          <button onClick={loadHistoricalData} disabled={loading} className="rr-btn-primary">
            {!loading ? (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.3" />
              </svg>
            ) : (
              <span className="loading" />
            )}
            {t('loadData')}
          </button>
        </div>
      </div>

      {/* Date Filter Bar */}
      <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-end', marginBottom: '16px', flexWrap: 'wrap' }}>
        <div>
          <label style={{ display: 'block', fontFamily: "'Space Mono',monospace", fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--muted)', marginBottom: '6px' }}>
            {t('from')}
          </label>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            disabled={allTime}
            className="rounded-lg border border-border-subtle bg-ink-light px-3 py-2 font-space-mono text-[13px] text-text-primary focus:border-cyan focus:outline-none"
            style={{ colorScheme: 'dark' }}
          />
        </div>
        <div>
          <label style={{ display: 'block', fontFamily: "'Space Mono',monospace", fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--muted)', marginBottom: '6px' }}>
            {t('to')}
          </label>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            disabled={allTime}
            className="rounded-lg border border-border-subtle bg-ink-light px-3 py-2 font-space-mono text-[13px] text-text-primary focus:border-cyan focus:outline-none"
            style={{ colorScheme: 'dark' }}
          />
        </div>
        <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontFamily: "'Space Mono',monospace", fontSize: '12px', color: 'var(--muted)', cursor: 'pointer', paddingBottom: '2px' }}>
          <input type="checkbox" checked={allTime} onChange={(e) => setAllTime(e.target.checked)} className="accent-cyan" />
          {t('allTime')}
        </label>
      </div>

      {/* Status bar */}
      {statusMsg && (
        <div
          style={{
            display: 'block',
            fontFamily: "'Space Mono',monospace",
            fontSize: '12px',
            color: isError ? 'var(--red)' : 'var(--muted)',
            marginBottom: '12px',
            padding: '8px 12px',
            borderRadius: '6px',
            background: 'rgba(255,255,255,0.03)',
            border: '0.5px solid var(--border-faint)',
          }}
        >
          {statusMsg}
        </div>
      )}

      {/* No data / no PAT / no repos states */}
      {noData && !noPat && !noRepos && (
        <div style={{ textAlign: 'center', padding: '80px 32px' }}>
          <div style={{ width: '56px', height: '56px', borderRadius: '50%', background: 'var(--cyan-dim)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
            <svg style={{ color: 'var(--cyan)' }} width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
          </div>
          <p style={{ fontFamily: "'Space Mono',monospace", fontSize: '14px', color: 'var(--text-primary)', marginBottom: '8px' }}>{t('noDataTitle')}</p>
          <p style={{ fontSize: '13px', color: 'var(--muted)' }}>{t('noDataDescription')}</p>
        </div>
      )}

      {noPat && (
        <div style={{ textAlign: 'center', padding: '80px 32px' }}>
          <div style={{ width: '56px', height: '56px', borderRadius: '50%', background: 'rgba(245,158,11,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
            <svg style={{ color: 'var(--amber)' }} width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
          </div>
          <p style={{ fontFamily: "'Space Mono',monospace", fontSize: '14px', color: 'var(--text-primary)', marginBottom: '8px' }}>{t('noPatTitle')}</p>
          <p style={{ fontSize: '13px', color: 'var(--muted)', marginBottom: '20px' }}>{t('noPatDescription')}</p>
          <div className="flex flex-col items-center gap-3">
            <GitHubOAuthButton />
            <a href={`/${locale}/settings`} className="rr-btn-primary" style={{ textDecoration: 'none' }}>
              {t('goToSettings')}
            </a>
          </div>
        </div>
      )}

      {noRepos && (
        <div style={{ textAlign: 'center', padding: '80px 32px' }}>
          <div style={{ width: '56px', height: '56px', borderRadius: '50%', background: 'var(--cyan-dim)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
            <svg style={{ color: 'var(--cyan)' }} width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4" />
            </svg>
          </div>
          <p style={{ fontFamily: "'Space Mono',monospace", fontSize: '14px', color: 'var(--text-primary)', marginBottom: '8px' }}>{t('noReposTitle')}</p>
          <p style={{ fontSize: '13px', color: 'var(--muted)', marginBottom: '20px' }}>{t('noReposDescription')}</p>
          <a href={`/${locale}/settings`} className="rr-btn-primary" style={{ textDecoration: 'none' }}>
            {t('addRepos')}
          </a>
        </div>
      )}

      {/* Typing Loader */}
      {loading && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '80px 32px', flexDirection: 'column' }}>
          <LoadingIllustration width={240} height={160} />
          {/* Progress bar */}
          <div style={{ width: '280px', maxWidth: '100%', marginTop: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
              <span style={{ fontFamily: "'Space Mono',monospace", fontSize: '11px', color: 'var(--muted)' }}>{statusMsg}</span>
              <span style={{ fontFamily: "'Space Mono',monospace", fontSize: '11px', color: 'var(--cyan)' }}>{progress}%</span>
            </div>
            <div style={{ height: '4px', background: 'var(--border-faint)', borderRadius: '2px', overflow: 'hidden' }}>
              <div style={{ height: '100%', background: 'var(--cyan)', borderRadius: '2px', width: `${progress}%`, transition: 'width 0.2s ease' }} />
            </div>
            {etaText && (
              <div style={{ textAlign: 'center', fontFamily: "'Space Mono',monospace", fontSize: '10px', color: 'var(--muted-dim)', marginTop: '6px' }}>
                {t('timeRemaining', { eta: etaText })}
              </div>
            )}
          </div>
          <p style={{ fontFamily: "'Space Mono',monospace", fontSize: '12px', color: 'var(--muted)', marginTop: '16px', letterSpacing: '0.05em', textAlign: 'center' }}>
            {t('fetchingHistorical')}
            <br />
            {t('fetchingHistoricalSub')}
          </p>
        </div>
      )}

      {/* Main content */}
      {showGrid && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '16px', maxWidth: '1200px', margin: '0 auto' }}>
          {/* Overview Metrics */}
          <h3 className="mb-1 font-space-mono text-[10px] font-bold uppercase tracking-wider text-white/40">{t('overview')}</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px' }}>
            <div className="rr-stat" style={{ background: 'var(--ink-light)', border: '0.5px solid var(--border-faint)', borderRadius: '12px', padding: '16px', textAlign: 'center' }}>
              <div style={{ fontFamily: "'Space Mono',monospace", fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--muted)', marginBottom: '8px' }}>{t('opened')}</div>
              <div style={{ fontFamily: "'Space Mono',monospace", fontSize: '28px', fontWeight: 700, color: 'var(--cyan)' }}>{openedCount}</div>
            </div>
            <div className="rr-stat" style={{ background: 'var(--ink-light)', border: '0.5px solid var(--border-faint)', borderRadius: '12px', padding: '16px', textAlign: 'center' }}>
              <div style={{ fontFamily: "'Space Mono',monospace", fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--muted)', marginBottom: '8px' }}>{t('closed')}</div>
              <div style={{ fontFamily: "'Space Mono',monospace", fontSize: '28px', fontWeight: 700, color: 'var(--amber)' }}>{closedCount}</div>
            </div>
            <div className="rr-stat" style={{ background: 'var(--ink-light)', border: '0.5px solid var(--border-faint)', borderRadius: '12px', padding: '16px', textAlign: 'center' }}>
              <div style={{ fontFamily: "'Space Mono',monospace", fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--muted)', marginBottom: '8px' }}>{t('merged')}</div>
              <div style={{ fontFamily: "'Space Mono',monospace", fontSize: '28px', fontWeight: 700, color: 'var(--green)' }}>{mergedCount}</div>
            </div>
            <div className="rr-stat" style={{ background: 'var(--ink-light)', border: '0.5px solid var(--border-faint)', borderRadius: '12px', padding: '16px', textAlign: 'center' }}>
              <div style={{ fontFamily: "'Space Mono',monospace", fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--muted)', marginBottom: '8px' }}>{t('reviews')}</div>
              <div style={{ fontFamily: "'Space Mono',monospace", fontSize: '28px', fontWeight: 700, color: 'var(--purple)' }}>{reviewsCount}</div>
            </div>
          </div>

          {/* User Metrics */}
          <h3 className="mb-1 font-space-mono text-[10px] font-bold uppercase tracking-wider text-white/40">{t('activityByPerson')}</h3>
          <div className="rr-stat" style={{ background: 'var(--ink-light)', border: '0.5px solid var(--border-faint)', borderRadius: '12px', padding: '20px', overflowX: 'auto' }}>
            <table className="w-full border-collapse text-[13px]">
              <thead className="border-b border-border-faint">
                <tr>
                  <th className="px-3 py-2 text-left font-space-mono text-[10px] font-semibold uppercase tracking-wider text-white/35">{t('person')}</th>
                  <th className="px-3 py-2 text-center font-space-mono text-[10px] font-semibold uppercase tracking-wider text-white/35">{t('opened')}</th>
                  <th className="px-3 py-2 text-center font-space-mono text-[10px] font-semibold uppercase tracking-wider text-white/35">{t('closed')}</th>
                  <th className="px-3 py-2 text-center font-space-mono text-[10px] font-semibold uppercase tracking-wider text-white/35">{t('merged')}</th>
                  <th className="px-3 py-2 text-center font-space-mono text-[10px] font-semibold uppercase tracking-wider text-white/35">{t('reviews')}</th>
                </tr>
              </thead>
              <tbody>
                {userStats.length === 0 ? (
                  <tr>
                    <td colSpan={5} style={{ padding: '32px', textAlign: 'center', color: 'var(--muted-dim)' }}>
                      {t('noActivity')}
                    </td>
                  </tr>
                ) : (
                  userStats.map(([name, stats]) => (
                    <tr key={name} style={{ borderBottom: '0.5px solid var(--border-faint)' }}>
                      <td style={{ padding: '10px 12px', fontFamily: "'Space Mono',monospace", fontSize: '12px', color: 'var(--text-primary)' }}>{name}</td>
                      <td style={{ padding: '10px 12px', textAlign: 'center', fontFamily: "'Space Mono',monospace", fontSize: '12px', color: 'var(--cyan)' }}>{stats.opened}</td>
                      <td style={{ padding: '10px 12px', textAlign: 'center', fontFamily: "'Space Mono',monospace", fontSize: '12px', color: 'var(--amber)' }}>{stats.closed}</td>
                      <td style={{ padding: '10px 12px', textAlign: 'center', fontFamily: "'Space Mono',monospace", fontSize: '12px', color: 'var(--green)' }}>{stats.merged}</td>
                      <td style={{ padding: '10px 12px', textAlign: 'center', fontFamily: "'Space Mono',monospace", fontSize: '12px', color: 'var(--purple)' }}>{stats.reviews}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Chart: PRs Opened & Closed Over Time */}
          <h3 className="mb-1 font-space-mono text-[10px] font-bold uppercase tracking-wider text-white/40">{t('prsOverTime')}</h3>
          <div className="rr-stat" style={{ background: 'var(--ink-light)', border: '0.5px solid var(--border-faint)', borderRadius: '12px', padding: '20px', height: '300px' }}>
            {openedOverTime.labels.length === 0 ? (
              <p style={{ textAlign: 'center', padding: '100px 0', fontSize: '12px', color: 'var(--muted-dim)' }}>{t('noPRsInPeriod')}</p>
            ) : (
              <canvas ref={chartOverTimeRef} />
            )}
          </div>

          {/* Charts: Duration & Approval */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '16px' }}>
            <div>
              <h3 className="mb-1 font-space-mono text-[10px] font-bold uppercase tracking-wider text-white/40">{t('openDuration')}</h3>
              <div className="rr-stat" style={{ background: 'var(--ink-light)', border: '0.5px solid var(--border-faint)', borderRadius: '12px', padding: '20px', height: '280px' }}>
                {durationBuckets.labels.length === 0 || durationBuckets.values.every((v) => v === 0) ? (
                  <p style={{ textAlign: 'center', padding: '90px 0', fontSize: '12px', color: 'var(--muted-dim)' }}>{t('stillOpen')}</p>
                ) : (
                  <>
                    <canvas ref={chartDurationRef} style={{ maxHeight: '220px' }} />
                    <div style={{ textAlign: 'center', fontFamily: "'Space Mono',monospace", fontSize: '11px', color: 'var(--muted)', marginTop: '8px' }}>
                      {t('avgOpenDuration', { value: durationBuckets.avg })}
                    </div>
                  </>
                )}
              </div>
            </div>
            <div>
              <h3 className="mb-1 font-space-mono text-[10px] font-bold uppercase tracking-wider text-white/40">{t('timeToApproval')}</h3>
              <div className="rr-stat" style={{ background: 'var(--ink-light)', border: '0.5px solid var(--border-faint)', borderRadius: '12px', padding: '20px', height: '280px' }}>
                {approvalBuckets.labels.length === 0 || approvalBuckets.values.every((v) => v === 0) ? (
                  <p style={{ textAlign: 'center', padding: '90px 0', fontSize: '12px', color: 'var(--muted-dim)' }}>{t('noApproval')}</p>
                ) : (
                  <>
                    <canvas ref={chartApprovalRef} style={{ maxHeight: '220px' }} />
                    <div style={{ textAlign: 'center', fontFamily: "'Space Mono',monospace", fontSize: '11px', color: 'var(--muted)', marginTop: '8px' }}>
                      {t('avgApprovalTime', { value: approvalBuckets.avg })}
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Chart: PR Size Spread */}
          <h3 className="mb-1 font-space-mono text-[10px] font-bold uppercase tracking-wider text-white/40">{t('prSizeSpread')}</h3>
          <div className="rr-stat" style={{ background: 'var(--ink-light)', border: '0.5px solid var(--border-faint)', borderRadius: '12px', padding: '20px', height: '300px' }}>
            <div style={{ display: 'flex', gap: '8px', marginBottom: '12px', justifyContent: 'center' }}>
              <button
                onClick={() => setSizeToggle('files')}
                className={`text-[11px] font-space-mono px-3 py-1 rounded-md border transition-colors ${sizeToggle === 'files' ? 'border-cyan/40 bg-cyan/10 text-cyan' : 'border-border-faint text-muted hover:text-text-primary hover:border-border-subtle'}`}
              >
                {t('byFiles')}
              </button>
              <button
                onClick={() => setSizeToggle('lines')}
                className={`text-[11px] font-space-mono px-3 py-1 rounded-md border transition-colors ${sizeToggle === 'lines' ? 'border-cyan/40 bg-cyan/10 text-cyan' : 'border-border-faint text-muted hover:text-text-primary hover:border-border-subtle'}`}
              >
                {t('byLines')}
              </button>
            </div>
            {(sizeToggle === 'files' ? sizeSpreadFiles : sizeSpreadLines).labels.length === 0 ? (
              <p style={{ textAlign: 'center', padding: '80px 0', fontSize: '12px', color: 'var(--muted-dim)' }}>{t('noPRsInPeriod')}</p>
            ) : (
              <>
                <canvas ref={chartSizeRef} style={{ maxHeight: '200px' }} />
                <div style={{ textAlign: 'center', fontFamily: "'Space Mono',monospace", fontSize: '11px', color: 'var(--muted)', marginTop: '8px' }}>
                  {t('avgSize', { value: sizeToggle === 'files' ? sizeSpreadFiles.avg : sizeSpreadLines.avg, unit: sizeToggle === 'files' ? tc('files') : tc('lines') })}
                </div>
              </>
            )}
          </div>

          {/* Chart: Weekly PR Throughput */}
          <h3 className="mb-1 font-space-mono text-[10px] font-bold uppercase tracking-wider text-white/40">{t('weeklyThroughput')}</h3>
          <div className="rr-stat" style={{ background: 'var(--ink-light)', border: '0.5px solid var(--border-faint)', borderRadius: '12px', padding: '20px', height: '300px' }}>
            {weeklyData.labels.length === 0 ? (
              <p style={{ textAlign: 'center', padding: '100px 0', fontSize: '12px', color: 'var(--muted-dim)' }}>{t('noPRsInPeriod')}</p>
            ) : (
              <canvas ref={chartWeeklyRef} />
            )}
          </div>

          {/* Review Health Cards */}
          <h3 className="mb-1 font-space-mono text-[10px] font-bold uppercase tracking-wider text-white/40">{t('reviewHealth')}</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
            <div className="rr-stat" style={{ background: 'var(--ink-light)', border: '0.5px solid var(--border-faint)', borderRadius: '12px', padding: '16px', textAlign: 'center' }}>
              <div style={{ fontFamily: "'Space Mono',monospace", fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--muted)', marginBottom: '8px' }}>{t('avgTimeToReview')}</div>
              <div style={{ fontFamily: "'Space Mono',monospace", fontSize: '24px', fontWeight: 700, color: 'var(--cyan)' }}>{reviewHealth.avgTimeToReview}<span style={{ fontSize: '12px', color: 'var(--muted)' }}>d</span></div>
            </div>
            <div className="rr-stat" style={{ background: 'var(--ink-light)', border: '0.5px solid var(--border-faint)', borderRadius: '12px', padding: '16px', textAlign: 'center' }}>
              <div style={{ fontFamily: "'Space Mono',monospace", fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--muted)', marginBottom: '8px' }}>{t('avgTimeToMerge')}</div>
              <div style={{ fontFamily: "'Space Mono',monospace", fontSize: '24px', fontWeight: 700, color: 'var(--green)' }}>{reviewHealth.avgTimeToMerge}<span style={{ fontSize: '12px', color: 'var(--muted)' }}>d</span></div>
            </div>
            <div className="rr-stat" style={{ background: 'var(--ink-light)', border: '0.5px solid var(--border-faint)', borderRadius: '12px', padding: '16px', textAlign: 'center' }}>
              <div style={{ fontFamily: "'Space Mono',monospace", fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--muted)', marginBottom: '8px' }}>{t('pctReviewed')}</div>
              <div style={{ fontFamily: "'Space Mono',monospace", fontSize: '24px', fontWeight: 700, color: 'var(--purple)' }}>{reviewHealth.pctReviewed}<span style={{ fontSize: '12px', color: 'var(--muted)' }}>%</span></div>
            </div>
            <div className="rr-stat" style={{ background: 'var(--ink-light)', border: '0.5px solid var(--border-faint)', borderRadius: '12px', padding: '16px', textAlign: 'center' }}>
              <div style={{ fontFamily: "'Space Mono',monospace", fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--muted)', marginBottom: '8px' }}>{t('avgReviewRounds')}</div>
              <div style={{ fontFamily: "'Space Mono',monospace", fontSize: '24px', fontWeight: 700, color: 'var(--amber)' }}>{reviewHealth.avgReviewRounds}</div>
            </div>
          </div>

          {/* Chart: Per-User Activity Over Time */}
          <h3 className="mb-1 font-space-mono text-[10px] font-bold uppercase tracking-wider text-white/40">{t('userActivityOverTime')}</h3>
          <div className="rr-stat" style={{ background: 'var(--ink-light)', border: '0.5px solid var(--border-faint)', borderRadius: '12px', padding: '20px', height: '340px' }}>
            <div style={{ display: 'flex', gap: '8px', marginBottom: '12px', justifyContent: 'center' }}>
              <button
                onClick={() => setUserMetric('opened')}
                className={`text-[11px] font-space-mono px-3 py-1 rounded-md border transition-colors ${userMetric === 'opened' ? 'border-cyan/40 bg-cyan/10 text-cyan' : 'border-border-faint text-muted hover:text-text-primary hover:border-border-subtle'}`}
              >
                {t('userMetricOpened')}
              </button>
              <button
                onClick={() => setUserMetric('reviews')}
                className={`text-[11px] font-space-mono px-3 py-1 rounded-md border transition-colors ${userMetric === 'reviews' ? 'border-cyan/40 bg-cyan/10 text-cyan' : 'border-border-faint text-muted hover:text-text-primary hover:border-border-subtle'}`}
              >
                {t('userMetricReviews')}
              </button>
              <button
                onClick={() => setUserMetric('lines')}
                className={`text-[11px] font-space-mono px-3 py-1 rounded-md border transition-colors ${userMetric === 'lines' ? 'border-cyan/40 bg-cyan/10 text-cyan' : 'border-border-faint text-muted hover:text-text-primary hover:border-border-subtle'}`}
              >
                {t('userMetricLines')}
              </button>
            </div>
            {userWeeklyData.labels.length === 0 || userWeeklyData.users.length === 0 ? (
              <p style={{ textAlign: 'center', padding: '100px 0', fontSize: '12px', color: 'var(--muted-dim)' }}>{t('noPRsInPeriod')}</p>
            ) : (
              <canvas ref={chartUserRef} />
            )}
          </div>

          {/* Review Matrix */}
          <h3 className="mb-1 font-space-mono text-[10px] font-bold uppercase tracking-wider text-white/40">{t('reviewMatrix')}</h3>
          <div className="rr-stat" style={{ background: 'var(--ink-light)', border: '0.5px solid var(--border-faint)', borderRadius: '12px', padding: '20px', overflowX: 'auto' }}>
            <table className="w-full border-collapse text-[13px]">
              <thead className="border-b border-border-faint">
                <tr>
                  <th className="px-3 py-2 text-left font-space-mono text-[10px] font-semibold uppercase tracking-wider text-white/35">{t('reviewer')}</th>
                  <th className="px-3 py-2 text-left font-space-mono text-[10px] font-semibold uppercase tracking-wider text-white/35">{t('author')}</th>
                  <th className="px-3 py-2 text-center font-space-mono text-[10px] font-semibold uppercase tracking-wider text-white/35">{t('reviewCount')}</th>
                </tr>
              </thead>
              <tbody>
                {reviewMatrix.length === 0 ? (
                  <tr>
                    <td colSpan={3} style={{ padding: '32px', textAlign: 'center', color: 'var(--muted-dim)' }}>
                      {t('noReviews')}
                    </td>
                  </tr>
                ) : (
                  reviewMatrix.slice(0, 50).map((row, idx) => (
                    <tr key={`${row.reviewer}-${row.author}-${idx}`} style={{ borderBottom: '0.5px solid var(--border-faint)' }}>
                      <td style={{ padding: '10px 12px', fontFamily: "'Space Mono',monospace", fontSize: '12px', color: 'var(--text-primary)' }}>{row.reviewer}</td>
                      <td style={{ padding: '10px 12px', fontFamily: "'Space Mono',monospace", fontSize: '12px', color: 'var(--text-primary)' }}>{row.author}</td>
                      <td style={{ padding: '10px 12px', textAlign: 'center', fontFamily: "'Space Mono',monospace", fontSize: '12px', color: 'var(--cyan)' }}>{row.count}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Heaviest PRs */}
          <h3 className="mb-1 font-space-mono text-[10px] font-bold uppercase tracking-wider text-white/40">{t('heaviestPRs')}</h3>
          <div className="rr-stat" style={{ background: 'var(--ink-light)', border: '0.5px solid var(--border-faint)', borderRadius: '12px', padding: '20px', overflowX: 'auto' }}>
            <table className="w-full border-collapse text-[13px]">
              <thead className="border-b border-border-faint">
                <tr>
                  <th className="px-3 py-2 text-left font-space-mono text-[10px] font-semibold uppercase tracking-wider text-white/35">{t('colPullRequest')}</th>
                  <th className="px-3 py-2 text-left font-space-mono text-[10px] font-semibold uppercase tracking-wider text-white/35">{t('colAuthor')}</th>
                  <th className="px-3 py-2 text-center font-space-mono text-[10px] font-semibold uppercase tracking-wider text-white/35">{t('colFiles')}</th>
                  <th className="px-3 py-2 text-center font-space-mono text-[10px] font-semibold uppercase tracking-wider text-white/35">{t('colLines')}</th>
                  <th className="px-3 py-2 text-center font-space-mono text-[10px] font-semibold uppercase tracking-wider text-white/35">{t('colSize')}</th>
                  <th className="px-3 py-2 text-center font-space-mono text-[10px] font-semibold uppercase tracking-wider text-white/35">{t('colStatus')}</th>
                </tr>
              </thead>
              <tbody>
                {heaviestPRs.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ padding: '32px', textAlign: 'center', color: 'var(--muted-dim)' }}>
                      {t('noPRsInPeriod')}
                    </td>
                  </tr>
                ) : (
                  heaviestPRs.map((pr, idx) => {
                    const color = SIZE_COLORS[pr.category];
                    return (
                      <tr key={idx} style={{ borderBottom: '0.5px solid var(--border-faint)' }}>
                        <td style={{ padding: '10px 12px', maxWidth: '300px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          <a href={pr.url} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--cyan)', textDecoration: 'none', fontSize: '12px' }} title={pr.title}>
                            {pr.title.substring(0, 60)}{pr.title.length > 60 ? '…' : ''}
                          </a>
                        </td>
                        <td style={{ padding: '10px 12px', fontFamily: "'Space Mono',monospace", fontSize: '12px', color: 'var(--text-primary)' }}>{pr.author}</td>
                        <td style={{ padding: '10px 12px', textAlign: 'center', fontFamily: "'Space Mono',monospace", fontSize: '12px', color: 'var(--text-primary)' }}>{pr.files}</td>
                        <td style={{ padding: '10px 12px', textAlign: 'center', fontFamily: "'Space Mono',monospace", fontSize: '12px', color: 'var(--text-primary)' }}>{pr.lines}</td>
                        <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                          <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: '4px', fontSize: '10px', fontWeight: 700, color, background: `${color}22` }}>
                            {tc(`size${pr.category}`)}
                          </span>
                        </td>
                        <td style={{ padding: '10px 12px', textAlign: 'center', fontFamily: "'Space Mono',monospace", fontSize: '11px', color: 'var(--muted)' }}>{pr.state}</td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* PR Size Distribution */}
          <h3 className="mb-1 font-space-mono text-[10px] font-bold uppercase tracking-wider text-white/40">{t('prSizeDistribution')}</h3>
          <div className="rr-stat" style={{ background: 'var(--ink-light)', border: '0.5px solid var(--border-faint)', borderRadius: '12px', padding: '20px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {sizeEntries.length === 0 ? (
                <p style={{ textAlign: 'center', padding: '40px', fontSize: '12px', color: 'var(--muted-dim)' }}>{t('noPRsInPeriod')}</p>
              ) : (
                sizeEntries.map(([cat, count]) => {
                  const pct = totalSized > 0 ? Math.round((count / totalSized) * 100) : 0;
                  const barWidth = maxSizeCount > 0 ? (count / maxSizeCount) * 100 : 0;
                  const color = SIZE_COLORS[cat];
                  return (
                    <div key={cat} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div style={{ fontFamily: "'Space Mono',monospace", fontSize: '11px', color: 'var(--muted-dim)', minWidth: '80px', textAlign: 'right' }}>{tc(`size${cat}`)}</div>
                      <div style={{ flex: 1, height: '18px', background: `${color}33`, borderRadius: '3px', overflow: 'hidden', position: 'relative' }}>
                        <div style={{ height: '100%', background: color, width: `${barWidth}%`, borderRadius: '3px' }} />
                      </div>
                      <div style={{ fontFamily: "'Space Mono',monospace", fontSize: '11px', color: 'var(--text-primary)', minWidth: '50px', textAlign: 'right' }}>{count}</div>
                      <div style={{ fontFamily: "'Space Mono',monospace", fontSize: '10px', color: 'var(--muted)', minWidth: '36px', textAlign: 'right' }}>{pct}%</div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* PR Size Details */}
          <h3 className="mb-1 font-space-mono text-[10px] font-bold uppercase tracking-wider text-white/40">{t('prSizeDetails')}</h3>
          <div className="rr-stat" style={{ background: 'var(--ink-light)', border: '0.5px solid var(--border-faint)', borderRadius: '12px', padding: '20px', overflowX: 'auto' }}>
            <table className="w-full border-collapse text-[13px]">
              <thead className="border-b border-border-faint">
                <tr>
                  <th className="px-3 py-2 text-left font-space-mono text-[10px] font-semibold uppercase tracking-wider text-white/35">{t('colPullRequest')}</th>
                  <th className="px-3 py-2 text-left font-space-mono text-[10px] font-semibold uppercase tracking-wider text-white/35">{t('colAuthor')}</th>
                  <th className="px-3 py-2 text-center font-space-mono text-[10px] font-semibold uppercase tracking-wider text-white/35">{t('colFiles')}</th>
                  <th className="px-3 py-2 text-center font-space-mono text-[10px] font-semibold uppercase tracking-wider text-white/35">{t('colLines')}</th>
                  <th className="px-3 py-2 text-center font-space-mono text-[10px] font-semibold uppercase tracking-wider text-white/35">{t('colSize')}</th>
                  <th className="px-3 py-2 text-center font-space-mono text-[10px] font-semibold uppercase tracking-wider text-white/35">{t('colStatus')}</th>
                </tr>
              </thead>
              <tbody>
                {sizeDetails.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ padding: '32px', textAlign: 'center', color: 'var(--muted-dim)' }}>
                      {t('noPRsInPeriod')}
                    </td>
                  </tr>
                ) : (
                  sizeDetails.map((pr, idx) => {
                    const color = SIZE_COLORS[pr.category];
                    return (
                      <tr key={idx} style={{ borderBottom: '0.5px solid var(--border-faint)' }}>
                        <td style={{ padding: '10px 12px', maxWidth: '300px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          <a href={pr.url} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--cyan)', textDecoration: 'none', fontSize: '12px' }} title={pr.title}>
                            {pr.title.substring(0, 60)}{pr.title.length > 60 ? '…' : ''}
                          </a>
                        </td>
                        <td style={{ padding: '10px 12px', fontFamily: "'Space Mono',monospace", fontSize: '12px', color: 'var(--text-primary)' }}>{pr.author}</td>
                        <td style={{ padding: '10px 12px', textAlign: 'center', fontFamily: "'Space Mono',monospace", fontSize: '12px', color: 'var(--text-primary)' }}>{pr.files}</td>
                        <td style={{ padding: '10px 12px', textAlign: 'center', fontFamily: "'Space Mono',monospace", fontSize: '12px', color: 'var(--text-primary)' }}>{pr.lines}</td>
                        <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                          <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: '4px', fontSize: '10px', fontWeight: 700, color, background: `${color}22` }}>
                            {tc(`size${pr.category}`)}
                          </span>
                        </td>
                        <td style={{ padding: '10px 12px', textAlign: 'center', fontFamily: "'Space Mono',monospace", fontSize: '11px', color: 'var(--muted)' }}>{pr.state}</td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </Layout>
  );
}
