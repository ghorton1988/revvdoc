/**
 * PartsUsedList — collapsed list of parts used in a service record.
 *
 * Renders inside <ServiceTimelineEntry> when a record has partsUsed.length > 0.
 * Shows part name, brand, part number, and warranty expiry if present.
 *
 * TODO Wave 2: implement expand/collapse toggle (collapsed by default).
 */

import type { PartRecord } from '@/types';

interface PartsUsedListProps {
  parts: PartRecord[];
}

export function PartsUsedList({ parts }: PartsUsedListProps) {
  if (parts.length === 0) return null;

  return (
    <div className="border-t border-surface-high/30 pt-2 mt-2">
      <p className="text-xs font-medium text-text-muted uppercase tracking-wider mb-2">
        Parts Used ({parts.length})
      </p>
      <ul className="space-y-1">
        {parts.map((part, idx) => (
          <li key={idx} className="flex items-start justify-between gap-2">
            <div>
              <p className="text-sm text-text-primary">{part.name}</p>
              {part.brand && (
                <p className="text-xs text-text-muted">{part.brand}</p>
              )}
              {part.partNumber && (
                <p className="text-xs text-text-muted font-mono">#{part.partNumber}</p>
              )}
            </div>
            {part.warrantyExpires && (
              <span className="text-xs text-status-optimal shrink-0">
                Warranty
              </span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
