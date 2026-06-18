import { fetchCurrentUser, fetchReposPRs, fetchPRReviews } from '../lib/githubApi';
import type { PR } from '../lib/store';

interface LoadPRsMessage {
  type: 'LOAD_PRS';
  repos: string[];
}

interface AbortMessage {
  type: 'ABORT';
}

interface ProgressMessage {
  type: 'PROGRESS';
  phase: 'repos' | 'prs';
  current: number;
  total: number;
}

interface ResultMessage {
  type: 'RESULT';
  prs: PR[];
  errors: string[];
  user: string;
  complete: boolean;
}

interface ErrorMessage {
  type: 'ERROR';
  message: string;
}

type WorkerMessage = LoadPRsMessage | AbortMessage;

let aborted = false;

function checkAborted(): boolean {
  return aborted;
}

self.onmessage = async (e: MessageEvent<WorkerMessage>) => {
  const msg = e.data;

  if (msg.type === 'ABORT') {
    aborted = true;
    return;
  }

  if (msg.type !== 'LOAD_PRS') return;

  aborted = false;
  const { repos } = msg;
  const errors: string[] = [];

  try {
    const user = await fetchCurrentUser();
    if (checkAborted()) return;

    self.postMessage({ type: 'PROGRESS', phase: 'repos', current: 0, total: repos.length } satisfies ProgressMessage);

    // Fetch repos in parallel to minimise total load time.
    const repoResults = await Promise.all(
      repos.map(async (repo) => {
        if (checkAborted()) return { repo, prs: [] as PR[], error: null as string | null };
        try {
          const prs = await fetchReposPRs(repo);
          return { repo, prs, error: null };
        } catch (e: any) {
          const message = e?.message || String(e);
          errors.push(`${repo}: ${message}`);
          return { repo, prs: [] as PR[], error: message };
        }
      })
    );

    if (checkAborted()) return;

    const allPRsData: PR[] = [];
    for (const { prs } of repoResults) {
      allPRsData.push(...prs);
    }

    // Sort by updated_at desc for a consistent initial display order
    allPRsData.sort((a, b) => new Date(b.updated_at || 0).getTime() - new Date(a.updated_at || 0).getTime());

    self.postMessage({ type: 'PROGRESS', phase: 'repos', current: repos.length, total: repos.length } satisfies ProgressMessage);

    // Post basic PRs immediately (fast — no detail calls needed)
    self.postMessage({
      type: 'RESULT',
      prs: allPRsData,
      errors: [...errors],
      user,
      complete: false,
    } satisfies ResultMessage);

    if (checkAborted()) return;

    // Fetch PR details in batches, posting progressively enriched results
    const BATCH_SIZE = 20;
    const enrichedByIndex = new Array<PR | undefined>(allPRsData.length);
    let batchErrors: string[] = [];

    for (let i = 0; i < allPRsData.length; i += BATCH_SIZE) {
      if (checkAborted()) return;

      const batchStart = i;
      const batchEnd = Math.min(i + BATCH_SIZE, allPRsData.length);
      const batch = allPRsData.slice(batchStart, batchEnd);

      const batchResults = await Promise.all(
        batch.map((pr) =>
          fetchPRReviews(pr).catch((e) => {
            batchErrors.push(`PR #${pr.number}: ${e?.message || String(e)}`);
            return pr;
          })
        )
      );

      if (checkAborted()) return;

      for (let j = 0; j < batchResults.length; j++) {
        enrichedByIndex[batchStart + j] = batchResults[j];
      }

      // Build the merged list once per batch, avoiding O(N²) copies.
      const merged = allPRsData.map((basic, idx) => enrichedByIndex[idx] || basic);
      const isComplete = batchEnd >= allPRsData.length;

      self.postMessage({
        type: 'RESULT',
        prs: merged,
        errors: [...errors, ...batchErrors],
        user,
        complete: isComplete,
      } satisfies ResultMessage);

      self.postMessage({ type: 'PROGRESS', phase: 'prs', current: batchEnd, total: allPRsData.length } satisfies ProgressMessage);
    }

    // If there were no PRs at all, still emit a complete result so the UI stops loading.
    if (allPRsData.length === 0) {
      self.postMessage({
        type: 'RESULT',
        prs: [],
        errors: [...errors],
        user,
        complete: true,
      } satisfies ResultMessage);
    }
  } catch (e: any) {
    self.postMessage({
      type: 'ERROR',
      message: e?.message || String(e),
    } satisfies ErrorMessage);
  }
};
