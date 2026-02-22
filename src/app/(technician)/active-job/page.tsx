'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { useGeoLocation } from '@/hooks/useGeoLocation';
import { getTechnicianActiveJob, advanceJobStage, updateTechLocation, getJobById } from '@/services/jobService';
import { getBookingById } from '@/services/bookingService';
import { haversineDistanceMeters } from '@/lib/maps/googleMaps';
import { formatPrice, formatDate } from '@/lib/formatters';
import type { Job, Booking, JobStage } from '@/types';

// ─── Stage config ─────────────────────────────────────────────────────────────

interface StageConfig {
  label: string;
  description: string;
  nextLabel: string;
  nextStage: JobStage | null;
}

const STAGES: Record<JobStage, StageConfig> = {
  dispatched: {
    label: 'Dispatched',
    description: 'Job assigned. Head to the service address.',
    nextLabel: 'Start Driving',
    nextStage: 'en_route',
  },
  en_route: {
    label: 'En Route',
    description: "You're on the way. GPS is active.",
    nextLabel: 'Mark Arrived',
    nextStage: 'arrived',
  },
  arrived: {
    label: 'Arrived',
    description: "You've arrived at the location.",
    nextLabel: 'Start Service',
    nextStage: 'in_progress',
  },
  in_progress: {
    label: 'In Progress',
    description: 'Service is underway.',
    nextLabel: 'Quality Check',
    nextStage: 'quality_check',
  },
  quality_check: {
    label: 'Quality Check',
    description: 'Final inspection before marking complete.',
    nextLabel: 'Complete Job',
    nextStage: 'complete',
  },
  complete: {
    label: 'Complete',
    description: 'Job done. Payment will be captured.',
    nextLabel: null as unknown as string,
    nextStage: null,
  },
};

const STAGE_ORDER: JobStage[] = [
  'dispatched', 'en_route', 'arrived', 'in_progress', 'quality_check', 'complete',
];

// ─── GPS Broadcaster ──────────────────────────────────────────────────────────

const GPS_MIN_DISTANCE_M = 10;
const GPS_MIN_INTERVAL_MS = 5000;

function TechLocationBroadcaster({
  jobId,
  active,
}: {
  jobId: string;
  active: boolean;
}) {
  const { position, error, supported } = useGeoLocation(active);
  const lastWriteRef = useRef<{ lat: number; lng: number; time: number } | null>(null);

  useEffect(() => {
    if (!position || !active) return;
    const { latitude: lat, longitude: lng } = position.coords;
    const now = Date.now();
    const last = lastWriteRef.current;

    const distMoved = last ? haversineDistanceMeters({ lat: last.lat, lng: last.lng }, { lat, lng }) : Infinity;
    const timeElapsed = last ? now - last.time : Infinity;

    if (distMoved >= GPS_MIN_DISTANCE_M || timeElapsed >= GPS_MIN_INTERVAL_MS) {
      updateTechLocation(jobId, { lat, lng }).catch((err) =>
        console.error('[TechLocationBroadcaster] write error:', err)
      );
      lastWriteRef.current = { lat, lng, time: now };
    }
  }, [position, active, jobId]);

  if (!active) return null;

  return (
    <div className={`flex items-center gap-2 text-xs px-3 py-2 rounded-lg ${
      error
        ? 'bg-status-fault/10 text-status-fault border border-status-fault/30'
        : 'bg-green-500/10 text-green-400 border border-green-500/30'
    }`}>
      <span className={`w-1.5 h-1.5 rounded-full ${error ? 'bg-status-fault' : 'bg-green-400 animate-pulse'}`} />
      {error ? error : supported ? 'GPS active — sharing location' : 'GPS not supported on this device'}
    </div>
  );
}

// ─── Stage stepper ────────────────────────────────────────────────────────────

