import { state } from './state.js';
import { fetchUserPRs, fetchReposPRs, fetchPRReviews } from './githubApi.js';
import {
  renderRepoList,
  updateRepoSelectorText,
  toggleRepoDropdown,
  closeRepoDropdown,
  filterRepoList,
  toggleRepoSelection,
  selectAllRepos,
  clearRepoSelection,
} from './repoSelector.js';
import { renderTable, updateStats } from './render.js';
import { getRepoFullNameFromUrl } from './utils.js';

export function scrollToFeatures() {
  window.location.href = '/#features';
}

export function scrollToHowItWorks() {
  window.location.href = '/#how-it-works';
}

export async function loadPRs() {
  state.pat = document.getElementById('patInput').value.trim();

  if (!state.pat) {
    showMessage('Please enter a GitHub PAT', 'error');
    return;
  }

  showMessage('Loading PRs...', 'info');
  const button = document.getElementById('loadButton');
  const icon = document.getElementById('loadIcon');
  const spinner = document.getElementById('loadSpinner');
  button.disabled = true;
  if (icon) icon.classList.add('hidden');
  if (spinner) spinner.classList.remove('hidden');

  try {
    const userResponse = await fetch('https://api.github.com/user', {
      headers: {
        Authorization: `token ${state.pat}`,
        Accept: 'application/vnd.github.v3+json',
      },
    });

    if (!userResponse.ok) {
      if (userResponse.status === 401) {
        throw new Error(
          'Invalid PAT - please check your token. Create one at: https://github.com/settings/tokens/new with "repo" scope',
        );
      }
      throw new Error(`GitHub API error: ${userResponse.status}`);
    }

    const userData = await userResponse.json();
    state.currentUser = userData.login;

    const scopes = userResponse.headers.get('x-oauth-scopes');
    const scopesList =
      scopes && typeof scopes === 'string'
        ? scopes.split(', ').map((s) => s.trim())
        : [];

    if (scopes && typeof scopes === 'string' && !scopesList.includes('repo')) {
      console.warn('Token scopes:', scopes);
      showMessage(
        `Warning: Your token has limited scopes (${scopes || 'none'}). For full access to private repos, regenerate with 'repo' scope`,
        'warning',
      );
    }

    let allPRsData = [];

    if (state.selectedRepos.size > 0) {
      for (const repo of state.selectedRepos) {
        try {
          const parts = repo.trim().split('/');
          if (parts.length === 2 && parts[0] && parts[1]) {
            const repoPRs = await fetchReposPRs(repo.trim(), state.pat);
            allPRsData.push(...repoPRs);
          }
        } catch (e) {
          console.warn(`Failed to load ${repo}:`, e);
        }
      }
    } else {
      // No repos selected — load nothing
      allPRsData = [];
    }

    const prsWithReviews = await Promise.all(
      allPRsData.map((pr) => fetchPRReviews(pr, state.pat)),
    );

    state.allPRs = prsWithReviews;

    const discoveredRepos = new Set();
    state.allPRs.forEach((pr) => {
      const repoUrl = pr.repository_url || pr.url;
      const repoName = getRepoFullNameFromUrl(repoUrl);
      if (repoName && repoName !== 'unknown/unknown') {
        discoveredRepos.add(repoName);
      }
    });

    discoveredRepos.forEach((r) => saveRepo(r));

    // Don't auto-select discovered repos — allow empty selection

    updateRepoSelectorText();
    renderRepoList();
    renderTable();
    updateStats();

    const helpText = document.getElementById('helpText');
    if (helpText) helpText.style.display = 'none';

    document.getElementById('statsContainer').style.display = 'grid';
    document.getElementById('filterControls').style.display = 'block';
    showMessage(
      `Loaded ${state.allPRs.length} pull requests from ${discoveredRepos.size} repos`,
      'success',
    );
  } catch (error) {
    let errorMsg = error.message;
    if (
      error.message.includes('Unsafe attempt to load') ||
      error.message.includes('SecurityError')
    ) {
      errorMsg =
        'Security error: Please serve this file via HTTP instead of opening as file://';
    }
    showMessage('Error: ' + errorMsg, 'error');
    console.error(error);
  } finally {
    button.disabled = false;
    const icon = document.getElementById('loadIcon');
    const spinner = document.getElementById('loadSpinner');
    if (icon) icon.classList.remove('hidden');
    if (spinner) spinner.classList.add('hidden');
  }
}

