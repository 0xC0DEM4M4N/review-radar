'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useParams, usePathname, useRouter } from 'next/navigation';

const SUPPORTED_LOCALES = ['en', 'fr'];
const DEFAULT_LOCALE = 'en';

const LOCALE_META: Record<string, { flag: string; label: string }> = {
  en: { flag: '🇬🇧', label: 'English' },
  fr: { flag: '🇫🇷', label: 'Français' },
};

function getBrowserLocale() {
  if (typeof window === 'undefined') return DEFAULT_LOCALE;
  const browserLang = navigator.language.split('-')[0];
  return SUPPORTED_LOCALES.includes(browserLang) ? browserLang : DEFAULT_LOCALE;
}

function setLocalePreference(locale: string) {
  const browserLocale = getBrowserLocale();
  if (locale === browserLocale) {
    localStorage.removeItem('reviewradar-locale');
  } else {
    localStorage.setItem('reviewradar-locale', locale);
  }
}

export default function LanguageSwitcher() {
  const params = useParams();
  const pathname = usePathname();
  const router = useRouter();
  const currentLocale = (params?.locale as string) || DEFAULT_LOCALE;
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const switchLocale = useCallback(
    (locale: string) => {
      if (locale === currentLocale) {
        setOpen(false);
        return;
      }
      setLocalePreference(locale);
      // Replace locale in pathname: /en/dashboard → /fr/dashboard
      const newPath = pathname.replace(/^\/(en|fr)(?=\/|$)/, `/${locale}`);
      router.push(newPath);
      setOpen(false);
    },
    [currentLocale, pathname, router]
  );

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('click', onClick);
    return () => document.removeEventListener('click', onClick);
  }, []);

  const currentMeta = LOCALE_META[currentLocale] || LOCALE_META[DEFAULT_LOCALE];

  return (
    <div ref={containerRef} style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen(!open)}
        className="cursor-pointer rounded-full border font-mono text-[13px] transition-colors"
        style={{
          borderColor: 'var(--border-subtle)',
          background: 'transparent',
          color: 'var(--muted)',
          padding: '6px 12px',
          display: 'flex',
          alignItems: 'center',
          gap: 6,
        }}
        title={currentMeta.label}
        aria-label={`Current language: ${currentMeta.label}`}
      >
        <span>{currentMeta.flag}</span>
        <span style={{ fontSize: 10 }}>▼</span>
      </button>
      {open && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 4px)',
            right: 0,
            background: 'var(--ink-light)',
            border: '0.5px solid var(--border-faint)',
            borderRadius: 8,
            padding: '4px',
            minWidth: 120,
            zIndex: 300,
            boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
          }}
        >
          {SUPPORTED_LOCALES.map((locale) => {
            const meta = LOCALE_META[locale];
            const isActive = locale === currentLocale;
            return (
              <button
                key={locale}
                onClick={() => switchLocale(locale)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  width: '100%',
                  padding: '6px 10px',
                  borderRadius: 6,
                  border: 'none',
                  background: isActive ? 'var(--cyan-dim)' : 'transparent',
                  color: isActive ? 'var(--cyan)' : 'var(--text-primary)',
                  cursor: 'pointer',
                  fontSize: 13,
                  fontFamily: "'Space Mono', monospace",
                  textAlign: 'left',
                  transition: 'background 150ms',
                }}
                onMouseEnter={(e) => {
                  if (!isActive) e.currentTarget.style.background = 'rgba(255,255,255,0.04)';
                }}
                onMouseLeave={(e) => {
                  if (!isActive) e.currentTarget.style.background = 'transparent';
                }}
              >
                <span>{meta.flag}</span>
                <span>{meta.label}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
