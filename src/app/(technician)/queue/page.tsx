'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { getPendingBookings } from '@/services/bookingService';
import { formatDate, formatPrice, formatDuration } from '@/lib/formatters';
import type { Booking } from '@/types';

function JobCard({
  booking,
  onAccept,
  accepting,
}: {
  booking: Booking;
  onAccept: (bookingId: string) => void;
  accepting: boolean;
}) {
  return (
    <div className="bg-surface-raised border border-surface-border rounded-xl p-4 space-y-3">
      {/* Service + price */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <span className="text-[10px] uppercase tracking-widest text-text-muted font-medium">
            {booking.serviceSnapshot.category}
          </span>
          <p className="font-semibold text-text-primary mt-0.5">
            {booking.serviceSnapshot.name}
          </p>
        </div>
        <div className="text-right shrink-0">
          <p className="font-bold text-text-primary">{formatPrice(booking.totalPrice)}</p>
          <p className="text-xs text-text-muted">{formatDuration(booking.serviceSnapshot.durationMins)}</p>
        </div>
      </div>

      {/* Vehicle */}
      <div className="flex items-center gap-2 text-sm text-text-secondary">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M5 17H3a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v5m-2 4h2a2 2 0 002-2v-1m-5 3a2 2 0 104 0 2 2 0 00-4 0M3 17a2 2 0 104 0 2 2 0 00-4 0" />
        </svg>
        <span>
          {booking.vehicleSnapshot.year} {booking.vehicleSnapshot.make} {booking.vehicleSnapshot.model}
        </span>
      </div>

      {/* Date + location (city/zip only for customer privacy) */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-1.5 text-xs text-text-muted">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          {formatDate(booking.scheduledAt)}
        </div>
        <div className="flex items-center gap-1.5 text-xs text-text-muted">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" />
          </svg>
          {booking.address.city}, {booking.address.zip}
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-2 pt-1">
        <button
          onClick={() => onAccept(booking.bookingId)}
          disabled={accepting}
          className="flex-1 py-2.5 bg-brand text-surface-base rounded-lg text-sm font-semibold disabled:opacity-60 flex items-center justify-center gap-2"
        >
          {accepting ? (
            <>
              <svg className="animate-spin w-3.5 h-3.5" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Accepting…
            </>
          ) : (
            'Accept Job'
          )}
        </button>
        <button
          disabled={accepting}
          className="px-4 py-2.5 border border-surface-border text-text-muted rounded-lg text-sm font-medium hover:text-text-secondary transition-colors disabled:opacity-40"
        >
          Skip
        </button>
      </div>
    </div>
  );
}

export default function QueuePage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState<string | null>(null);
  const [error, setError] = useState('');

  const fetchQueue = useCallback(() => {
    setLoading(true);
    getPendingBookings()
      .then(setBookings)
      .catch(() => setError('Failed to load queue'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!user) return;
    fetchQueue();
  }, [user, fetchQueue]);

  async function handleAccept(bookingId: string) {
    if (!user) return;
    setAccepting(bookingId);
    setError('');

    try {
      const idToken = await (user as { getIdToken?: () => Promise<string> }).getIdToken?.();
      const res = await fetch('/api/admin/assign-technician', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(idToken ? { Authorization: `Bearer ${idToken}` } : {}),
        },
        body: JSON.stringify({ bookingId, technicianId: user.uid }),
      });

      if (!res.ok) {
        const data = await res.json();
        if (res.status === 409) {
          // Already accepted — refresh queue
          setBookings((prev) => prev.filter((b) => b.bookingId !== bookingId));
          setError('That job was already accepted. Queue refreshed.');
        } else {
          throw new Error(data.error ?? 'Failed to accept job');
        }
        return;
      }

      await res.json();
      router.push('/active-job');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to accept job');
    } finally {
      setAccepting(null);
    }
  }

  if (authLoading || loading) {
    return (
      <div className="p-4 space-y-3">
        <div className="h-7 w-28 bg-surface-raised rounded animate-pulse" />
        {[1, 2].map((i) => (
          <div key={i} className="h-40 bg-surface-raised rounded-xl animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-text-primary">Job Queue</h1>
        <button
          onClick={fetchQueue}
          className="p-2 text-text-muted hover:text-text-secondary transition-colors"
          aria-label="Refresh"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="23 4 23 10 17 10" />
            <path d="M20.49 15a9 9 0 11-2.12-9.36L23 10" />
          </svg>
        </button>
      </div>

      {error && (
        <p className="text-status-fault text-sm bg-status-fault/10 border border-status-fault/30 rounded-lg px-3 py-2">
          {error}
        </p>
      )}

      {bookings.length === 0 ? (
        <div className="text-center py-16 space-y-2">
          <svg className="w-12 h-12 text-text-muted mx-auto" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
          </svg>
          <p className="text-text-muted text-sm">No jobs in the queue right now.</p>
          <p className="text-text-muted text-xs">Pull to refresh or check back soon.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {bookings.map((b) => (
            <JobCard
              key={b.bookingId}
              booking={b}
              onAccept={handleAccept}
              accepting={accepting === b.bookingId}
            />
          ))}
        </div>
      )}
    </div>
  );
}
