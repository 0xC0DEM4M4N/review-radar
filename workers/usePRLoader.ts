'use client';

import { useCallback, useRef, useEffect } from 'react';
import type { PR } from '../lib/store';

interface ProgressCallback {
  (phase: 'repos' | 'prs', current: number, total: number): void;
}

interface ResultCallback {
  (prs: PR[], errors: string[], user: string, complete: boolean): void;
}

interface ErrorCallback {
  (message: string): void;
}

export function usePRLoader() {
  const workerRef = useRef<Worker | null>(null);
  const callbacksRef = useRef<{
    onProgress?: ProgressCallback;
    onResult: ResultCallback;
    onError: ErrorCallback;
  } | null>(null);

  const terminate = useCallback(() => {
    if (workerRef.current) {
      workerRef.current.terminate();
      workerRef.current = null;
    }
  }, []);

  const load = useCallback((
    repos: string[],
    callbacks: {
      onProgress?: ProgressCallback;
      onResult: ResultCallback;
      onError: ErrorCallback;
    }
  ) => {
    callbacksRef.current = callbacks;

    // Abort any in-progress load before starting a new one.
    if (workerRef.current) {
      workerRef.current.postMessage({ type: 'ABORT' });
    }

    // Reuse a single worker instance; only create a new one if needed.
    let worker = workerRef.current;
    if (!worker) {
      worker = new Worker(
        new URL('./githubWorker.ts', import.meta.url),
        { type: 'module' }
      );
      workerRef.current = worker;

      worker.onmessage = (e: MessageEvent) => {
        const msg = e.data;
        const cbs = callbacksRef.current;
        if (!cbs) return;

        switch (msg.type) {
          case 'PROGRESS':
            cbs.onProgress?.(msg.phase, msg.current, msg.total);
            break;
          case 'RESULT':
            cbs.onResult(msg.prs, msg.errors, msg.user, msg.complete);
            if (msg.complete) {
              worker?.terminate();
              workerRef.current = null;
              callbacksRef.current = null;
            }
            break;
          case 'ERROR':
            cbs.onError(msg.message);
            worker?.terminate();
            workerRef.current = null;
            callbacksRef.current = null;
            break;
        }
      };

      worker.onerror = (err) => {
        callbacksRef.current?.onError(err.message || 'Worker error');
        worker?.terminate();
        workerRef.current = null;
        callbacksRef.current = null;
      };
    }

    worker.postMessage({ type: 'LOAD_PRS', repos });
  }, []);

  useEffect(() => {
    return () => {
      terminate();
    };
  }, [terminate]);

  return { load, terminate };
}
