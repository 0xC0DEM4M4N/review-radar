# ReviewRadar

A client-side\* GitHub PR dashboard that gives you a live sweep of every open pull request across your repos — who's blocked, what needs attention, what's ready to ship, and which workflows are failing.

\* The dashboard UI is entirely client-side. GitHub API calls are proxied through a Cloudflare Worker that encrypts your token via AES-GCM and stores it in an HttpOnly, Secure, SameSite=Strict cookie — your token never touches the browser's network tab.

---

## Features

- **Live radar sweeps** — Auto-refresh on a configurable interval. Browser notifications for approvals, comments, and build changes.
- **PR-aware filtering** — Filter by all, mine, needs attention, approved, changes requested, pending, or conflicts. Click any label or status badge to filter instantly.
- **Diff at a glance** — Review status, build state, mentions, labels, merge conflicts, and last updated — all visible without leaving the dashboard.
- **Workflow dashboard** — See the latest workflow run for your main branch and all failing feature branches. Expand any card to inspect individual jobs and quality gates (check runs). Branches with failures are auto-highlighted with inline summaries of what broke.
- **Landing page workflows card** — The home page surfaces failing workflows at a glance, showing status dots, branch names, and inline failure summaries for both live (authenticated) and demo visitors.
- **Per-repo default branch config** — Store a custom default branch name per repository in Settings, so workflow dashboards always target the right branch.
- **Size & Complexity scoring** — See the real footprint and calculated complexity of every PR (see below).
- **Privacy-first auth** — Use a GitHub PAT or OAuth. Tokens are encrypted and stored in `HttpOnly` cookies, never in `localStorage`.
- **Multi-repo support** — Sweep across as many repositories as you have access to.

---

## Workflow Dashboard

The **Workflows** page (`/workflows`) shows the CI/CD status across your repositories:

- **Main branch card** — Always visible, pinned with a cyan border. Shows the latest run with full job and check-run breakdown. Collapsible to keep the view clean.
- **Feature branches** — Only failing branches are listed, sorted by severity. Each card shows the branch name, commit message, relative time, and an inline summary of what failed (e.g. "Failing: Npm.Build.Publish.Scan, Jest Unit Tests").
- **Expand to debug** — Click any branch card to expand and inspect individual jobs and check runs. Failing tasks get a tinted red background so problems stand out.
- **Status badges** — Overall status per branch (Passing / Failing / Running / Queued) computed from both the workflow run conclusion and individual check-run results.

The landing page embeds a compact **WorkflowsCard** that surfaces the same failing-workflows data, keeping it visible from the moment you land on the site.

---

## Size & Complexity Scoring

ReviewRadar analyses every PR's changed files to surface two useful metrics in the dashboard table.

### Size Column

The **Size** column shows the raw diff footprint:

```
+additions / −deletions
```

Hovering over the value reveals the number of files changed. This gives you an immediate sense of how large a PR is, regardless of file types.

### Complexity Score

The **Complexity** column shows a score from **0 to 100**. It is not just "lines changed" — it is a weighted metric that estimates review effort by considering:

1. **What** changed (file type relevance)
2. **How much** code was rewritten (churn)
3. **How spread out** the change is (file count)
4. **How intense** the rewrite is (churn vs net change)

#### File Relevance Weighting

Each changed file is assigned a weight `w(p)` in `[0, 1]` based on its path and extension:

| Weight | Category | Examples |
|--------|----------|----------|
| `1.0` | Source code, tests, runtime templates | `.py`, `.js`, `.ts`, `.tsx`, `.go`, `.java`, `.rb`, `.rs`, `*test*`, `*.spec.*` |
| `0.8` | Styling files | `.css`, `.scss`, `.sass`, `.less` |
| `0.6` | Unknown / catch-all | Unusual extensions that might be code |
| `0.5` | Config, infra, CI, build scripts | `.yaml`, `.json`, `Dockerfile`, `.tf`, `.sh` |
| `0.3` | Type definitions | `.d.ts` |
| `0.1` | Documentation | `.md`, `.rst`, `.txt` |
| `0.0` | Generated, vendored, binary, lockfiles | `node_modules/`, `dist/`, `.next/`, `.png`, `.lock`, `.min.js`, `.map` |

