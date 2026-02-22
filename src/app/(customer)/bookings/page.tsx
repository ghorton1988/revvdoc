'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAuth } from '@/hooks/useAuth';
import { getBookingsByCustomer } from '@/services/bookingService';
import { formatDate, formatPrice } from '@/lib/formatters';
import type { Booking, BookingStatus } from '@/types';

const STATUS_STYLES: Record<BookingStatus, { label: string; cls: string }> = {
  pending: { label: 'Pending', cls: 'bg-amber-500/15 text-amber-400 border-amber-500/30' },
  accepted: { label: 'Accepted', cls: 'bg-brand/15 text-brand border-brand/30' },
  en_route: { label: 'En Route', cls: 'bg-brand/15 text-brand border-brand/30' },
  in_progress: { label: 'In Progress', cls: 'bg-brand/15 text-brand border-brand/30' },
  complete: { label: 'Complete', cls: 'bg-green-500/15 text-green-400 border-green-500/30' },
  cancelled: { label: 'Cancelled', cls: 'bg-surface-raised text-text-muted border-surface-border' },
};

const ACTIVE_STATUSES: BookingStatus[] = ['accepted', 'en_route', 'in_progress'];
const UPCOMING_STATUSES: BookingStatus[] = ['pending', ...ACTIVE_STATUSES];

function BookingRow({ booking }: { booking: Booking }) {
  const { label, cls } = STATUS_STYLES[booking.status];
  const isActive = ACTIVE_STATUSES.includes(booking.status);

  return (
    <Link
      href={`/bookings/${booking.bookingId}`}
      className="block bg-surface-raised border border-surface-border rounded-xl p-4 hover:border-brand/40 transition-colors"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-text-primary truncate">
            {booking.serviceSnapshot.name}
          </p>
          <p className="text-xs text-text-muted mt-0.5">
            {booking.vehicleSnapshot.year} {booking.vehicleSnapshot.make} {booking.vehicleSnapshot.model}
          </p>
          <p className="text-xs text-text-muted mt-1">
            {formatDate(booking.scheduledAt)}
          </p>
        </div>
        <div className="flex flex-col items-end gap-1.5 shrink-0">
          <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${cls}`}>
            {label}
          </span>
          <span className="text-sm font-bold text-text-primary">
            {formatPrice(booking.totalPrice)}
          </span>
        </div>
      </div>
      {isActive && (
        <div className="mt-3 pt-3 border-t border-surface-border">
          <span className="text-xs text-brand font-medium flex items-center gap-1">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3" />
              <path d="M12 2v2m0 16v2M2 12h2m16 0h2m-3.5-7.5-1.4 1.4M6.9 17.1l-1.4 1.4M17.1 17.1l-1.4-1.4M6.9 6.9 5.5 5.5" />
            </svg>
            Tap to track live
          </span>
        </div>
      )}
    </Link>
  );
}

export default function BookingsPage() {
  const { user, loading: authLoading } = useAuth();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    getBookingsByCustomer(user.uid)
      .then(setBookings)
      .finally(() => setLoading(false));
  }, [user]);

  const upcoming = bookings.filter((b) => UPCOMING_STATUSES.includes(b.status));
  const past = bookings.filter((b) => b.status === 'complete');
  const cancelled = bookings.filter((b) => b.status === 'cancelled');

  if (authLoading || loading) {
    return (
      <div className="p-4 space-y-3">
        <div className="h-7 w-32 bg-surface-raised rounded animate-pulse" />
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-24 bg-surface-raised rounded-xl animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="p-4 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-text-primary">My Bookings</h1>
        <Link
          href="/services"
          className="text-xs font-semibold text-brand bg-brand/10 border border-brand/30 px-3 py-1.5 rounded-full"
        >
          + New
        </Link>
      </div>

      {bookings.length === 0 ? (
        <div className="text-center py-16 space-y-3">
          <svg className="w-12 h-12 text-text-muted mx-auto" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
          <p className="text-text-muted text-sm">No bookings yet.</p>
          <Link
            href="/services"
            className="inline-block px-4 py-2 bg-brand text-surface-base rounded-lg text-sm font-semibold"
          >
            Book a Service
          </Link>
        </div>
      ) : (
        <>
          {upcoming.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-text-secondary uppercase tracking-wider">
                Upcoming ({upcoming.length})
              </p>
              {upcoming.map((b) => (
                <BookingRow key={b.bookingId} booking={b} />
              ))}
            </div>
          )}

          {past.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-text-secondary uppercase tracking-wider">
                Completed ({past.length})
              </p>
              {past.map((b) => (
                <BookingRow key={b.bookingId} booking={b} />
              ))}
            </div>
          )}

          {cancelled.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-text-secondary uppercase tracking-wider">
                Cancelled ({cancelled.length})
              </p>
              {cancelled.map((b) => (
                <BookingRow key={b.bookingId} booking={b} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
