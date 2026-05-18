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

        <section>
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
      </div>
    </Layout>
  );
}
