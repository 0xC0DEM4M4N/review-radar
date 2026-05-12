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

export function showDashboard() {
  window.location.href = '/dashboard';
}

export function showLanding() {
  window.location.href = '/';
}

export function scrollToHowItWorks() {
  window.location.href = '/#how-it-works';
}

function showTypingLoader() {
  const loader = document.getElementById('typingLoader');
  const table = document.querySelector('.rr-table-wrap');
  if (loader) loader.style.display = 'flex';
  if (table) table.style.display = 'none';
}

function hideTypingLoader() {
  const loader = document.getElementById('typingLoader');
  const table = document.querySelector('.rr-table-wrap');
  if (loader) loader.style.display = 'none';
  if (table) table.style.display = '';
}

export async function loadPRs() {
  const patElem = document.getElementById('patInput');
  state.pat = patElem ? patElem.value.trim() : '';

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
  showTypingLoader();
  const loadStartTime = Date.now();
  const MIN_LOAD_TIME = 1500;

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

    // Persist PRs for the reports page
    try { localStorage.setItem('reviewradar-prs', JSON.stringify(state.allPRs)); } catch(e) {}

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
    document.getElementById('filterControls').style.display = 'flex';
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
    const elapsed = Date.now() - loadStartTime;
    const remaining = Math.max(0, MIN_LOAD_TIME - elapsed);
    const finish = () => {
      button.disabled = false;
      const icon = document.getElementById('loadIcon');
      const spinner = document.getElementById('loadSpinner');
      if (icon) icon.classList.remove('hidden');
      if (spinner) spinner.classList.add('hidden');
      hideTypingLoader();
    };
    if (remaining > 0) {
      setTimeout(finish, remaining);
    } else {
      finish();
    }
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
  const elem = document.getElementById('autoRefreshToggle');
  if (!elem) return;
  const enabled = elem.checked;
  localStorage.setItem('auto-refresh-enabled', enabled ? 'true' : 'false');
  if (enabled) {
    startAutoRefresh();
    showMessage('Auto-refresh enabled ✅', 'success');
  } else {
    stopAutoRefresh();
    showMessage('Auto-refresh disabled', 'info');
  }
}

export function toggleNotifications() {
  const elem = document.getElementById('notificationsToggle');
  if (!elem) return;
  const enabled = elem.checked;
  if (enabled) {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission().then((permission) => {
        if (permission === 'granted') {
          state.notificationsEnabled = true;
          localStorage.setItem('notifications-enabled', 'true');
          showMessage('Notifications enabled 🔔', 'success');
        } else {
          const notifElem = document.getElementById('notificationsToggle');
          if (notifElem) notifElem.checked = false;
          localStorage.setItem('notifications-enabled', 'false');
          showMessage('Notification permission denied', 'error');
        }
      });
    } else if (
      'Notification' in window &&
      Notification.permission === 'granted'
    ) {
      state.notificationsEnabled = true;
      localStorage.setItem('notifications-enabled', 'true');
      showMessage('Notifications enabled 🔔', 'success');
    } else {
      showMessage('Notifications not supported in your browser', 'error');
      const notifElem = document.getElementById('notificationsToggle');
      if (notifElem) notifElem.checked = false;
      localStorage.setItem('notifications-enabled', 'false');
    }
  } else {
    state.notificationsEnabled = false;
    localStorage.setItem('notifications-enabled', 'false');
    showMessage('Notifications disabled', 'info');
  }
}

export function clearChangesNotif() {
  const el = document.getElementById('changesNotif');
  el.classList.add('hidden');
  el.classList.remove('inline-flex');
}

export function updateRefreshInterval() {
  const elem = document.getElementById('refreshInterval');
  if (elem) {
    state.refreshInterval = parseInt(elem.value) || 5;
  }
  localStorage.setItem('refresh-interval', state.refreshInterval.toString());
  const autoElem = document.getElementById('autoRefreshToggle');
  if (autoElem && autoElem.checked) {
    stopAutoRefresh();
    startAutoRefresh();
  }
}

