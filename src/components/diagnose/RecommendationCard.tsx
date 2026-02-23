/**
 * RecommendationCard — displays a single service recommendation
 * from the AI Troubleshooting Assistant analysis.
 *
 * UI CONTRACT: Per the symptomService spec, all recommendations
 * MUST be labeled "Suggested based on your description — not a diagnosis."
 * This label is embedded in the card header — do not remove it.
 *
 * Shows the recommended service details and a "Book This Service" CTA
 * that links to /book?serviceId=<id>.
 *
 * Usage:
 *   <RecommendationCard service={service} rank={1} />
 */

import Link from 'next/link';
import { formatPrice, formatDuration } from '@/lib/formatters';
import type { Service } from '@/types';

const CATEGORY_LABEL: Record<string, string> = {
  mechanic:   'Mechanic',
  detailing:  'Detailing',
  diagnostic: 'Diagnostic',
};

interface RecommendationCardProps {
  service: Service;
  /** 1-based rank — shown as a numbered badge. */
  rank: number;
}

export function RecommendationCard({ service, rank }: RecommendationCardProps) {
  return (
    <div className="bg-surface-raised border border-surface-border rounded-xl overflow-hidden">
      {/* Disclaimer banner — required by UI CONTRACT */}
      <div className="px-4 py-2 bg-brand/5 border-b border-brand/15">
        <p className="text-[10px] text-brand font-medium leading-snug">
          Suggested based on your description — not a diagnosis.
        </p>
      </div>

      <div className="p-4 space-y-3">
        {/* Rank badge + service name */}
        <div className="flex items-start gap-3">
          <span className="shrink-0 h-6 w-6 rounded-full bg-brand text-black text-xs font-bold flex items-center justify-center">
            {rank}
          </span>
          <div className="flex-1 min-w-0">
            <p className="text-xs text-text-muted uppercase tracking-wide">
              {CATEGORY_LABEL[service.category] ?? service.category}
            </p>
            <h3 className="text-base font-bold text-text-primary leading-snug">{service.name}</h3>
          </div>
          <div className="shrink-0 text-right">
            <p className="text-brand font-bold">{formatPrice(service.basePrice)}</p>
            <p className="text-[10px] text-text-muted">{formatDuration(service.durationMins)}</p>
          </div>
        </div>

        {/* Service description */}
        {service.description && (
          <p className="text-sm text-text-secondary leading-relaxed">{service.description}</p>
        )}

        {/* Book CTA */}
        <Link
          href={`/book?serviceId=${service.serviceId}`}
          className="block w-full text-center bg-brand hover:bg-brand/90 active:scale-[0.98] transition-all rounded-xl py-2.5 font-semibold text-black text-sm"
        >
          Book This Service
        </Link>
      </div>
    </div>
  );
}
