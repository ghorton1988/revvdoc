'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { getAllActiveServices } from '@/services/serviceService';
import { getVehiclesByOwner } from '@/services/vehicleService';
import { formatPrice, formatDuration } from '@/lib/formatters';
import type { Service, Vehicle, BookingTimeWindow } from '@/types';

// ─── Step indicator ──────────────────────────────────────────────────────────

const STEPS = ['Service', 'Vehicle', 'Schedule', 'Confirm'];

function StepBar({ step }: { step: number }) {
  return (
    <div className="flex items-center gap-1 px-4 py-3">
      {STEPS.map((label, i) => {
        const n = i + 1;
        const done = n < step;
        const active = n === step;
        return (
          <div key={label} className="flex items-center gap-1 flex-1 last:flex-none">
            <div
              className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                done
                  ? 'bg-brand text-surface-base'
                  : active
                  ? 'bg-brand/20 text-brand border border-brand'
                  : 'bg-surface-raised text-text-muted border border-surface-border'
              }`}
            >
              {done ? (
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              ) : (
                n
              )}
            </div>
            {i < STEPS.length - 1 && (
              <div className={`h-px flex-1 ${done ? 'bg-brand' : 'bg-surface-border'}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Step 1: Service ─────────────────────────────────────────────────────────

function Step1Service({
  onSelect,
  initialServiceId,
}: {
  onSelect: (s: Service) => void;
  initialServiceId: string | null;
}) {
  const [services, setServices] = useState<Service[]>([]);
  const [tab, setTab] = useState<'all' | 'mechanic' | 'detailing' | 'diagnostic'>('all');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getAllActiveServices()
      .then(setServices)
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (initialServiceId && services.length > 0) {
      const s = services.find((x) => x.serviceId === initialServiceId);
      if (s) onSelect(s);
    }
  }, [initialServiceId, services, onSelect]);

  const TABS = [
    { key: 'all', label: 'All' },
    { key: 'mechanic', label: 'Mechanic' },
    { key: 'detailing', label: 'Detailing' },
    { key: 'diagnostic', label: 'Diagnostic' },
  ] as const;

  const filtered = tab === 'all' ? services : services.filter((s) => s.category === tab);

  if (loading) {
    return (
      <div className="p-4 space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-24 bg-surface-raised rounded-xl animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-text-primary">Choose a Service</h2>
        <p className="text-sm text-text-muted mt-0.5">What do you need done today?</p>
      </div>
      <div className="flex gap-2 overflow-x-auto pb-1">
        {TABS.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap shrink-0 transition-colors ${
              tab === key
                ? 'bg-brand text-surface-base'
                : 'bg-surface-raised text-text-muted border border-surface-border'
            }`}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="space-y-2">
        {filtered.map((s) => (
          <button
            key={s.serviceId}
            onClick={() => onSelect(s)}
            className="w-full text-left bg-surface-raised border border-surface-border rounded-xl p-4 hover:border-brand/50 transition-colors"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <span className="text-[10px] uppercase tracking-widest text-text-muted font-medium">
                  {s.category}
                </span>
                <p className="font-semibold text-text-primary mt-0.5">{s.name}</p>
                <p className="text-xs text-text-muted mt-1 line-clamp-2">{s.description}</p>
              </div>
              <div className="text-right shrink-0">
                <p className="font-bold text-text-primary">{formatPrice(s.basePrice)}</p>
                <p className="text-xs text-text-muted mt-0.5">{formatDuration(s.durationMins)}</p>
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── Step 2: Vehicle ─────────────────────────────────────────────────────────

function Step2Vehicle({ onSelect, userId }: { onSelect: (v: Vehicle) => void; userId: string }) {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    getVehiclesByOwner(userId)
      .then(setVehicles)
      .finally(() => setLoading(false));
  }, [userId]);

  if (loading) {
    return (
      <div className="p-4 space-y-3">
        {[1, 2].map((i) => (
          <div key={i} className="h-20 bg-surface-raised rounded-xl animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-text-primary">Select a Vehicle</h2>
        <p className="text-sm text-text-muted mt-0.5">Which vehicle needs service?</p>
      </div>
      {vehicles.length === 0 ? (
        <div className="text-center py-12 space-y-3">
          <p className="text-text-muted text-sm">No vehicles on your account yet.</p>
          <button
            onClick={() => router.push('/vehicles/add')}
            className="px-4 py-2 bg-brand text-surface-base rounded-lg text-sm font-semibold"
          >
            Add a Vehicle
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          {vehicles.map((v) => (
            <button
              key={v.vehicleId}
              onClick={() => onSelect(v)}
              className="w-full text-left bg-surface-raised border border-surface-border rounded-xl p-4 hover:border-brand/50 transition-colors"
            >
              <p className="font-semibold text-text-primary">
                {v.year} {v.make} {v.model}
                {v.nickname ? ` · ${v.nickname}` : ''}
              </p>
              <p className="text-xs text-text-muted mt-0.5">
                VIN: {v.vin.slice(0, 8)}… · {v.mileage.toLocaleString()} mi
              </p>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Step 3: Schedule ────────────────────────────────────────────────────────

const TIME_WINDOWS: { key: BookingTimeWindow; label: string; range: string }[] = [
  { key: 'morning',   label: 'Morning',   range: '8 AM – 12 PM' },
  { key: 'afternoon', label: 'Afternoon', range: '12 PM – 5 PM' },
  { key: 'evening',   label: 'Evening',   range: '5 PM – 8 PM' },
];

interface ScheduleResult {
  scheduledDate: string;            // YYYY-MM-DD
  scheduledTimeWindow: BookingTimeWindow;
}

function Step3Schedule({ onNext }: { onNext: (v: ScheduleResult) => void }) {
  const todayStr = new Date().toISOString().split('T')[0];
  const [date, setDate] = useState('');
  const [timeWindow, setTimeWindow] = useState<BookingTimeWindow | null>(null);
  const [error, setError] = useState('');

  function handleNext() {
    if (!date) { setError('Please select a date.'); return; }
    if (!timeWindow) { setError('Please select a time window.'); return; }
    if (date < todayStr) { setError('Please choose a future date.'); return; }
    onNext({ scheduledDate: date, scheduledTimeWindow: timeWindow });
  }

  const inputCls =
    'w-full bg-surface-raised border border-surface-border rounded-lg px-3 py-2 text-sm text-text-primary placeholder-text-muted focus:outline-none focus:border-brand';

  return (
    <div className="p-4 space-y-5">
      <div>
        <h2 className="text-lg font-semibold text-text-primary">Pick a Date & Time</h2>
        <p className="text-sm text-text-muted mt-0.5">When would you like service?</p>
      </div>

      <div className="space-y-2">
        <label className="block text-xs text-text-muted">Preferred Date *</label>
        <input
          type="date"
          min={todayStr}
          value={date}
          onChange={(e) => { setDate(e.target.value); setError(''); }}
          className={inputCls}
        />
      </div>

      <div className="space-y-2">
        <p className="text-xs text-text-muted">Preferred Time Window *</p>
        <div className="grid grid-cols-3 gap-2">
          {TIME_WINDOWS.map(({ key, label, range }) => (
            <button
              key={key}
              onClick={() => { setTimeWindow(key); setError(''); }}
              className={`flex flex-col items-center py-3 px-2 rounded-xl border transition-colors ${
                timeWindow === key
                  ? 'bg-brand/15 border-brand text-brand'
                  : 'bg-surface-raised border-surface-border text-text-muted hover:border-brand/40'
              }`}
            >
              <span className="text-sm font-semibold">{label}</span>
              <span className="text-[10px] mt-0.5 opacity-80">{range}</span>
            </button>
          ))}
        </div>
      </div>

      {error && <p className="text-status-fault text-sm">{error}</p>}

      <button onClick={handleNext} className="w-full py-3 bg-brand text-surface-base rounded-xl font-semibold">
        Continue
      </button>
    </div>
  );
}

// ─── Step 4: Confirm (with notes) ────────────────────────────────────────────

function Step4Confirm({
  service,
  vehicle,
  scheduledDate,
  scheduledTimeWindow,
  onConfirm,
  loading,
  error,
}: {
  service: Service;
  vehicle: Vehicle;
  scheduledDate: string;
  scheduledTimeWindow: BookingTimeWindow;
  onConfirm: (notes: string) => void;
  loading: boolean;
  error: string;
}) {
  const [notes, setNotes] = useState('');

  /** Format "2026-03-15" → "Mar 15, 2026" without timezone shift. */
  function formatLocalDate(dateStr: string): string {
    const [y, m, d] = dateStr.split('-').map(Number);
    return new Date(y, m - 1, d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }

  const windowLabel = TIME_WINDOWS.find((w) => w.key === scheduledTimeWindow)?.label ?? scheduledTimeWindow;

  const rows = [
    { label: 'Service',  value: service.name },
    { label: 'Vehicle',  value: `${vehicle.year} ${vehicle.make} ${vehicle.model}${vehicle.nickname ? ` (${vehicle.nickname})` : ''}` },
    { label: 'Date',     value: formatLocalDate(scheduledDate) },
    { label: 'Window',   value: `${windowLabel} (${TIME_WINDOWS.find((w) => w.key === scheduledTimeWindow)?.range})` },
    { label: 'Duration', value: formatDuration(service.durationMins) },
  ];

  return (
    <div className="p-4 space-y-5">
      <div>
        <h2 className="text-lg font-semibold text-text-primary">Confirm Booking</h2>
        <p className="text-sm text-text-muted mt-0.5">Review your details and add any notes.</p>
      </div>

      <div className="bg-surface-raised border border-surface-border rounded-xl divide-y divide-surface-border">
        {rows.map(({ label, value }) => (
          <div key={label} className="flex items-start justify-between gap-4 px-4 py-3">
            <span className="text-xs text-text-muted shrink-0 pt-0.5">{label}</span>
            <span className="text-sm text-text-primary text-right">{value}</span>
          </div>
        ))}
      </div>

      <div className="bg-brand/10 border border-brand/30 rounded-xl px-4 py-3 flex items-center justify-between">
        <span className="text-sm font-medium text-text-primary">Estimated Total</span>
        <span className="text-xl font-bold text-brand">{formatPrice(service.basePrice)}</span>
      </div>

      <div className="space-y-1.5">
        <label className="block text-xs text-text-muted">Notes for the Technician (optional)</label>
        <textarea
          rows={3}
          maxLength={500}
          placeholder="E.g. gate code, parking instructions, specific concerns…"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className="w-full bg-surface-raised border border-surface-border rounded-lg px-3 py-2 text-sm text-text-primary placeholder-text-muted focus:outline-none focus:border-brand resize-none"
        />
        <p className="text-[10px] text-text-muted text-right">{notes.length}/500</p>
      </div>

      <p className="text-xs text-text-muted text-center">
        Payment is collected after the service is complete.
      </p>

      {error && (
        <p className="text-status-fault text-sm bg-status-fault/10 border border-status-fault/30 rounded-lg px-3 py-2">
          {error}
        </p>
      )}

      <button
        onClick={() => onConfirm(notes)}
        disabled={loading}
        className="w-full py-3 bg-brand text-surface-base rounded-xl font-semibold disabled:opacity-60 flex items-center justify-center gap-2"
      >
        {loading ? (
          <>
            <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            Booking…
          </>
        ) : (
          'Request Service'
        )}
      </button>
    </div>
  );
}

// ─── Success screen ───────────────────────────────────────────────────────────

function SuccessScreen({ bookingId, onViewBookings }: { bookingId: string; onViewBookings: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] p-8 text-center space-y-5">
      <div className="w-16 h-16 rounded-full bg-green-500/15 flex items-center justify-center">
        <svg className="text-green-400" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M22 11.08V12a10 10 0 11-5.93-9.14" />
          <polyline points="22 4 12 14.01 9 11.01" />
        </svg>
      </div>
      <div>
        <h2 className="text-xl font-bold text-text-primary">Booking Requested!</h2>
        <p className="text-sm text-text-muted mt-2">
          We&apos;ll match you with a technician and confirm your appointment shortly.
        </p>
      </div>
      <div className="w-full bg-surface-raised border border-surface-border rounded-xl px-4 py-3 text-left space-y-1">
        <p className="text-xs text-text-muted">Booking ID</p>
        <p className="text-sm font-mono text-text-primary">{bookingId}</p>
      </div>
      <button
        onClick={onViewBookings}
        className="w-full py-3 bg-brand text-surface-base rounded-xl font-semibold"
      >
        View My Bookings
      </button>
    </div>
  );
}

// ─── Main ────────────────────────────────────────────────────────────────────

function BookForm() {
  const searchParams = useSearchParams();
  const initialServiceId = searchParams.get('serviceId');
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [service, setService] = useState<Service | null>(null);
  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const [scheduledDate, setScheduledDate] = useState('');
  const [scheduledTimeWindow, setScheduledTimeWindow] = useState<BookingTimeWindow | null>(null);
  const [confirmLoading, setConfirmLoading] = useState(false);
  const [confirmError, setConfirmError] = useState('');
  const [createdBookingId, setCreatedBookingId] = useState<string | null>(null);

  async function handleConfirm(notes: string) {
    if (!user || !service || !vehicle || !scheduledDate || !scheduledTimeWindow) return;
    setConfirmLoading(true);
    setConfirmError('');

    try {
      const { getAuth } = await import('firebase/auth');
      const firebaseUser = getAuth().currentUser;
      if (!firebaseUser) throw new Error('User not authenticated');
      const token = await firebaseUser.getIdToken();

      const res = await fetch('/api/bookings/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          userId:              user.uid,
          vehicleId:           vehicle.vehicleId,
          serviceId:           service.serviceId,
          scheduledDate,
          scheduledTimeWindow,
          notes:               notes || undefined,
          source:              initialServiceId ? 'manual' : 'manual',
        }),
      });

      const text = await res.text();
      let data;
      try {
        data = JSON.parse(text);
      } catch {
        console.error('BOOKING RAW RESPONSE:', text);
        throw new Error('Server returned non-JSON response: ' + text);
      }

      if (!res.ok) {
        throw new Error(data?.message || data?.error || 'Booking failed');
      }

      setCreatedBookingId(data.bookingId);
    } catch (err: unknown) {
      setConfirmError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setConfirmLoading(false);
    }
  }

  if (authLoading) {
    return (
      <div className="p-4 space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-20 bg-surface-raised rounded-xl animate-pulse" />
        ))}
      </div>
    );
  }

  if (!user) {
    router.replace('/sign-in');
    return null;
  }

  if (createdBookingId) {
    return <SuccessScreen bookingId={createdBookingId} onViewBookings={() => router.push('/bookings')} />;
  }

  return (
    <div>
      {/* Sub-header with back button + step bar */}
      <div className="sticky top-14 z-30 bg-surface-base border-b border-surface-border">
        <div className="flex items-center gap-3 px-4 h-11">
          {step > 1 && (
            <button
              onClick={() => setStep((s) => (s - 1) as typeof step)}
              className="text-text-secondary -ml-1"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M15 18l-6-6 6-6" />
              </svg>
            </button>
          )}
          <span className="font-semibold text-sm text-text-primary">Book a Service</span>
        </div>
        <StepBar step={step} />
      </div>

      {step === 1 && (
        <Step1Service
          initialServiceId={initialServiceId}
          onSelect={(s) => { setService(s); setStep(2); }}
        />
      )}

      {step === 2 && (
        <Step2Vehicle
          userId={user.uid}
          onSelect={(v) => { setVehicle(v); setStep(3); }}
        />
      )}

      {step === 3 && (
        <Step3Schedule
          onNext={({ scheduledDate: d, scheduledTimeWindow: tw }) => {
            setScheduledDate(d);
            setScheduledTimeWindow(tw);
            setStep(4);
          }}
        />
      )}

      {step === 4 && service && vehicle && scheduledDate && scheduledTimeWindow && (
        <Step4Confirm
          service={service}
          vehicle={vehicle}
          scheduledDate={scheduledDate}
          scheduledTimeWindow={scheduledTimeWindow}
          onConfirm={handleConfirm}
          loading={confirmLoading}
          error={confirmError}
        />
      )}
    </div>
  );
}

export default function BookPage() {
  return (
    <Suspense
      fallback={
        <div className="p-4 space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-20 bg-surface-raised rounded-xl animate-pulse" />
          ))}
        </div>
      }
    >
      <BookForm />
    </Suspense>
  );
}
