export interface PRFile {
  filename: string;
  additions: number;
  deletions: number;
  changes: number;
  status: string;
  patch?: string;
}

export interface PRSize {
  additions: number;
  deletions: number;
  changedFiles: number;
}

// Directories that strongly indicate generated/vendored content
const GENERATED_DIRS = [
  'node_modules/',
  'dist/',
  'build/',
  'out/',
  'coverage/',
  '.next/',
  'target/',
  'bin/',
  'obj/',
  '.turbo/',
  'vendor/',
  'generated/',
  'autogen/',
  '__pycache__/',
  '.venv/',
  'venv/',
  'public/assets/',
  'static/assets/',
];

// Extensions that are typically generated, binary, or non-code
const LOW_WEIGHT_EXTS = new Set([
  // Generated / bundled
  '.min.js',
  '.bundle.js',
  '.map',
  // Lockfiles
  '.lock',
  // Images
  '.png',
  '.jpg',
  '.jpeg',
  '.gif',
  '.svg',
  '.webp',
  '.ico',
  '.bmp',
  // Docs
  '.md',
  '.rst',
  '.txt',
  // Design / binary
  '.pdf',
  '.psd',
  '.ai',
  '.sketch',
  '.fig',
  // Data
  '.csv',
  '.xls',
  '.xlsx',
  '.json', // often generated/config; handled separately
  // Fonts
  '.woff',
  '.woff2',
  '.ttf',
  '.eot',
  '.otf',
]);

// Extensions that are clearly code/tests and should get full weight
const CODE_EXTS = new Set([
  '.py',
  '.js',
  '.ts',
  '.tsx',
  '.jsx',
  '.go',
  '.java',
  '.kt',
  '.rb',
  '.php',
  '.cs',
  '.c',
  '.h',
  '.cpp',
  '.cc',
  '.swift',
  '.rs',
  '.scala',
  '.clj',
  '.cljs',
  '.elm',
  '.erl',
  '.ex',
  '.exs',
  '.hs',
  '.lua',
  '.ml',
  '.nim',
  '.pas',
  '.pl',
  '.r',
  '.sh',
  '.bash',
  '.zsh',
  '.fish',
  '.ps1',
  '.bat',
  '.cmd',
  '.sql',
  '.graphql',
  '.gql',
]);

// Template / markup files that affect runtime
const TEMPLATE_EXTS = new Set([
  '.html',
  '.htm',
  '.svelte',
  '.vue',
  '.hbs',
  '.handlebars',
  '.ejs',
  '.pug',
  '.jade',
  '.njk',
  '.liquid',
  '.erb',
  '.haml',
  '.slim',
]);

// Config / infra files
const CONFIG_EXTS = new Set([
  '.yaml',
  '.yml',
  '.toml',
  '.ini',
  '.cfg',
  '.conf',
  '.properties',
]);

// Test file patterns
const TEST_PATTERNS = [
  /\.(test|spec)\.(js|ts|jsx|tsx|py|go|java|rb|php|cs|c|cpp|cc|swift|rs)$/i,
  /[_-](test|spec)\.(js|ts|jsx|tsx|py|go|java|rb|php|cs|c|cpp|cc|swift|rs)$/i,
  /\/(test|tests|__tests__|spec|specs)\/[^/]+\.(js|ts|jsx|tsx|py|go|java|rb|php|cs|c|cpp|cc|swift|rs)$/i,
];

function isTestFile(filename: string): boolean {
  return TEST_PATTERNS.some((p) => p.test(filename));
}

function getExtension(filename: string): string {
  const base = filename.split('/').pop() || '';
  // Handle compound extensions like .test.ts, .min.js, .d.ts
  if (base.endsWith('.d.ts')) return '.d.ts';
  if (base.endsWith('.test.ts')) return '.test.ts';
  if (base.endsWith('.spec.ts')) return '.spec.ts';
  if (base.endsWith('.test.tsx')) return '.test.tsx';
  if (base.endsWith('.spec.tsx')) return '.spec.tsx';
  if (base.endsWith('.test.js')) return '.test.js';
  if (base.endsWith('.spec.js')) return '.spec.js';
  if (base.endsWith('.test.jsx')) return '.test.jsx';
  if (base.endsWith('.spec.jsx')) return '.spec.jsx';
  const idx = base.lastIndexOf('.');
  return idx > 0 ? base.slice(idx) : '';
}

/**
 * Compute file relevance weight in [0, 1].
 * 1.0 = code/tests/key runtime templates
 * 0.5 = build scripts / infra / CI configs
 * 0.1 = docs
 * 0.0 = generated artifacts, vendored deps, images, lockfiles
 */