export function showMessage(message, type) {
  const messageEl = document.getElementById('statusMessage');
  messageEl.innerHTML = message;
  const base = 'fixed bottom-6 right-6 z-[1000] max-w-[420px] rounded-lg border-l-[3px] px-4 py-3.5 text-[13px] shadow-md backdrop-blur-sm animate-slide-in block';
  const typeClasses = {
    info: 'border-cyan bg-cyan/[0.08] text-cyan',
    error: 'border-red bg-red/[0.08] text-red',
    success: 'border-green bg-green/[0.08] text-green',
    warning: 'border-amber bg-amber/[0.08] text-amber',
  };
  messageEl.className = `${base} ${typeClasses[type] || typeClasses.info}`;
  if (type === 'success') {
    setTimeout(() => {
      messageEl.classList.add('hidden');
      messageEl.classList.remove('block');
    }, 3000);
  }
}

export function toggleTheme() {
  const html = document.documentElement;
  const isLight = html.classList.contains('light-mode');

  if (!isLight) {
    html.classList.add('light-mode');
    html.classList.remove('dark-mode');
    localStorage.setItem('reviewradar-theme', 'light');
  } else {
    html.classList.remove('light-mode');
    html.classList.add('dark-mode');
    localStorage.setItem('reviewradar-theme', 'dark');
  }
  updateThemeIcon();
  updateRadarImage();
}

export function updateThemeIcon() {
  const html = document.documentElement;
  const btn = document.getElementById('themeToggle');
  if (!btn) return;

  const isLight = html.classList.contains('light-mode');
  if (isLight) {
    btn.textContent = '☀️';
    btn.title = 'Light mode — click for dark';
  } else {
    btn.textContent = '🌙';
    btn.title = 'Dark mode — click for light';
  }
}

export function updateRadarImage() {
  const radarImg = document.getElementById('radarImg');
  if (!radarImg) return;

  const isLight = document.documentElement.classList.contains('light-mode');
  radarImg.src = isLight ? 'assets/radar-light.svg' : 'assets/radar.svg';
}

export function toggleAutoRefresh() {
  const enabled = document.getElementById('autoRefreshToggle').checked;
  if (enabled) {
    startAutoRefresh();
    showMessage('Auto-refresh enabled ✅', 'success');
  } else {
    stopAutoRefresh();
    showMessage('Auto-refresh disabled', 'info');
  }
}

export function toggleNotifications() {
  const enabled = document.getElementById('notificationsToggle').checked;
  if (enabled) {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission().then((permission) => {
        if (permission === 'granted') {
          state.notificationsEnabled = true;
          showMessage('Notifications enabled 🔔', 'success');
        } else {
          document.getElementById('notificationsToggle').checked = false;
          showMessage('Notification permission denied', 'error');
        }
      });
    } else if (
      'Notification' in window &&
      Notification.permission === 'granted'
    ) {
      state.notificationsEnabled = true;
      showMessage('Notifications enabled 🔔', 'success');
    } else {
      showMessage('Notifications not supported in your browser', 'error');
      document.getElementById('notificationsToggle').checked = false;
    }
  } else {
    state.notificationsEnabled = false;
    showMessage('Notifications disabled', 'info');
  }
}

export function clearChangesNotif() {
  const el = document.getElementById('changesNotif');
  el.classList.add('hidden');
  el.classList.remove('inline-flex');
}

export function updateRefreshInterval() {
  state.refreshInterval =
    parseInt(document.getElementById('refreshInterval').value) || 5;
  if (document.getElementById('autoRefreshToggle').checked) {
    stopAutoRefresh();
    startAutoRefresh();
  }
}

export function startAutoRefresh() {
  if (state.autoRefreshTimer) stopAutoRefresh();

  if (!state.pat) {
    showMessage('Please load PRs first', 'error');
    document.getElementById('autoRefreshToggle').checked = false;
    return;
  }

  const interval = state.refreshInterval * 60 * 1000;
  state.autoRefreshTimer = setInterval(() => {
    autoRefreshPRs();
  }, interval);

  autoRefreshPRs();
}

export function stopAutoRefresh() {
  if (state.autoRefreshTimer) {
    clearInterval(state.autoRefreshTimer);
    state.autoRefreshTimer = null;
  }
}

