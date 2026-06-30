import Link from 'next/link';
import dynamic from 'next/dynamic';
import TopNav from '@/components/TopNav';
import { getTranslations } from 'next-intl/server';

const WorkflowsCard = dynamic(() => import('@/components/WorkflowsCard'));

export default async function HomePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'home' });
  const ts = await getTranslations({ locale, namespace: 'components.statsbar' });
  const tf = await getTranslations({ locale, namespace: 'components.prfilter' });
  const tpr = await getTranslations({ locale, namespace: 'components.prtable' });
  const td = await getTranslations({ locale, namespace: 'dashboard' });
  const tw = await getTranslations({ locale, namespace: 'workflows' });

  return (
    <>
      <TopNav />
      <div className="min-h-screen" style={{ paddingTop: 56 }}>
        {/* Hero */}
        <section className="mx-auto grid min-h-[calc(100vh-56px)] max-w-[1280px] grid-cols-2 items-center gap-0 px-12 pb-20 pt-[60px] max-lg:grid-cols-1 max-lg:text-center">
          <div className="pr-12 max-lg:pr-0">
            <div className="mb-7 inline-flex items-center gap-2 rounded-full border border-cyan-mid bg-cyan-dim px-3.5 py-1 font-mono text-[11px] uppercase tracking-wider text-cyan animate-fade-up">
              <span className="h-1.5 w-1.5 rounded-full bg-cyan"></span> {t('heroBadge')}
            </div>
            <h1 className="mb-6 font-mono text-[clamp(36px,4vw,56px)] font-bold leading-tight tracking-tight text-text-primary animate-fade-up">
              {t('heroTitle')}
            </h1>
            <p className="mb-10 max-w-[480px] text-lg font-light leading-relaxed text-white/55 max-lg:mx-auto animate-fade-up">
              {t('heroDescription')}
            </p>
            <div className="mb-12 flex flex-wrap items-center gap-3.5 animate-fade-up">
              <Link href={`/${locale}/dashboard`}
                className="inline-flex items-center gap-1.5 rounded-full border-none bg-cyan px-7 py-3.5 font-mono text-[13px] font-bold text-ink-light no-underline transition-all duration-150 hover:-translate-y-px hover:opacity-90">
                {t('openDashboard')}
              </Link>
              <Link href={`/${locale}/demo`}
                className="inline-flex items-center gap-1.5 rounded-full border border-cyan/30 bg-cyan-dim px-6 py-3.5 font-mono text-[13px] font-medium text-cyan no-underline transition-all duration-150 hover:-translate-y-px hover:border-cyan/60 hover:bg-cyan-mid">
                {t('tryDemo')}
              </Link>
              <a className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-transparent px-6 py-3.5 text-sm text-white/60 no-underline transition-all duration-150 hover:border-white/35 hover:text-text-primary"
                href="https://github.com/0xC0DEM4M4N/review-radar" target="_blank" rel="noopener noreferrer">{t('viewOnGitHub')}</a>
            </div>
            <div className="flex gap-8 animate-fade-up">
              <div>
                <div className="font-mono text-2xl font-bold text-text-primary">∞</div>
                <div className="mt-0.5 text-xs text-white/40">{t('statRepos')}</div>
              </div>
              <div>
                <div className="font-mono text-2xl font-bold text-text-primary">0ms</div>
                <div className="mt-0.5 text-xs text-white/40">{t('statSetup')}</div>
              </div>
              <div>
                <div className="font-mono text-2xl font-bold text-text-primary">100%</div>
                <div className="mt-0.5 text-xs text-white/40">{t('statClientSide')}</div>
              </div>
            </div>
          </div>
          <div className="relative flex items-center justify-center animate-fade-up max-lg:hidden">
            <div className="relative h-[440px] w-[440px]">
              <img id="radarImg" className="h-full w-full" src="/assets/radar.svg" alt="Radar"
                style={{ filter: 'drop-shadow(0 0 30px rgba(34, 211, 238, 0.15))' }} />
            </div>
          </div>
        </section>

        {/* The ReviewRadar Advantage */}
        <section className="mx-auto max-w-[1280px] border-t border-white/[0.06] px-12 py-[100px] max-md:px-5 max-md:py-[60px]" id="features">
          <div className="mb-4 font-mono text-[11px] uppercase tracking-widest text-cyan">{t('advantageLabel')}</div>
          <h2 className="mb-[60px] max-w-[420px] font-mono text-4xl font-bold leading-tight tracking-tight text-text-primary">
            {t('advantageTitle')}
          </h2>
          <div className="grid grid-cols-3 gap-6 max-lg:grid-cols-2 max-md:grid-cols-1">
            {/* Selling 1 */}
            <div className="relative overflow-hidden rounded-2xl border border-border-faint bg-surface p-7 transition-all duration-200 hover:border-cyan/20 hover:bg-cyan/[0.03]">
              <div className="absolute left-0 top-0 h-full w-[2px] bg-cyan/60"></div>
              <div className="mb-[18px] flex h-10 w-10 items-center justify-center rounded-[10px] border border-cyan-mid bg-cyan-dim">
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                  <circle cx="10" cy="10" r="7" stroke="#22d3ee" strokeWidth="1.4" />
                  <path d="M10 6 L10 10 L13 12" stroke="#22d3ee" strokeWidth="1.4" strokeLinecap="round" />
                </svg>
              </div>
              <h3 className="mb-2.5 font-mono text-sm font-bold text-text-primary">{t('selling1Title')}</h3>
              <p className="text-sm leading-relaxed text-white/45">{t('selling1Desc')}</p>
            </div>
            {/* Selling 2 */}
            <div className="relative overflow-hidden rounded-2xl border border-border-faint bg-surface p-7 transition-all duration-200 hover:border-cyan/20 hover:bg-cyan/[0.03]">
              <div className="absolute left-0 top-0 h-full w-[2px] bg-cyan/60"></div>
              <div className="mb-[18px] flex h-10 w-10 items-center justify-center rounded-[10px] border border-cyan-mid bg-cyan-dim">
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                  <rect x="3" y="7" width="14" height="10" rx="2" fill="none" stroke="#22d3ee" strokeWidth="1.4" />
                  <path d="M6 7V5a4 4 0 0 1 8 0v2" fill="none" stroke="#22d3ee" strokeWidth="1.4" />
                </svg>
              </div>
              <h3 className="mb-2.5 font-mono text-sm font-bold text-text-primary">{t('selling2Title')}</h3>
              <p className="text-sm leading-relaxed text-white/45">{t('selling2Desc')}</p>
            </div>
            {/* Selling 3 */}
            <div className="relative overflow-hidden rounded-2xl border border-border-faint bg-surface p-7 transition-all duration-200 hover:border-cyan/20 hover:bg-cyan/[0.03]">
              <div className="absolute left-0 top-0 h-full w-[2px] bg-cyan/60"></div>
              <div className="mb-[18px] flex h-10 w-10 items-center justify-center rounded-[10px] border border-cyan-mid bg-cyan-dim">
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                  <circle cx="7" cy="7" r="2.5" fill="none" stroke="#22d3ee" strokeWidth="1.4" />
                  <circle cx="13" cy="7" r="2.5" fill="none" stroke="#22d3ee" strokeWidth="1.4" />
                  <circle cx="7" cy="13" r="2.5" fill="none" stroke="#22d3ee" strokeWidth="1.4" />
                  <circle cx="13" cy="13" r="2.5" fill="none" stroke="#22d3ee" strokeWidth="1.4" />
                  <line x1="7" y1="9.5" x2="7" y2="10.5" stroke="#22d3ee" strokeWidth="1" />
                  <line x1="13" y1="9.5" x2="13" y2="10.5" stroke="#22d3ee" strokeWidth="1" />
                  <line x1="9.5" y1="7" x2="10.5" y2="7" stroke="#22d3ee" strokeWidth="1" />
                  <line x1="9.5" y1="13" x2="10.5" y2="13" stroke="#22d3ee" strokeWidth="1" />
                </svg>
              </div>
              <h3 className="mb-2.5 font-mono text-sm font-bold text-text-primary">{t('selling3Title')}</h3>
              <p className="text-sm leading-relaxed text-white/45">{t('selling3Desc')}</p>
            </div>
            {/* Selling 4 */}
            <div className="relative overflow-hidden rounded-2xl border border-border-faint bg-surface p-7 transition-all duration-200 hover:border-cyan/20 hover:bg-cyan/[0.03]">
              <div className="absolute left-0 top-0 h-full w-[2px] bg-cyan/60"></div>
              <div className="mb-[18px] flex h-10 w-10 items-center justify-center rounded-[10px] border border-cyan-mid bg-cyan-dim">
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                  <circle cx="6" cy="5" r="2.5" fill="none" stroke="#22d3ee" strokeWidth="1.4" />
                  <circle cx="6" cy="15" r="2.5" fill="none" stroke="#22d3ee" strokeWidth="1.4" />
                  <circle cx="14" cy="5" r="2.5" fill="#22d3ee" />
                  <line x1="6" y1="7.5" x2="6" y2="12.5" stroke="#22d3ee" strokeWidth="1.4" strokeLinecap="round" />
                </svg>
              </div>
              <h3 className="mb-2.5 font-mono text-sm font-bold text-text-primary">{t('selling4Title')}</h3>
              <p className="text-sm leading-relaxed text-white/45">{t('selling4Desc')}</p>
            </div>
            {/* Selling 5 */}
            <div className="relative overflow-hidden rounded-2xl border border-border-faint bg-surface p-7 transition-all duration-200 hover:border-cyan/20 hover:bg-cyan/[0.03]">
              <div className="absolute left-0 top-0 h-full w-[2px] bg-cyan/60"></div>
              <div className="mb-[18px] flex h-10 w-10 items-center justify-center rounded-[10px] border border-cyan-mid bg-cyan-dim">
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                  <rect x="2.5" y="4" width="5" height="12" rx="1.5" fill="none" stroke="#22d3ee" strokeWidth="1.4" />
                  <rect x="8.5" y="7" width="4" height="9" rx="1.5" fill="none" stroke="#22d3ee" strokeWidth="1.4" opacity="0.5" />
                  <rect x="14" y="5" width="3.5" height="11" rx="1.5" fill="none" stroke="#22d3ee" strokeWidth="1.4" opacity="0.3" />
                </svg>
              </div>
              <h3 className="mb-2.5 font-mono text-sm font-bold text-text-primary">{t('selling5Title')}</h3>
              <p className="text-sm leading-relaxed text-white/45">{t('selling5Desc')}</p>
            </div>
            {/* Selling 6 */}
            <div className="relative overflow-hidden rounded-2xl border border-border-faint bg-surface p-7 transition-all duration-200 hover:border-cyan/20 hover:bg-cyan/[0.03]">
              <div className="absolute left-0 top-0 h-full w-[2px] bg-cyan/60"></div>
              <div className="mb-[18px] flex h-10 w-10 items-center justify-center rounded-[10px] border border-cyan-mid bg-cyan-dim">
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                  <circle cx="10" cy="10" r="7" stroke="#22d3ee" strokeWidth="1.5" strokeOpacity="0.5" />
                  <circle cx="10" cy="10" r="3.5" stroke="#22d3ee" strokeWidth="1.5" />
                  <line x1="10" y1="1" x2="10" y2="3.5" stroke="#22d3ee" strokeWidth="1.2" strokeLinecap="round" />
                  <line x1="10" y1="16.5" x2="10" y2="19" stroke="#22d3ee" strokeWidth="1.2" strokeLinecap="round" />
                  <line x1="1" y1="10" x2="3.5" y2="10" stroke="#22d3ee" strokeWidth="1.2" strokeLinecap="round" />
                  <line x1="16.5" y1="10" x2="19" y2="10" stroke="#22d3ee" strokeWidth="1.2" strokeLinecap="round" />
                </svg>
              </div>
              <h3 className="mb-2.5 font-mono text-sm font-bold text-text-primary">{t('selling6Title')}</h3>
              <p className="text-sm leading-relaxed text-white/45">{t('selling6Desc')}</p>
            </div>
          </div>
        </section>

        {/* Six Scenarios. One Dashboard. */}
        <section className="mx-auto max-w-[1280px] border-t border-white/[0.06] px-12 py-[100px] max-md:px-5 max-md:py-[60px]">
          <div className="mb-4 font-mono text-[11px] uppercase tracking-widest text-cyan">{t('problemsLabel')}</div>
          <h2 className="mb-[60px] max-w-[560px] font-mono text-4xl font-bold leading-tight tracking-tight text-text-primary">
            {t('problemsTitle')}
          </h2>
          <div className="grid grid-cols-3 gap-6 max-lg:grid-cols-1">
            {/* Problem 1 */}
            <div className="rounded-2xl border border-border-faint bg-ink-light/40 p-7">
              <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-[10px] border border-red/20 bg-red/10">
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                  <path d="M10 2 L12 7 L17 7 L13 10.5 L14.5 16 L10 12.5 L5.5 16 L7 10.5 L3 7 L8 7 Z" fill="none" stroke="#ef4444" strokeWidth="1.4" strokeLinejoin="round" />
                </svg>
              </div>
              <h3 className="mb-3 font-mono text-sm font-bold text-text-primary">{t('problem1Title')}</h3>
              <p className="text-sm leading-relaxed text-white/40">{t('problem1Desc')}</p>
            </div>
            {/* Problem 2 */}
            <div className="rounded-2xl border border-border-faint bg-ink-light/40 p-7">
              <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-[10px] border border-cyan/20 bg-cyan/10">
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                  <circle cx="9" cy="9" r="6" fill="none" stroke="#22d3ee" strokeWidth="1.4" />
                  <line x1="14" y1="14" x2="18" y2="18" stroke="#22d3ee" strokeWidth="1.4" strokeLinecap="round" />
                  <line x1="6" y1="9" x2="12" y2="9" stroke="#22d3ee" strokeWidth="1.4" strokeLinecap="round" />
                </svg>
              </div>
              <h3 className="mb-3 font-mono text-sm font-bold text-text-primary">{t('problem2Title')}</h3>
              <p className="text-sm leading-relaxed text-white/40">{t('problem2Desc')}</p>
            </div>
            {/* Problem 3 */}
            <div className="rounded-2xl border border-border-faint bg-ink-light/40 p-7">
              <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-[10px] border border-amber/20 bg-amber/10">
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                  <rect x="3" y="3" width="14" height="14" rx="2" fill="none" stroke="#f59e0b" strokeWidth="1.4" />
                  <line x1="3" y1="8" x2="17" y2="8" stroke="#f59e0b" strokeWidth="1.4" />
                  <line x1="8" y1="3" x2="8" y2="8" stroke="#f59e0b" strokeWidth="1.4" />
                  <line x1="12" y1="3" x2="12" y2="8" stroke="#f59e0b" strokeWidth="1.4" opacity="0.4" />
                </svg>
              </div>
              <h3 className="mb-3 font-mono text-sm font-bold text-text-primary">{t('problem3Title')}</h3>
              <p className="text-sm leading-relaxed text-white/40">{t('problem3Desc')}</p>
            </div>
            {/* Problem 4 */}
            <div className="rounded-2xl border border-border-faint bg-ink-light/40 p-7">
              <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-[10px] border border-purple/20 bg-purple/10">
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                  <path d="M4 4 L16 16 M16 4 L4 16" stroke="#8b5cf6" strokeWidth="1.4" strokeLinecap="round" />
                  <circle cx="10" cy="10" r="8" fill="none" stroke="#8b5cf6" strokeWidth="1.4" />
                </svg>
              </div>
              <h3 className="mb-3 font-mono text-sm font-bold text-text-primary">{t('problem4Title')}</h3>
              <p className="text-sm leading-relaxed text-white/40">{t('problem4Desc')}</p>
            </div>
            {/* Problem 5 */}
            <div className="rounded-2xl border border-border-faint bg-ink-light/40 p-7">
              <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-[10px] border border-green/20 bg-green/10">
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                  <polyline points="4,10 8,14 16,6" fill="none" stroke="#22c55e" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              <h3 className="mb-3 font-mono text-sm font-bold text-text-primary">{t('problem5Title')}</h3>
              <p className="text-sm leading-relaxed text-white/40">{t('problem5Desc')}</p>
            </div>
            {/* Problem 6 */}
            <div className="rounded-2xl border border-border-faint bg-ink-light/40 p-7">
              <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-[10px] border border-cyan/20 bg-cyan/10">
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                  <path d="M15 8 C15 12 12 15 10 15 L7 17 L8 15 C5 14 4 11 4 8 C4 5 7 3 10 3 C13 3 15 5 15 8 Z" fill="none" stroke="#22d3ee" strokeWidth="1.4" />
                </svg>
              </div>
              <h3 className="mb-3 font-mono text-sm font-bold text-text-primary">{t('problem6Title')}</h3>
              <p className="text-sm leading-relaxed text-white/40">{t('problem6Desc')}</p>
            </div>
          </div>
        </section>

        {/* Demo table */}
        <section className="mx-auto max-w-[1280px] px-12 pb-[100px] max-md:px-5 max-md:pb-[60px]">
          <div className="mb-4 font-mono text-[11px] uppercase tracking-widest text-cyan">{t('demoLabel')}</div>
          <h2 className="mb-10 font-mono text-4xl font-bold tracking-tight text-text-primary">{t('demoTitle')}</h2>
          <div className="overflow-hidden rounded-2xl border border-border-faint bg-surface">
            <div className="flex items-center gap-2 border-b border-white/[0.06] bg-ink-light/50 px-5 py-3.5">
              <span className="h-2.5 w-2.5 rounded-full bg-red"></span>
              <span className="h-2.5 w-2.5 rounded-full bg-amber"></span>
              <span className="h-2.5 w-2.5 rounded-full bg-green"></span>
              <span className="flex-1 text-center font-mono text-[11px] text-white/25">{t('demoWindowTitle')}</span>
            </div>
            <div className="p-4">
              <div className="rr-stats mb-4">
                <div className="rr-stat active">
                  <div className="rr-stat-label">{ts('totalPRs')}</div>
                  <div className="rr-stat-val" style={{ color: 'var(--cyan)' }}>12</div>
                </div>
                <div className="rr-stat">
                  <div className="rr-stat-label">{ts('mine')}</div>
                  <div className="rr-stat-val" style={{ color: 'var(--cyan)' }}>3</div>
                </div>
                <div className="rr-stat">
                  <div className="rr-stat-label">{ts('needsAttention')}</div>
                  <div className="rr-stat-val" style={{ color: 'var(--amber)' }}>4</div>
                </div>
                <div className="rr-stat">
                  <div className="rr-stat-label">{ts('approved')}</div>
                  <div className="rr-stat-val" style={{ color: 'var(--green)' }}>2</div>
                </div>
                <div className="rr-stat">
                  <div className="rr-stat-label">{ts('blocked')}</div>
                  <div className="rr-stat-val" style={{ color: 'var(--red)' }}>3</div>
            </div>
            </div>
          </div>
              <div className="flex items-center gap-3 mb-4 flex-wrap">
                <button className="rr-filter-toggle">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
                  </svg>
                  <span>{tf('filter')}</span>
                  <span className="rr-filter-badge">2</span>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                </button>
                <button className="rr-filter-field-btn">
                  <span>{tf('users')}</span>
                  <span style={{ color: 'var(--muted)' }}>{tf('selectedUsers', { count: 3 })}</span>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                </button>
                <div style={{ flex: 1, minWidth: 200 }}>
                  <div style={{ position: 'relative' }}>
                    <input type="text" placeholder={tf('ticketPlaceholder')} className="rr-filter-text-input" style={{ width: '100%', maxWidth: 280 }} readOnly />
                  </div>
                </div>
                <span className="rr-pill active">
                  {td('filterPillStatus', { status: tpr('status.awaitingApproval') })}
                  <span className="rr-filter-pill-close">{td('filterPillClose')}</span>
                </span>
              </div>
              <div className="rr-table-wrap" style={{ overflowX: 'auto' }}>
                <table style={{ minWidth: 980 }}>
                  <thead>
                    <tr>
                      <th className="sortable" style={{ minWidth: 200 }}>{t('demoColPR')}</th>
                      <th className="sortable rr-col-narrow" style={{ width: 45 }}>{t('demoColAuthor')}</th>
                      <th className="sortable rr-col-narrow" style={{ width: 100 }}>{t('demoColStatus')}</th>
                      <th className="sortable rr-col-narrow" style={{ width: 45 }}>{t('demoColMyAction')}</th>
                      <th className="sortable rr-col-narrow" style={{ width: 75 }}>{t('demoColApprovals')}</th>
                      <th className="sortable rr-col-narrow" style={{ width: 130 }}>{t('demoColLabels')}</th>
                      <th className="sortable" style={{ width: 70 }}>{t('demoColBuild')}</th>
                      <th className="sortable rr-col-narrow" style={{ width: 55 }}>{t('demoColFiles')}</th>
                      <th className="sortable rr-col-narrow" style={{ width: 90 }}>{t('demoColSize')}</th>
                      <th className="sortable rr-col-narrow" style={{ width: 80 }}>{t('demoColComplexity')}</th>
                      <th className="sortable rr-col-narrow" style={{ width: 60 }}>{t('demoColUpdated')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="repo-bg-0">
                      <td style={{ padding: '11px 12px', verticalAlign: 'middle' }}>
                        <div>
                          <span className="rr-pr-title">feat: add real-time PR webhook listener</span>
                          <div className="rr-pr-repo"><span className="rr-radar-blip-sm repo-color-0" />hmr0001 / review-radar</div>
                        </div>
                      </td>
                      <td className="rr-col-narrow" style={{ verticalAlign: 'middle' }}>
                        <span className="rr-avatar" style={{ background: '#0e7490' }}>HR</span>
                      </td>
                      <td className="rr-col-narrow" style={{ verticalAlign: 'middle' }}>
                        <span className="rr-badge rr-badge-review">{tpr('status.awaitingApproval')}</span>
                      </td>
                      <td className="rr-col-narrow" style={{ verticalAlign: 'middle', fontSize: 16, textAlign: 'center' }}>
                        <span title="You approved">
                          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="var(--green)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 8L6.5 11.5L13 4.5" /></svg>
                        </span>
                      </td>
                      <td className="rr-col-narrow" style={{ verticalAlign: 'middle', textAlign: 'center' }}>
                        <span className="rr-reviews">1</span>
                      </td>
                      <td className="rr-col-narrow" style={{ verticalAlign: 'middle' }}>
                        <span className="inline-block rounded px-2 py-[3px] text-[10px] font-medium mr-1 mb-0.5 border border-border-faint" style={{ backgroundColor: '#a855f733', borderColor: '#a855f744' }}>
                          <span className="rr-label-text">enhancement</span>
                        </span>
                      </td>
                      <td style={{ padding: '11px 12px', verticalAlign: 'middle' }}>
                        <span className="rr-build-ok">{tpr('build.pass')}</span>
                      </td>
                      <td className="rr-col-narrow" style={{ verticalAlign: 'middle', textAlign: 'center', fontSize: 12, fontFamily: "'Space Mono', monospace" }}>8</td>
                      <td className="rr-col-narrow" style={{ verticalAlign: 'middle', textAlign: 'center', fontSize: 11, fontFamily: "'Space Mono', monospace", whiteSpace: 'nowrap' }}>+124 / -18</td>
                      <td className="rr-col-narrow" style={{ verticalAlign: 'middle', textAlign: 'center' }}>
                        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--cyan)', fontFamily: "'Space Mono', monospace" }}>42</span>
                      </td>
                      <td className="rr-age" style={{ verticalAlign: 'middle', textAlign: 'center' }}>
                        <div style={{ lineHeight: 1.3 }}><div>12m</div></div>
                      </td>
                    </tr>
                    <tr className="repo-bg-1">
                      <td style={{ padding: '11px 12px', verticalAlign: 'middle' }}>
                        <div>
                          <span className="rr-pr-title">fix: token expiry not refreshing on 401</span>
                          <div className="rr-pr-repo"><span className="rr-radar-blip-sm repo-color-1" />hmr0001 / api-gateway</div>
                        </div>
                      </td>
                      <td className="rr-col-narrow" style={{ verticalAlign: 'middle' }}>
                        <span className="rr-avatar" style={{ background: '#7c3aed' }}>SD</span>
                      </td>
                      <td className="rr-col-narrow" style={{ verticalAlign: 'middle' }}>
                        <span className="rr-badge rr-badge-approved">{tpr('status.approved')}</span>
                      </td>
                      <td className="rr-col-narrow" style={{ verticalAlign: 'middle', fontSize: 16, textAlign: 'center' }}></td>
                      <td className="rr-col-narrow" style={{ verticalAlign: 'middle', textAlign: 'center' }}>
                        <span className="rr-reviews">2</span>
                      </td>
                      <td className="rr-col-narrow" style={{ verticalAlign: 'middle' }}>
                        <span className="inline-block rounded px-2 py-[3px] text-[10px] font-medium mr-1 mb-0.5 border border-border-faint" style={{ backgroundColor: '#ef444433', borderColor: '#ef444444' }}>
                          <span className="rr-label-text">bugfix</span>
                        </span>
                      </td>
                      <td style={{ padding: '11px 12px', verticalAlign: 'middle' }}>
                        <span className="rr-build-ok">{tpr('build.pass')}</span>
                      </td>
                      <td className="rr-col-narrow" style={{ verticalAlign: 'middle', textAlign: 'center', fontSize: 12, fontFamily: "'Space Mono', monospace" }}>3</td>
                      <td className="rr-col-narrow" style={{ verticalAlign: 'middle', textAlign: 'center', fontSize: 11, fontFamily: "'Space Mono', monospace", whiteSpace: 'nowrap' }}>+45 / -12</td>
                      <td className="rr-col-narrow" style={{ verticalAlign: 'middle', textAlign: 'center' }}>
                        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--green)', fontFamily: "'Space Mono', monospace" }}>18</span>
                      </td>
                      <td className="rr-age" style={{ verticalAlign: 'middle', textAlign: 'center' }}>
                        <div style={{ lineHeight: 1.3 }}><div>34m</div></div>
                      </td>
                    </tr>
                    <tr className="repo-bg-2">
                      <td style={{ padding: '11px 12px', verticalAlign: 'middle' }}>
                        <div>
                          <span className="rr-pr-title">chore: upgrade to Node 22 LTS</span>
                          <div className="rr-pr-repo"><span className="rr-radar-blip-sm repo-color-2" />hmr0001 / workers-deploy</div>
                        </div>
                      </td>
                      <td className="rr-col-narrow" style={{ verticalAlign: 'middle' }}>
                        <span className="rr-avatar" style={{ background: '#b45309' }}>JK</span>
                      </td>
                      <td className="rr-col-narrow" style={{ verticalAlign: 'middle' }}>
                        <span className="rr-badge rr-badge-blocked">{tpr('status.changesRequested')}</span>
                      </td>
                      <td className="rr-col-narrow" style={{ verticalAlign: 'middle', fontSize: 16, textAlign: 'center' }}>
                        <span title="You requested changes">
                          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="var(--amber)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M13 8H3M3 8L7 4M3 8L7 12" /></svg>
                        </span>
                      </td>
                      <td className="rr-col-narrow" style={{ verticalAlign: 'middle', textAlign: 'center' }}>
                        <span className="rr-build-na">—</span>
                      </td>
                      <td className="rr-col-narrow" style={{ verticalAlign: 'middle' }}>
                        <span className="inline-block rounded px-2 py-[3px] text-[10px] font-medium mr-1 mb-0.5 border border-border-faint" style={{ backgroundColor: '#0366d633', borderColor: '#0366d644' }}>
                          <span className="rr-label-text">dependencies</span>
                        </span>
                      </td>
                      <td style={{ padding: '11px 12px', verticalAlign: 'middle' }}>
                        <span className="rr-build-fail">{tpr('build.fail')}</span>
                      </td>
                      <td className="rr-col-narrow" style={{ verticalAlign: 'middle', textAlign: 'center', fontSize: 12, fontFamily: "'Space Mono', monospace" }}>56</td>
                      <td className="rr-col-narrow" style={{ verticalAlign: 'middle', textAlign: 'center', fontSize: 11, fontFamily: "'Space Mono', monospace", whiteSpace: 'nowrap' }}>+2,847 / -198</td>
                      <td className="rr-col-narrow" style={{ verticalAlign: 'middle', textAlign: 'center' }}>
                        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--red)', fontFamily: "'Space Mono', monospace" }}>73</span>
                      </td>
                      <td className="rr-age" style={{ verticalAlign: 'middle', textAlign: 'center' }}>
                        <div style={{ lineHeight: 1.3 }}><div>1h</div></div>
                      </td>
                    </tr>
                    <tr className="owned-pr repo-bg-0">
                      <td style={{ padding: '11px 12px', verticalAlign: 'middle' }}>
                        <div>
                          <span className="rr-pr-title">feat: dashboard dark mode toggle</span>
                          <div className="rr-pr-repo"><span className="rr-radar-blip-sm repo-color-0" />hmr0001 / review-radar</div>
                        </div>
                      </td>
                      <td className="rr-col-narrow" style={{ verticalAlign: 'middle' }}>
                        <span className="rr-avatar" style={{ background: '#0e7490' }}>HR</span>
                      </td>
                      <td className="rr-col-narrow" style={{ verticalAlign: 'middle' }}>
                        <span className="rr-badge rr-badge-open">{tpr('status.open')}</span>
                      </td>
                      <td className="rr-col-narrow" style={{ verticalAlign: 'middle', fontSize: 16, textAlign: 'center' }}></td>
                      <td className="rr-col-narrow" style={{ verticalAlign: 'middle', textAlign: 'center' }}>
                        <span className="rr-build-na">—</span>
                      </td>
                      <td className="rr-col-narrow" style={{ verticalAlign: 'middle' }}>
                        <span className="inline-block rounded px-2 py-[3px] text-[10px] font-medium mr-1 mb-0.5 border border-border-faint" style={{ backgroundColor: '#22d3ee33', borderColor: '#22d3ee44' }}>
                          <span className="rr-label-text">feature</span>
                        </span>
                      </td>
                      <td style={{ padding: '11px 12px', verticalAlign: 'middle' }}>
                        <span className="rr-build-run">{tpr('build.running')}</span>
                      </td>
                      <td className="rr-col-narrow" style={{ verticalAlign: 'middle', textAlign: 'center', fontSize: 12, fontFamily: "'Space Mono', monospace" }}>14</td>
                      <td className="rr-col-narrow" style={{ verticalAlign: 'middle', textAlign: 'center', fontSize: 11, fontFamily: "'Space Mono', monospace", whiteSpace: 'nowrap' }}>+312 / -84</td>
                      <td className="rr-col-narrow" style={{ verticalAlign: 'middle', textAlign: 'center' }}>
                        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--amber)', fontFamily: "'Space Mono', monospace" }}>55</span>
                      </td>
                      <td className="rr-age" style={{ verticalAlign: 'middle', textAlign: 'center' }}>
                        <div style={{ lineHeight: 1.3 }}><div>2h</div></div>
                      </td>
                    </tr>
                    <tr className="repo-bg-3">
                      <td style={{ padding: '11px 12px', verticalAlign: 'middle' }}>
                        <div>
                          <span className="rr-pr-title">refactor: extract shared Button component</span>
                          <div className="rr-pr-repo"><span className="rr-radar-blip-sm repo-color-3" />acme-corp / ui-kit</div>
                        </div>
                      </td>
                      <td className="rr-col-narrow" style={{ verticalAlign: 'middle' }}>
                        <span className="rr-avatar" style={{ background: '#0f766e' }}>AL</span>
                      </td>
                      <td className="rr-col-narrow" style={{ verticalAlign: 'middle' }}>
                        <span className="rr-badge rr-badge-draft">{tpr('status.draft')}</span>
                      </td>
                      <td className="rr-col-narrow" style={{ verticalAlign: 'middle', fontSize: 16, textAlign: 'center' }}></td>
                      <td className="rr-col-narrow" style={{ verticalAlign: 'middle', textAlign: 'center' }}>
                        <span className="rr-build-na">—</span>
                      </td>
                      <td className="rr-col-narrow" style={{ verticalAlign: 'middle' }}>
                        <span className="rr-build-na">—</span>
                      </td>
                      <td style={{ padding: '11px 12px', verticalAlign: 'middle' }}>
                        <span className="rr-build-na">{tpr('build.na')}</span>
                      </td>
                      <td className="rr-col-narrow" style={{ verticalAlign: 'middle', textAlign: 'center', fontSize: 12, fontFamily: "'Space Mono', monospace" }}>2</td>
                      <td className="rr-col-narrow" style={{ verticalAlign: 'middle', textAlign: 'center', fontSize: 11, fontFamily: "'Space Mono', monospace", whiteSpace: 'nowrap' }}>+12 / -4</td>
                      <td className="rr-col-narrow" style={{ verticalAlign: 'middle', textAlign: 'center' }}>
                        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted-dim)', fontFamily: "'Space Mono', monospace" }}>8</span>
                      </td>
                      <td className="rr-age" style={{ verticalAlign: 'middle', textAlign: 'center' }}>
                        <div style={{ lineHeight: 1.3 }}><div>3h</div></div>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
          </div>
        </section>

        {/* Workflows Card */}
        <section className="mx-auto max-w-[1280px] px-12 pb-[100px] max-md:px-5 max-md:pb-[60px]">
          <div className="mx-auto max-w-2xl">
            <WorkflowsCard />
          </div>
        </section>

        {/* All Features */}
        <section className="mx-auto max-w-[1280px] border-t border-white/[0.06] px-12 py-[100px] max-md:px-5 max-md:py-[60px]">
          <div className="mb-4 font-mono text-[11px] uppercase tracking-widest text-cyan">{t('allFeaturesLabel')}</div>
          <h2 className="mb-[60px] max-w-[500px] font-mono text-4xl font-bold leading-tight tracking-tight text-text-primary">
            {t('allFeaturesTitle')}
          </h2>
          <div className="grid grid-cols-3 gap-6 max-lg:grid-cols-2 max-md:grid-cols-1">
            <div className="rounded-2xl border border-border-faint bg-surface p-7 transition-all duration-200 hover:border-cyan/20 hover:bg-cyan/[0.03]">
              <div className="mb-[18px] flex h-10 w-10 items-center justify-center rounded-[10px] border border-cyan-mid bg-cyan-dim">
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                  <rect x="3" y="3" width="14" height="14" rx="3" fill="none" stroke="#22d3ee" strokeWidth="1.4" />
                  <line x1="6" y1="8" x2="9" y2="8" stroke="#22c55e" strokeWidth="1.4" strokeLinecap="round" />
                  <line x1="11" y1="8" x2="14" y2="8" stroke="#22d3ee" strokeWidth="1.4" strokeLinecap="round" opacity="0.35" />
                  <line x1="6" y1="11" x2="14" y2="11" stroke="#22d3ee" strokeWidth="1.4" strokeLinecap="round" opacity="0.2" />
                  <line x1="6" y1="14" x2="10" y2="14" stroke="#ef4444" strokeWidth="1.4" strokeLinecap="round" />
                </svg>
              </div>
              <h3 className="mb-2.5 font-mono text-sm font-bold text-text-primary">{t('feature3Title')}</h3>
              <p className="text-sm leading-relaxed text-white/45">{t('feature3Desc')}</p>
            </div>
            <div className="rounded-2xl border border-border-faint bg-surface p-7 transition-all duration-200 hover:border-cyan/20 hover:bg-cyan/[0.03]">
              <div className="mb-[18px] flex h-10 w-10 items-center justify-center rounded-[10px] border border-cyan-mid bg-cyan-dim">
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                  <path d="M10 2 L12.5 7.5 L18 8.2 L14 12 L15 17.5 L10 14.8 L5 17.5 L6 12 L2 8.2 L7.5 7.5 Z" fill="none"
                    stroke="#22d3ee" strokeWidth="1.4" strokeLinejoin="round" />
                </svg>
              </div>
              <h3 className="mb-2.5 font-mono text-sm font-bold text-text-primary">{t('feature4Title')}</h3>
              <p className="text-sm leading-relaxed text-white/45">{t('feature4Desc')}</p>
            </div>
            <div className="rounded-2xl border border-border-faint bg-surface p-7 transition-all duration-200 hover:border-cyan/20 hover:bg-cyan/[0.03]">
              <div className="mb-[18px] flex h-10 w-10 items-center justify-center rounded-[10px] border border-cyan-mid bg-cyan-dim">
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                  <rect x="2" y="4" width="16" height="12" rx="2.5" fill="none" stroke="#22d3ee" strokeWidth="1.4" />
                  <line x1="2" y1="8" x2="18" y2="8" stroke="#22d3ee" strokeWidth="1" strokeOpacity="0.4" />
                  <circle cx="5" cy="6" r="1" fill="#22d3ee" opacity="0.5" />
                  <circle cx="8.5" cy="6" r="1" fill="#22d3ee" opacity="0.3" />
                </svg>
              </div>
              <h3 className="mb-2.5 font-mono text-sm font-bold text-text-primary">{t('feature5Title')}</h3>
              <p className="text-sm leading-relaxed text-white/45">{t('feature5Desc')}</p>
            </div>
            <div className="rounded-2xl border border-border-faint bg-surface p-7 transition-all duration-200 hover:border-cyan/20 hover:bg-cyan/[0.03]">
              <div className="mb-[18px] flex h-10 w-10 items-center justify-center rounded-[10px] border border-cyan-mid bg-cyan-dim">
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                  <polyline points="3,14 7,9 11,12 17,5" fill="none" stroke="#22d3ee" strokeWidth="1.5"
                    strokeLinecap="round" strokeLinejoin="round" />
                  <circle cx="17" cy="5" r="2" fill="#22d3ee" />
                </svg>
              </div>
              <h3 className="mb-2.5 font-mono text-sm font-bold text-text-primary">{t('feature6Title')}</h3>
              <p className="text-sm leading-relaxed text-white/45">{t('feature6Desc')}</p>
            </div>
            <div className="rounded-2xl border border-border-faint bg-surface p-7 transition-all duration-200 hover:border-cyan/20 hover:bg-cyan/[0.03]">
              <div className="mb-[18px] flex h-10 w-10 items-center justify-center rounded-[10px] border border-cyan-mid bg-cyan-dim">
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                  <circle cx="10" cy="10" r="7" fill="none" stroke="#22d3ee" strokeWidth="1.4" />
                  <ellipse cx="10" cy="10" rx="3" ry="7" fill="none" stroke="#22d3ee" strokeWidth="1.2" />
                  <path d="M3.5 10 H16.5" stroke="#22d3ee" strokeWidth="1.2" />
                  <path d="M4.5 6.5 Q10 5.5 15.5 6.5" fill="none" stroke="#22d3ee" strokeWidth="1.2" />
                  <path d="M4.5 13.5 Q10 14.5 15.5 13.5" fill="none" stroke="#22d3ee" strokeWidth="1.2" />
                </svg>
              </div>
              <h3 className="mb-2.5 font-mono text-sm font-bold text-text-primary">{t('feature9Title')}</h3>
              <p className="text-sm leading-relaxed text-white/45">{t('feature9Desc')}</p>
            </div>
          </div>
        </section>

        {/* How it works */}
        <section className="mx-auto max-w-[1280px] border-t border-white/[0.06] px-12 py-[100px] max-md:px-5 max-md:py-[60px]" id="how-it-works">
          <h2 className="mb-4 font-mono text-4xl font-bold tracking-tight text-text-primary">{t('howItWorksTitle')}</h2>
          <p className="mb-12 text-lg text-white/45">{t('howItWorksSubtitle')}</p>
          <div className="flex max-w-[700px] flex-col gap-8">
            <div className="flex items-start gap-5">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-cyan-mid bg-cyan-dim font-mono text-base font-bold text-cyan">
                1</div>
              <div>
                <h3 className="mb-1.5 font-mono text-base font-bold text-text-primary">{t('step1Title')}</h3>
                <p className="text-sm leading-relaxed text-white/45">
                  {t.rich('step1Description', {
                    githubLink: (chunks) => <a className="text-cyan no-underline hover:underline" href="https://github.com/settings/tokens/new" target="_blank" rel="noopener noreferrer">{chunks}</a>,
                    codeRepo: (chunks) => <code className="rounded bg-white/[0.06] px-1.5 py-0.5 font-mono text-xs text-cyan">{chunks}</code>,
                    codePublicRepo: (chunks) => <code className="rounded bg-white/[0.06] px-1.5 py-0.5 font-mono text-xs text-cyan">{chunks}</code>,
                  })}
                </p>
              </div>
            </div>
            <div className="flex items-start gap-5">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-cyan-mid bg-cyan-dim font-mono text-base font-bold text-cyan">
                2</div>
              <div>
                <h3 className="mb-1.5 font-mono text-base font-bold text-text-primary">{t('step2Title')}</h3>
                <p className="text-sm leading-relaxed text-white/45">{t('step2Description')}</p>
              </div>
            </div>
            <div className="flex items-start gap-5">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-cyan-mid bg-cyan-dim font-mono text-base font-bold text-cyan">
                3</div>
              <div>
                <h3 className="mb-1.5 font-mono text-base font-bold text-text-primary">{t('step3Title')}</h3>
                <p className="text-sm leading-relaxed text-white/45">{t('step3Description')}</p>
              </div>
            </div>
          </div>
          <div className="mt-10 text-center">
            <Link href={`/${locale}/dashboard`}
              className="inline-flex items-center gap-1.5 rounded-full border-none bg-cyan px-7 py-3.5 font-mono text-[13px] font-bold text-ink-light no-underline transition-all duration-150 hover:-translate-y-px hover:opacity-90">
              {t('stepCTA')}
            </Link>
          </div>
        </section>

        {/* Security */}
        <section className="mx-auto max-w-[1280px] border-t border-white/[0.06] px-12 py-[100px] max-md:px-5 max-md:py-[60px]">
          <div className="mb-4 font-mono text-[11px] uppercase tracking-widest text-cyan">{t('securityLabel')}</div>
          <h2 className="mb-[60px] max-w-[560px] font-mono text-4xl font-bold leading-tight tracking-tight text-text-primary">
            {t('securityTitle')}
          </h2>
          <div className="grid grid-cols-3 gap-6 max-lg:grid-cols-1">
            <div className="rounded-2xl border border-border-faint bg-surface p-7 transition-all duration-200 hover:border-cyan/20 hover:bg-cyan/[0.03]">
              <div className="mb-[18px] flex h-10 w-10 items-center justify-center rounded-[10px] border border-cyan-mid bg-cyan-dim">
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                  <rect x="3" y="7" width="14" height="10" rx="2" fill="none" stroke="#22d3ee" strokeWidth="1.4" />
                  <path d="M6 7V5a4 4 0 0 1 8 0v2" fill="none" stroke="#22d3ee" strokeWidth="1.4" />
                  <circle cx="10" cy="12" r="1.5" fill="#22d3ee" />
                </svg>
              </div>
              <h3 className="mb-2.5 font-mono text-sm font-bold text-text-primary">{t('securityFeature1Title')}</h3>
              <p className="text-sm leading-relaxed text-white/45">{t('securityFeature1Desc')}</p>
            </div>
            <div className="rounded-2xl border border-border-faint bg-surface p-7 transition-all duration-200 hover:border-cyan/20 hover:bg-cyan/[0.03]">
              <div className="mb-[18px] flex h-10 w-10 items-center justify-center rounded-[10px] border border-cyan-mid bg-cyan-dim">
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                  <path d="M10 2 L12 7 L17 7 L13 10.5 L14.5 16 L10 12.5 L5.5 16 L7 10.5 L3 7 L8 7 Z" fill="none" stroke="#22d3ee" strokeWidth="1.4" strokeLinejoin="round" />
                </svg>
              </div>
              <h3 className="mb-2.5 font-mono text-sm font-bold text-text-primary">{t('securityFeature2Title')}</h3>
              <p className="text-sm leading-relaxed text-white/45">{t('securityFeature2Desc')}</p>
            </div>
            <div className="rounded-2xl border border-border-faint bg-surface p-7 transition-all duration-200 hover:border-cyan/20 hover:bg-cyan/[0.03]">
              <div className="mb-[18px] flex h-10 w-10 items-center justify-center rounded-[10px] border border-cyan-mid bg-cyan-dim">
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                  <rect x="2" y="4" width="16" height="12" rx="2.5" fill="none" stroke="#22d3ee" strokeWidth="1.4" />
                  <line x1="6" y1="8" x2="6" y2="8" stroke="#22d3ee" strokeWidth="1.4" strokeLinecap="round" />
                  <line x1="10" y1="8" x2="10" y2="8" stroke="#22d3ee" strokeWidth="1.4" strokeLinecap="round" />
                  <line x1="14" y1="8" x2="14" y2="8" stroke="#22d3ee" strokeWidth="1.4" strokeLinecap="round" />
                  <line x1="6" y1="12" x2="14" y2="12" stroke="#22d3ee" strokeWidth="1.4" strokeLinecap="round" />
                </svg>
              </div>
              <h3 className="mb-2.5 font-mono text-sm font-bold text-text-primary">{t('securityFeature3Title')}</h3>
              <p className="text-sm leading-relaxed text-white/45">{t('securityFeature3Desc')}</p>
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="border-t border-white/[0.06] px-12 py-20 text-center max-md:px-5 max-md:py-[60px]">
          <h2 className="mb-4 font-mono text-[42px] font-bold leading-tight tracking-tight text-text-primary max-md:text-[28px]">
            {t('ctaTitle')}<span className="text-cyan"> {t('ctaTitleHighlight')}</span></h2>
          <p className="mb-9 text-base text-white/40">{t('ctaDescription')}</p>
          <Link href={`/${locale}/dashboard`}
            className="inline-flex items-center gap-1.5 rounded-full border-none bg-cyan px-7 py-3.5 font-mono text-[13px] font-bold text-ink-light no-underline transition-all duration-150 hover:-translate-y-px hover:opacity-90">
            {t('ctaButton')}
          </Link>
        </section>
      </div>
    </>
  );
}
