export function isLightTheme(): boolean {
  return document.documentElement.dataset.theme === 'light';
}

export function applyTheme(theme: 'light' | 'dark'): void {
  if (theme === 'light') {
    document.documentElement.dataset.theme = 'light';
  } else {
    delete document.documentElement.dataset.theme;
  }
  window.dispatchEvent(new CustomEvent('themechange'));
}

export function getThemePreference(): 'light' | 'dark' {
  if (typeof window === 'undefined') return 'dark';
  const saved = localStorage.getItem('reviewradar-theme') as 'light' | 'dark' | null;
  if (saved) return saved;
  return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
}

export function setThemePreference(theme: 'light' | 'dark'): void {
  applyTheme(theme);
  localStorage.setItem('reviewradar-theme', theme);
}