export function getFileWeight(filename: string): number {
  const lower = filename.toLowerCase();

  // Generated / vendored directories
  for (const dir of GENERATED_DIRS) {
    if (lower.includes('/' + dir) || lower.startsWith(dir)) {
      return 0.0;
    }
  }

  const ext = getExtension(lower);

  // Lockfiles by name
  const baseName = lower.split('/').pop() || '';
  if (
    baseName === 'package-lock.json' ||
    baseName === 'yarn.lock' ||
    baseName === 'pnpm-lock.yaml' ||
    baseName === 'poetry.lock' ||
    baseName === 'pipfile.lock' ||
    baseName === 'composer.lock' ||
    baseName === 'gemfile.lock' ||
    baseName === 'cargo.lock' ||
    baseName === 'mix.lock' ||
    baseName === 'podfile.lock' ||
    baseName === 'pubspec.lock' ||
    baseName === 'flake.lock'
  ) {
    return 0.0;
  }

  // Minified / bundled / maps
  if (ext === '.min.js' || ext === '.bundle.js' || ext === '.map') {
    return 0.0;
  }

  // Images
  if (
    ext === '.png' ||
    ext === '.jpg' ||
    ext === '.jpeg' ||
    ext === '.gif' ||
    ext === '.svg' ||
    ext === '.webp' ||
    ext === '.ico' ||
    ext === '.bmp'
  ) {
    return 0.0;
  }

  // Docs-only
  if (ext === '.md' || ext === '.rst' || ext === '.txt') {
    return 0.1;
  }

  // Config / infra / CI (low weight)
  if (
    ext === '.yaml' ||
    ext === '.yml' ||
    ext === '.toml' ||
    ext === '.ini' ||
    ext === '.cfg' ||
    ext === '.conf' ||
    ext === '.properties' ||
    baseName === 'dockerfile' ||
    baseName.startsWith('dockerfile.') ||
    baseName.startsWith('docker-compose') ||
    baseName === 'makefile' ||
    baseName === 'rakefile' ||
    baseName === 'gemfile' ||
    ext === '.tf' ||
    ext === '.tfvars' ||
    ext === '.hcl'
  ) {
    return 0.2;
  }

  // JSON — config vs generated. Treat as 0.2 unless it's a lockfile (handled above)
  if (ext === '.json') {
    return 0.2;
  }

  // CSS / styling files
  if (ext === '.css' || ext === '.scss' || ext === '.sass' || ext === '.less' || ext === '.styl' || ext === '.pcss') {
    return 0.8;
  }

  // Test files — low weight
  if (isTestFile(filename)) {
    return 0.2;
  }

  // Source code
  if (CODE_EXTS.has(ext)) {
    return 1.0;
  }

  // Runtime templates
  if (TEMPLATE_EXTS.has(ext)) {
    return 1.0;
  }

  // Type definition files
  if (ext === '.d.ts') {
    return 0.3;
  }

  // Unknown / catch-all: give some weight since it could be code in an unusual language
  return 0.6;
}

/**
 * Compute PR size metrics from file list.
 */
export function computePRSize(files: PRFile[]): PRSize {
  let additions = 0;
  let deletions = 0;
  let changedFiles = 0;

  for (const f of files) {
    if (getFileWeight(f.filename) > 0) {
      additions += f.additions || 0;
      deletions += f.deletions || 0;
      changedFiles += 1;
    }
  }

  return { additions, deletions, changedFiles };
}

export interface ComplexityBreakdown {
  score: number;
  label: string;
  totalFiles: number;
  relevantFiles: number;
  ignoredFiles: number;
  totalAdditions: number;
  totalDeletions: number;
  weightedChurn: number;
  fileSpread: number;
  intensity: number;
  topFiles: { filename: string; weight: number; churn: number; contribution: number }[];
}

/**
 * Compute complexity score for a PR.
 *
 * Algorithm (logarithmic additive components):
 * 1. Per-file churn: m_i = max(additions_i, deletions_i), capped at M=500
 * 2. Weighted code churn: S_code = sum(w(p_i) * m_i) — no total cap
 * 3. File spread: 10 * ln(1 + F)
 * 4. Intensity: 5 * r/(1+r)  where r = C / (1 + |A-D|)
 * 5. Combined: ln(1 + S_code) * 5 + ln(1 + F) * 10 + 5 * r/(1+r) - 12
 *
 * This spreads large PRs across the full 0-100 range instead of
 * clustering them at the top. 100 is still reserved for extremes.
 */
export function computeComplexity(files: PRFile[]): number {
  return computeComplexityBreakdown(files).score;
}