async function autoRefreshPRs() {
  try {
    const prevPRs = JSON.parse(JSON.stringify(state.allPRs));

    let allPRsData = [];
    if (state.selectedRepos.size > 0) {
      for (const repo of state.selectedRepos) {
        try {
          const parts = repo.trim().split('/');
          if (parts.length === 2 && parts[0] && parts[1]) {
            const repoPRs = await fetchReposPRs(repo.trim(), state.pat);
            allPRsData.push(...repoPRs);
          }
        } catch (e) {
          console.warn(`Auto-refresh failed for ${repo}:`, e);
        }
      }
    } else {
      allPRsData = await fetchUserPRs(state.currentUser, state.pat);
    }

    const prsWithReviews = await Promise.all(
      allPRsData.map((pr) => fetchPRReviews(pr, state.pat)),
    );

    state.allPRs = prsWithReviews;
    detectAndNotifyChanges(prevPRs, state.allPRs);
    renderTable();
    updateStats();
    updateRefreshStatus();
  } catch (error) {
    // Silent fail for auto-refresh
  }
}

export function updateRefreshStatus() {
  const now = new Date().toLocaleTimeString();
  document.getElementById('refreshStatus').textContent = `Last updated: ${now}`;
}

function detectAndNotifyChanges(previousPRs, currentPRs) {
  let changeCount = 0;

  for (const currentPR of currentPRs) {
    const previousPR = previousPRs.find((p) => p.id === currentPR.id);
    if (!previousPR) {
      changeCount++;
      if (
        state.notificationsEnabled &&
        'Notification' in window &&
        currentPR.buildStatus?.state === 'success'
      ) {
        sendBrowserNotification(
          `🎉 New PR Passed Build`,
          currentPR.title,
          currentPR.html_url,
        );
      }
      continue;
    }

    if (currentPR.user?.login === state.currentUser) {
      const prevCommentCount = previousPR.comments?.length || 0;
      const currCommentCount = currentPR.comments?.length || 0;

      if (currCommentCount > prevCommentCount) {
        changeCount++;
        const latestComment = currentPR.comments?.[currCommentCount - 1];
        const commenterName = latestComment?.user?.login || 'Someone';
        if (state.notificationsEnabled && 'Notification' in window) {
          sendBrowserNotification(
            `💬 New Comment on Your PR`,
            `${commenterName}: ${currentPR.title}`,
            currentPR.html_url,
          );
        }
      }

      const prevApproved =
        previousPR.reviews?.some((r) => r.state === 'APPROVED') || false;
      const currApproved =
        currentPR.reviews?.some((r) => r.state === 'APPROVED') || false;

      if (!prevApproved && currApproved) {
        changeCount++;
        if (state.notificationsEnabled && 'Notification' in window) {
          sendBrowserNotification(
            `✅ Your PR Approved!`,
            currentPR.title,
            currentPR.html_url,
          );
        }
      }

      const prevChanges =
        previousPR.reviews?.some((r) => r.state === 'CHANGES_REQUESTED') ||
        false;
      const currChanges =
        currentPR.reviews?.some((r) => r.state === 'CHANGES_REQUESTED') ||
        false;

      if (!prevChanges && currChanges) {
        changeCount++;
        if (state.notificationsEnabled && 'Notification' in window) {
          sendBrowserNotification(
            `🔄 Changes Requested on Your PR`,
            currentPR.title,
            currentPR.html_url,
          );
        }
      }
    }

    const prevBuild = previousPR.buildStatus?.state;
    const currBuild = currentPR.buildStatus?.state;

    if (prevBuild !== 'success' && currBuild === 'success') {
      changeCount++;
      if (state.notificationsEnabled && 'Notification' in window) {
        const notifTitle =
          currentPR.user?.login === state.currentUser
            ? '✅ Your Build Passed!'
            : '✅ Build Passed';
        sendBrowserNotification(
          notifTitle,
          currentPR.title,
          currentPR.html_url,
        );
      }
    } else if (prevBuild !== 'failure' && currBuild === 'failure') {
      changeCount++;
      if (state.notificationsEnabled && 'Notification' in window) {
        const notifTitle =
          currentPR.user?.login === state.currentUser
            ? '❌ Your Build Failed'
            : '❌ Build Failed';
        sendBrowserNotification(
          notifTitle,
          currentPR.title,
          currentPR.html_url,
        );
      }
    }

    const prevMerge = previousPR.mergeable_state;
    const currMerge = currentPR.mergeable_state;

    if (
      currMerge === 'dirty' &&
      prevMerge !== 'dirty' &&
      currentPR.user?.login === state.currentUser
    ) {
      changeCount++;
      if (state.notificationsEnabled && 'Notification' in window) {
        sendBrowserNotification(
          `⚠️ Merge Conflict Detected`,
          `${currentPR.title} needs rebase`,
          currentPR.html_url,
        );
      }
    }
  }

  if (changeCount > 0) {
    document.getElementById('changesCount').textContent = changeCount;
    const el = document.getElementById('changesNotif');
    el.classList.remove('hidden');
    el.classList.add('inline-flex');
  }
}

