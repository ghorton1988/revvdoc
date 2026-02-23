'use client';

/**
 * /vehicles/[vehicleId]/timeline
 *
 * Unified service timeline for one vehicle.
 * Merges:
 *   - Upcoming bookings (pending / accepted) — shown at top, soonest first
 *   - Completed service history records — shown newest first below
 *
 * Uses the existing ServiceTimelineEntry component for completed records.
 * Renders a lightweight UpcomingBookingCard for pending/accepted bookings.
 */

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { getHistoryByVehicle } from '@/services/serviceHistoryService';
import { getUpcomingBookingsForVehicle } from '@/services/bookingService';
import { getVehicleById } from '@/services/vehicleService';
import { ServiceTimelineEntry } from '@/components/vehicles/ServiceTimelineEntry';
import type { ServiceHistoryRecord, Booking, Vehicle, BookingStatus } from '@/types';

// ── Upcoming booking card ─────────────────────────────────────────────────────

const UPCOMING_STATUS_STYLES: Partial<Record<BookingStatus, { label: string; cls: string }>> = {
  pending:  { label: 'Awaiting Technician', cls: 'bg-amber-500/15 text-amber-400 border-amber-500/30' },
  accepted: { label: 'Technician Assigned', cls: 'bg-brand/15 text-brand border-brand/30' },
};

const TIME_WINDOW_RANGES: Record<string, string> = {
  morning:   '8 AM – 12 PM',
  afternoon: '12 PM – 5 PM',
  evening:   '5 PM – 8 PM',
};

function UpcomingBookingCard({ booking }: { booking: Booking }) {
  const style = UPCOMING_STATUS_STYLES[booking.status] ?? {
    label: booking.status,
    cls: 'bg-surface-raised text-text-muted border-surface-border',
  };

  const dateStr = booking.scheduledAt.toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  });
  const windowStr = booking.scheduledTimeWindow
    ? ` · ${booking.scheduledTimeWindow.charAt(0).toUpperCase() + booking.scheduledTimeWindow.slice(1)} (${TIME_WINDOW_RANGES[booking.scheduledTimeWindow] ?? ''})`
    : '';

  return (
    <div className="relative pl-6 pb-6">
      {/* Timeline spine */}
      <span className="absolute left-0 top-1.5 h-full w-px bg-surface-mid" aria-hidden="true" />
      <span className="absolute left-[-4px] top-1.5 h-2.5 w-2.5 rounded-full bg-amber-500/60 ring-2 ring-surface-base" aria-hidden="true" />

      <Link
        href={`/bookings/${booking.bookingId}`}
        className="block bg-surface-mid rounded-xl p-4 border border-surface-border hover:border-brand/40 transition-colors"
      >
        <div className="flex items-start justify-between gap-2">
          <div>
            <span className="text-[10px] font-medium text-amber-400 uppercase tracking-wider">
              Upcoming
            </span>
            <p className="text-sm font-semibold text-text-primary mt-0.5">
              {booking.serviceSnapshot.name}
            </p>
            <p className="text-xs text-text-muted mt-1">
              {dateStr}{windowStr}
            </p>
          </div>
          <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border shrink-0 ${style.cls}`}>
            {style.label}
          </span>
        </div>
        {booking.notes && (
          <p className="text-xs text-text-muted mt-2 italic">{booking.notes}</p>
        )}
      </Link>
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function VehicleTimelinePage({
  params,
}: {
  params: { vehicleId: string };
}) {
  const { vehicleId } = params;
  const { user }      = useAuth();
  const router        = useRouter();

  const [vehicle,  setVehicle]  = useState<Vehicle | null>(null);
  const [history,  setHistory]  = useState<ServiceHistoryRecord[]>([]);
  const [upcoming, setUpcoming] = useState<Booking[]>([]);
  const [loading,  setLoading]  = useState(true);

  useEffect(() => {
    if (!user) return;

    Promise.all([
      getVehicleById(vehicleId),
      getHistoryByVehicle(vehicleId),
      getUpcomingBookingsForVehicle(user.uid, vehicleId),
    ])
      .then(([v, hist, up]) => {
        setVehicle(v);
        setHistory(hist);
        setUpcoming(up);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.uid, vehicleId]);

  const hasAny = upcoming.length > 0 || history.length > 0;

  return (
    <div className="pb-8">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 pt-6 pb-4">
        <button onClick={() => router.back()} className="text-text-secondary -ml-1 shrink-0">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>
        <div>
          <h1 className="text-lg font-bold text-text-primary">Service Timeline</h1>
          {vehicle && (
            <p className="text-xs text-text-muted">
              {vehicle.year} {vehicle.make} {vehicle.model}
              {vehicle.nickname ? ` — ${vehicle.nickname}` : ''}
            </p>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="px-4">
        {loading ? (
          <div className="pl-6 space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-24 bg-surface-raised rounded-xl animate-pulse" />
            ))}
          </div>
        ) : !hasAny ? (
          <div className="flex flex-col items-center justify-center py-16 space-y-3">
            <svg
              className="text-text-muted"
              width="40"
              height="40"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            <p className="text-text-muted text-sm">No service history yet.</p>
            <Link href="/book" className="px-4 py-2 bg-brand text-surface-base rounded-lg text-sm font-semibold">
              Book a Service
            </Link>
          </div>
        ) : (
          <div>
            {/* Upcoming bookings — soonest first */}
            {upcoming.length > 0 && (
              <div>
                <p className="text-[10px] font-semibold text-text-muted uppercase tracking-wider mb-3">
                  Upcoming
                </p>
                {[...upcoming]
                  .sort((a, b) => a.scheduledAt.getTime() - b.scheduledAt.getTime())
                  .map((b) => (
                    <UpcomingBookingCard key={b.bookingId} booking={b} />
                  ))}
              </div>
            )}

            {/* Completed service history — newest first */}
            {history.length > 0 && (
              <div className={upcoming.length > 0 ? 'mt-4' : ''}>
                <p className="text-[10px] font-semibold text-text-muted uppercase tracking-wider mb-3">
                  Completed
                </p>
                {history.map((record) => (
                  <ServiceTimelineEntry key={record.recordId} record={record} />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