**Directory heuristics** are applied first. Any file inside a known generated directory (e.g. `node_modules/`, `dist/`, `build/`, `.next/`, `target/`, `vendor/`, `generated/`, `coverage/`) gets weight `0`.

Lockfiles are identified by name (`package-lock.json`, `yarn.lock`, `pnpm-lock.yaml`, `poetry.lock`, `Cargo.lock`, etc.) and also get weight `0`.

#### The Algorithm

For each relevant file `i` in the PR:

- `a_i` = additions
- `d_i` = deletions
- `m_i = min(max(a_i, d_i), 300)` — per-file churn capped at 300

**Weighted code churn** (total capped at 2000):

```
S_code = min(Σ w(p_i) × m_i, 2000)
```

**File spread bonus** (diminishing returns for context-switching):

```
spreadBonus = 20 × ln(1 + F)
```

where `F` = number of relevant files.

**Change intensity bonus** (penalises high-churn rewrites):

```
C = total_additions + total_deletions
net = |total_additions - total_deletions|
r = C / (1 + net)
intensityBonus = 10 × ln(1 + C) × r / (1 + r)
```

**Combined score** (square-root normalisation for a gentler curve):

```
base = S_code + spreadBonus + intensityBonus
complexity = round(min(100, sqrt(base) × 2.2))
```

This scaling is tuned so that:

- Tiny PR (~20 lines, 1 file) ≈ **5–15**
- Small PR (~150 lines, 3 files) ≈ **15–30**
- Medium PR (~400 lines, 6 files) ≈ **35–50**
- Large PR (~1000 lines, 12 files) ≈ **55–75**
- Very large PR (~2000 lines, 20 files) ≈ **75–90**
- **Only the most extreme PRs (>5000 lines, 50+ files, heavy rewrite) hit 100**

#### Colour Coding

The complexity score is colour-coded in the table:

| Score Range | Colour | Meaning |
|-------------|--------|---------|
| `< 15` | Muted grey | Trivial |
| `15–39` | Green | Small |
| `40–64` | Cyan | Medium |
| `65–84` | Amber | Large |
| `85–89` | Amber | Complex |
| `≥ 90` | Red | Very Complex |

---

## Tech Stack

- [Next.js](https://nextjs.org/) 16 (App Router)
- [React](https://react.dev/) 19
- [TypeScript](https://www.typescriptlang.org/)
- [Tailwind CSS](https://tailwindcss.com/)
- [Zustand](https://github.com/pmndrs/zustand) (state management)
- [next-intl](https://next-intl-docs.vercel.app/) (i18n — English, French, Polish, Vietnamese)
- [Chart.js](https://www.chartjs.org/) (reports & historical data visualisations)

---

## Getting Started

1. **Create a GitHub Personal Access Token**
   - Go to [GitHub Settings → Developer settings → Personal access tokens](https://github.com/settings/tokens)
   - Create a classic token with the `repo` scope (or `public_repo` for public repos only)

2. **Run the app**

   ```bash
   npm install
   npm run dev
   ```

3. **Open the dashboard**
   - Paste your token in the Settings panel
   - Add repositories in `owner/repo` format
   - Click **Load PRs**

---

## Build & Deploy

```bash
npm run build
```

The app is a static export and can be deployed to any static host (Cloudflare Pages, Vercel, GitHub Pages, etc.).

See [`DEPLOY.md`](DEPLOY.md) for detailed deployment instructions.

---

## License

MIT

---

## Footnotes

<sup>\*</sup> **How the Cloudflare Worker keeps your token safe.** When you sign in via OAuth or paste a PAT, the token is sent once to a Cloudflare Worker (`POST /api/session`). The worker encrypts the token with AES-GCM using a server-side `SESSION_SECRET` and returns it as an `HttpOnly`, `Secure`, `SameSite=Strict` cookie. The raw token is never stored in `localStorage`, never exposed to client-side JavaScript, and never visible in the browser's network tab. All subsequent GitHub API calls go through the worker (`/api/github/*`), which decrypts the cookie, attaches the token as an HTTP `Authorization` header, and proxies the request. The worker also enforces per-IP rate limiting (1,000 req/min) and validates every request path against a strict allowlist — requests to non-whitelisted GitHub endpoints are rejected with a 403 before they ever reach GitHub.
