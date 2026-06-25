'use client';

import { useState, useEffect, useCallback, type ReactNode } from 'react';

interface Step {
  id: string;
  title: string;
  description: string;
  targetSelector: string;
  position?: 'bottom' | 'top';
}

const STEPS: Step[] = [
  {
    id: 'welcome',
    title: 'Welcome to ReviewRadar',
    description: 'This interactive tour walks you through every feature — from the live dashboard to the PR table, complexity scoring, and more. All data here is demo data; nothing leaves your browser.',
    targetSelector: '#tour-header',
    position: 'bottom',
  },
  {
    id: 'header',
    title: 'Dashboard Overview',
    description: 'The header shows the dashboard title, your signed-in user, and a DEMO badge. On the real dashboard, click "Load PRs" to fetch fresh data — here it loads automatically with sample PRs.',
    targetSelector: '#tour-header',
    position: 'bottom',
  },
  {
    id: 'search',
    title: 'Smart Search & Filters',
    description: 'Search any PR by title or number, and filter by users or repos. In the live dashboard, dropdown menus let you multi-select specific users and repos. Active filters appear as pills inside the search bar.',
    targetSelector: '#tour-search',
    position: 'bottom',
  },
  {
    id: 'stats',
    title: 'PR Status Overview',
    description: 'See your PR landscape at a glance: total PRs, yours, needs attention, approved, and blocked. Click any stat card to quick-filter the table below. The dashboard adapts instantly.',
    targetSelector: '#tour-stats',
    position: 'bottom',
  },
  {
    id: 'table',
    title: 'The PR Table',
    description: 'Every row is a pull request. Columns include title, author, status, approvals, build status, file count, size, and complexity score. Click any row to open the detail drawer.',
    targetSelector: '#tour-table',
    position: 'top',
  },
  {
    id: 'status',
    title: 'Status & Build Columns',
    description: 'Click any status badge or build result to instantly filter the table by that value. Green = passing, red = failing, amber = running, gray = pending.',
    targetSelector: '#tour-table',
    position: 'top',
  },
  {
    id: 'complexity',
    title: 'Complexity Scoring',
    description: 'Each PR gets a complexity score (0-100+) based on weighted code churn, file spread, and rewrite intensity. Low (green) < 20, Moderate (cyan) 20-40, High (amber) 40-60, Very High (red) 60+. Hover the score for a detailed breakdown.',
    targetSelector: '#tour-table',
    position: 'top',
  },
  {
    id: 'click',
    title: 'Click to Explore',
    description: 'Click a PR row to open the detail drawer with full PR info. Click an author avatar, status badge, label tag, or build status to filter the table by that value. The dashboard is fully interactive.',
    targetSelector: '#tour-table',
    position: 'top',
  },
  {
    id: 'sorting',
    title: 'Multi-Column Sorting',
    description: 'Click any column header to sort by that column. Hold Shift and click multiple headers for multi-column sorting (e.g., sort by status, then by complexity).',
    targetSelector: '#tour-table',
    position: 'top',
  },
  {
    id: 'pagination',
    title: 'Pagination & Page Size',
    description: 'Navigate pages with Previous/Next buttons at the bottom of the table. Change the page size (10, 25, 50, 100, All) to control how many PRs you see at once.',
    targetSelector: '#tour-table',
    position: 'top',
  },
  {
    id: 'theme',
    title: 'Light & Dark Mode',
    description: 'Toggle between light and dark themes using the sun/moon icon in the top navigation bar. Your preference is saved automatically. All colors adapt seamlessly.',
    targetSelector: '#tour-header',
    position: 'bottom',
  },
  {
    id: 'finish',
    title: 'You\'re Ready!',
    description: 'That covers the key features. Head to Settings to add your own GitHub repos, or connect via OAuth. The dashboard is fully client-side — no backend, your tokens stay safe.',
    targetSelector: '#tour-header',
    position: 'bottom',
  },
];

const TOUR_DISMISSED_KEY = 'reviewradar-tour-dismissed';

export default function DemoTour({ children }: { children: ReactNode }) {
  const [active, setActive] = useState(() => {
    if (typeof window === 'undefined') return false;
    return !localStorage.getItem(TOUR_DISMISSED_KEY);
  });
  const [stepIndex, setStepIndex] = useState(0);
  const [tooltipPos, setTooltipPos] = useState<{ top: number; left: number }>({ top: 0, left: 0 });

  const dismiss = useCallback(() => {
    setActive(false);
    localStorage.setItem(TOUR_DISMISSED_KEY, '1');
  }, []);

  const step = STEPS[stepIndex];

  const updatePosition = useCallback(() => {
    const el = document.querySelector(step.targetSelector);
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const gap = 14;
    const tooltipW = 380;
    const maxLeft = window.innerWidth - tooltipW - 12;
    const centerLeft = rect.left + rect.width / 2 - tooltipW / 2;
    const clampedLeft = Math.max(12, Math.min(centerLeft, maxLeft));

    switch (step.position) {
      case 'bottom':
        setTooltipPos({ top: rect.bottom + gap, left: clampedLeft });
        break;
      case 'top':
        setTooltipPos({ top: rect.top - gap, left: clampedLeft });
        break;
    }
  }, [step]);

  useEffect(() => {
    updatePosition();
    window.addEventListener('scroll', updatePosition, { passive: true });
    window.addEventListener('resize', updatePosition, { passive: true });
    return () => {
      window.removeEventListener('scroll', updatePosition);
      window.removeEventListener('resize', updatePosition);
    };
  }, [updatePosition]);

  useEffect(() => {
    const el = document.querySelector(step.targetSelector);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setTimeout(updatePosition, 450);
    }
  }, [stepIndex, step.targetSelector, updatePosition]);

  useEffect(() => {
    const el = document.querySelector(step.targetSelector);
    if (el) {
      el.classList.add('tour-highlight');
      return () => { el.classList.remove('tour-highlight'); };
    }
  }, [step.targetSelector, stepIndex]);

  const isFirst = stepIndex === 0;
  const isLast = stepIndex === STEPS.length - 1;

  return (
    <>
      {active && <div className="tour-backdrop" onClick={dismiss} />}
      {active && (
        <div
          className="tour-tooltip"
          style={{ position: 'fixed', top: tooltipPos.top, left: tooltipPos.left }}
          role="dialog"
          aria-label={step.title}
          aria-describedby="tour-desc"
        >
          <button
            onClick={dismiss}
            className="tour-close"
            aria-label="Close tour"
          >×</button>
          <div className="tour-step-indicator">
            {STEPS.map((s, i) => (
              <span key={s.id} className={`tour-dot ${i === stepIndex ? 'active' : ''} ${i < stepIndex ? 'done' : ''}`} />
            ))}
          </div>
          <h3 className="tour-title">{step.title}</h3>
          <p id="tour-desc" className="tour-desc">{step.description}</p>
          <div className="tour-actions">
            {!isFirst ? (
              <button className="tour-btn tour-btn-ghost" onClick={() => setStepIndex((i) => i - 1)}>
                Back
              </button>
            ) : <div />}
            {!isLast ? (
              <button className="tour-btn tour-btn-primary" onClick={() => setStepIndex((i) => i + 1)}>
                Next
              </button>
            ) : (
              <button className="tour-btn tour-btn-primary" onClick={dismiss}>
                Got it
              </button>
            )}
          </div>
        </div>
      )}

      {children}
    </>
  );
}
