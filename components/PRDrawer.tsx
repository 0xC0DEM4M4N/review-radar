'use client';

import { useEffect, useState } from 'react';
import { PR } from '@/lib/store';
import { computeComplexityBreakdown } from '@/lib/complexity';
import { marked } from 'marked';
import DOMPurify from 'dompurify';
import { useTranslations } from 'next-intl';

function stripMediaFromHtml(html: string, mediaNotAvailable: string) {
  const div = document.createElement('div');
  div.innerHTML = html;
  div.querySelectorAll('img').forEach((img) => {
    const p = document.createElement('div');
    p.style.cssText = 'background:var(--border-faint);border:1px dashed var(--border-subtle);border-radius:8px;padding:12px;margin:12px 0;color:var(--muted);font-size:12px;text-align:center;font-style:italic;';
    p.textContent = mediaNotAvailable;
    img.replaceWith(p);
  });
  div.querySelectorAll('video').forEach((video) => {
    const p = document.createElement('div');
    p.style.cssText = 'background:var(--border-faint);border:1px dashed var(--border-subtle);border-radius:8px;padding:12px;margin:12px 0;color:var(--muted);font-size:12px;text-align:center;font-style:italic;';
    p.textContent = mediaNotAvailable;
    video.replaceWith(p);
  });
  return div.innerHTML;
}

export default function PRDrawer({ pr, onClose }: { pr: PR | null; onClose: () => void }) {
  const [description, setDescription] = useState('');
  const [commentsHtml, setCommentsHtml] = useState('');
  const t = useTranslations('components.prdrawer');
  const tc = useTranslations('common');

  useEffect(() => {
    if (!pr) return;
    marked.setOptions({ breaks: true, gfm: true });
    const desc = pr.body || t('noDescription');
    const rawDescHtml = marked.parse(desc) as string;
    const cleanDescHtml = DOMPurify.sanitize(rawDescHtml, { USE_PROFILES: { html: true } });
    setDescription(stripMediaFromHtml(cleanDescHtml, tc('mediaNotAvailable')));

    const allComments: any[] = [];
    if (pr.reviews) {
      pr.reviews.forEach((review) => {
        allComments.push({
          author: review.user?.login || t('unknownAuthor'),
          avatar: review.user?.avatar_url,
          body: review.body || t('reviewState', { state: review.state }),
          date: review.submitted_at || review.created_at,
          state: review.state,
          type: 'review',
        });
      });
    }
    if (pr.comments) {
      pr.comments.forEach((comment) => {
        allComments.push({
          author: comment.user?.login || t('unknownAuthor'),
          avatar: comment.user?.avatar_url,
          body: comment.body,
          date: comment.created_at,
          type: 'comment',
        });
      });
    }
    allComments.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    const html = allComments.map((c) => {
      const date = new Date(c.date);
      const dateStr = date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      const badge = c.type === 'review' ? `<span style="display:inline-block;margin-left:8px;padding:2px 8px;border-radius:4px;background:var(--green);color:var(--ink-light);font-size:10px;font-weight:bold;">${c.state}</span>` : '';
      const rawBodyHtml = marked.parse(c.body || '') as string;
      const cleanBodyHtml = DOMPurify.sanitize(rawBodyHtml, { USE_PROFILES: { html: true } });
      const bodyHtml = stripMediaFromHtml(cleanBodyHtml, tc('mediaNotAvailable'));
      return `
        <div style="border-left:2px solid var(--border-faint);padding-left:12px;margin-bottom:16px;">
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;">
            <span style="font-weight:600;color:var(--text-primary);font-size:13px;">${c.author}</span>
            <span style="font-size:11px;color:var(--muted);">${dateStr}</span>
            ${badge}
          </div>
          <div class="prose pr-drawer-comments" style="color:var(--muted);">${bodyHtml}</div>
        </div>
      `;
    }).join('');
    setCommentsHtml(html || `<p style="color:var(--muted-dim);font-style:italic;">${tc('noCommentsYet')}</p>`);
  }, [pr, t, tc]);

  const breakdown = pr?.files ? computeComplexityBreakdown(pr.files) : null;

  if (!pr) return null;

  return (
    <>
      <div
        className="fixed inset-0 bg-black/50 transition-opacity z-[300]"
        onClick={onClose}
      />
      <div
        className="top-0 right-0 bottom-0 w-full max-w-lg bg-ink-light border-l border-border-faint overflow-y-auto p-6 absolute z-[310]"
      >
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold text-text-primary pr-4">{pr.title || t('untitledPR')}</h2>
          <button onClick={onClose} className="text-muted hover:text-text-primary text-xl">{t('close')}</button>
        </div>

        {/* Complexity breakdown */}
        {breakdown && breakdown.score > 0 && (
          <div className="mb-6 rounded-lg border border-border-faint bg-surface p-4">
            <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">
              {tc('complexityTitle')}
            </h3>
            <div className="mb-3 flex items-baseline gap-2">
              <span
                className="text-2xl font-bold"
                style={{
                  color:
                    breakdown.score >= 70
                      ? 'var(--red)'
                      : breakdown.score >= 50
                        ? 'var(--amber)'
                        : breakdown.score >= 30
                          ? 'var(--cyan)'
                          : breakdown.score >= 15
                            ? 'var(--green)'
                            : 'var(--muted-dim)',
                }}
              >
                {breakdown.score}
              </span>
              <span className="text-sm text-muted">— {breakdown.label}</span>
            </div>
            <div className="mb-3 grid grid-cols-2 gap-2 text-xs text-muted">
              <div>
                <span className="block text-[10px] uppercase tracking-wide text-muted-dim">{tc('complexityFilesLabel')}</span>
                {breakdown.relevantFiles} relevant{breakdown.ignoredFiles > 0 ? `, ${breakdown.ignoredFiles} ignored` : ''}
              </div>
              <div>
                <span className="block text-[10px] uppercase tracking-wide text-muted-dim">{tc('complexityChurnLabel')}</span>
                +{breakdown.totalAdditions} / −{breakdown.totalDeletions}
              </div>
              <div>
                <span className="block text-[10px] uppercase tracking-wide text-muted-dim">{tc('complexitySpreadLabel')}</span>
                {breakdown.fileSpread}
              </div>
              <div>
                <span className="block text-[10px] uppercase tracking-wide text-muted-dim">{tc('complexityIntensityLabel')}</span>
                {breakdown.intensity}
              </div>
            </div>
            {breakdown.topFiles.length > 0 && (
              <div>
                <span className="mb-1 block text-[10px] uppercase tracking-wide text-muted-dim">{tc('complexityTopFilesLabel')}</span>
                <div className="space-y-1">
                  {breakdown.topFiles.map((f) => (
                    <div key={f.filename} className="flex items-center justify-between text-xs">
                      <span className="truncate text-text-primary" style={{ maxWidth: '70%' }} title={f.filename}>
                        {f.filename}
                      </span>
                      <span className="text-muted" style={{ fontFamily: "'Space Mono', monospace" }}>
                        +{f.churn} × {f.weight}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        <div className="mb-6 text-sm text-muted leading-relaxed pr-drawer-desc prose" dangerouslySetInnerHTML={{ __html: description }} />
        <div className="pr-drawer-comments" dangerouslySetInnerHTML={{ __html: commentsHtml }} />
      </div>
    </>
  );
}
