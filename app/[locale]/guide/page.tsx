import Layout from '@/components/Layout';
import { useTranslations } from 'next-intl';

export default function GuidePage() {
  const t = useTranslations('guide');

  return (
    <Layout>
      <div className="mx-auto max-w-2xl px-6 py-16">
        <h1 className="mb-10 text-3xl font-bold" style={{ color: 'var(--text-primary)' }}>
          {t('title')}
        </h1>

        <section className="mb-10">
          <h2 className="mb-3 text-xl font-semibold" style={{ color: 'var(--cyan)' }}>
            {t('step1Title')}
          </h2>
          <p className="mb-3 text-sm leading-relaxed" style={{ color: 'var(--muted)' }}>
            {t('step1Description')}
          </p>
          <ol className="list-inside list-decimal space-y-2 text-sm" style={{ color: 'var(--text-primary)' }}>
            <li>
              {t.rich('step1List1', {
                githubLink: (chunks) => (
                  <a
                    href="https://github.com/settings/tokens"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline hover:opacity-80"
                    style={{ color: 'var(--cyan)' }}
                  >
                    {chunks}
                  </a>
                ),
              })}
            </li>
            <li>{t.rich('step1List2', { strong: (chunks) => <strong>{chunks}</strong> })}</li>
            <li>{t.rich('step1List3', { strong: (chunks) => <strong>{chunks}</strong>, code: (chunks) => <code className="rounded bg-white/[0.06] px-1.5 py-0.5 font-mono text-xs text-cyan">{chunks}</code> })}</li>
            <li>{t.rich('step1List4', { strong: (chunks) => <strong>{chunks}</strong> })}</li>
            <li>{t('step1List5')}</li>
          </ol>
        </section>

        <section className="mb-10">
          <h2 className="mb-3 text-xl font-semibold" style={{ color: 'var(--cyan)' }}>
            {t('step2Title')}
          </h2>
          <p className="mb-3 text-sm leading-relaxed" style={{ color: 'var(--muted)' }}>
            {t('step2Description')}
          </p>
          <ul className="list-inside list-disc space-y-2 text-sm" style={{ color: 'var(--text-primary)' }}>
            <li>{t.rich('step2List1', { strong: (chunks) => <strong>{chunks}</strong> })}</li>
            <li>{t.rich('step2List2', { code: (chunks) => <code className="rounded bg-white/[0.06] px-1.5 py-0.5 font-mono text-xs text-cyan">{chunks}</code> })}</li>
            <li>{t.rich('step2List3', { strong: (chunks) => <strong>{chunks}</strong> })}</li>
            <li>{t('step2List4')}</li>
          </ul>
        </section>

        <section className="mb-10">
          <h2 className="mb-3 text-xl font-semibold" style={{ color: 'var(--cyan)' }}>
            {t('step3Title')}
          </h2>
          <p className="mb-3 text-sm leading-relaxed" style={{ color: 'var(--muted)' }}>
            {t('step3Description')}
          </p>
          <ul className="list-inside list-disc space-y-2 text-sm" style={{ color: 'var(--text-primary)' }}>
            <li>{t('step3List1')}</li>
            <li>{t('step3List2')}</li>
            <li>{t('step3List3')}</li>
            <li>{t('step3List4')}</li>
          </ul>
        </section>

        <section className="mb-10">
          <h2 className="mb-3 text-xl font-semibold" style={{ color: 'var(--cyan)' }}>
            {t('step4Title')}
          </h2>
          <p className="mb-3 text-sm leading-relaxed" style={{ color: 'var(--muted)' }}>
            {t('step4Description')}
          </p>
          <ul className="list-inside list-disc space-y-2 text-sm" style={{ color: 'var(--text-primary)' }}>
            <li>{t.rich('step4List1', { strong: (chunks) => <strong>{chunks}</strong> })}</li>
            <li>{t.rich('step4List2', { strong: (chunks) => <strong>{chunks}</strong> })}</li>
            <li>{t.rich('step4List3', { strong: (chunks) => <strong>{chunks}</strong> })}</li>
          </ul>
        </section>

        <section className="mb-10">
          <h2 className="mb-3 text-xl font-semibold" style={{ color: 'var(--cyan)' }}>
            {t('step7Title')}
          </h2>
          <p className="mb-3 text-sm leading-relaxed" style={{ color: 'var(--muted)' }}>
            {t('step7Description')}
          </p>

          <div className="mb-4 rounded-lg border border-border-faint bg-ink-light p-4">
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">
              {t('step7OAuthTitle')}
            </h3>
            <p className="mb-2 text-xs leading-relaxed" style={{ color: 'var(--muted)' }}>
              {t('step7OAuthDesc')}
            </p>
            <ol className="list-inside list-decimal space-y-1 text-xs" style={{ color: 'var(--text-primary)' }}>
              <li>{t.rich('step7OAuthList1', { code: (chunks) => <code className="rounded bg-white/[0.06] px-1.5 py-0.5 font-mono text-xs text-cyan">{chunks}</code> })}</li>
              <li>{t.rich('step7OAuthList2', { code: (chunks) => <code className="rounded bg-white/[0.06] px-1.5 py-0.5 font-mono text-xs text-cyan">{chunks}</code> })}</li>
              <li>{t('step7OAuthList3')}</li>
            </ol>
            <p className="mt-2 text-xs leading-relaxed text-amber" style={{ color: 'var(--amber)' }}>
              {t('step7OAuthNote')}
            </p>
          </div>

          <div className="rounded-lg border border-border-faint bg-ink-light p-4">
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">
              {t('step7PatTitle')}
            </h3>
            <p className="mb-2 text-xs leading-relaxed" style={{ color: 'var(--muted)' }}>
              {t('step7PatDesc')}
            </p>
            <ol className="list-inside list-decimal space-y-1 text-xs" style={{ color: 'var(--text-primary)' }}>
              <li>
                {t.rich('step7PatList1', {
                  githubLink: (chunks) => (
                    <a href="https://github.com/settings/tokens" target="_blank" rel="noopener noreferrer" className="underline hover:opacity-80" style={{ color: 'var(--cyan)' }}>{chunks}</a>
                  ),
                })}
              </li>
              <li>{t.rich('step7PatList2', { code: (chunks) => <code className="rounded bg-white/[0.06] px-1.5 py-0.5 font-mono text-xs text-cyan">{chunks}</code> })}</li>
              <li>{t('step7PatList3')}</li>
            </ol>
          </div>
        </section>

        <section className="mb-10">
          <h2 className="mb-3 text-xl font-semibold" style={{ color: 'var(--cyan)' }}>
            {t('step8Title')}
          </h2>
          <p className="mb-3 text-sm leading-relaxed" style={{ color: 'var(--muted)' }}>
            {t('step8Description')}
          </p>
          <ul className="list-inside list-disc space-y-2 text-sm" style={{ color: 'var(--text-primary)' }}>
            <li>{t.rich('step8List1', { strong: (chunks) => <strong>{chunks}</strong> })}</li>
            <li>{t.rich('step8List2', { strong: (chunks) => <strong>{chunks}</strong> })}</li>
            <li>{t.rich('step8List3', { strong: (chunks) => <strong>{chunks}</strong> })}</li>
            <li>{t.rich('step8List4', { strong: (chunks) => <strong>{chunks}</strong> })}</li>
            <li>{t.rich('step8List5', { strong: (chunks) => <strong>{chunks}</strong> })}</li>
          </ul>
        </section>

        <section className="mb-10">
          <h2 className="mb-3 text-xl font-semibold" style={{ color: 'var(--cyan)' }}>
            {t('step9Title')}
          </h2>
          <p className="mb-3 text-sm leading-relaxed" style={{ color: 'var(--muted)' }}>
            {t('step9Description')}
          </p>
          <ul className="list-inside list-disc space-y-2 text-sm" style={{ color: 'var(--text-primary)' }}>
            <li>{t.rich('step9List1', { strong: (chunks) => <strong>{chunks}</strong>, code: (chunks) => <code className="rounded bg-white/[0.06] px-1.5 py-0.5 font-mono text-xs text-cyan">{chunks}</code> })}</li>
            <li>{t.rich('step9List2', { strong: (chunks) => <strong>{chunks}</strong> })}</li>
            <li>{t.rich('step9List3', { strong: (chunks) => <strong>{chunks}</strong>, code: (chunks) => <code className="rounded bg-white/[0.06] px-1.5 py-0.5 font-mono text-xs text-cyan">{chunks}</code> })}</li>
            <li>{t.rich('step9List4', { strong: (chunks) => <strong>{chunks}</strong> })}</li>
          </ul>
        </section>

        <section>
          <h2 className="mb-3 text-xl font-semibold" style={{ color: 'var(--cyan)' }}>
            {t('step5Title')}
          </h2>
          <p className="mb-3 text-sm leading-relaxed" style={{ color: 'var(--muted)' }}>
            {t('step5Description')}
          </p>

          <div className="mb-4 rounded-lg border border-border-faint bg-surface p-4">
            <code className="block text-xs text-cyan font-mono leading-relaxed">
              {t('step5Formula')}
            </code>
          </div>

          <ol className="list-inside list-decimal space-y-3 text-sm" style={{ color: 'var(--text-primary)' }}>
            <li>
              <strong style={{ color: 'var(--cyan)' }}>{t('step5Step1Title')}</strong>
              <p className="mt-1 text-xs leading-relaxed" style={{ color: 'var(--muted)' }}>
                {t('step5Step1Desc')}
              </p>
              <ul className="mt-1 ml-4 list-disc space-y-1 text-xs" style={{ color: 'var(--muted)' }}>
                <li>{t('step5Step1W1')}</li>
                <li>{t('step5Step1W2')}</li>
                <li>{t('step5Step1W3')}</li>
                <li>{t('step5Step1W4')}</li>
                <li>{t('step5Step1W5')}</li>
              </ul>
            </li>
            <li>
              <strong style={{ color: 'var(--cyan)' }}>{t('step5Step2Title')}</strong>
              <p className="mt-1 text-xs leading-relaxed" style={{ color: 'var(--muted)' }}>
                {t('step5Step2Desc')}
              </p>
            </li>
            <li>
              <strong style={{ color: 'var(--cyan)' }}>{t('step5Step3Title')}</strong>
              <p className="mt-1 text-xs leading-relaxed" style={{ color: 'var(--muted)' }}>
                {t('step5Step3Desc')}
              </p>
            </li>
            <li>
              <strong style={{ color: 'var(--cyan)' }}>{t('step5Step4Title')}</strong>
              <p className="mt-1 text-xs leading-relaxed" style={{ color: 'var(--muted)' }}>
                {t('step5Step4Desc')}
              </p>
            </li>
            <li>
              <strong style={{ color: 'var(--cyan)' }}>{t('step5Step5Title')}</strong>
              <p className="mt-1 text-xs leading-relaxed" style={{ color: 'var(--muted)' }}>
                {t('step5Step5Desc')}
              </p>
            </li>
          </ol>

          <div className="mt-4 rounded-lg border border-border-faint bg-ink-light p-4">
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">
              {t('step5LabelTitle')}
            </h3>
            <p className="mb-2 text-xs leading-relaxed" style={{ color: 'var(--muted)' }}>
              {t('step5LabelDesc')}
            </p>
            <div className="grid grid-cols-2 gap-2 text-xs" style={{ color: 'var(--text-primary)' }}>
              <div>
                <span className="block text-[10px] uppercase tracking-wide text-muted-dim mb-1">{t('step5FileTier')}</span>
                <ul className="list-disc list-inside space-y-0.5">
                  <li>{t('step5FileTrivial')}</li>
                  <li>{t('step5FileSmall')}</li>
                  <li>{t('step5FileMedium')}</li>
                  <li>{t('step5FileLarge')}</li>
                  <li>{t('step5FileEnormous')}</li>
                </ul>
              </div>
              <div>
                <span className="block text-[10px] uppercase tracking-wide text-muted-dim mb-1">{t('step5ScoreTier')}</span>
                <ul className="list-disc list-inside space-y-0.5">
                  <li>{t('step5ScoreTrivial')}</li>
                  <li>{t('step5ScoreSmall')}</li>
                  <li>{t('step5ScoreMedium')}</li>
                  <li>{t('step5ScoreLarge')}</li>
                  <li>{t('step5ScoreComplex')}</li>
                  <li>{t('step5ScoreVeryComplex')}</li>
                </ul>
              </div>
            </div>
          </div>
        </section>

        <section className="mb-10">
          <h2 className="mb-3 text-xl font-semibold" style={{ color: 'var(--cyan)' }}>
            {t('step6Title')}
          </h2>
          <p className="mb-3 text-sm leading-relaxed" style={{ color: 'var(--muted)' }}>
            {t('step6Description')}
          </p>

          <div className="mb-4 rounded-lg border border-border-faint bg-ink-light p-4">
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">
              {t('step6NeedsAttentionTitle')}
            </h3>
            <p className="mb-2 text-xs leading-relaxed" style={{ color: 'var(--muted)' }}>
              {t('step6NeedsAttentionDesc')}
            </p>
            <ul className="list-disc list-inside space-y-1 text-xs" style={{ color: 'var(--text-primary)' }}>
              <li>{t('step6NeedsAttention1')}</li>
              <li>{t('step6NeedsAttention2')}</li>
              <li>{t('step6NeedsAttention3')}</li>
              <li>{t('step6NeedsAttention4')}</li>
            </ul>
          </div>

          <div className="rounded-lg border border-border-faint bg-ink-light p-4">
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">
              {t('step6BlockedTitle')}
            </h3>
            <p className="mb-2 text-xs leading-relaxed" style={{ color: 'var(--muted)' }}>
              {t('step6BlockedDesc')}
            </p>
            <ul className="list-disc list-inside space-y-1 text-xs" style={{ color: 'var(--text-primary)' }}>
              <li>{t('step6Blocked1')}</li>
              <li>{t('step6Blocked2')}</li>
              <li>{t('step6Blocked3')}</li>
            </ul>
            <p className="mt-2 text-xs leading-relaxed" style={{ color: 'var(--muted)' }}>
              {t('step6Overlap')}
            </p>
          </div>
        </section>

        {/* Step 10: Reports */}
        <section className="mb-10">
          <h2 className="mb-3 text-xl font-semibold" style={{ color: 'var(--cyan)' }}>
            {t('step10Title')}
          </h2>
          <p className="mb-3 text-sm leading-relaxed" style={{ color: 'var(--muted)' }}>
            {t('step10Description')}
          </p>

          <div className="mb-6 rounded-lg border border-border-faint bg-ink-light p-4">
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">
              {t('step10WatchdogTitle')}
            </h3>
            <p className="mb-2 text-xs leading-relaxed" style={{ color: 'var(--muted)' }}>
              {t('step10WatchdogDesc')}
            </p>
            <p className="mb-1 text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>
              {t('step10WatchdogHow')}
            </p>
            <ul className="list-disc list-inside space-y-1 text-xs" style={{ color: 'var(--text-primary)' }}>
              <li>{t('step10WatchdogRule1')}</li>
              <li>{t('step10WatchdogRule2')}</li>
              <li>{t('step10WatchdogRule3')}</li>
              <li>{t('step10WatchdogRule4')}</li>
              <li>{t('step10WatchdogRule5')}</li>
              <li>{t('step10WatchdogRule6')}</li>
            </ul>
          </div>

          <div className="mb-6 rounded-lg border border-border-faint bg-ink-light p-4">
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">
              {t('step10VelocityTitle')}
            </h3>
            <p className="mb-2 text-xs leading-relaxed" style={{ color: 'var(--muted)' }}>
              {t('step10VelocityDesc')}
            </p>
            <p className="mb-1 text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>
              {t('step10VelocityHow')}
            </p>
            <ul className="list-disc list-inside space-y-1 text-xs" style={{ color: 'var(--text-primary)' }}>
              <li>{t('step10VelocityRule1')}</li>
              <li>{t('step10VelocityRule2')}</li>
              <li>{t('step10VelocityRule3')}</li>
              <li>{t('step10VelocityRule4')}</li>
              <li>{t('step10VelocityRule5')}</li>
            </ul>
          </div>

          <div className="rounded-lg border border-border-faint bg-ink-light p-4">
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">
              {t('step10BurnoutTitle')}
            </h3>
            <p className="mb-2 text-xs leading-relaxed" style={{ color: 'var(--muted)' }}>
              {t('step10BurnoutDesc')}
            </p>
            <p className="mb-1 text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>
              {t('step10BurnoutHow')}
            </p>
            <ul className="list-disc list-inside space-y-1 text-xs" style={{ color: 'var(--text-primary)' }}>
              <li>{t('step10BurnoutRule1')}</li>
              <ul className="list-circle list-inside ml-4 space-y-1 text-xs" style={{ color: 'var(--text-primary)' }}>
                <li>{t('step10BurnoutRule1a')}</li>
                <li>{t('step10BurnoutRule1b')}</li>
                <li>{t('step10BurnoutRule1c')}</li>
              </ul>
              <li>{t('step10BurnoutRule2')}</li>
              <li>{t('step10BurnoutRule3')}</li>
              <ul className="list-circle list-inside ml-4 space-y-1 text-xs" style={{ color: 'var(--text-primary)' }}>
                <li>{t('step10BurnoutRisk1')}</li>
                <li>{t('step10BurnoutRisk2')}</li>
                <li>{t('step10BurnoutRisk3')}</li>
              </ul>
            </ul>
            <p className="mt-3 text-xs leading-relaxed" style={{ color: 'var(--muted-dim)', fontStyle: 'italic' }}>
              {t('step10BurnoutNote')}
            </p>
            <p className="mt-2 text-xs leading-relaxed" style={{ color: 'var(--muted-dim)' }}>
              {t('step10BurnoutSuggestion')}
            </p>
          </div>
        </section>
      </div>
    </Layout>
  );
}
