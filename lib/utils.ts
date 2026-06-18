export function escapeHtml(text = '') {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

export function getContrastColor(hexColor: string) {
  const r = parseInt(hexColor.substr(0, 2), 16);
  const g = parseInt(hexColor.substr(2, 2), 16);
  const b = parseInt(hexColor.substr(4, 2), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.5 ? '#000000' : '#ffffff';
}

export function formatDateSplit(isoDateString: string, todayLabel = 'Today', locale = 'en') {
  const date = new Date(isoDateString);
  const today = new Date();

  const dateOnly = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const todayOnly = new Date(today.getFullYear(), today.getMonth(), today.getDate());

  let dateStr;
  if (dateOnly.getTime() === todayOnly.getTime()) {
    dateStr = todayLabel;
  } else {
    const includeYear = dateOnly.getFullYear() === todayOnly.getFullYear();
    dateStr = date.toLocaleDateString(locale, {
      month: 'short',
      day: 'numeric',
      ...(includeYear ? {} : { year: 'numeric' }),
    });
  }

  const timeStr = date.toLocaleTimeString(locale, {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });

  return { dateStr, timeStr };
}

export function formatRelativeTime(isoDateString: string, locale = 'en'): string {
  const diffMs = Date.now() - new Date(isoDateString).getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });

  if (diffSec < 60) return rtf.format(-diffSec, 'second');
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return rtf.format(-diffMin, 'minute');
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return rtf.format(-diffHour, 'hour');
  const diffDay = Math.floor(diffHour / 24);
  if (diffDay < 30) return rtf.format(-diffDay, 'day');
  const diffMonth = Math.floor(diffDay / 30);
  if (diffMonth < 12) return rtf.format(-diffMonth, 'month');
  return rtf.format(-Math.floor(diffMonth / 12), 'year');
}

export function formatEta(ms: number, locale = 'en'): string {
  const seconds = Math.ceil(ms / 1000);
  const nf = new Intl.NumberFormat(locale);
  if (seconds < 1) return '<1s';
  if (seconds < 60) return nf.format(seconds) + 's';
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return nf.format(mins) + 'm ' + nf.format(secs).padStart(2, '0') + 's';
}

export function getRepoNameFromUrl(repoUrl: string) {
  if (!repoUrl || typeof repoUrl !== 'string') return 'unknown';
  const parts = repoUrl.split('/');
  return parts.length > 0 ? parts[parts.length - 1] : 'unknown';
}

export function getRepoFullNameFromUrl(repoUrl: string) {
  if (!repoUrl || typeof repoUrl !== 'string') return 'unknown/unknown';
  const apiMatch = repoUrl.match(/\/repos\/([^/]+)\/([^/]+)/);
  if (apiMatch) return `${apiMatch[1]}/${apiMatch[2]}`;
  const parts = repoUrl.split('/');
  const cleanParts = parts.filter((p) => p && p !== 'https:' && p !== 'http:' && p !== '' && p !== 'github.com');
  if (cleanParts.length >= 2) return `${cleanParts[0]}/${cleanParts[1]}`;
  return 'unknown/unknown';
}

export const REPO_COLOR_CLASSES = [
  'repo-color-0',
  'repo-color-1',
  'repo-color-2',
  'repo-color-3',
  'repo-color-4',
  'repo-color-5',
  'repo-color-6',
  'repo-color-7',
];

export const REPO_DEFAULT_COLORS = [
  '#22d3ee',
  '#22c55e',
  '#f59e0b',
  '#6366f1',
  '#a855f7',
  '#ec4899',
  '#6366f1',
  '#14b8a6',
];

export function getRepoColorIndex(repoName: string) {
  let hash = 0;
  for (let i = 0; i < repoName.length; i++) hash = repoName.charCodeAt(i) + ((hash << 5) - hash);
  return Math.abs(hash) % REPO_COLOR_CLASSES.length;
}

export function getRepoDefaultColor(repoName: string): string {
  return REPO_DEFAULT_COLORS[getRepoColorIndex(repoName)];
}

export function getRepoColor(repoName: string, repoColors?: Record<string, string>): string {
  return repoColors?.[repoName] || getRepoDefaultColor(repoName);
}

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const clean = hex.replace('#', '');
  if (!/^[0-9a-fA-F]{6}$/.test(clean)) return null;
  return {
    r: parseInt(clean.substring(0, 2), 16),
    g: parseInt(clean.substring(2, 4), 16),
    b: parseInt(clean.substring(4, 6), 16),
  };
}

export function withOpacity(hex: string, opacity: number): string {
  const rgb = hexToRgb(hex);
  if (!rgb) return hex;
  return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${opacity})`;
}
