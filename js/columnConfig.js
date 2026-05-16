export const DEFAULT_COLUMNS = [
  'title',
  'author',
  'status',
  'myaction',
  'approvals',
  'comments',
  'labels',
  'build',
  'created',
  'updated',
  'details',
];

export const COLUMN_META = {
  title: {
    label: 'Pull request',
    sortKey: 'title',
    width: null,
    narrow: false,
    titleHeader: true,
  },
  author: {
    label: 'Author',
    sortKey: 'author',
    width: '45px',
    narrow: true,
  },
  status: {
    label: 'Status',
    sortKey: 'status',
    width: '100px',
    narrow: true,
  },
  myaction: {
    label: 'My Action',
    sortKey: 'myaction',
    width: '45px',
    narrow: true,
  },
  approvals: {
    label: 'Approvals',
    sortKey: 'approvals',
    width: '75px',
    narrow: true,
  },
  comments: {
    label: 'Comments',
    sortKey: 'comments',
    width: '75px',
    narrow: true,
  },
  labels: {
    label: 'Labels',
    sortKey: 'labels',
    width: '130px',
    narrow: true,
  },
  build: {
    label: 'Build',
    sortKey: 'buildStatus',
    width: '70px',
    narrow: false,
  },
  created: {
    label: 'Created',
    sortKey: 'created',
    width: '60px',
    narrow: true,
  },
  updated: {
    label: 'Updated',
    sortKey: 'updated',
    width: '60px',
    narrow: true,
  },
  details: {
    label: '',
    sortKey: null,
    width: '45px',
    narrow: true,
  },
};

const STORAGE_KEY = 'reviewradar-columns';

export function loadColumnConfig() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch {
    // fall through
  }
  return [...DEFAULT_COLUMNS];
}

export function saveColumnConfig(columns) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(columns));
}

export function resetColumnConfig() {
  localStorage.removeItem(STORAGE_KEY);
  return [...DEFAULT_COLUMNS];
}
