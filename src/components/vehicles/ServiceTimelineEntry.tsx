/**
 * ServiceTimelineEntry — one row in the vehicle service history timeline.
 *
 * Displays:
 *  - Date + service type badge
 *  - Mileage at service, cost, and tech notes
 *  - Expandable <PartsUsedList> if partsUsed.length > 0
 *  - Expandable warranty info if warrantyInfo is present
 *  - Photo thumbnails if photoUrls.length > 0
 *
 * TODO Wave 2: implement
 *  - Expand/collapse interaction for parts and photos
 *  - WarrantyInfo inline render
 *  - Photo grid (next/image thumbnails, tap-to-enlarge)
 */

import type { ServiceHistoryRecord, ServiceCategory } from '@/types';
import { PartsUsedList } from './PartsUsedList';

const CATEGORY_LABELS: Record<ServiceCategory, string> = {
  mechanic: 'Mechanic',
  detailing: 'Detailing',
  diagnostic: 'Diagnostic',
};

interface ServiceTimelineEntryProps {
  record: ServiceHistoryRecord;
}

export function ServiceTimelineEntry({ record }: ServiceTimelineEntryProps) {
  const dateStr = record.date instanceof Date
    ? record.date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
    : String(record.date);

  const costStr = `$${(record.cost / 100).toFixed(2)}`;
  const hasParts = (record.partsUsed ?? []).length > 0;

  return (
    <div className="relative pl-6 pb-6">
      {/* Timeline spine */}
      <span className="absolute left-0 top-1.5 h-full w-px bg-surface-mid" aria-hidden="true" />
      <span className="absolute left-[-4px] top-1.5 h-2.5 w-2.5 rounded-full bg-brand ring-2 ring-surface-base" aria-hidden="true" />

      <div className="bg-surface-mid rounded-xl p-4 space-y-2">
        {/* Header row */}
        <div className="flex items-start justify-between gap-2">
          <div>
            <span className="text-xs font-medium text-brand uppercase tracking-wider">
              {CATEGORY_LABELS[record.serviceType]}
            </span>
            <p className="text-sm text-text-muted mt-0.5">{dateStr}</p>
          </div>
          <div className="text-right">
            <p className="text-sm font-semibold text-text-primary">{costStr}</p>
            <p className="text-xs text-text-muted">{record.mileageAtService.toLocaleString()} mi</p>
          </div>
        </div>

        {/* Tech notes */}
        {record.techNotes && (
          <p className="text-sm text-text-secondary">{record.techNotes}</p>
        )}

        {/* Parts used */}
        {hasParts && <PartsUsedList parts={record.partsUsed} />}

        {/* Warranty summary */}
        {record.warrantyInfo && (
          <p className="text-xs text-status-optimal">
            Warranty: {record.warrantyInfo.description}
            {record.warrantyInfo.expiresAt ? ` — expires ${String(record.warrantyInfo.expiresAt)}` : ''}
          </p>
        )}
      </div>
    </div>
  );
}
