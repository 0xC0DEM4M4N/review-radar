'use client';

import { useEffect } from 'react';
import { setThemePreference, applyTheme } from '@/lib/theme';

export default function ThemeInitializer() {
  useEffect(() => {
    // The inline script in layout.tsx already set data-theme before hydration.
    // Sync that value with localStorage and the theme utility.
    const current = document.documentElement.getAttribute('data-theme') as 'light' | 'dark' | null;
    const saved = localStorage.getItem('reviewradar-theme');
    if (saved) {
      setThemePreference(saved as 'light' | 'dark');
    } else if (current) {
      localStorage.setItem('reviewradar-theme', current);
    } else {
      const prefersLight = window.matchMedia('(prefers-color-scheme: light)').matches;
      applyTheme(prefersLight ? 'light' : 'dark');
    }
  }, []);

  return null;
}
