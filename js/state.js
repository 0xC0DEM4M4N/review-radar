export const state = {
  allPRs: [],
  currentUser: null,
  currentFilter: 'all',
  currentSort: [],
  activeFilters: {
    label: null,
    status: null,
    author: null,
  },
  autoRefreshTimer: null,
  refreshInterval: 5,
  notificationsEnabled: false,
  previousPRState: {},
  pat: null,
  selectedRepos: new Set(),
  repoColorMap: {},
  repoDropdownOpen: false,
  repoSelectionSnapshot: null,
  prDataMap: {}, // Store PR data by ID for drawer
  lastLoadedRepos: new Set(),
  columnOrder: ['title','author','status','myaction','approvals','comments','labels','build','created','updated','details'],
};

export const REPO_COLORS = [
  'repo-color-0',
  'repo-color-1',
  'repo-color-2',
  'repo-color-3',
  'repo-color-4',
  'repo-color-5',
  'repo-color-6',
  'repo-color-7',
];
