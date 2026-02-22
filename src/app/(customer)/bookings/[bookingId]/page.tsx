'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { listenToBooking, cancelBooking } from '@/services/bookingService';
import { getJobByBookingId } from '@/services/jobService';
import { formatDate, formatPrice, formatDuration } from '@/lib/formatters';
import type { Booking, BookingStatus } from '@/types';

const STATUS_STYLES: Record<BookingStatus, { label: string; cls: string }> = {
  pending: { label: 'Pending', cls: 'bg-amber-500/15 text-amber-400 border-amber-500/30' },
  accepted: { label: 'Accepted', cls: 'bg-brand/15 text-brand border-brand/30' },
  en_route: { label: 'En Route', cls: 'bg-brand/15 text-brand border-brand/30' },
  in_progress: { label: 'In Progress', cls: 'bg-brand/15 text-brand border-brand/30' },
  complete: { label: 'Complete', cls: 'bg-green-500/15 text-green-400 border-green-500/30' },
  cancelled: { label: 'Cancelled', cls: 'bg-surface-raised text-text-muted border-surface-border' },
};

export default function BookingDetailPage() {
  const { bookingId } = useParams<{ bookingId: string }>();
  const { user } = useAuth();
  const router = useRouter();

  const [booking, setBooking] = useState<Booking | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [cancelling, setCancelling] = useState(false);
  const [cancelError, setCancelError] = useState('');

  useEffect(() => {
    const unsub = listenToBooking(bookingId, (b) => {
      setBooking(b);
      setLoading(false);
    });
    return () => unsub();
  }, [bookingId]);

  // Fetch job ID when booking is active
  useEffect(() => {
    if (!booking) return;
    const activeStatuses: BookingStatus[] = ['accepted', 'en_route', 'in_progress', 'complete'];
    if (activeStatuses.includes(booking.status)) {
      getJobByBookingId(bookingId).then((job) => {
        if (job) setJobId(job.jobId);
      });
    }
  }, [booking?.status, bookingId]);

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

  if (loading) {
    return (
      <div className="p-4 space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-surface-raised rounded-full animate-pulse" />
          <div className="h-6 w-40 bg-surface-raised rounded animate-pulse" />
        </div>
        {[1, 2, 3, 4].map((i) => (
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

  const { label, cls } = STATUS_STYLES[booking.status];
  const isActive = ['accepted', 'en_route', 'in_progress'].includes(booking.status);
  const canCancel = booking.status === 'pending';
  const isComplete = booking.status === 'complete';

  const rows: { label: string; value: string }[] = [
    { label: 'Service', value: booking.serviceSnapshot.name },
    {
      label: 'Vehicle',
      value: `${booking.vehicleSnapshot.year} ${booking.vehicleSnapshot.make} ${booking.vehicleSnapshot.model}${booking.vehicleSnapshot.nickname ? ` (${booking.vehicleSnapshot.nickname})` : ''}`,
    },
    { label: 'Date', value: formatDate(booking.scheduledAt) },
    {
      label: 'Address',
      value: `${booking.address.street}, ${booking.address.city}, ${booking.address.state} ${booking.address.zip}`,
    },
    { label: 'Duration', value: formatDuration(booking.serviceSnapshot.durationMins) },
    { label: 'Category', value: booking.serviceSnapshot.category },
  ];

  return (
    <div className="p-4 space-y-5 pb-8">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => router.back()} className="text-text-secondary">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>
        <h1 className="text-lg font-bold text-text-primary flex-1">Booking Details</h1>
        <span className={`text-[11px] font-semibold px-2.5 py-1 rounded-full border ${cls}`}>
          {label}
        </span>
      </div>

      {/* Live tracking CTA */}
      {isActive && jobId && (
        <Link
          href={`/jobs/${jobId}`}
          className="flex items-center gap-3 bg-brand/10 border border-brand/30 rounded-xl px-4 py-3"
        >
          <svg className="text-brand shrink-0" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" />
          </svg>
          <div>
            <p className="text-sm font-semibold text-brand">Track Your Technician</p>
            <p className="text-xs text-text-muted">View live location and job progress</p>
          </div>
          <svg className="ml-auto text-brand" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 18l6-6-6-6" />
          </svg>
        </Link>
      )}

      {/* Details */}
      <div className="bg-surface-raised border border-surface-border rounded-xl divide-y divide-surface-border">
        {rows.map(({ label: rowLabel, value }) => (
          <div key={rowLabel} className="flex items-start justify-between gap-4 px-4 py-3">
            <span className="text-xs text-text-muted shrink-0 pt-0.5">{rowLabel}</span>
            <span className="text-sm text-text-primary text-right capitalize">{value}</span>
          </div>
        ))}
      </div>

      {/* Price summary */}
      <div className="bg-surface-raised border border-surface-border rounded-xl px-4 py-3 flex items-center justify-between">
        <span className="text-sm text-text-muted">Total</span>
        <span className="text-lg font-bold text-text-primary">{formatPrice(booking.totalPrice)}</span>
      </div>

      {/* Payment status */}
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

      {/* Cancel */}
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

      {/* Booking ID (for support) */}
      <p className="text-[10px] text-text-muted text-center">
        Booking ID: {bookingId}
      </p>
    </div>
  );
}
