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

export function formatDateSplit(isoDateString: string) {
  const date = new Date(isoDateString);
  const today = new Date();

  const dateOnly = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const todayOnly = new Date(today.getFullYear(), today.getMonth(), today.getDate());

  let dateStr;
  if (dateOnly.getTime() === todayOnly.getTime()) {
    dateStr = 'Today';
  } else {
    const includeYear = dateOnly.getFullYear() === todayOnly.getFullYear();
    dateStr = date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      ...(includeYear ? {} : { year: 'numeric' }),
    });
  }

  const timeStr = date.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });

  return { dateStr, timeStr };
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

const REPO_COLORS = [
  'repo-color-0',
  'repo-color-1',
  'repo-color-2',
  'repo-color-3',
  'repo-color-4',
  'repo-color-5',
  'repo-color-6',
  'repo-color-7',
];

export function getRepoColorIndex(repoName: string) {
  let hash = 0;
  for (let i = 0; i < repoName.length; i++) hash = repoName.charCodeAt(i) + ((hash << 5) - hash);
  return Math.abs(hash) % REPO_COLORS.length;
}