export function startAutoRefresh() {
  if (state.autoRefreshTimer) stopAutoRefresh();

  if (!state.pat) {
    showMessage('Please load PRs first', 'error');
    const elem = document.getElementById('autoRefreshToggle');
    if (elem) elem.checked = false;
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
  const elem = document.getElementById('refreshStatus');
  if (elem) elem.textContent = `Last updated: ${now}`;
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
    const countElem = document.getElementById('changesCount');
    if (countElem) countElem.textContent = changeCount;
    const el = document.getElementById('changesNotif');
    if (el) {
      el.classList.remove('hidden');
      el.classList.add('inline-flex');
    }
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

  // Restore previously selected repos
  const savedSelections = localStorage.getItem('selected-repos');
  if (savedSelections) {
    try {
      const selections = JSON.parse(savedSelections);
      selections.forEach((repo) => {
        if (repos.includes(repo)) {
          state.selectedRepos.add(repo);
        }
      });
    } catch (e) {
      console.warn('Failed to restore repo selections:', e);
    }
  }

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
  // Auto-select newly added repos
  state.selectedRepos.add(repoName);
  const currentSelections = Array.from(state.selectedRepos);
  localStorage.setItem('selected-repos', JSON.stringify(currentSelections));
}

export function savePatToken() {
  const elem = document.getElementById('patInput');
  if (!elem) {
    showMessage('Error: Form not found', 'error');
    return;
  }
  const patVal = elem.value.trim();
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
  }
  // Modal elements
  const modalInput = document.getElementById('modalPatInputWrap');
  const modalSaved = document.getElementById('modalPatSavedWrap');
  if (modalInput && modalSaved) {
    modalInput.classList.remove('hidden');
    modalSaved.classList.add('hidden');
    modalSaved.classList.remove('flex');
  }
  const patElem = document.getElementById('patInput');
  if (patElem) patElem.focus();
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
  const patElem = document.getElementById('patInput');
  if (savedPat && patElem) {
    patElem.value = savedPat;
    hidePatInput();
  } else if (patElem) {
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
    const hasData = renderStatusReport();
    
    // Only show modal if there's data to report on
    if (!hasData) return;
    
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

export function settingsAddRepo() {
  const input = document.getElementById('addRepoInput');
  if (!input) return;
  const repo = input.value.trim();
  if (repo && repo.includes('/')) {
    saveRepo(repo);
    input.value = '';
    showMessage('Repository added ✅', 'success');
    // Update settings repo list if it exists
    if (window.renderSettingsRepos) {
      window.renderSettingsRepos();
    }
  } else if (repo) {
    alert('Invalid format. Use owner/repo (e.g., facebook/react)');
  } else {
    alert('Please enter a repository name');
  }
}

export function initializeApp() {
  const savedPat = localStorage.getItem('github-pat');
  const patElem = document.getElementById('patInput');
  if (savedPat && patElem) {
    patElem.value = savedPat;
    hidePatInput();
  }
  toggleHelpText(!!savedPat);

  const savedAutoRefresh =
    localStorage.getItem('auto-refresh-enabled') === 'true';
  const savedInterval = localStorage.getItem('refresh-interval');
  const savedNotifications =
    localStorage.getItem('notifications-enabled') === 'true';

  if (savedAutoRefresh) {
    const elem = document.getElementById('autoRefreshToggle');
    if (elem) elem.checked = true;
  }
  if (savedInterval) {
    state.refreshInterval = parseInt(savedInterval);
    const elem = document.getElementById('refreshInterval');
    if (elem) elem.value = state.refreshInterval;
  }
  if (savedNotifications) {
    state.notificationsEnabled = true;
    const elem = document.getElementById('notificationsToggle');
    if (elem) {
      elem.checked = true;
    }
  }

  const savedTheme = localStorage.getItem('reviewradar-theme');
  const prefersLight = window.matchMedia('(prefers-color-scheme: light)').matches;
  const effectiveTheme = savedTheme || (prefersLight ? 'light' : 'dark');
  if (effectiveTheme === 'light') {
    document.documentElement.classList.add('light-mode');
    document.documentElement.classList.remove('dark-mode');
  } else {
    document.documentElement.classList.add('dark-mode');
    document.documentElement.classList.remove('light-mode');
  }
  updateThemeIcon();

  updateRadarImage();

  loadSavedRepos();

  // Auto-load PRs if PAT exists and we're on the dashboard page
  const isDashboard = document.getElementById('prTable') !== null;
  if (savedPat && isDashboard) {
    state.pat = savedPat;
    loadPRs();
  } else if (isDashboard) {
    // No PAT — render the appropriate empty state
    renderTable();
  }

  document.addEventListener('click', (e) => {
    const selector = document.getElementById('repoSelector');
    if (selector && !selector.contains(e.target)) {
      closeRepoDropdown();
    }
  });

  const patInputElem = document.getElementById('patInput');
  if (patInputElem) {
    patInputElem.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        savePatToken();
      }
    });
  }

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeSettingsModal();
    }
  });

  const autoRefreshElem = document.getElementById('autoRefreshToggle');
  if (autoRefreshElem) {
    autoRefreshElem.addEventListener('change', () => {
      localStorage.setItem(
        'auto-refresh-enabled',
        autoRefreshElem.checked,
      );
    });
  }

  const refreshIntervalElem = document.getElementById('refreshInterval');
  if (refreshIntervalElem) {
    refreshIntervalElem.addEventListener('change', () => {
      const interval = refreshIntervalElem.value;
      localStorage.setItem('refresh-interval', interval);
    });
  }
}

