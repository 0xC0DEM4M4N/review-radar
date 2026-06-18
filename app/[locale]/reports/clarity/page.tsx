'use client';

import { useEffect, useRef, useState } from 'react';
import Layout from '@/components/Layout';
import styles from './clarity.module.css';

type ChipFilter = 'All' | 'Draft' | 'Failed' | 'Open';

interface QueueRow {
  pr: string;
  author: string;
  status: 'Draft' | 'Failed' | 'In review' | 'Open' | 'Approved';
  labels: string;
  complexity: string;
  barWidth: number;
  barColor?: string;
  updated: string;
}

const queueData: QueueRow[] = [
  {
    pr: '#1842',
    author: 'Przemyslaw—Galarowicz',
    status: 'Draft',
    labels: 'donotmerge, update',
    complexity: 'High',
    barWidth: 78,
    updated: '2026-05-03',
  },
  {
    pr: '#1831',
    author: 'Andrew—Burdon',
    status: 'Failed',
    labels: 'draft, auth',
    complexity: 'Very High',
    barWidth: 92,
    barColor: 'linear-gradient(90deg, rgba(239,68,68,.9), rgba(239,68,68,.25))',
    updated: '2026-04-21',
  },
  {
    pr: '#1820',
    author: 'Hannah—Redmond',
    status: 'In review',
    labels: 'refactor, tests',
    complexity: 'Medium',
    barWidth: 55,
    updated: '2026-05-27',
  },
  {
    pr: '#1812',
    author: 'svc-github-runners',
    status: 'Open',
    labels: 'docs',
    complexity: 'Low',
    barWidth: 26,
    updated: '2026-05-12',
  },
  {
    pr: '#1799',
    author: 'Martin—Matzcuk',
    status: 'Approved',
    labels: 'feature',
    complexity: 'Low',
    barWidth: 32,
    barColor: 'linear-gradient(90deg, rgba(245,158,11,.9), rgba(245,158,11,.25))',
    updated: '2026-04-30',
  },
];

const statusClass: Record<QueueRow['status'], string> = {
  Draft: styles.statusDraft,
  Failed: styles.statusFailed,
  'In review': styles.statusInReview,
  Open: styles.statusOpen,
  Approved: styles.statusApproved,
};

