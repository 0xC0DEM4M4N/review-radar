import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type PRFile = {
  filename: string;
  additions: number;
  deletions: number;
  changes: number;
  status: string;
  patch?: string;
};

export type PR = {
  id: number;
  title: string;
  html_url: string;
  created_at: string;
  updated_at: string;
  user?: { login: string; avatar_url?: string };
  repository_url?: string;
  url?: string;
  number?: number;
  head?: { sha: string; repo?: { full_name: string } };
  pull_request?: { url: string };
  draft?: boolean;
  labels?: { name: string; color: string }[];
  reviews?: { state: string; user?: { login: string; avatar_url?: string }; submitted_at?: string; created_at?: string; body?: string }[];
  comments?: { user?: { login: string; avatar_url?: string }; created_at: string; body: string }[];
  buildStatus?: { state: string; conclusion?: string; checkRuns?: any[] };
  mergeable_state?: string;
  body?: string;
  files?: PRFile[];
  additions?: number;
  deletions?: number;
  changed_files?: number;
};

export type SortState = { column: string; direction: 'asc' | 'desc' }[];

export type ColumnKey =
  | 'title'
  | 'author'
  | 'status'
  | 'myaction'
  | 'approvals'
  | 'comments'
  | 'labels'
  | 'build'
  | 'files'
  | 'size'
  | 'complexity'
  | 'created'
  | 'updated'
  | 'details';

export const DEFAULT_COLUMNS: ColumnKey[] = [
  'title',
  'author',
  'status',
  'myaction',
  'approvals',
  'comments',
  'labels',
  'build',
  'files',
  'size',
  'complexity',
  'created',
  'updated',
  'details',
];

export const COLUMN_META: Record<ColumnKey, { sortKey: string | null; width: string | null; narrow: boolean }> = {
  title: { sortKey: 'title', width: null, narrow: false },
  author: { sortKey: 'author', width: '45px', narrow: true },
  status: { sortKey: 'status', width: '100px', narrow: true },
  myaction: { sortKey: 'myaction', width: '45px', narrow: true },
  approvals: { sortKey: 'approvals', width: '75px', narrow: true },
  comments: { sortKey: 'comments', width: '75px', narrow: true },
  labels: { sortKey: 'labels', width: '130px', narrow: true },
  build: { sortKey: 'buildStatus', width: '70px', narrow: false },
  files: { sortKey: 'files', width: '55px', narrow: true },
  size: { sortKey: 'size', width: '90px', narrow: true },
  complexity: { sortKey: 'complexity', width: '80px', narrow: true },
  created: { sortKey: 'created', width: '60px', narrow: true },
  updated: { sortKey: 'updated', width: '60px', narrow: true },
  details: { sortKey: null, width: '45px', narrow: true },
};

interface AppState {
  allPRs: PR[];
  currentUser: string | null;
  currentFilter: string;
  currentSort: SortState;
  activeFilters: { label: string | null; status: string | null; author: string | null; build: string | null };
  selectedRepos: Set<string>;
  searchQuery: string;
  selectedUsers: string[];
  columnOrder: ColumnKey[];
  notificationsEnabled: boolean;
  refreshInterval: number;
  prDataMap: Record<number, PR>;
  lastLoadedRepos: Set<string>;
  setAllPRs: (prs: PR[]) => void;
  setCurrentUser: (user: string | null) => void;
  setFilter: (filter: string) => void;
  setSort: (sort: SortState) => void;
  toggleSort: (column: string) => void;
  setActiveFilter: (type: 'label' | 'status' | 'author' | 'build', value: string | null) => void;
  setSelectedRepos: (repos: Set<string>) => void;
  toggleRepo: (repo: string) => void;
  setSearchQuery: (query: string) => void;
  toggleSelectedUser: (user: string) => void;
  clearSelectedUsers: () => void;
  setColumnOrder: (order: ColumnKey[]) => void;
  setNotificationsEnabled: (v: boolean) => void;
  setRefreshInterval: (v: number) => void;
  setPRDataMap: (map: Record<number, PR>) => void;
  setLastLoadedRepos: (repos: Set<string>) => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      allPRs: [],
      currentUser: null,
      currentFilter: 'all',
      currentSort: [],
      activeFilters: { label: null, status: null, author: null, build: null },
      selectedRepos: new Set(),
      searchQuery: '',
      selectedUsers: [],
      columnOrder: [...DEFAULT_COLUMNS],
      notificationsEnabled: false,
      refreshInterval: 5,
      prDataMap: {},
      lastLoadedRepos: new Set(),
      setAllPRs: (prs) => set({ allPRs: prs }),
      setCurrentUser: (user) => set({ currentUser: user }),
      setFilter: (filter) => set({ currentFilter: filter }),
      setSort: (sort) => set({ currentSort: sort }),
      toggleSort: (column) =>
        set((state) => {
          const existing = state.currentSort.find((s) => s.column === column);
          if (!existing) return { currentSort: [{ column, direction: 'asc' }] };
          if (existing.direction === 'asc') {
            return { currentSort: [{ column, direction: 'desc' }] };
          }
          return { currentSort: [] };
        }),
      setActiveFilter: (type, value) =>
        set(() => ({
          activeFilters: { label: null, status: null, author: null, build: null, [type]: value },
        })),
      setSelectedRepos: (repos) => set({ selectedRepos: repos }),
      toggleRepo: (repo) =>
        set((state) => {
          const next = new Set(state.selectedRepos);
          if (next.has(repo)) next.delete(repo);
          else next.add(repo);
          return { selectedRepos: next };
        }),
      setSearchQuery: (query) => set({ searchQuery: query }),
      toggleSelectedUser: (user) =>
        set((state) => {
          const next = new Set(state.selectedUsers);
          if (next.has(user)) next.delete(user);
          else next.add(user);
          return { selectedUsers: Array.from(next) };
        }),
      clearSelectedUsers: () => set({ selectedUsers: [] }),
      setColumnOrder: (order) => set({ columnOrder: order }),
      setNotificationsEnabled: (v) => set({ notificationsEnabled: v }),
      setRefreshInterval: (v) => set({ refreshInterval: v }),
      setPRDataMap: (map) => set({ prDataMap: map }),
      setLastLoadedRepos: (repos) => set({ lastLoadedRepos: repos }),
    }),
    {
      name: 'reviewradar-storage',
      partialize: (state) => ({
        selectedRepos: Array.from(state.selectedRepos),
        columnOrder: state.columnOrder,
        notificationsEnabled: state.notificationsEnabled,
        refreshInterval: state.refreshInterval,
        lastLoadedRepos: Array.from(state.lastLoadedRepos),
      }),
    }
  )
);