export function openPRDrawer(prId) {
  const drawer = document.getElementById('prDrawer');
  const backdrop = document.getElementById('prDrawerBackdrop');
  
  if (!drawer || !backdrop) return;

  // Get PR data from state map
  const pr = state.prDataMap[prId];
  if (!pr) {
    console.error('PR data not found for ID:', prId);
    return;
  }

  // Helper function to replace media with placeholder text
  function stripMediaFromHtml(html) {
    const div = document.createElement('div');
    div.innerHTML = html;
    
    // Replace all img tags
    const imgs = div.querySelectorAll('img');
    imgs.forEach(img => {
      const placeholder = document.createElement('div');
      placeholder.style.cssText = 'background:var(--border-faint);border:1px dashed var(--border-subtle);border-radius:8px;padding:12px;margin:12px 0;color:var(--muted);font-size:12px;text-align:center;font-style:italic;';
      placeholder.textContent = 'media not available';
      img.replaceWith(placeholder);
    });
    
    // Replace all video tags
    const videos = div.querySelectorAll('video');
    videos.forEach(video => {
      const placeholder = document.createElement('div');
      placeholder.style.cssText = 'background:var(--border-faint);border:1px dashed var(--border-subtle);border-radius:8px;padding:12px;margin:12px 0;color:var(--muted);font-size:12px;text-align:center;font-style:italic;';
      placeholder.textContent = 'media not available';
      video.replaceWith(placeholder);
    });
    
    return div.innerHTML;
  }

  // Populate drawer content
  document.getElementById('prDrawerTitle').textContent = pr.title || 'Untitled PR';
  
  // Import marked for markdown parsing
  import('marked').then(({ marked }) => {
    // Configure marked to render HTML and images properly
    marked.setOptions({
      breaks: true,
      gfm: true
    });
    const description = pr.body || '*(No description provided)*';
    const html = marked(description);
    const cleanHtml = stripMediaFromHtml(html);
    document.getElementById('prDrawerDescription').innerHTML = cleanHtml;
  });

  // Render comments and reviews with markdown parsing
  const commentsContainer = document.getElementById('prDrawerComments');
  const allComments = [];

  // Add reviews
  if (pr.reviews && pr.reviews.length > 0) {
    pr.reviews.forEach(review => {
      allComments.push({
        author: review.user?.login || 'unknown',
        avatar: review.user?.avatar_url,
        body: review.body || `*(${review.state})*`,
        date: review.submitted_at || review.created_at,
        state: review.state,
        type: 'review'
      });
    });
  }

  // Add PR comments
  if (pr.comments && pr.comments.length > 0) {
    pr.comments.forEach(comment => {
      allComments.push({
        author: comment.user?.login || 'unknown',
        avatar: comment.user?.avatar_url,
        body: comment.body,
        date: comment.created_at,
        type: 'comment'
      });
    });
  }

  // Sort by date (oldest first)
  allComments.sort((a, b) => new Date(a.date) - new Date(b.date));

  if (allComments.length === 0) {
    commentsContainer.innerHTML = '<p class="text-muted-dim italic">No comments or reviews yet</p>';
  } else {
    import('marked').then(({ marked }) => {
      // Configure marked to render HTML and images properly
      marked.setOptions({
        breaks: true,
        gfm: true
      });
      commentsContainer.innerHTML = allComments.map(c => {
        const date = new Date(c.date);
        const dateStr = date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const badge = c.type === 'review' ? `<span style="display:inline-block;margin-left:8px;padding:2px 8px;border-radius:4px;background:var(--green);color:var(--ink-light);font-size:10px;font-weight:bold;">${c.state}</span>` : '';
        const bodyHtml = marked(c.body || '');
        const cleanBodyHtml = stripMediaFromHtml(bodyHtml);
        return `
          <div style="border-left:2px solid var(--border-faint);padding-left:12px;pb:4px;">
            <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;">
              <span style="font-weight:600;color:var(--text-primary);font-size:13px;">${c.author}</span>
              <span style="font-size:11px;color:var(--muted);">${dateStr}</span>
              ${badge}
            </div>
            <div class="prose dark:prose-invert text-sm leading-relaxed break-words prose-p:my-1 prose-headings:my-2 prose-code:bg-black/10 dark:prose-code:bg-black/30 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-pre:bg-black/10 dark:prose-pre:bg-black/30 prose-pre:p-2 prose-pre:rounded prose-pre:text-xs">${cleanBodyHtml}</div>
          </div>
        `;
      }).join('');
    });
  }

  // Show drawer
  backdrop.style.display = 'block';
  void backdrop.offsetWidth; // Trigger reflow
  backdrop.classList.remove('opacity-0');
  
  drawer.style.display = 'block';
  void drawer.offsetWidth; // Trigger reflow
  drawer.classList.remove('translate-x-full');

  // Prevent body scroll
  document.body.style.overflow = 'hidden';
}

export function closePRDrawer() {
  const drawer = document.getElementById('prDrawer');
  const backdrop = document.getElementById('prDrawerBackdrop');
  
  if (!drawer || !backdrop) return;

  backdrop.classList.add('opacity-0');
  drawer.classList.add('translate-x-full');
  
  setTimeout(() => {
    backdrop.style.display = 'none';
    drawer.style.display = 'none';
    document.body.style.overflow = '';
  }, 300);
}
