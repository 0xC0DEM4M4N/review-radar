'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { isLightTheme } from '@/lib/theme';

function getInitialLight(): boolean {
  if (typeof document === 'undefined') return false;
  return document.documentElement.getAttribute('data-theme') === 'light';
}

export default function LoadingIllustration({ width = 240, height = 160 }: { width?: number; height?: number }) {
  const [isLight, setIsLight] = useState(getInitialLight);
  const t = useTranslations('components.loading');

  useEffect(() => {
    setIsLight(isLightTheme());
    const handler = () => setIsLight(isLightTheme());
    window.addEventListener('themechange', handler);
    return () => window.removeEventListener('themechange', handler);
  }, []);

  return (
    <img
      src={isLight ? '/assets/typing-dev-light.svg' : '/assets/typing-dev.svg'}
      width={width}
      height={height}
      alt={t('alt')}
      style={{ maxWidth: '100%', height: 'auto' }}
    />
  );
}
