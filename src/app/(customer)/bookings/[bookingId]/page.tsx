'use client';

import { useState, useEffect, useMemo, Fragment } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { useChat } from '@/hooks/useChat';
import { useLiveJob } from '@/hooks/useLiveJob';
import { listenToBooking, cancelBooking } from '@/services/bookingService';
import { getUserById } from '@/services/userService';
import { formatDate, formatPrice, formatDuration } from '@/lib/formatters';
import { haversineDistanceMeters } from '@/lib/maps/googleMaps';
import { BookingChatPanel } from '@/components/booking/BookingChatPanel';
import type { Booking, BookingStatus, User, TechnicianUser } from '@/types';

// Dynamically imported — Google Maps must not run on the server
const BookingLiveMap = dynamic(() => import('./BookingLiveMap'), { ssr: false });

const DEBUG_MAP = false;

// ─── Types ────────────────────────────────────────────────────────────────────

/**
 * View model for a technician as displayed in AcceptedCard.
 * Not a Firestore entity — always derived through mapTechnicianToDisplay.
 * All fields have explicit fallback values so the UI never crashes on
 * incomplete or missing Firestore documents.
 */
type TechnicianDisplay = {
  id:        string;
  name:      string;
  rating:    number | null;
  avatarUrl: string | null;
  vehicle:   string | null;  // technician's own vehicle — not in schema yet
  status:    'available' | 'busy' | 'offline';
};

/**
 * Single mapping point: Firestore User / TechnicianUser → TechnicianDisplay.
 * All field access goes through explicit fallbacks so callers receive a
 * fully-typed, safe object regardless of document completeness.
 */
function mapTechnicianToDisplay(user: User): TechnicianDisplay {
  const tech = user as TechnicianUser;
  return {
    id:        user.uid,
    name:      user.name      || 'Technician',
    rating:    tech.rating    ?? null,
    avatarUrl: user.photoUrl  ?? null,
    vehicle:   null,  // reserved — technician vehicle not yet in schema
    status:    tech.currentJobId
      ? 'busy'
      : (tech.isAvailable ?? false)
      ? 'available'
      : 'offline',
  };
}

// ─── Lifecycle step definitions ───────────────────────────────────────────────

/** Ordered list of display steps. Internal status values are used as keys. */
const LIFECYCLE_STEPS: { status: string; label: string; sublabel: string }[] = [
  { status: 'pending',     label: 'Requested',  sublabel: 'Awaiting technician' },
  { status: 'accepted',    label: 'Accepted',    sublabel: 'Technician assigned' },
  { status: 'scheduled',   label: 'Scheduled',   sublabel: 'Time confirmed' },
  { status: 'en_route',    label: 'En Route',    sublabel: 'Tech is on the way' },
  { status: 'in_progress', label: 'In Service',  sublabel: 'Service underway' },
  { status: 'complete',    label: 'Completed',   sublabel: 'Service complete' },
];

const STEP_ORDER = LIFECYCLE_STEPS.map((s) => s.status);

// ─── Stepper component ────────────────────────────────────────────────────────

/**
 * BookingLifecycleStepper — horizontal 6-step progress indicator.
 *
 * Past steps: filled teal circle with checkmark.
 * Current step: teal-outlined circle, label highlighted.
 * Future steps: muted circle.
 * Cancelled: replaced with a simple cancelled banner.
 *
 * This component is purely presentational — the parent feeds it the
 * live `status` prop from the onSnapshot subscription.
 */