function sendBrowserNotification(title, message, url) {
  if (!('Notification' in window) || Notification.permission !== 'granted')
    return;

  const notification = new Notification(title, {
    body: message,
    icon: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" rx="20" fill="%23001a2e"/><circle cx="50" cy="50" r="30" stroke="%2322d3ee" stroke-width="2" fill="none"/><circle cx="50" cy="50" r="5" fill="%2322d3ee"/></svg>',
    badge:
      'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" rx="20" fill="%23001a2e"/><circle cx="50" cy="50" r="30" stroke="%2322d3ee" stroke-width="2" fill="none"/></svg>',
  });

  notification.onclick = () => {
    if (url) window.open(url, '_blank');
    notification.close();
  };
}

export function loadSavedRepos() {
  const saved = localStorage.getItem('github-repos');
  let repos = saved ? JSON.parse(saved) : [];

  // Filter out any invalid repo names that may have been saved previously
  const INVALID_SEGMENTS = new Set(['pulls', 'issues', 'commits', 'branches', 'tags', 'releases', 'actions', 'wiki', 'security', 'insights', 'settings', 'compare', 'blob', 'tree', 'raw']);
  repos = repos.filter((r) => {
    const parts = r.split('/');
    if (parts.length !== 2 || !parts[0] || !parts[1]) return false;
    if (INVALID_SEGMENTS.has(parts[0]) || INVALID_SEGMENTS.has(parts[1])) return false;
    return true;
  });

  // Save the cleaned list back
  localStorage.setItem('github-repos', JSON.stringify(repos));

  // Don't auto-select repos on load — allow empty selection

  updateRepoSelectorText();
}

export function saveRepo(repoName) {
  if (!repoName || !repoName.trim()) return;
  const parts = repoName.split('/');
  if (parts.length !== 2 || !parts[0] || !parts[1]) {
    console.warn(`Invalid repo name, not saving: ${repoName}`);
    return;
  }
  const saved = localStorage.getItem('github-repos');
  let repos = saved ? JSON.parse(saved) : [];
  if (!repos.includes(repoName)) {
    repos.push(repoName);
    localStorage.setItem('github-repos', JSON.stringify(repos));
  }
}

export function savePatToken() {
  const patVal = document.getElementById('patInput').value.trim();
  if (patVal) {
    localStorage.setItem('github-pat', patVal);
    hidePatInput();
    toggleHelpText(true);
    showMessage('Token saved ✅', 'success');
  } else {
    showMessage('Please enter a token', 'error');
  }
}

export function toggleHelpText(hide) {
  const helpText = document.getElementById('helpText');
  if (helpText) {
    helpText.style.display = hide ? 'none' : '';
  }
  const modalHelp = document.getElementById('modalHelpText');
  if (modalHelp) {
    modalHelp.style.display = hide ? 'none' : '';
  }
}

export function hidePatInput() {
  // Legacy inline elements (may not exist after modal refactor)
  const inputWrap = document.getElementById('patInputWrap');
  const savedWrap = document.getElementById('patSavedWrap');
  if (inputWrap && savedWrap) {
    inputWrap.classList.add('hidden');
    savedWrap.classList.remove('hidden');
    savedWrap.classList.add('flex');
  }
  // Modal elements
  const modalInput = document.getElementById('modalPatInputWrap');
  const modalSaved = document.getElementById('modalPatSavedWrap');
  if (modalInput && modalSaved) {
    modalInput.classList.add('hidden');
    modalSaved.classList.remove('hidden');
    modalSaved.classList.add('flex');
  }
}

export function showPatInput() {
  // Legacy inline elements
  const inputWrap = document.getElementById('patInputWrap');
  const savedWrap = document.getElementById('patSavedWrap');
  if (inputWrap && savedWrap) {
    inputWrap.classList.remove('hidden');
    savedWrap.classList.add('hidden');
    savedWrap.classList.remove('flex');
    document.getElementById('patInput').focus();
  }
  // Modal elements
  const modalInput = document.getElementById('modalPatInputWrap');
  const modalSaved = document.getElementById('modalPatSavedWrap');
  if (modalInput && modalSaved) {
    modalInput.classList.remove('hidden');
    modalSaved.classList.add('hidden');
    modalSaved.classList.remove('flex');
    document.getElementById('patInput').focus();
  }
  toggleHelpText(false);
}