export function computeComplexityBreakdown(files: PRFile[]): ComplexityBreakdown {
  const M = 500; // per-file churn cap

  let totalAdditions = 0;
  let totalDeletions = 0;
  let weightedChurn = 0;
  let relevantFileCount = 0;
  let ignoredFileCount = 0;
  const fileContributions: { filename: string; weight: number; churn: number; contribution: number }[] = [];

  for (const f of files) {
    const weight = getFileWeight(f.filename);
    const a = f.additions || 0;
    const d = f.deletions || 0;

    if (weight === 0) {
      ignoredFileCount++;
      continue;
    }

    const m = Math.min(Math.max(a, d), M);
    const contribution = weight * m;

    totalAdditions += a;
    totalDeletions += d;
    weightedChurn += contribution;
    relevantFileCount++;

    fileContributions.push({ filename: f.filename, weight, churn: m, contribution });
  }

  if (relevantFileCount === 0) {
    return {
      score: 0,
      label: getComplexityLabel(0, 0),
      totalFiles: files.length,
      relevantFiles: 0,
      ignoredFiles: ignoredFileCount,
      totalAdditions,
      totalDeletions,
      weightedChurn: 0,
      fileSpread: 0,
      intensity: 0,
      topFiles: [],
    };
  }

  const C = totalAdditions + totalDeletions;
  const net = Math.abs(totalAdditions - totalDeletions);
  const intensityRatio = C / (1 + net);
  const intensityFactor = intensityRatio / (1 + intensityRatio);

  const churnComponent = Math.log(1 + weightedChurn) * 5.5;
  const fileComponent = Math.log(1 + relevantFileCount) * 10;
  const intensityComponent = 5 * intensityFactor;

  const BASELINE = 12;
  const raw = churnComponent + fileComponent + intensityComponent - BASELINE;
  const score = Math.max(1, Math.min(100, Math.round(raw)));

  // Sort by contribution and take top 5
  fileContributions.sort((a, b) => b.contribution - a.contribution);

  return {
    score,
    label: getComplexityLabel(score, relevantFileCount),
    totalFiles: files.length,
    relevantFiles: relevantFileCount,
    ignoredFiles: ignoredFileCount,
    totalAdditions,
    totalDeletions,
    weightedChurn: Math.round(weightedChurn * 10) / 10,
    fileSpread: Math.round(Math.log(1 + relevantFileCount) * 100) / 100,
    intensity: Math.round(intensityFactor * 100) / 100,
    topFiles: fileContributions.slice(0, 5),
  };
}

/**
 * Get a human-readable complexity label.
 * The label is the maximum (most severe) of the file-count tier and the score tier.
 *
 * File tiers:  <5=Trivial  <15=Small  <35=Medium  <50=Large  50+=Enormous
 * Score tiers: <15=Trivial  <30=Small  <50=Medium  <70=Large  <90=Complex  90+=Very Complex
 */
export function getComplexityLabel(score: number, relevantFiles: number = 0): string {
  const TIERS = ['Trivial', 'Small', 'Medium', 'Large', 'Complex', 'Enormous', 'Very Complex'];

  let fileIdx = 6;
  if (relevantFiles < 5) fileIdx = 0;
  else if (relevantFiles < 15) fileIdx = 1;
  else if (relevantFiles < 35) fileIdx = 2;
  else if (relevantFiles < 50) fileIdx = 3;
  else fileIdx = 5; // Enormous

  let scoreIdx = 6;
  if (score < 15) scoreIdx = 0;
  else if (score < 30) scoreIdx = 1;
  else if (score < 50) scoreIdx = 2;
  else if (score < 70) scoreIdx = 3;
  else if (score < 90) scoreIdx = 4; // Complex
  else scoreIdx = 6; // Very Complex

  return TIERS[Math.max(fileIdx, scoreIdx)];
}

/**
 * Format size as "+A / -D" string.
 */
export function formatSize(additions: number, deletions: number): string {
  return `+${additions} / -${deletions}`;
}

/**
 * Calculate estimated review time in minutes for a PR.
 * Approved PRs return 0 (no effort needed).
 */
export function computeEffort(pr: {
  additions?: number;
  deletions?: number;
  changed_files?: number;
  files?: PRFile[];
  body?: string;
  reviews?: { state: string }[];
}): number {
  const approved = pr.reviews?.some((r) => r.state === 'APPROVED');
  if (approved) return 0;

  const totalChanges = (pr.additions || 0) + (pr.deletions || 0);
  const fileCount = pr.changed_files || pr.files?.length || 0;
  const descLen = pr.body?.length || 0;

  const readingTime = totalChanges / 5;
  const contextTime = fileCount * 1.5;
  const descTime = descLen / 1000;

  let complexity = 0;
  if (pr.files && pr.files.length > 0) {
    try { complexity = computeComplexity(pr.files); } catch {}
  }
  const multiplier = 1 + (complexity / 100);

  return Math.round((readingTime + contextTime + descTime) * multiplier);
}

/**
 * Format effort minutes into a human-readable string like "45m" or "2h 15m".
 */
export function formatEffort(minutes: number): string {
  if (minutes <= 0) return '—';
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}
