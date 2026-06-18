'use client';

import { useState, useMemo, useRef } from 'react';
import { useAppStore, DEFAULT_COLUMNS, PR } from '@/lib/store';
import PRTable from '@/components/PRTable';
import PRDrawer from '@/components/PRDrawer';
import StatsBar from '@/components/StatsBar';
import Layout from '@/components/Layout';
import DemoTour from '@/components/DemoTour';
import { buildDemoPRs, DEMO_REPOS, DEMO_USERS, DEMO_CURRENT_USER } from '@/lib/demoData';
import { useTranslations, useLocale } from 'next-intl';
import Link from 'next/link';

export default function DemoPage() {
  const store = useAppStore();
  const t = useTranslations('dashboard');
  const locale = useLocale();
  const [drawerPR, setDrawerPR] = useState<PR | null>(null);

  const demoPRs = useMemo(() => buildDemoPRs(), []);

  const initialized = useRef(false);
  if (!initialized.current) {
    initialized.current = true;
    useAppStore.setState({
      allPRs: demoPRs,
      selectedRepos: new Set(DEMO_REPOS),
      selectedUsers: [...DEMO_USERS],
      currentUser: DEMO_CURRENT_USER,
      columnOrder: DEFAULT_COLUMNS,
      searchQuery: '',
      currentFilter: 'all',
      activeFilters: { label: null, status: null, author: null, build: null },
      currentSort: [],
    });
  }

  const lastRefreshAt = Date.now();
  const [timeAgo, setTimeAgo] = useState('just now');
  const rtf = useMemo(() => new Intl.RelativeTimeFormat(locale, { numeric: 'auto' }), [locale]);

  // client-side time updates
  if (typeof window !== 'undefined') {
    const diffSec = Math.floor((Date.now() - lastRefreshAt) / 1000);
    const tAgo = diffSec < 60 ? rtf.format(-diffSec, 'seconds')
      : diffSec < 3600 ? rtf.format(-Math.floor(diffSec / 60), 'minutes')
      : rtf.format(-Math.floor(diffSec / 3600), 'hours');
    if (tAgo !== timeAgo) {
      setTimeout(() => setTimeAgo(tAgo), 30000);
    }
  }

  return (
    <DemoTour>
      <Layout>
        <div className="max-w-[1400px] mx-auto">
          {/* ── HEADER ── */}
          <div className="rr-header-row">
            <div className="flex items-center gap-3">
              <div className="rr-radar-bg">
                <svg width="28" height="28" viewBox="0 0 40 40" fill="none">
                  <circle cx="20" cy="20" r="18" stroke="var(--cyan)" strokeWidth="0.5" opacity="0.3" />
                  <circle cx="20" cy="20" r="12" stroke="var(--cyan)" strokeWidth="0.5" opacity="0.2" />
                  <circle cx="20" cy="20" r="6" stroke="var(--cyan)" strokeWidth="0.5" opacity="0.15" />
                  <line x1="20" y1="2" x2="20" y2="38" stroke="var(--cyan)" strokeWidth="0.5" opacity="0.15" />
                  <line x1="2" y1="20" x2="38" y2="20" stroke="var(--cyan)" strokeWidth="0.5" opacity="0.15" />
                  <circle cx="20" cy="20" r="2" fill="var(--cyan)" opacity="0.6" />
                  <circle cx="28" cy="12" r="1.5" fill="var(--cyan)" opacity="0.8" className="rr-radar-blip1" />
                  <circle cx="10" cy="26" r="1" fill="var(--cyan)" opacity="0.6" className="rr-radar-blip2" />
                  <path d="M20 20 L38 2" stroke="var(--cyan)" strokeWidth="1" opacity="0.4" className="rr-radar-sweep" />
                </svg>
              </div>
              <div id="tour-header">
                <h1 className="rr-header-title">{t('title')}</h1>
                <div className="rr-header-sub">{t('subtitle')}</div>
              </div>
            </div>
            <Link href={`/${locale}/settings`} style={{ textDecoration: 'none' }}>
              <div className="rr-time-badge" style={{ fontFamily: "'Space Mono', monospace", fontSize: 11, color: 'var(--muted-dim)', padding: '8px 12px', borderRadius: 6, background: 'var(--surface)', border: '0.5px solid var(--border-faint)', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                <span style={{ fontSize: 9, lineHeight: 1, marginBottom: 3, opacity: 0.6 }}>{t('lastRefreshed')}</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <span>{timeAgo}</span>
                </div>
              </div>
            </Link>
            <div
              className="rr-time-badge"
              style={{
                fontSize: 11, color: 'var(--muted-dim)', padding: '8px 12px', borderRadius: 6,
                background: 'var(--surface)', border: '0.5px solid var(--border-faint)',
                display: 'flex', alignItems: 'center', gap: 8,
              }}
            >
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--green)' }} />
              <span>Signed in as <strong>{DEMO_CURRENT_USER}</strong></span>
            </div>
            <div
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                fontSize: 11, color: 'var(--muted-dim)', padding: '8px 12px', borderRadius: 6,
                background: 'rgba(34,211,238,0.08)', border: '0.5px solid var(--cyan-mid)',
              }}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--cyan)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2L2 7l10 5 10-5-10-5z" />
                <path d="M2 17l10 5 10-5" />
                <path d="M2 12l10 5 10-5" />
              </svg>
              <span style={{ color: 'var(--cyan)', fontWeight: 600 }}>DEMO</span>
            </div>
          </div>

          <div style={{ height: 1, background: 'var(--border-faint)', marginBottom: 16 }} />

          {/* ── SEARCH & FILTERS ── */}
          <div id="tour-search" style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 24 }}>
            <div style={{
              flex: 1, display: 'flex', alignItems: 'center', height: 36,
              background: 'var(--surface)', borderRadius: 8, padding: '0 12px',
            }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--text-secondary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: 8, flexShrink: 0 }} aria-hidden="true">
                <circle cx="11" cy="11" r="8" />
                <path d="M21 21l-4.35-4.35" />
              </svg>
              <input
                type="text"
                placeholder="Search PRs by title or number..."
                value={store.searchQuery}
                onChange={(e) => store.setSearchQuery(e.target.value)}
                style={{
                  flex: 1, height: '100%', background: 'transparent', border: 'none',
                  color: 'var(--text-primary)', fontSize: 13, outline: 'none', padding: 0,
                }}
              />
            </div>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 4, height: 36, minWidth: 180,
              background: 'var(--ink-light)', border: '0.5px solid var(--border-faint)',
              borderRadius: 8, padding: '0 12px',
              color: 'var(--text-primary)', fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap',
            }}>
              <span>Users:</span>
              <span style={{ color: 'var(--muted)', fontWeight: 400 }}>{DEMO_USERS.length}</span>
            </div>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 4, height: 36, minWidth: 180,
              background: 'var(--ink-light)', border: '0.5px solid var(--border-faint)',
              borderRadius: 8, padding: '0 12px',
              color: 'var(--text-primary)', fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap',
            }}>
              <span>Repos:</span>
              <span style={{ color: 'var(--muted)', fontWeight: 400 }}>{DEMO_REPOS.length}</span>
            </div>
          </div>

          {/* ── STATS ── */}
          <div id="tour-stats">
            <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--muted)', marginBottom: 12 }}>
              PR Status Overview
            </div>
            <StatsBar />
          </div>

          {/* ── TABLE ── */}
          <div id="tour-table">
            <PRTable onOpenDrawer={setDrawerPR} loading={false} />
          </div>

          {/* Drawer */}
          {drawerPR && <PRDrawer pr={drawerPR} onClose={() => setDrawerPR(null)} />}
        </div>
      </Layout>
    </DemoTour>
  );
}
