'use client';

import Link from 'next/link';
import { usePathname, useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import LanguageSwitcher from './LanguageSwitcher';
import { isLightTheme, setThemePreference } from '@/lib/theme';

export default function TopNav() {
  const pathname = usePathname();
  const params = useParams();
  const locale = (params?.locale as string) || 'en';
  const t = useTranslations('components.topnav');
  const [isLight, setIsLight] = useState(() =>
    typeof document !== 'undefined'
      ? document.documentElement.getAttribute('data-theme') === 'light'
      : false
  );

  useEffect(() => {
    setIsLight(isLightTheme());
    const handler = () => setIsLight(isLightTheme());
    window.addEventListener('themechange', handler);
    return () => window.removeEventListener('themechange', handler);
  }, []);

  const toggleTheme = () => {
    const next = !isLight;
    setIsLight(next);
    setThemePreference(next ? 'light' : 'dark');
  };

  const navBg = isLight ? 'rgba(255, 255, 255, 0.85)' : 'rgba(6, 14, 22, 0.85)';
  const linkColor = isLight ? 'rgba(15, 23, 42, 0.5)' : 'rgba(255, 255, 255, 0.5)';
  const linkHoverColor = isLight ? 'var(--text-primary)' : 'var(--text-primary)';

  return (
    <nav
      className="rr-topnav"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 200,
        display: 'flex',
        height: 56,
        alignItems: 'center',
        gap: 12,
        borderBottom: '0.5px solid var(--border-subtle)',
        background: navBg,
        padding: '0 32px 0 16px',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
      }}
    >
      <Link href={`/${locale}`} className="flex items-center gap-2.5 no-underline">
        <img className="h-7 w-7 shrink-0" src="/assets/logo.svg" alt="ReviewRadar" />
        <span className="font-mono text-[15px] font-bold tracking-tight text-text-primary">
          {t('logoReview')}<span style={{ color: 'var(--cyan)' }}>{t('logoRadar')}</span>
        </span>
      </Link>
      <div className="flex-1" />
      <ul className="flex list-none gap-6" style={{ margin: 0, padding: 0 }}>
        <li>
          <Link href={`/${locale}`} className="text-[13px] no-underline transition-colors duration-150 hover:text-text-primary" style={{ color: linkColor }}>
            {t('home')}
          </Link>
        </li>
        <li>
          <Link href={`/${locale}/guide`} className="text-[13px] no-underline transition-colors duration-150 hover:text-text-primary" style={{ color: linkColor }}>
            {t('guide')}
          </Link>
        </li>
      </ul>
      {!pathname?.startsWith(`/${locale}/dashboard`) && (
        <Link
          href={`/${locale}/dashboard`}
          className="inline-flex items-center gap-1.5 rounded-full border-none font-mono text-xs font-bold no-underline transition-opacity duration-150"
          style={{ background: 'var(--cyan)', color: 'var(--ink-light)', padding: '8px 20px' }}
        >
          {t('openDashboard')}
        </Link>
      )}
      <LanguageSwitcher />
      <button
        onClick={toggleTheme}
        className="cursor-pointer rounded-full border font-mono text-[11px] transition-colors"
        style={{
          borderColor: 'var(--border-subtle)',
          background: 'transparent',
          color: 'var(--muted)',
          padding: '7px 12px',
        }}
        title={isLight ? t('lightModeTooltip') : t('darkModeTooltip')}
        aria-label={isLight ? t('lightModeTooltip') : t('darkModeTooltip')}
      >
        {isLight ? t('themeLight') : t('themeDark')}
      </button>
      <a
        href="https://github.com"
        target="_blank"
        rel="noopener noreferrer"
        className="ml-2 transition-colors hover:text-text-primary"
        style={{ color: linkColor }}
        title={t('viewOnGithub')}
        aria-label={t('viewOnGithub')}
      >
        <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
        </svg>
      </a>
    </nav>
  );
}