export function openSettingsModal() {
  const backdrop = document.getElementById('settingsModalBackdrop');
  const modal = document.getElementById('settingsModal');
  if (backdrop && modal) {
    backdrop.style.display = 'flex';
    // Force reflow so transition plays
    void backdrop.offsetWidth;
    backdrop.classList.remove('opacity-0');
    modal.classList.remove('scale-95', 'opacity-0');
    modal.classList.add('scale-100', 'opacity-100');
  }
  const savedPat = localStorage.getItem('github-pat');
  if (savedPat) {
    document.getElementById('patInput').value = savedPat;
    hidePatInput();
  } else {
    showPatInput();
  }
}

export function closeSettingsModal() {
  const backdrop = document.getElementById('settingsModalBackdrop');
  const modal = document.getElementById('settingsModal');
  if (backdrop && modal) {
    backdrop.classList.add('opacity-0');
    modal.classList.remove('scale-100', 'opacity-100');
    modal.classList.add('scale-95', 'opacity-0');
    setTimeout(() => {
      backdrop.style.display = 'none';
    }, 200);
  }
}

export async function openStatusReport() {
  const backdrop = document.getElementById('statusReportBackdrop');
  const modal = document.getElementById('statusReportModal');
  if (backdrop && modal) {
    // Render fresh data before showing
    const { renderStatusReport } = await import('./render.js');
    renderStatusReport();
    backdrop.style.display = 'flex';
    void backdrop.offsetWidth;
    backdrop.classList.remove('opacity-0');
    modal.classList.remove('scale-95', 'opacity-0');
    modal.classList.add('scale-100', 'opacity-100');
  }
}

export function closeStatusReport() {
  const backdrop = document.getElementById('statusReportBackdrop');
  const modal = document.getElementById('statusReportModal');
  if (backdrop && modal) {
    backdrop.classList.add('opacity-0');
    modal.classList.remove('scale-100', 'opacity-100');
    modal.classList.add('scale-95', 'opacity-0');
    setTimeout(() => {
      backdrop.style.display = 'none';
    }, 200);
  }
}

export function addRepoManually() {
  const repo = prompt('Enter repo name (owner/repo):');
  if (repo && repo.includes('/')) {
    saveRepo(repo);
    state.selectedRepos.add(repo);
    updateRepoSelectorText();
    renderRepoList();
  } else if (repo) {
    alert('Invalid format. Use owner/repo (e.g., facebook/react)');
  }
}

export function initializeApp() {
  const savedPat = localStorage.getItem('github-pat');
  if (savedPat) {
    document.getElementById('patInput').value = savedPat;
    hidePatInput();
  }
  toggleHelpText(!!savedPat);

  const savedAutoRefresh =
    localStorage.getItem('auto-refresh-enabled') === 'true';
  const savedInterval = localStorage.getItem('refresh-interval');

  if (savedAutoRefresh) {
    document.getElementById('autoRefreshToggle').checked = true;
  }
  if (savedInterval) {
    state.refreshInterval = parseInt(savedInterval);
    document.getElementById('refreshInterval').value = state.refreshInterval;
  }

  const savedTheme = localStorage.getItem('reviewradar-theme');
  if (savedTheme === 'light') {
    document.documentElement.classList.add('light-mode');
    document.documentElement.classList.remove('dark-mode');
  } else {
    document.documentElement.classList.add('dark-mode');
    document.documentElement.classList.remove('light-mode');
    if (!savedTheme) {
      localStorage.setItem('reviewradar-theme', 'dark');
    }
  }
  updateThemeIcon();

  updateRadarImage();

  loadSavedRepos();

  // Auto-load PRs if PAT exists (with no repos selected = all repos)
  if (savedPat) {
    state.pat = savedPat;
    loadPRs();
  } else {
    // No PAT — render the appropriate empty state
    renderTable();
  }

  document.addEventListener('click', (e) => {
    const selector = document.getElementById('repoSelector');
    if (selector && !selector.contains(e.target)) {
      closeRepoDropdown();
    }
  });

  document.getElementById('patInput').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      savePatToken();
    }
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeSettingsModal();
    }
  });

  document
    .getElementById('autoRefreshToggle')
    .addEventListener('change', () => {
      localStorage.setItem(
        'auto-refresh-enabled',
        document.getElementById('autoRefreshToggle').checked,
      );
    });

  document.getElementById('refreshInterval').addEventListener('change', () => {
    const interval = document.getElementById('refreshInterval').value;
    localStorage.setItem('refresh-interval', interval);
  });
}
