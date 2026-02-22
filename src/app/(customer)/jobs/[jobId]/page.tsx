'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useLiveJob } from '@/hooks/useLiveJob';
import { getBookingById } from '@/services/bookingService';
import { formatPrice } from '@/lib/formatters';
import type { Booking, JobStage } from '@/types';

// ─── Stage config ─────────────────────────────────────────────────────────────

const STAGE_LABELS: Record<JobStage, string> = {
  dispatched: 'Tech Dispatched',
  en_route: 'En Route to You',
  arrived: 'Arrived',
  in_progress: 'Service in Progress',
  quality_check: 'Quality Check',
  complete: 'Service Complete',
};

const STAGE_ORDER: JobStage[] = [
  'dispatched', 'en_route', 'arrived', 'in_progress', 'quality_check', 'complete',
];

const LiveMap = dynamic(() => import('./LiveMap'), {
  ssr: false,
  loading: () => (
    <div className="flex-1 bg-surface-raised flex items-center justify-center">
      <div className="text-center space-y-2">
        <div className="w-8 h-8 border-2 border-brand border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="text-xs text-text-muted">Loading map…</p>
      </div>
    </div>
  ),
});

// ─── Stage progress bar ───────────────────────────────────────────────────────

function StageBar({ currentStage }: { currentStage: JobStage }) {
  const currentIdx = STAGE_ORDER.indexOf(currentStage);
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-0.5">
        {STAGE_ORDER.map((stage, i) => {
          const idx = STAGE_ORDER.indexOf(stage);
          const done = idx <= currentIdx;
          const isLast = i === STAGE_ORDER.length - 1;
          return (
            <div key={stage} className="flex items-center gap-0.5 flex-1 last:flex-none">
              <div
                className={`w-3 h-3 rounded-full shrink-0 transition-colors ${
                  done ? 'bg-brand' : 'bg-surface-border'
                }`}
              />
              {!isLast && (
                <div className={`h-0.5 flex-1 transition-colors ${
                  STAGE_ORDER.indexOf(STAGE_ORDER[i + 1]) <= currentIdx ? 'bg-brand' : 'bg-surface-border'
                }`} />
              )}
            </div>
          );
        })}
      </div>
      <p className="text-sm font-semibold text-text-primary">{STAGE_LABELS[currentStage]}</p>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function LiveJobPage() {
  const { jobId } = useParams<{ jobId: string }>();
  const router = useRouter();
  const { job, loading: jobLoading } = useLiveJob(jobId);
  const [booking, setBooking] = useState<Booking | null>(null);

  useEffect(() => {
    if (job?.bookingId) {
      getBookingById(job.bookingId).then(setBooking);
    }
  }, [job?.bookingId]);

  // Redirect when job is complete
  useEffect(() => {
    if (job?.currentStage === 'complete' && job.bookingId) {
      const timer = setTimeout(() => {
        router.push(`/bookings/${job.bookingId}`);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [job?.currentStage, job?.bookingId, router]);

  if (jobLoading) {
    return (
      <div className="h-[calc(100vh-7rem)] flex flex-col">
        <div className="flex-1 bg-surface-raised animate-pulse" />
        <div className="h-40 bg-surface-raised border-t border-surface-border animate-pulse" />
      </div>
    );
  }

  if (!job) {
    return (
      <div className="p-4 text-center py-16 space-y-3">
        <p className="text-text-muted">Job not found.</p>
        <Link href="/bookings" className="text-brand text-sm">
          Back to bookings
        </Link>
      </div>
    );
  }

  const isComplete = job.currentStage === 'complete';
  const techLat = job.techLocation?.lat ?? null;
  const techLng = job.techLocation?.lng ?? null;
  const destLat = booking?.address.lat ?? 0;
  const destLng = booking?.address.lng ?? 0;

  return (
    <div className="flex flex-col h-[calc(100vh-7rem)]">
      {/* Map */}
      <div className="flex-1 relative min-h-0">
        <LiveMap
          techLat={techLat}
          techLng={techLng}
          destLat={destLat}
          destLng={destLng}
        />

        {/* Back button overlay */}
        <Link
          href={booking ? `/bookings/${booking.bookingId}` : '/bookings'}
          className="absolute top-3 left-3 z-10 w-9 h-9 bg-surface-raised border border-surface-border rounded-full flex items-center justify-center shadow-lg"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-text-primary">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </Link>

        {/* No GPS indicator */}
        {!techLat && job.currentStage !== 'dispatched' && (
          <div className="absolute top-3 right-3 z-10 bg-surface-raised border border-surface-border rounded-lg px-3 py-1.5 text-xs text-text-muted flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
            Waiting for GPS…
          </div>
        )}
      </div>

      {/* Info panel */}
      <div className="bg-surface-raised border-t border-surface-border px-4 pt-4 pb-safe space-y-4 pb-6">
        {/* Stage progress */}
        <StageBar currentStage={job.currentStage} />

        {/* Complete state */}
        {isComplete && (
          <div className="bg-green-500/10 border border-green-500/30 rounded-xl px-4 py-3 text-center space-y-1">
            <p className="text-sm font-semibold text-green-400">Service Complete!</p>
            <p className="text-xs text-text-muted">Redirecting to your booking receipt…</p>
          </div>
        )}

        {/* Service + vehicle info */}
        {booking && (
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-xs text-text-muted">Service</p>
              <p className="text-sm font-semibold text-text-primary truncate">{booking.serviceSnapshot.name}</p>
              <p className="text-xs text-text-muted mt-1">
                {booking.vehicleSnapshot.year} {booking.vehicleSnapshot.make} {booking.vehicleSnapshot.model}
              </p>
            </div>
            <div className="text-right shrink-0">
              <p className="text-xs text-text-muted">Total</p>
              <p className="text-base font-bold text-text-primary">{formatPrice(booking.totalPrice)}</p>
            </div>
          </div>
        )}

        {/* Tech location timestamp */}
        {job.techLocation && (
          <p className="text-[11px] text-text-muted">
            Location updated {new Date(job.techLocation.updatedAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
          </p>
        )}
      </div>
    </div>
  );
}
