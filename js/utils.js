export function escapeHtml(text = '') {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

export function getContrastColor(hexColor) {
  const r = parseInt(hexColor.substr(0, 2), 16);
  const g = parseInt(hexColor.substr(2, 2), 16);
  const b = parseInt(hexColor.substr(4, 2), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.5 ? '#000000' : '#ffffff';
}

export function formatLastUpdated(isoDateString) {
  const date = new Date(isoDateString);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  const dateOnly = new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
  );
  const todayOnly = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate(),
  );
  const yesterdayOnly = new Date(
    yesterday.getFullYear(),
    yesterday.getMonth(),
    yesterday.getDate(),
  );

  let dateStr;
  if (dateOnly.getTime() === todayOnly.getTime()) {
    dateStr = 'Today';
  } else if (dateOnly.getTime() === yesterdayOnly.getTime()) {
    dateStr = 'Yesterday';
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
    hour12: true,
  });
  return `${dateStr} ${timeStr}`;
}

export function getRepoNameFromUrl(repoUrl) {
  if (!repoUrl || typeof repoUrl !== 'string') return 'unknown';
  const parts = repoUrl.split('/');
  return parts.length > 0 ? parts[parts.length - 1] : 'unknown';
}

export function getRepoFullNameFromUrl(repoUrl) {
  if (!repoUrl || typeof repoUrl !== 'string') return 'unknown/unknown';

  // For API URLs like https://api.github.com/repos/owner/repo/pulls/3
  // extract owner/repo from the /repos/owner/repo/... pattern
  const apiMatch = repoUrl.match(/\/repos\/([^/]+)\/([^/]+)/);
  if (apiMatch) {
    return `${apiMatch[1]}/${apiMatch[2]}`;
  }

  // For HTML URLs like https://github.com/owner/repo or https://github.com/owner/repo/pull/3
  const parts = repoUrl.split('/');
  const cleanParts = parts.filter(
    (p) => p && p !== 'https:' && p !== 'http:' && p !== '' && p !== 'github.com',
  );
  if (cleanParts.length >= 2) {
    return `${cleanParts[0]}/${cleanParts[1]}`;
  }

  return 'unknown/unknown';
}
