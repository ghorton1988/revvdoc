/**
 * RecallAlert — displays a single NHTSA safety recall for a vehicle.
 *
 * Rendered on the vehicle detail page and potentially on the dashboard.
 * Styled as a warning card with red/amber emphasis to convey severity.
 *
 * If multiple recalls exist, the parent maps over them:
 *   recalls.map((r) => <RecallAlert key={r.nhtsaId} recall={r} />)
 *
 * TODO Wave 2: implement
 *  - Expand/collapse for full consequence + remedy text
 *  - NHTSA campaign number link (nhtsaId → NHTSA recall search URL)
 */

import type { RecallRecord } from '@/types';

interface RecallAlertProps {
  recall: RecallRecord;
}

export function RecallAlert({ recall }: RecallAlertProps) {
  const dateStr =
    recall.reportDate instanceof Date
      ? recall.reportDate.toLocaleDateString('en-US', { year: 'numeric', month: 'short' })
      : String(recall.reportDate);

  return (
    <div className="rounded-xl border border-status-fault/30 bg-status-fault/5 p-4 space-y-2">
      {/* Badge + campaign number */}
      <div className="flex items-center gap-2">
        <span className="text-xs font-bold text-status-fault uppercase tracking-widest">
          Safety Recall
        </span>
        <span className="text-xs text-text-muted font-mono">{recall.nhtsaId}</span>
        <span className="ml-auto text-xs text-text-muted">{dateStr}</span>
      </div>

      {/* Component */}
      <p className="text-sm font-medium text-text-primary">{recall.component}</p>

      {/* Summary — truncated */}
      <p className="text-sm text-text-secondary line-clamp-3">{recall.summary}</p>

      {/* Remedy (collapsed by default — TODO expand) */}
      {recall.remedy && (
        <p className="text-xs text-text-muted">
          <span className="font-medium text-text-secondary">Remedy: </span>
          {recall.remedy}
        </p>
      )}
    </div>
  );
}