export default function ReportsClarityPage() {
  const [refreshing, setRefreshing] = useState(false);
  const [activeChip, setActiveChip] = useState<ChipFilter>('All');
  const tableRef = useRef<HTMLTableElement>(null);

  const handleRefresh = () => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 700);
  };

  const scrollToQueue = () => {
    if (tableRef.current) {
      tableRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const filteredRows =
    activeChip === 'All'
      ? queueData
      : queueData.filter((row) => row.status === activeChip || (activeChip === 'Failed' && row.status === 'Failed'));

  useEffect(() => {
    // Ensure theme attribute is synced on mount.
  }, []);

  return (
    <Layout>
      <div className={styles.appBackground}>
        <div className={styles.page}>
          <div className={styles.topbar} role="banner" aria-label="Reports top bar">
            <div className={styles.brand}>
              <div className={styles.dot} aria-hidden="true" />
              <div>
                <div style={{ fontSize: 14, color: 'var(--muted)', fontWeight: 800, marginTop: -2 }}>ReviewRadar</div>
                <div style={{ fontSize: 16 }}>Reports</div>
              </div>
            </div>

            <div className={styles.filters}>
              <div className={styles.control}>
                <label htmlFor="repo">Project</label>
                <select id="repo" aria-label="Project" className={styles.select}>
                  <option>saleshub</option>
                  <option>core-api</option>
                  <option>dashboard</option>
                </select>
              </div>
              <div className={styles.control}>
                <label htmlFor="range">Time range</label>
                <select id="range" aria-label="Time range" className={styles.select} defaultValue="7">
                  <option value="30">Last 30 days</option>
                  <option value="7">Last 7 days</option>
                  <option value="all">All time</option>
                </select>
              </div>
              <div className={styles.control}>
                <label htmlFor="label">Label</label>
                <select id="label" aria-label="Label filter" className={styles.select} defaultValue="all">
                  <option value="all">All</option>
                  <option>bug</option>
                  <option>feature</option>
                  <option>docs</option>
                  <option>refactor</option>
                </select>
              </div>
              <button
                className={styles.btn}
                type="button"
                onClick={handleRefresh}
                disabled={refreshing}
              >
                {refreshing ? 'Refreshing…' : '↻ Refresh'}
              </button>
            </div>
          </div>

          {/* Row 1: Summary */}
          <div className={styles.section}>
            <div className={styles.grid}>
              <div className={`${styles.card} ${styles.col3}`}>
                <div className={styles.stat}>
                  <div className={styles.statLabel}>
                    <span className={styles.pill} style={{ background: 'var(--blue)' }} />
                    TOTAL PRS
                  </div>
                  <div className={styles.value}>55</div>
                  <div className={styles.sub}>Across selected timeframe</div>
                </div>
              </div>

              <div className={`${styles.card} ${styles.col3}`}>
                <div className={styles.stat}>
                  <div className={styles.statLabel}>
                    <span className={styles.pill} style={{ background: 'var(--green)' }} />
                    APPROVED
                  </div>
                  <div className={styles.value} style={{ color: 'var(--green)' }}>34</div>
                  <div className={styles.sub}>Quality outcome</div>
                </div>
              </div>

              <div className={`${styles.card} ${styles.col3}`}>
                <div className={styles.stat}>
                  <div className={styles.statLabel}>
                    <span className={styles.pill} style={{ background: 'var(--red)' }} />
                    FAILED
                  </div>
                  <div className={styles.value} style={{ color: 'var(--red)' }}>20</div>
                  <div className={styles.sub}>Needs fixes</div>
                </div>
              </div>

              <div className={`${styles.card} ${styles.col3}`}>
                <div className={styles.stat}>
                  <div className={styles.statLabel}>
                    <span className={styles.pill} style={{ background: 'var(--orange)' }} />
                    STALE QUEUE
                  </div>
                  <div className={styles.value} style={{ color: 'var(--orange)' }}>55</div>
                  <div className={styles.sub}>Updated &gt; 7 days</div>
                </div>
              </div>
            </div>
          </div>

          {/* Row 2: Triage */}
          <div className={styles.section}>
            <div className={styles.grid}>
              <div className={`${styles.card} ${styles.col4}`}>
                <h2>Needs attention now</h2>
                <div className={styles.triage}>
                  <div className={styles.triageRow}>
                    <div className={styles.triageBadge} style={{ background: 'var(--orange)' }}>!</div>
                    <div>
                      <strong>Stale PRs</strong>
                      <span>55 items &gt; 7 days → review/close first</span>
                    </div>
                  </div>

                  <div className={styles.triageRow}>
                    <div className={styles.triageBadge} style={{ background: 'var(--red)' }}>×</div>
                    <div>
                      <strong>Failed outcomes</strong>
                      <span>20 PRs → inspect by label next</span>
                    </div>
                  </div>

                  <div className={styles.triageRow}>
                    <div className={styles.triageBadge} style={{ background: 'var(--green)' }}>✓</div>
                    <div>
                      <strong>Approved flow</strong>
                      <span>34 approved → identify what works</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className={`${styles.card} ${styles.col8}`}>
                <h2>Aging Queue (default view)</h2>
                <div className={styles.chartMock} aria-hidden="true">Table/List goes here</div>
                <div className={styles.sub} style={{ marginTop: 10 }}>
                  In the final design, this area becomes the “Aging Queue” table (filterable &amp; sortable).
                </div>
              </div>
            </div>
          </div>

          {/* Row 3: Table */}
          <div className={styles.section}>
            <div className={styles.grid}>
              <div className={`${styles.card} ${styles.col12} ${styles.tableWrap}`}>
                <div className={styles.tableHead}>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 950 }}>Aging Queue</div>
                    <div className={styles.smallMuted}>Sorted by last updated (stale first)</div>
                  </div>
                  <div className={styles.tableControls} aria-label="Quick filters (mock)">
                    {(['All', 'Draft', 'Failed', 'Open'] as ChipFilter[]).map((chip) => (
                      <div
                        key={chip}
                        className={styles.chip}
                        aria-pressed={activeChip === chip}
                        role="button"
                        tabIndex={0}
                        onClick={() => setActiveChip(chip)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            setActiveChip(chip);
                          }
                        }}
                      >
                        {chip}
                      </div>
                    ))}
                  </div>
                </div>

                <div style={{ padding: '0 14px' }}>
                  <table ref={tableRef} className={styles.table} aria-label="Aging queue table mock">
                    <thead>
                      <tr>
                        <th style={{ minWidth: 160 }}>PR</th>
                        <th style={{ minWidth: 130 }}>Author</th>
                        <th style={{ minWidth: 120 }}>Status</th>
                        <th style={{ minWidth: 180 }}>Labels</th>
                        <th style={{ minWidth: 180 }}>Complexity</th>
                        <th style={{ minWidth: 140 }}>Last updated</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredRows.map((row) => (
                        <tr key={row.pr}>
                          <td>
                            <span style={{ fontWeight: 900 }}>{row.pr}</span>
                          </td>
                          <td>{row.author}</td>
                          <td>
                            <span className={`${styles.tag} ${statusClass[row.status]}`}>{row.status}</span>
                          </td>
                          <td>{row.labels}</td>
                          <td>
                            <div style={{ fontWeight: 900 }}>{row.complexity}</div>
                            <div className={styles.bar} aria-hidden="true">
                              <i
                                className={styles.barFill}
                                style={{
                                  width: `${row.barWidth}%`,
                                  background: row.barColor || undefined,
                                }}
                              />
                            </div>
                          </td>
                          <td>{row.updated}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>

          {/* Row 4: Breakdowns */}
          <div className={styles.section}>
            <div className={styles.grid}>
              <div className={`${styles.card} ${styles.col6}`}>
                <h2>Status distribution</h2>
                <div className={styles.chartMock} aria-hidden="true">Donut / stacked bars (mock)</div>
                <div className={styles.sub} style={{ marginTop: 10 }}>Counts: Open / In review / Approved / Draft</div>
              </div>

              <div className={`${styles.card} ${styles.col6}`}>
                <h2>Complexity spread</h2>
                <div className={styles.chartMock} aria-hidden="true">Histogram + buckets (mock)</div>
                <div className={styles.sub} style={{ marginTop: 10 }}>Show risk &amp; failed/draft rate by bucket</div>
              </div>
            </div>
          </div>

          {/* Row 5: Why it’s happening */}
          <div className={styles.section}>
            <div className={styles.grid}>
              <div className={`${styles.card} ${styles.col6}`}>
                <h2>PRs by person (Top N)</h2>
                <div className={styles.chartMock} aria-hidden="true">Bar list (Top 10) (mock)</div>
                <div className={styles.sub} style={{ marginTop: 10 }}>Sortable + “Show all”</div>
              </div>

              <div className={`${styles.card} ${styles.col6}`}>
                <h2>PRs by label (Top N)</h2>
                <div className={styles.chartMock} aria-hidden="true">Top labels (mock)</div>
                <div className={styles.sub} style={{ marginTop: 10 }}>Optionally display status mix per label</div>
              </div>
            </div>
          </div>

          {/* Footer next action */}
          <div className={styles.section}>
            <div className={`${styles.card} ${styles.nextAction}`} role="note" aria-label="Next action guidance">
              <div>
                <strong>Next action</strong>
                <div style={{ height: 4 }} />
                <span>
                  Start with the <b>&gt; 7 days</b> queue (55 items), then focus on labels contributing most to{' '}
                  <b>Draft/Failed</b>.
                </span>
              </div>
              <button className={styles.btn} type="button" onClick={scrollToQueue}>
                Go to Queue ↓
              </button>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
