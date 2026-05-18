'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export const SUPPORTED_LOCALES = ['en', 'fr'];
export const DEFAULT_LOCALE = 'en';

function getBrowserLocale() {
  if (typeof window === 'undefined') return DEFAULT_LOCALE;
  const browserLang = navigator.language.split('-')[0];
  return SUPPORTED_LOCALES.includes(browserLang) ? browserLang : DEFAULT_LOCALE;
}

function getStoredLocale() {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('reviewradar-locale');
}

function getEffectiveLocale() {
  const stored = getStoredLocale();
  if (stored && SUPPORTED_LOCALES.includes(stored)) return stored;
  return getBrowserLocale();
}

export default function RootPage() {
  const router = useRouter();
  useEffect(() => {
    const locale = getEffectiveLocale();
    router.replace(`/${locale}`);
  }, [router]);
  return null;
}