function StageStepper({ currentStage }: { currentStage: JobStage }) {
  const currentIdx = STAGE_ORDER.indexOf(currentStage);
  return (
    <div className="flex items-center gap-0.5">
      {STAGE_ORDER.filter((s) => s !== 'complete').map((stage, i) => {
        const idx = STAGE_ORDER.indexOf(stage);
        const done = idx < currentIdx;
        const active = stage === currentStage;
        return (
          <div key={stage} className="flex items-center gap-0.5 flex-1 last:flex-none">
            <div
              className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ${
                done
                  ? 'bg-brand text-surface-base'
                  : active
                  ? 'bg-brand/20 text-brand border border-brand'
                  : 'bg-surface-raised text-text-muted border border-surface-border'
              }`}
            >
              {done ? '✓' : i + 1}
            </div>
            {i < STAGE_ORDER.filter((s) => s !== 'complete').length - 1 && (
              <div className={`h-px flex-1 ${done ? 'bg-brand' : 'bg-surface-border'}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function ActiveJobPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [job, setJob] = useState<Job | null>(null);
  const [booking, setBooking] = useState<Booking | null>(null);
  const [loading, setLoading] = useState(true);
  const [advancing, setAdvancing] = useState(false);
  const [advanceError, setAdvanceError] = useState('');
  const [completing, setCompleting] = useState(false);

  const gpsActive = job?.currentStage === 'en_route' || job?.currentStage === 'arrived';

  useEffect(() => {
    if (!user) return;
    getTechnicianActiveJob(user.uid)
      .then((j) => {
        setJob(j);
        if (j) return getBookingById(j.bookingId).then(setBooking);
      })
      .finally(() => setLoading(false));
  }, [user]);

  async function handleAdvanceStage() {
    if (!job || !user) return;
    const cfg = STAGES[job.currentStage];
    if (!cfg.nextStage) return;

    if (cfg.nextStage === 'complete') {
      await handleComplete();
      return;
    }

    setAdvancing(true);
    setAdvanceError('');
    try {
      await advanceJobStage(job.jobId, cfg.nextStage);
      setJob((prev) => prev ? { ...prev, currentStage: cfg.nextStage! } : prev);
    } catch (err: unknown) {
      setAdvanceError(err instanceof Error ? err.message : 'Failed to advance stage');
    } finally {
      setAdvancing(false);
    }
  }

  async function handleComplete() {
    if (!job || !booking || !user) return;
    setCompleting(true);
    setAdvanceError('');

    try {
      // Advance to complete stage in Firestore
      await advanceJobStage(job.jobId, 'complete');

      // Capture payment via server
      const idToken = await (user as { getIdToken?: () => Promise<string> }).getIdToken?.();
      const res = await fetch('/api/stripe/capture-payment', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(idToken ? { Authorization: `Bearer ${idToken}` } : {}),
        },
        body: JSON.stringify({ bookingId: booking.bookingId, jobId: job.jobId }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? 'Payment capture failed');
      }

      router.push('/job-history');
    } catch (err: unknown) {
      setAdvanceError(err instanceof Error ? err.message : 'Failed to complete job');
      setCompleting(false);
    }
  }

  if (authLoading || loading) {
    return (
      <div className="p-4 space-y-4">
        <div className="h-8 w-36 bg-surface-raised rounded animate-pulse" />
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-24 bg-surface-raised rounded-xl animate-pulse" />
        ))}
      </div>
    );
  }

  if (!job) {
    return (
      <div className="p-4 text-center space-y-4 py-16">
        <svg className="w-12 h-12 text-text-muted mx-auto" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M11.42 15.17L17.25 21A2.652 2.652 0 0021 17.25l-5.877-5.877M11.42 15.17l2.496-3.03c.317-.384.74-.626 1.208-.766M11.42 15.17l-4.655 5.653a2.548 2.548 0 11-3.586-3.586l6.837-5.63m5.108-.233c.55-.164 1.163-.188 1.743-.14a4.5 4.5 0 004.486-6.336l-3.276 3.277a3.004 3.004 0 01-2.25-2.25l3.276-3.276a4.5 4.5 0 00-6.336 4.486c.091 1.076-.071 2.264-.904 2.95l-.102.085m-1.745 1.437L5.909 7.5H4.5L2.25 3.75l1.5-1.5L7.5 4.5v1.409l4.26 4.26m-1.745 1.437l1.745-1.437m6.615 8.206L15.75 15.75M4.867 19.125h.008v.008h-.008v-.008z" />
        </svg>
        <p className="text-text-muted">No active job right now.</p>
        <Link href="/queue" className="inline-block px-4 py-2 bg-brand text-surface-base rounded-lg text-sm font-semibold">
          View Job Queue
        </Link>
      </div>
    );
  }

  const stageConfig = STAGES[job.currentStage];
  const isComplete = job.currentStage === 'complete';

  return (
    <div className="p-4 space-y-4 pb-8">
      {/* Stage header */}
      <div className="bg-surface-raised border border-surface-border rounded-xl p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-text-muted uppercase tracking-wider font-medium">Current Stage</p>
            <p className="text-lg font-bold text-text-primary mt-0.5">{stageConfig.label}</p>
            <p className="text-sm text-text-muted mt-0.5">{stageConfig.description}</p>
          </div>
          {isComplete && (
            <div className="w-10 h-10 rounded-full bg-green-500/20 flex items-center justify-center">
              <svg className="text-green-400" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          )}
        </div>
        <StageStepper currentStage={job.currentStage} />
      </div>

      {/* GPS broadcast */}
      {(job.currentStage === 'en_route' || job.currentStage === 'dispatched') && (
        <TechLocationBroadcaster jobId={job.jobId} active={gpsActive} />
      )}

      {/* Job details */}
      {booking && (
        <div className="bg-surface-raised border border-surface-border rounded-xl divide-y divide-surface-border">
          <div className="px-4 py-3">
            <p className="text-xs text-text-muted uppercase tracking-wider font-medium mb-2">Service</p>
            <p className="font-semibold text-text-primary">{booking.serviceSnapshot.name}</p>
            <p className="text-xs text-text-muted mt-0.5 capitalize">{booking.serviceSnapshot.category}</p>
          </div>

          <div className="px-4 py-3">
            <p className="text-xs text-text-muted uppercase tracking-wider font-medium mb-2">Vehicle</p>
            <p className="font-semibold text-text-primary">
              {booking.vehicleSnapshot.year} {booking.vehicleSnapshot.make} {booking.vehicleSnapshot.model}
              {booking.vehicleSnapshot.nickname ? ` · ${booking.vehicleSnapshot.nickname}` : ''}
            </p>
            <p className="text-xs text-text-muted mt-0.5">VIN: {booking.vehicleSnapshot.vin}</p>
          </div>

          <div className="px-4 py-3">
            <p className="text-xs text-text-muted uppercase tracking-wider font-medium mb-2">Service Address</p>
            <p className="text-sm text-text-primary">{booking.address.street}</p>
            <p className="text-sm text-text-primary">
              {booking.address.city}, {booking.address.state} {booking.address.zip}
            </p>
            <a
              href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(
                `${booking.address.street} ${booking.address.city} ${booking.address.state} ${booking.address.zip}`
              )}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-brand mt-1 inline-flex items-center gap-1"
            >
              Open in Maps
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6M15 3h6v6M10 14L21 3" />
              </svg>
            </a>
          </div>

          <div className="px-4 py-3 flex items-center justify-between">
            <p className="text-xs text-text-muted uppercase tracking-wider font-medium">Payout</p>
            <p className="text-lg font-bold text-brand">{formatPrice(booking.totalPrice)}</p>
          </div>
        </div>
      )}

      {/* Advance stage / Complete */}
      {!isComplete && stageConfig.nextStage && (
        <div className="space-y-2">
          {advanceError && (
            <p className="text-status-fault text-sm bg-status-fault/10 border border-status-fault/30 rounded-lg px-3 py-2">
              {advanceError}
            </p>
          )}
          <button
            onClick={handleAdvanceStage}
            disabled={advancing || completing}
            className={`w-full py-3.5 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition-colors ${
              stageConfig.nextStage === 'complete'
                ? 'bg-green-500 text-white hover:bg-green-400'
                : 'bg-brand text-surface-base'
            } disabled:opacity-60`}
          >
            {advancing || completing ? (
              <>
                <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                {stageConfig.nextStage === 'complete' ? 'Completing job…' : 'Updating…'}
              </>
            ) : (
              stageConfig.nextLabel
            )}
          </button>
          {stageConfig.nextStage === 'complete' && (
            <p className="text-xs text-text-muted text-center">
              This will capture payment from the customer.
            </p>
          )}
        </div>
      )}

      {isComplete && (
        <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-4 text-center space-y-2">
          <p className="font-semibold text-green-400">Job Complete!</p>
          <p className="text-xs text-text-muted">Payment has been captured successfully.</p>
          <Link
            href="/job-history"
            className="inline-block mt-1 px-4 py-2 bg-green-500 text-white rounded-lg text-sm font-semibold"
          >
            View History
          </Link>
        </div>
      )}
    </div>
  );
}
