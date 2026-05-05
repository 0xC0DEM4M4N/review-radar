import { state, REPO_COLORS } from './state.js';
import { renderTable } from './render.js';

function resolveRepoColorIndex(repoName) {
  if (!(repoName in state.repoColorMap)) {
    const usedColors = new Set(Object.values(state.repoColorMap));
    for (let i = 0; i < REPO_COLORS.length; i++) {
      if (!usedColors.has(i)) {
        state.repoColorMap[repoName] = i;
        return i;
      }
    }
    state.repoColorMap[repoName] =
      Object.keys(state.repoColorMap).length % REPO_COLORS.length;
  }
  return state.repoColorMap[repoName];
}

export function updateRepoSelectorText() {
  const count = state.selectedRepos.size;
  const text =
    count === 0
      ? 'No repos selected'
      : count === 1
        ? Array.from(state.selectedRepos)[0]
        : `${count} repos selected`;
  document.getElementById('repoSelectorText').textContent = text;
}

export function renderRepoList() {
  const saved = localStorage.getItem('github-repos');
  const repos = saved ? JSON.parse(saved) : [];
  const listEl = document.getElementById('repoSelectorList');
  const searchTerm = document.getElementById('repoSearch').value.toLowerCase();

  const filtered = repos.filter((r) => r.toLowerCase().includes(searchTerm));

  if (filtered.length === 0) {
    listEl.innerHTML =
      '<div class="p-4 text-center font-space-mono text-xs text-white/30">No repos match your search</div>';
    return;
  }

  listEl.innerHTML = filtered
    .map((repo) => {
      const isSelected = state.selectedRepos.has(repo);
      const colorIdx = getRepoColorIndex(repo);
      const colorClass = REPO_COLORS[colorIdx];
      return `
      <div class="repo-option flex cursor-pointer items-center gap-2.5 rounded-md p-2 font-space-mono text-xs text-white/70 transition-colors duration-150 hover:bg-white/[0.05] ${isSelected ? 'selected' : ''}" onclick="toggleRepoSelection('${repo}')">
        <div class="repo-option-checkbox flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded border border-white/30 text-[10px] text-cyan">${isSelected ? '✓' : ''}</div>
        <span class="repo-indicator inline-block h-2 w-2 shrink-0 rounded-full ${colorClass}"></span>
        <span>${repo}</span>
      </div>
    `;
    })
    .join('');
}

export function toggleRepoDropdown() {
  state.repoDropdownOpen = !state.repoDropdownOpen;
  const dropdown = document.getElementById('repoSelectorDropdown');
  const trigger = document.getElementById('repoSelectorTrigger');

  if (state.repoDropdownOpen) {
    // Snapshot current selection before opening
    state.repoSelectionSnapshot = new Set(state.selectedRepos);
    dropdown.classList.remove('hidden');
    trigger.classList.add('active');
    document.getElementById('repoSearch').focus();
    renderRepoList();
  } else {
    dropdown.classList.add('hidden');
    trigger.classList.remove('active');
    // Check if selection changed and reload if so
    const changed = selectionChanged(state.repoSelectionSnapshot, state.selectedRepos);
    state.repoSelectionSnapshot = null;
    if (changed && state.pat) {
      window.loadPRs();
    }
  }
}

export function closeRepoDropdown() {
  if (!state.repoDropdownOpen) return;
  state.repoDropdownOpen = false;
  document.getElementById('repoSelectorDropdown').classList.add('hidden');
  document.getElementById('repoSelectorTrigger').classList.remove('active');
  // Check if selection changed and reload if so
  const changed = selectionChanged(state.repoSelectionSnapshot, state.selectedRepos);
  state.repoSelectionSnapshot = null;
  if (changed && state.pat) {
    window.loadPRs();
  }
}

function selectionChanged(before, after) {
  if (!before || !after) return false;
  if (before.size !== after.size) return true;
  for (const item of before) {
    if (!after.has(item)) return true;
  }
  return false;
}

export function filterRepoList() {
  renderRepoList();
}

export function toggleRepoSelection(repo) {
  if (state.selectedRepos.has(repo)) {
    state.selectedRepos.delete(repo);
  } else {
    state.selectedRepos.add(repo);
  }
  updateRepoSelectorText();
  renderRepoList();

  if (state.allPRs.length > 0) {
    renderTable();
  }
}

export function selectAllRepos() {
  const saved = localStorage.getItem('github-repos');
  const repos = saved ? JSON.parse(saved) : [];
  repos.forEach((r) => state.selectedRepos.add(r));
  updateRepoSelectorText();
  renderRepoList();
  if (state.allPRs.length > 0) renderTable();
}

export function clearRepoSelection() {
  state.selectedRepos.clear();
  updateRepoSelectorText();
  renderRepoList();
  if (state.allPRs.length > 0) renderTable();
}

export function getRepoColorIndex(repoName) {
  return resolveRepoColorIndex(repoName);
}