function BookingLifecycleStepper({ status }: { status: BookingStatus }) {
  if (status === 'cancelled') {
    return (
      <div className="bg-surface-raised border border-surface-border rounded-xl px-4 py-3 flex items-center gap-3">
        <div className="w-2 h-2 rounded-full bg-text-muted shrink-0" />
        <p className="text-sm text-text-muted font-medium">Booking cancelled</p>
      </div>
    );
  }

  const currentIdx  = STEP_ORDER.indexOf(status);
  const currentStep = LIFECYCLE_STEPS[currentIdx];

  return (
    <div className="bg-surface-raised border border-surface-border rounded-2xl px-4 pt-4 pb-5 space-y-4">
      {/* Current step summary */}
      <div className="flex items-start justify-between">
        <div>
          <p className="text-[10px] font-semibold text-text-muted uppercase tracking-wider">Status</p>
          <p className="text-base font-bold text-brand mt-0.5">{currentStep?.label ?? status}</p>
          <p className="text-xs text-text-muted">{currentStep?.sublabel}</p>
        </div>
        <span className="text-[10px] text-text-muted tabular-nums mt-0.5">
          Step {currentIdx + 1} of {LIFECYCLE_STEPS.length}
        </span>
      </div>

      {/* Step track */}
      <div className="flex items-start">
        {LIFECYCLE_STEPS.map((step, i) => {
          const isPast    = i < currentIdx;
          const isCurrent = i === currentIdx;

          return (
            <Fragment key={step.status}>
              {/* Circle + label */}
              <div className="flex flex-col items-center gap-1.5 shrink-0">
                <div
                  className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold transition-colors ${
                    isPast
                      ? 'bg-brand text-surface-base'
                      : isCurrent
                      ? 'bg-brand/20 border-2 border-brand text-brand'
                      : 'bg-surface-base border border-surface-border text-text-muted'
                  }`}
                >
                  {isPast ? (
                    <svg
                      width="10"
                      height="10"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="3.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  ) : (
                    i + 1
                  )}
                </div>
                <span
                  className={`text-[9px] font-medium text-center leading-tight w-12 ${
                    isCurrent
                      ? 'text-brand'
                      : isPast
                      ? 'text-text-secondary'
                      : 'text-text-muted'
                  }`}
                >
                  {step.label}
                </span>
              </div>

              {/* Connector between steps — filled when past */}
              {i < LIFECYCLE_STEPS.length - 1 && (
                <div
                  className={`flex-1 h-0.5 mt-3 mx-0.5 rounded-full transition-colors duration-500 ${
                    isPast ? 'bg-brand' : 'bg-surface-border'
                  }`}
                />
              )}
            </Fragment>
          );
        })}
      </div>
    </div>
  );
}

// ─── Live status cards ────────────────────────────────────────────────────────

/**
 * Shown when status === 'en_route'.
 *
 * Embeds a live Google Map showing the technician's moving marker
 * (white dot with teal stroke) and the destination marker (gold pin).
 * Below the map: pulsing beacon, ETA text, and a "Full map" link
 * to the full-screen tracking page at /jobs/[jobId].
 */
function EnRouteCard({
  jobId,
  techLat,
  techLng,
  destLat,
  destLng,
  etaMinutes,
}: {
  jobId: string;
  techLat: number | null;
  techLng: number | null;
  destLat: number;
  destLng: number;
  etaMinutes: number | null;
}) {
  return (
    <div className="bg-brand/10 border border-brand/40 rounded-2xl overflow-hidden">
      {/* Embedded live map */}
      <div className="h-48 w-full">
        <BookingLiveMap
          techLat={techLat}
          techLng={techLng}
          destLat={destLat}
          destLng={destLng}
        />
      </div>

      {/* Status bar below map */}
      <div className="px-4 py-3 flex items-center gap-3">
        {/* Animated location beacon */}
        <div className="relative shrink-0 w-8 h-8 flex items-center justify-center">
          <div className="absolute inset-0 bg-brand/20 rounded-full animate-ping" />
          <div className="absolute inset-1 bg-brand/30 rounded-full animate-pulse" />
          <svg className="relative text-brand" width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" />
          </svg>
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-brand">Your technician is on the way</p>
          {etaMinutes !== null ? (
            <p className="text-xs text-text-muted mt-0.5">~{etaMinutes} min away</p>
          ) : (
            <p className="text-xs text-text-muted mt-0.5">Calculating ETA…</p>
          )}
        </div>

        <Link
          href={`/jobs/${jobId}`}
          className="text-xs font-semibold text-brand border border-brand/30 px-2.5 py-1 rounded-lg shrink-0"
        >
          Full map
        </Link>
      </div>
    </div>
  );
}

/**
 * Shown when status === 'accepted'.
 *
 * Renders as soon as a technician is assigned — regardless of whether the job
 * document has been written yet (jobId may briefly be null immediately after
 * the acceptance transaction completes).
 *
 * Technician data priority:
 *   1. `technician` prop — provided by parent; no listener is created here.
 *   2. Internal one-shot getUserById — fires only when `technician` is
 *      literally `undefined` (prop not passed). Passing `null` signals that
 *      the parent owns the fetch and the card should not create its own.
 *
 * Props:
 *   bookingId    — reserved for future deep-links / support references
 *   technicianId — used for the fallback fetch when `technician` is absent
 *   jobId        — optional; activates the "View job" link when present
 *   technician   — optional snapshot from parent; `null` = parent is handling
 *                  the fetch, do not create a duplicate listener
 */
function AcceptedCard({
  technicianId,
  jobId,
  technician,
}: {
  bookingId:    string;
  technicianId: string | null;
  jobId?:       string | null;
  technician?:  TechnicianDisplay | null;
}) {
  // Internal state — only populated when parent does not pass the snapshot.
  const [internalTech, setInternalTech] = useState<TechnicianDisplay | null>(null);

  // Fallback fetch: fires once when the prop is absent (`undefined`).
  // Skipped entirely when `technician` is `null` or a real snapshot,
  // preventing a duplicate Firestore read alongside the parent's fetch.
  useEffect(() => {
    if (technician !== undefined || !technicianId) return;
    let cancelled = false;
    getUserById(technicianId).then((user) => {
      if (cancelled || !user) return;
      setInternalTech(mapTechnicianToDisplay(user));
    });
    return () => { cancelled = true; };
  }, [technicianId, technician]);

  // Prefer the prop; fall back to the internal fetch result.
  // useMemo prevents a new object reference on every render when neither
  // source has changed, shielding any children from identity-based re-renders.
  const displayTech = useMemo(
    () => technician ?? internalTech,
    [technician, internalTech],
  );

  return (
    <div className="bg-brand/10 border border-brand/30 rounded-2xl px-4 py-3 flex items-center gap-3">
      <div className="w-2.5 h-2.5 rounded-full bg-brand animate-pulse shrink-0" />

      <div className="flex-1 min-w-0">
        {displayTech ? (
          <>
            <p className="text-sm font-semibold text-brand truncate">{displayTech.name}</p>
            <p className="text-xs text-text-muted">
              {displayTech.rating !== null
                ? `★ ${displayTech.rating.toFixed(1)} · Live tracking available once en route`
                : 'Live tracking available once en route'}
            </p>
          </>
        ) : (
          <>
            <p className="text-sm font-semibold text-brand">Technician assigned</p>
            <p className="text-xs text-text-muted">Preparing to depart — live tracking available once en route</p>
          </>
        )}
      </div>

      {/* View link: active when job doc exists, muted while it's being written */}
      {jobId ? (
        <Link
          href={`/jobs/${jobId}`}
          className="text-xs font-semibold text-brand border border-brand/30 px-2.5 py-1 rounded-lg shrink-0"
        >
          View
        </Link>
      ) : (
        <span
          aria-disabled="true"
          className="text-xs font-semibold text-text-muted border border-surface-border px-2.5 py-1 rounded-lg shrink-0 opacity-40 cursor-default"
        >
          View
        </span>
      )}
    </div>
  );
}

/** Shown when status === 'in_progress'. */
function InServiceCard({ jobId }: { jobId: string | null }) {
  return (
    <div className="bg-brand/10 border border-brand/30 rounded-2xl px-4 py-3 flex items-center gap-3">
      <div className="w-2.5 h-2.5 rounded-full bg-brand animate-pulse shrink-0" />
      <div className="flex-1">
        <p className="text-sm font-semibold text-brand">Service in progress</p>
        <p className="text-xs text-text-muted">Your technician is working on your vehicle</p>
      </div>
      {jobId && (
        <Link
          href={`/jobs/${jobId}`}
          className="text-xs font-semibold text-brand border border-brand/30 px-2.5 py-1 rounded-lg shrink-0"
        >
          Track
        </Link>
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function BookingDetailPage() {
  const { bookingId } = useParams<{ bookingId: string }>();
  const { user } = useAuth();
  const router = useRouter();

  const [booking, setBooking] = useState<Booking | null>(null);
  const [loading, setLoading] = useState(true);
  const [cancelling, setCancelling] = useState(false);
  const [cancelError, setCancelError] = useState('');

  // Chat — derives state from booking.status; listens to live messages
  const { messages, chatState, send, sending } = useChat(booking);

  // jobId is now stored on the booking document itself (written atomically when
  // status → 'accepted' by /api/bookings/status). We subscribe via useLiveJob
  // which re-subscribes automatically when booking.jobId is populated.
  const { job: liveJob } = useLiveJob(booking?.jobId ?? '');

  // Technician snapshot — fetched once when technicianId is first known.
  // Passed to AcceptedCard as a prop so the card never needs its own listener,
  // preventing a duplicate Firestore read on the same document.
  // Initialized to null (not undefined) so AcceptedCard's fallback is never
  // triggered — the parent owns this fetch from the first render.
  // Raw Firestore user — stored as-is so mapTechnicianToDisplay runs once via useMemo.
  const [rawTechUser, setRawTechUser] = useState<User | null>(null);
  useEffect(() => {
    const tid = booking?.technicianId;
    if (!tid) { setRawTechUser(null); return; }
    getUserById(tid)
      .then((user) => setRawTechUser(user))
      .catch(() => setRawTechUser(null));
  }, [booking?.technicianId]);

  // Map raw user → TechnicianDisplay exactly once per rawTechUser identity change.
  const technicianDisplay = useMemo(
    () => rawTechUser ? mapTechnicianToDisplay(rawTechUser) : null,
    [rawTechUser],
  );

  /**
   * Real-time subscription via Firestore onSnapshot (wrapped in listenToBooking).
   * Any status transition written to Firestore — by the technician, a webhook,
   * or the admin panel — is reflected here immediately without a page reload.
   * When status → 'accepted', the booking doc now also contains jobId, so
   * useLiveJob above will subscribe to the job document automatically.
   */
  useEffect(() => {
    const unsub = listenToBooking(bookingId, (b) => {
      setBooking(b);
      setLoading(false);
    });
    return () => unsub();
  }, [bookingId]);

  async function handleCancel() {
    if (!booking || booking.status !== 'pending') return;
    setCancelling(true);
    setCancelError('');
    try {
      await cancelBooking(bookingId);
    } catch (err: unknown) {
      setCancelError(err instanceof Error ? err.message : 'Failed to cancel booking');
      setCancelling(false);
    }
  }

  // ── Loading skeleton ──────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="p-4 space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-surface-raised rounded-full animate-pulse" />
          <div className="h-6 w-40 bg-surface-raised rounded animate-pulse" />
        </div>
        <div className="h-36 bg-surface-raised rounded-2xl animate-pulse" />
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-14 bg-surface-raised rounded-xl animate-pulse" />
        ))}
      </div>
    );
  }

  if (!booking) {
    return (
      <div className="p-4 text-center space-y-3 py-16">
        <p className="text-text-muted">Booking not found.</p>
        <Link href="/bookings" className="text-brand text-sm">
          Back to bookings
        </Link>
      </div>
    );
  }

  const canCancel   = booking.status === 'pending';
  const isAccepted  = booking.status === 'accepted';
  const isEnRoute   = booking.status === 'en_route';
  const isInService = booking.status === 'in_progress';
  const isComplete  = booking.status === 'complete';

  // jobId is written to the booking document when status → 'accepted'
  // and kept up-to-date by listenToBooking (onSnapshot).
  const jobId = booking.jobId;

  // Tech + destination coords for the embedded en-route map
  const techLat = liveJob?.techLocation?.lat ?? null;
  const techLng = liveJob?.techLocation?.lng ?? null;
  const destLat = (booking.address as { lat?: number } | null)?.lat ?? 0;
  const destLng = (booking.address as { lng?: number } | null)?.lng ?? 0;

  // ETA: Haversine distance ÷ 30 km/h (≈ 500 m/min) → minutes
  let etaMinutes: number | null = null;
  if (isEnRoute && techLat !== null && techLng !== null && (destLat || destLng)) {
    const dist = haversineDistanceMeters(
      { lat: techLat, lng: techLng },
      { lat: destLat, lng: destLng },
    );
    etaMinutes = Math.max(1, Math.ceil(dist / 500));
  }

  // DEBUG: log all map-relevant state on every render ────────────────────────
  if (DEBUG_MAP) {
    console.log('[DEBUG:map] status:', booking.status);
    console.log('[DEBUG:map] jobId:', jobId ?? 'null');
    console.log('[DEBUG:map] dest lat/lng:', destLat, destLng, '| address:', booking.address ?? 'MISSING');
    console.log('[DEBUG:map] tech lat/lng:', techLat ?? 'null', techLng ?? 'null', '| liveJob:', liveJob ?? 'null');
  }
  // ──────────────────────────────────────────────────────────────────────────

  const rows: { label: string; value: string }[] = [
    { label: 'Service',  value: booking.serviceSnapshot.name },
    {
      label: 'Vehicle',
      value: `${booking.vehicleSnapshot.year} ${booking.vehicleSnapshot.make} ${booking.vehicleSnapshot.model}${booking.vehicleSnapshot.nickname ? ` (${booking.vehicleSnapshot.nickname})` : ''}`,
    },
    { label: 'Date',     value: formatDate(booking.scheduledAt) },
    ...(booking.address
      ? [{
          label: 'Address',
          value: `${booking.address.street}, ${booking.address.city}, ${booking.address.state} ${booking.address.zip}`,
        }]
      : []),
    { label: 'Duration', value: formatDuration(booking.serviceSnapshot.durationMins) },
    { label: 'Category', value: booking.serviceSnapshot.category },
  ];

  return (
    <div className="p-4 space-y-4 pb-8">
      {/* Header — service name + vehicle, no redundant status badge */}
      <div className="flex items-center gap-3">
        <button onClick={() => router.push('/bookings')} className="text-text-secondary shrink-0">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-base font-bold text-text-primary truncate">
            {booking.serviceSnapshot.name}
          </h1>
          <p className="text-xs text-text-muted">
            {booking.vehicleSnapshot.year} {booking.vehicleSnapshot.make} {booking.vehicleSnapshot.model}
          </p>
        </div>
      </div>

      {/* ── LIFECYCLE STEPPER ─────────────────────────────────────────────────
           Updates in real-time via listenToBooking → onSnapshot.
           No manual refresh needed — status changes propagate automatically. */}
      <BookingLifecycleStepper status={booking.status} />

      {/* DEBUG: on-screen map state inspector — remove when DEBUG_MAP = false ── */}
      {DEBUG_MAP && (
        <div className="border border-yellow-500/40 rounded-xl px-3 py-2.5 font-mono text-[10px] space-y-1 bg-yellow-500/5">
          <p className="font-bold text-yellow-400 text-[11px]">MAP DEBUG (DEBUG_MAP=true)</p>
          <p>
            <span className="text-text-muted">status: </span>
            <span className="text-yellow-300">{booking.status}</span>
          </p>
          <p>
            <span className="text-text-muted">jobId: </span>
            <span className={jobId ? 'text-green-400' : 'text-red-400'}>
              {jobId ?? 'null — no job doc yet (expected for pending)'}
            </span>
          </p>
          <p>
            <span className="text-text-muted">dest lat/lng: </span>
            <span className={(destLat || destLng) ? 'text-green-400' : 'text-red-400'}>
              {(destLat || destLng)
                ? `${destLat}, ${destLng}`
                : 'MISSING — booking.address has no lat/lng'}
            </span>
          </p>
          <p>
            <span className="text-text-muted">tech lat/lng: </span>
            <span className={techLat !== null ? 'text-green-400' : 'text-yellow-300'}>
              {techLat !== null
                ? `${techLat}, ${techLng}`
                : 'null — waiting for tech location (normal until en_route)'}
            </span>
          </p>
          <p>
            <span className="text-text-muted">directionsService: </span>
            <span className="text-yellow-300">see BookingLiveMap overlay below</span>
          </p>
        </div>
      )}
      {/* END DEBUG ─────────────────────────────────────────────────────────── */}

      {/* Live status cards — conditional on current status */}
      {isAccepted && (
        <AcceptedCard
          bookingId={bookingId}
          technicianId={booking.technicianId ?? null}
          jobId={jobId}
          technician={technicianDisplay}
        />
      )}
      {isEnRoute && jobId && (
        <EnRouteCard
          jobId={jobId}
          techLat={techLat}
          techLng={techLng}
          destLat={destLat}
          destLng={destLng}
          etaMinutes={etaMinutes}
        />
      )}
      {isInService && <InServiceCard jobId={jobId ?? null} />}

      {/* Details grid */}
      <div className="bg-surface-raised border border-surface-border rounded-xl divide-y divide-surface-border">
        {rows.map(({ label: rowLabel, value }) => (
          <div key={rowLabel} className="flex items-start justify-between gap-4 px-4 py-3">
            <span className="text-xs text-text-muted shrink-0 pt-0.5">{rowLabel}</span>
            <span className="text-sm text-text-primary text-right capitalize">{value}</span>
          </div>
        ))}
      </div>

      {/* Price */}
      <div className="bg-surface-raised border border-surface-border rounded-xl px-4 py-3 flex items-center justify-between">
        <span className="text-sm text-text-muted">Total</span>
        <span className="text-lg font-bold text-text-primary">{formatPrice(booking.totalPrice)}</span>
      </div>

      {/* Payment complete */}
      {isComplete && (
        <div className="bg-green-500/10 border border-green-500/30 rounded-xl px-4 py-3 flex items-center gap-3">
          <svg className="text-green-400 shrink-0" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div>
            <p className="text-sm font-semibold text-green-400">Service Complete</p>
            <p className="text-xs text-text-muted">
              {formatPrice(booking.totalPrice)} charged to your payment method
            </p>
          </div>
        </div>
      )}

      {/* Cancel (only while pending / no tech assigned) */}
      {canCancel && (
        <div className="space-y-2">
          {cancelError && (
            <p className="text-status-fault text-sm bg-status-fault/10 border border-status-fault/30 rounded-lg px-3 py-2">
              {cancelError}
            </p>
          )}
          <button
            onClick={handleCancel}
            disabled={cancelling}
            className="w-full py-3 border border-status-fault/50 text-status-fault rounded-xl text-sm font-semibold hover:bg-status-fault/10 transition-colors disabled:opacity-60"
          >
            {cancelling ? 'Cancelling…' : 'Cancel Booking'}
          </button>
          <p className="text-xs text-text-muted text-center">
            Cancellation is free before a technician is assigned.
          </p>
        </div>
      )}

      {/* Service Chat */}
      {user && (
        <BookingChatPanel
          messages={messages}
          chatState={chatState}
          currentUserId={user.uid}
          onSend={send}
          sending={sending}
        />
      )}

      {/* Booking ID for support */}
      <p className="text-[10px] text-text-muted text-center">
        Booking ID: {bookingId}
      </p>
    </div>
  );
}
