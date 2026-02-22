'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { useAuth } from '@/hooks/useAuth';
import { getAllActiveServices } from '@/services/serviceService';
import { getVehiclesByOwner } from '@/services/vehicleService';
import { createBooking } from '@/services/bookingService';
import { formatPrice, formatDuration, formatDate } from '@/lib/formatters';
import type { Service, Vehicle, ServiceAddress } from '@/types';

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? '');

// ─── Step indicator ──────────────────────────────────────────────────────────

const STEPS = ['Service', 'Vehicle', 'Date', 'Review', 'Pay'];

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

// ─── Step 3: Date + address ──────────────────────────────────────────────────

interface DateAddressResult {
  scheduledAt: Date;
  flexDateEnd: Date | null;
  address: ServiceAddress;
}

function Step3DateAddress({ onNext }: { onNext: (v: DateAddressResult) => void }) {
  const todayStr = new Date().toISOString().split('T')[0];
  const [date, setDate] = useState('');
  const [time, setTime] = useState('09:00');
  const [flexEnd, setFlexEnd] = useState('');
  const [street, setStreet] = useState('');
  const [city, setCity] = useState('');
  const [stateVal, setStateVal] = useState('');
  const [zip, setZip] = useState('');
  const [error, setError] = useState('');

  function handleNext() {
    if (!date || !street || !city || !stateVal || !zip) {
      setError('Please fill in all required fields.');
      return;
    }
    const [h, m] = time.split(':').map(Number);
    const scheduled = new Date(`${date}T00:00:00`);
    scheduled.setHours(h, m, 0, 0);
    if (scheduled < new Date()) {
      setError('Please choose a future date and time.');
      return;
    }
    const flexEndDate = flexEnd ? new Date(`${flexEnd}T23:59:59`) : null;
    if (flexEndDate && flexEndDate < scheduled) {
      setError('Flexible end date must be after the start date.');
      return;
    }
    onNext({
      scheduledAt: scheduled,
      flexDateEnd: flexEndDate,
      address: { street, city, state: stateVal, zip, lat: 0, lng: 0 },
    });
  }

  const inputCls =
    'w-full bg-surface-raised border border-surface-border rounded-lg px-3 py-2 text-sm text-text-primary placeholder-text-muted focus:outline-none focus:border-brand';

  return (
    <div className="p-4 space-y-5">
      <div>
        <h2 className="text-lg font-semibold text-text-primary">Date & Location</h2>
        <p className="text-sm text-text-muted mt-0.5">When and where should we come?</p>
      </div>

      <div className="space-y-3">
        <p className="text-xs font-semibold text-text-secondary uppercase tracking-wider">Schedule</p>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-text-muted mb-1">Preferred Date *</label>
            <input type="date" min={todayStr} value={date} onChange={(e) => setDate(e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className="block text-xs text-text-muted mb-1">Time *</label>
            <input type="time" value={time} onChange={(e) => setTime(e.target.value)} className={inputCls} />
          </div>
        </div>
        <div>
          <label className="block text-xs text-text-muted mb-1">Flexible Until (optional)</label>
          <input type="date" min={date || todayStr} value={flexEnd} onChange={(e) => setFlexEnd(e.target.value)} className={inputCls} />
          <p className="text-xs text-text-muted mt-1">Allow the tech to schedule within a date range</p>
        </div>
      </div>

      <div className="space-y-3">
        <p className="text-xs font-semibold text-text-secondary uppercase tracking-wider">Service Address</p>
        <div>
          <label className="block text-xs text-text-muted mb-1">Street *</label>
          <input type="text" placeholder="123 Main St" value={street} onChange={(e) => setStreet(e.target.value)} className={inputCls} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-text-muted mb-1">City *</label>
            <input type="text" placeholder="Austin" value={city} onChange={(e) => setCity(e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className="block text-xs text-text-muted mb-1">State *</label>
            <input type="text" placeholder="TX" maxLength={2} value={stateVal} onChange={(e) => setStateVal(e.target.value.toUpperCase())} className={inputCls} />
          </div>
        </div>
        <div>
          <label className="block text-xs text-text-muted mb-1">ZIP *</label>
          <input type="text" inputMode="numeric" placeholder="78701" maxLength={5} value={zip} onChange={(e) => setZip(e.target.value.replace(/\D/g, ''))} className={inputCls} />
        </div>
      </div>

      {error && <p className="text-status-fault text-sm">{error}</p>}

      <button onClick={handleNext} className="w-full py-3 bg-brand text-surface-base rounded-xl font-semibold">
        Continue
      </button>
    </div>
  );
}

// ─── Step 4: Review ──────────────────────────────────────────────────────────

function Step4Review({
  service,
  vehicle,
  scheduledAt,
  flexDateEnd,
  address,
  onConfirm,
  loading,
  error,
}: {
  service: Service;
  vehicle: Vehicle;
  scheduledAt: Date;
  flexDateEnd: Date | null;
  address: ServiceAddress;
  onConfirm: () => void;
  loading: boolean;
  error: string;
}) {
  const rows = [
    { label: 'Service', value: service.name },
    { label: 'Vehicle', value: `${vehicle.year} ${vehicle.make} ${vehicle.model}${vehicle.nickname ? ` (${vehicle.nickname})` : ''}` },
    { label: 'Date', value: flexDateEnd ? `${formatDate(scheduledAt)} – ${formatDate(flexDateEnd)}` : formatDate(scheduledAt) },
    { label: 'Address', value: `${address.street}, ${address.city}, ${address.state} ${address.zip}` },
    { label: 'Duration', value: formatDuration(service.durationMins) },
  ];

  return (
    <div className="p-4 space-y-5">
      <div>
        <h2 className="text-lg font-semibold text-text-primary">Review Your Booking</h2>
        <p className="text-sm text-text-muted mt-0.5">Confirm the details below.</p>
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
        <span className="text-sm font-medium text-text-primary">Total</span>
        <span className="text-xl font-bold text-brand">{formatPrice(service.basePrice)}</span>
      </div>

      <p className="text-xs text-text-muted text-center">
        Your card will be pre-authorized but not charged until the service is complete.
      </p>

      {error && (
        <p className="text-status-fault text-sm bg-status-fault/10 border border-status-fault/30 rounded-lg px-3 py-2">
          {error}
        </p>
      )}

      <button
        onClick={onConfirm}
        disabled={loading}
        className="w-full py-3 bg-brand text-surface-base rounded-xl font-semibold disabled:opacity-60 flex items-center justify-center gap-2"
      >
        {loading ? (
          <>
            <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            Setting up payment…
          </>
        ) : (
          'Confirm & Pay'
        )}
      </button>
    </div>
  );
}

// ─── Step 5: Stripe Elements ──────────────────────────────────────────────────

function PaymentForm() {
  const stripe = useStripe();
  const elements = useElements();
  const router = useRouter();
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!stripe || !elements) return;
    setSubmitting(true);
    setError('');

    const result = await stripe.confirmPayment({
      elements,
      confirmParams: { return_url: `${window.location.origin}/bookings` },
      redirect: 'if_required',
    });

    if (result.error) {
      setError(result.error.message ?? 'Payment failed. Please try again.');
      setSubmitting(false);
    } else {
      router.push('/bookings');
    }
  }

  return (
    <div className="p-4 space-y-5">
      <div>
        <h2 className="text-lg font-semibold text-text-primary">Payment</h2>
        <p className="text-sm text-text-muted mt-0.5">
          Pre-authorization only — you won't be charged until service is complete.
        </p>
      </div>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="bg-surface-raised border border-surface-border rounded-xl p-4">
          <PaymentElement options={{ layout: 'tabs' }} />
        </div>
        {error && (
          <p className="text-status-fault text-sm bg-status-fault/10 border border-status-fault/30 rounded-lg px-3 py-2">
            {error}
          </p>
        )}
        <button
          type="submit"
          disabled={!stripe || submitting}
          className="w-full py-3 bg-brand text-surface-base rounded-xl font-semibold disabled:opacity-60 flex items-center justify-center gap-2"
        >
          {submitting ? (
            <>
              <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Processing…
            </>
          ) : (
            'Authorize Payment'
          )}
        </button>
      </form>
    </div>
  );
}

// ─── Main ────────────────────────────────────────────────────────────────────

function BookForm() {
  const searchParams = useSearchParams();
  const initialServiceId = searchParams.get('serviceId');
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  const [step, setStep] = useState<1 | 2 | 3 | 4 | 5>(1);
  const [service, setService] = useState<Service | null>(null);
  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const [scheduledAt, setScheduledAt] = useState<Date | null>(null);
  const [flexDateEnd, setFlexDateEnd] = useState<Date | null>(null);
  const [address, setAddress] = useState<ServiceAddress | null>(null);
  const [bookingId, setBookingId] = useState<string | null>(null);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [confirmLoading, setConfirmLoading] = useState(false);
  const [confirmError, setConfirmError] = useState('');

  async function handleConfirm() {
    if (!user || !service || !vehicle || !scheduledAt || !address) return;
    setConfirmLoading(true);
    setConfirmError('');

    try {
      const newBookingId = await createBooking({
        customerId: user.uid,
        technicianId: null,
        vehicleId: vehicle.vehicleId,
        serviceId: service.serviceId,
        serviceSnapshot: {
          serviceId: service.serviceId,
          name: service.name,
          category: service.category,
          basePrice: service.basePrice,
          durationMins: service.durationMins,
        },
        vehicleSnapshot: {
          vehicleId: vehicle.vehicleId,
          vin: vehicle.vin,
          make: vehicle.make,
          model: vehicle.model,
          year: vehicle.year,
          nickname: vehicle.nickname,
          mileage: vehicle.mileage,
        },
        scheduledAt,
        flexDateEnd,
        status: 'pending',
        address,
        totalPrice: service.basePrice,
        stripePaymentIntentId: null,
      });
      setBookingId(newBookingId);

      const idToken = await (user as { getIdToken?: () => Promise<string> }).getIdToken?.();
      const res = await fetch('/api/stripe/create-payment-intent', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(idToken ? { Authorization: `Bearer ${idToken}` } : {}),
        },
        body: JSON.stringify({ bookingId: newBookingId, amountCents: service.basePrice }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? 'Failed to create payment intent');
      }

      const { clientSecret: cs } = await res.json();
      setClientSecret(cs);
      setStep(5);
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

  return (
    <div>
      {/* Sub-header with back button + step bar */}
      <div className="sticky top-14 z-30 bg-surface-base border-b border-surface-border">
        <div className="flex items-center gap-3 px-4 h-11">
          {step > 1 && step < 5 && (
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
        <Step3DateAddress
          onNext={({ scheduledAt: sa, flexDateEnd: fe, address: addr }) => {
            setScheduledAt(sa);
            setFlexDateEnd(fe);
            setAddress(addr);
            setStep(4);
          }}
        />
      )}

      {step === 4 && service && vehicle && scheduledAt && address && (
        <Step4Review
          service={service}
          vehicle={vehicle}
          scheduledAt={scheduledAt}
          flexDateEnd={flexDateEnd}
          address={address}
          onConfirm={handleConfirm}
          loading={confirmLoading}
          error={confirmError}
        />
      )}

      {step === 5 && clientSecret && (
        <Elements
          stripe={stripePromise}
          options={{
            clientSecret,
            appearance: {
              theme: 'night',
              variables: {
                colorPrimary: '#D4A843',
                colorBackground: '#141414',
                colorText: '#E5E5E5',
                borderRadius: '8px',
              },
            },
          }}
        >
          <PaymentForm />
        </Elements>
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
