import Link from 'next/link';
import TopNav from '@/components/TopNav';
import { getTranslations } from 'next-intl/server';

export default async function HomePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'home' });

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
              {t('heroTitle1')}<br /><span className="text-cyan">{t('heroTitle2')}</span>
            </h1>
            <p className="mb-10 max-w-[440px] text-lg font-light leading-relaxed text-white/55 max-lg:mx-auto animate-fade-up">
              {t('heroDescription')}
            </p>
            <div className="mb-12 flex flex-wrap items-center gap-3.5 animate-fade-up">
              <Link href={`/${locale}/dashboard`}
                className="inline-flex items-center gap-1.5 rounded-full border-none bg-cyan px-7 py-3.5 font-mono text-[13px] font-bold text-ink-light no-underline transition-all duration-150 hover:-translate-y-px hover:opacity-90">
                {t('openDashboard')}
              </Link>
              <a className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-transparent px-6 py-3.5 text-sm text-white/60 no-underline transition-all duration-150 hover:border-white/35 hover:text-text-primary"
                href="https://github.com" target="_blank" rel="noopener noreferrer">{t('viewOnGitHub')}</a>
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

        {/* Features */}
        <section className="mx-auto max-w-[1280px] border-t border-white/[0.06] px-12 py-[100px] max-md:px-5 max-md:py-[60px]" id="features">
          <div className="mb-4 font-mono text-[11px] uppercase tracking-widest text-cyan">{t('featuresLabel')}</div>
          <h2 className="mb-[60px] max-w-[500px] font-mono text-4xl font-bold leading-tight tracking-tight text-text-primary">
            {t('featuresTitle')}</h2>
          <div className="grid grid-cols-3 gap-6 max-lg:grid-cols-2 max-md:grid-cols-1">
            <div className="rounded-2xl border border-border-faint bg-surface p-7 transition-all duration-200 hover:border-cyan/20 hover:bg-cyan/[0.03]">
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
              <h3 className="mb-2.5 font-mono text-sm font-bold text-text-primary">{t('feature1Title')}</h3>
              <p className="text-sm leading-relaxed text-white/45">{t('feature1Desc')}</p>
            </div>
            <div className="rounded-2xl border border-border-faint bg-surface p-7 transition-all duration-200 hover:border-cyan/20 hover:bg-cyan/[0.03]">
              <div className="mb-[18px] flex h-10 w-10 items-center justify-center rounded-[10px] border border-cyan-mid bg-cyan-dim">
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                  <circle cx="6" cy="5" r="2.5" fill="none" stroke="#22d3ee" strokeWidth="1.4" />
                  <circle cx="6" cy="15" r="2.5" fill="none" stroke="#22d3ee" strokeWidth="1.4" />
                  <circle cx="14" cy="5" r="2.5" fill="#22d3ee" />
                  <line x1="6" y1="7.5" x2="6" y2="12.5" stroke="#22d3ee" strokeWidth="1.4" strokeLinecap="round" />
                  <path d="M14 7.5 Q14 15 10 15 Q8 15 6 15" stroke="#22d3ee" strokeWidth="1.4" strokeLinecap="round"
                    fill="none" strokeDasharray="2.5 2" />
                </svg>
              </div>
              <h3 className="mb-2.5 font-mono text-sm font-bold text-text-primary">{t('feature2Title')}</h3>
              <p className="text-sm leading-relaxed text-white/45">{t('feature2Desc')}</p>
            </div>
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
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  <th className="border-b border-white/[0.06] px-5 py-3 text-left font-mono text-[10px] uppercase tracking-widest text-white/25">{t('demoColPR')}</th>
                  <th className="border-b border-white/[0.06] px-5 py-3 text-left font-mono text-[10px] uppercase tracking-widest text-white/25">{t('demoColAuthor')}</th>
                  <th className="border-b border-white/[0.06] px-5 py-3 text-left font-mono text-[10px] uppercase tracking-widest text-white/25">{t('demoColStatus')}</th>
                  <th className="border-b border-white/[0.06] px-5 py-3 text-left font-mono text-[10px] uppercase tracking-widest text-white/25">{t('demoColReviews')}</th>
                  <th className="border-b border-white/[0.06] px-5 py-3 text-left font-mono text-[10px] uppercase tracking-widest text-white/25">{t('demoColBuild')}</th>
                  <th className="border-b border-white/[0.06] px-5 py-3 text-left font-mono text-[10px] uppercase tracking-widest text-white/25">{t('demoColUpdated')}</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-white/[0.04] transition-colors duration-150 hover:bg-cyan/[0.03]">
                  <td className="px-5 py-3.5 align-middle text-[13px] text-white/70">
                    <div className="font-medium text-text-primary">feat: add real-time PR webhook listener</div>
                    <div className="mt-0.5 font-mono text-[11px] text-white/30">hmr0001 / review-radar</div>
                  </td>
                  <td className="px-5 py-3.5 align-middle font-mono text-xs text-white/40">hmr0001</td>
                  <td className="px-5 py-3.5 align-middle"><span className="inline-flex items-center gap-1 rounded-full border border-cyan/20 bg-cyan/10 px-2.5 py-0.5 font-mono text-[11px] text-cyan"><span className="h-[5px] w-[5px] rounded-full bg-current"></span>In review</span></td>
                  <td className="px-5 py-3.5 align-middle font-mono text-xs text-white/35">2 / 3</td>
                  <td className="px-5 py-3.5 align-middle font-mono text-[11px] text-green">✓ pass</td>
                  <td className="px-5 py-3.5 align-middle font-mono text-[11px] text-white/30">12m</td>
                </tr>
                <tr className="border-b border-white/[0.04] transition-colors duration-150 hover:bg-cyan/[0.03]">
                  <td className="px-5 py-3.5 align-middle text-[13px] text-white/70">
                    <div className="font-medium text-text-primary">fix: token expiry not refreshing on 401</div>
                    <div className="mt-0.5 font-mono text-[11px] text-white/30">hmr0001 / api-gateway</div>
                  </td>
                  <td className="px-5 py-3.5 align-middle font-mono text-xs text-white/40">sr_dev</td>
                  <td className="px-5 py-3.5 align-middle"><span className="inline-flex items-center gap-1 rounded-full border border-green/20 bg-green/10 px-2.5 py-0.5 font-mono text-[11px] text-green"><span className="h-[5px] w-[5px] rounded-full bg-current"></span>Approved</span></td>
                  <td className="px-5 py-3.5 align-middle font-mono text-xs text-white/35">3 / 3</td>
                  <td className="px-5 py-3.5 align-middle font-mono text-[11px] text-green">✓ pass</td>
                  <td className="px-5 py-3.5 align-middle font-mono text-[11px] text-white/30">34m</td>
                </tr>
                <tr className="border-b border-white/[0.04] transition-colors duration-150 hover:bg-cyan/[0.03]">
                  <td className="px-5 py-3.5 align-middle text-[13px] text-white/70">
                    <div className="font-medium text-text-primary">chore: upgrade to Node 22 LTS</div>
                    <div className="mt-0.5 font-mono text-[11px] text-white/30">hmr0001 / workers-deploy</div>
                  </td>
                  <td className="px-5 py-3.5 align-middle font-mono text-xs text-white/40">jk_eng</td>
                  <td className="px-5 py-3.5 align-middle"><span className="inline-flex items-center gap-1 rounded-full border border-red/20 bg-red/10 px-2.5 py-0.5 font-mono text-[11px] text-red"><span className="h-[5px] w-[5px] rounded-full bg-current"></span>Blocked</span></td>
                  <td className="px-5 py-3.5 align-middle font-mono text-xs text-white/35">1 / 3</td>
                  <td className="px-5 py-3.5 align-middle font-mono text-[11px] text-red">✗ fail</td>
                  <td className="px-5 py-3.5 align-middle font-mono text-[11px] text-white/30">1h</td>
                </tr>
                <tr className="transition-colors duration-150 hover:bg-cyan/[0.03]">
                  <td className="px-5 py-3.5 align-middle text-[13px] text-white/70">
                    <div className="font-medium text-text-primary">feat: dashboard dark mode toggle</div>
                    <div className="mt-0.5 font-mono text-[11px] text-white/30">hmr0001 / review-radar</div>
                  </td>
                  <td className="px-5 py-3.5 align-middle font-mono text-xs text-white/40">hmr0001</td>
                  <td className="px-5 py-3.5 align-middle"><span className="inline-flex items-center gap-1 rounded-full border border-cyan/20 bg-cyan/10 px-2.5 py-0.5 font-mono text-[11px] text-cyan"><span className="h-[5px] w-[5px] rounded-full bg-current"></span>Open</span></td>
                  <td className="px-5 py-3.5 align-middle font-mono text-xs text-white/35">0 / 3</td>
                  <td className="px-5 py-3.5 align-middle font-mono text-[11px] text-amber">⟳ running</td>
                  <td className="px-5 py-3.5 align-middle font-mono text-[11px] text-white/30">2h</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        {/* CTA */}
        <section className="border-t border-white/[0.06] px-12 py-20 text-center max-md:px-5 max-md:py-[60px]">
          <h2 className="mb-4 font-mono text-[42px] font-bold leading-tight tracking-tight text-text-primary max-md:text-[28px]">
            {t('ctaTitle1')}<span className="text-cyan">{t('ctaTitle2')}</span></h2>
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
