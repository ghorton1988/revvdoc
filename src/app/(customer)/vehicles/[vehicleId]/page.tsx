'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { useVehicleHealth } from '@/hooks/useVehicleHealth';
import { getVehicleById, updateVehicle } from '@/services/vehicleService';
import { getUpcomingBookingsForVehicle } from '@/services/bookingService';
import { VehicleHealthBanner } from '@/components/vehicles/VehicleHealthBanner';
import { RecallAlert } from '@/components/vehicles/RecallAlert';
import { VEHICLE_STATUS_STYLES } from '@/types';
import type { Vehicle, RecallRecord, FactoryMaintenanceItem, Booking, BookingStatus } from '@/types';

export default function VehicleDetailPage() {
  const { vehicleId } = useParams<{ vehicleId: string }>();
  const { user } = useAuth();
  const router = useRouter();

  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const [loading, setLoading] = useState(true);

  // Health snapshot — real-time via onSnapshot
  const { snapshot: healthSnapshot, loading: healthLoading } = useVehicleHealth(vehicleId);

  // Recalls — server-cached, fetched once on mount
  const [recalls, setRecalls] = useState<RecallRecord[]>([]);
  const [recallsLoading, setRecallsLoading] = useState(false);

  // Factory schedule — generated server-side, 30-day cache
  const [factorySchedule, setFactorySchedule] = useState<FactoryMaintenanceItem[] | null>(null);
  const [scheduleLoading, setScheduleLoading] = useState(false);

  // Upcoming bookings for this vehicle
  const [upcomingBookings, setUpcomingBookings] = useState<Booking[]>([]);

  // Inline mileage edit
  const [editingMileage, setEditingMileage] = useState(false);
  const [mileageInput, setMileageInput] = useState('');
  const [savingMileage, setSavingMileage] = useState(false);
  const [mileageError, setMileageError] = useState('');

  // Fetch vehicle document (one-time on mount)
  useEffect(() => {
    getVehicleById(vehicleId)
      .then((v) => { setVehicle(v); setLoading(false); })
      .catch(() => setLoading(false));
  }, [vehicleId]);

  // Fetch recalls after vehicle doc is loaded
  useEffect(() => {
    if (!vehicle || !user) return;

    const fetchRecalls = async () => {
      setRecallsLoading(true);
      try {
        const { getAuth } = await import('firebase/auth');
        const idToken = await getAuth().currentUser?.getIdToken();
        if (!idToken) return;

        const params = new URLSearchParams({
          make:  vehicle.make,
          model: vehicle.model,
          year:  String(vehicle.year),
        });
        const res = await fetch(`/api/vehicles/recalls?${params}`, {
          headers: { Authorization: `Bearer ${idToken}` },
        });
        if (res.ok) {
          const data = await res.json();
          setRecalls(data.recalls ?? []);
        }
      } catch (err) {
        console.error('[VehicleDetail] recalls fetch error:', err);
      } finally {
        setRecallsLoading(false);
      }
    };

    fetchRecalls();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vehicle?.vehicleId]);

  // Fetch factory schedule after vehicle doc is loaded
  useEffect(() => {
    if (!vehicle || !user) return;

    const fetchSchedule = async () => {
      setScheduleLoading(true);
      try {
        const { getAuth } = await import('firebase/auth');
        const idToken = await getAuth().currentUser?.getIdToken();
        if (!idToken) return;

        const res = await fetch(
          `/api/vehicles/factory-schedule?vehicleId=${vehicleId}`,
          { headers: { Authorization: `Bearer ${idToken}` } }
        );
        if (res.ok) {
          const data = await res.json();
          setFactorySchedule(data.schedule ?? []);
        }
      } catch (err) {
        console.error('[VehicleDetail] factory schedule fetch error:', err);
      } finally {
        setScheduleLoading(false);
      }
    };

    fetchSchedule();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vehicle?.vehicleId]);

  // Fetch upcoming bookings for this vehicle
  useEffect(() => {
    if (!user || !vehicle) return;
    getUpcomingBookingsForVehicle(user.uid, vehicleId)
      .then(setUpcomingBookings)
      .catch(console.error);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.uid, vehicle?.vehicleId]);

  // ── Mileage edit ─────────────────────────────────────────────────────────────

  function startEditMileage() {
    if (!vehicle) return;
    setMileageInput(String(vehicle.mileage));
    setMileageError('');
    setEditingMileage(true);
  }

  async function saveMileage() {
    if (!vehicle || savingMileage) return;
    const parsed = parseInt(mileageInput.replace(/,/g, ''), 10);
    if (isNaN(parsed) || parsed < 0) {
      setMileageError('Please enter a valid mileage.');
      return;
    }

    setSavingMileage(true);
    setMileageError('');
    try {
      await updateVehicle(vehicleId, { mileage: parsed });
      setVehicle((v) => v ? { ...v, mileage: parsed } : v);
      setEditingMileage(false);

      // Trigger maintenance recompute (non-blocking — updates health snapshot)
      const { getAuth } = await import('firebase/auth');
      const idToken = await getAuth().currentUser?.getIdToken();
      if (idToken) {
        fetch('/api/maintenance/recompute', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${idToken}`,
          },
          body: JSON.stringify({ vehicleId }),
        }).catch(console.error);
      }
    } catch (err) {
      setMileageError(err instanceof Error ? err.message : 'Failed to save mileage.');
    } finally {
      setSavingMileage(false);
    }
  }

  // ── Loading skeleton ──────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="p-4 space-y-4">
        <div className="h-8 w-52 bg-surface-raised rounded animate-pulse" />
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-20 bg-surface-raised rounded-xl animate-pulse" />
        ))}
      </div>
    );
  }

  if (!vehicle) {
    return (
      <div className="p-4 text-center py-16 space-y-3">
        <p className="text-text-muted text-sm">Vehicle not found.</p>
        <Link href="/vehicles" className="text-brand text-sm">Back to vehicles</Link>
      </div>
    );
  }

  const statusStyle = VEHICLE_STATUS_STYLES[vehicle.status];
  const lastServiceDate = vehicle.lastServiceDate
    ? (() => {
        const d = vehicle.lastServiceDate instanceof Date
          ? vehicle.lastServiceDate
          : (vehicle.lastServiceDate as { toDate(): Date }).toDate();
        return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
      })()
    : 'No services recorded';

  // ── Main view ─────────────────────────────────────────────────────────────────

  return (
    <div className="p-4 pb-8 space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => router.back()} className="text-text-secondary shrink-0">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-lg font-bold text-text-primary truncate">
            {vehicle.year} {vehicle.make} {vehicle.model}
          </h1>
          {vehicle.nickname && (
            <p className="text-sm text-text-muted truncate">{vehicle.nickname}</p>
          )}
        </div>
        <span className={`shrink-0 text-[11px] font-bold px-2.5 py-1 rounded-full ${statusStyle.bg} ${statusStyle.text}`}>
          {statusStyle.label}
        </span>
      </div>

      {/* Info card */}
      <div className="bg-surface-raised border border-surface-border rounded-xl divide-y divide-surface-border">
        {[
          { label: 'VIN',          value: vehicle.vin },
          { label: 'Last Service', value: lastServiceDate },
        ].map(({ label, value }) => (
          <div key={label} className="flex items-center justify-between px-4 py-3 gap-4">
            <span className="text-xs text-text-muted shrink-0">{label}</span>
            <span className="text-sm text-text-primary text-right font-mono">{value}</span>
          </div>
        ))}

        {/* Mileage — inline editable */}
        <div className="flex items-center justify-between px-4 py-3 gap-4 min-h-[52px]">
          <span className="text-xs text-text-muted shrink-0">Mileage</span>
          {editingMileage ? (
            <div className="flex items-center gap-2">
              <input
                type="number"
                value={mileageInput}
                onChange={(e) => setMileageInput(e.target.value)}
                className="w-28 text-sm text-right bg-surface-mid border border-brand/40 rounded-lg px-2 py-1 text-text-primary focus:outline-none"
                autoFocus
              />
              <button
                onClick={saveMileage}
                disabled={savingMileage}
                className="text-xs text-brand font-medium disabled:opacity-60"
              >
                {savingMileage ? 'Saving…' : 'Save'}
              </button>
              <button onClick={() => setEditingMileage(false)} className="text-xs text-text-muted">
                Cancel
              </button>
            </div>
          ) : (
            <button onClick={startEditMileage} className="flex items-center gap-1.5 group">
              <span className="text-sm text-text-primary">
                {vehicle.mileage.toLocaleString()} mi
              </span>
              {/* Pencil icon */}
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-text-muted group-hover:text-brand transition-colors">
                <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
                <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
              </svg>
            </button>
          )}
        </div>

        {mileageError && (
          <p className="px-4 py-2 text-xs text-status-fault">{mileageError}</p>
        )}
      </div>

      {/* Health snapshot */}
      <section>
        <h2 className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">
          Vehicle Health
        </h2>
        <VehicleHealthBanner snapshot={healthSnapshot} loading={healthLoading} />
      </section>

      {/* Quick navigation */}
      <div className="grid grid-cols-2 gap-3">
        <Link
          href={`/vehicles/${vehicleId}/maintenance`}
          className="flex items-center gap-2 bg-surface-raised border border-surface-border rounded-xl px-4 py-3 hover:border-brand/30 transition-colors"
        >
          {/* Clock icon */}
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="text-brand shrink-0">
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 16 14" />
          </svg>
          <span className="text-sm font-medium text-text-primary">Schedules</span>
        </Link>

        <Link
          href={`/vehicles/${vehicleId}/timeline`}
          className="flex items-center gap-2 bg-surface-raised border border-surface-border rounded-xl px-4 py-3 hover:border-brand/30 transition-colors"
        >
          {/* Clipboard icon */}
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="text-brand shrink-0">
            <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
          <span className="text-sm font-medium text-text-primary">History</span>
        </Link>
      </div>

      {/* Upcoming bookings for this vehicle */}
      {upcomingBookings.length > 0 && (
        <section>
          <h2 className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">
            Upcoming Service
          </h2>
          <div className="space-y-2">
            {upcomingBookings.map((b) => {
              const statusStyles: Partial<Record<BookingStatus, { label: string; cls: string }>> = {
                pending:  { label: 'Awaiting Tech',     cls: 'bg-amber-500/15 text-amber-400 border-amber-500/30' },
                accepted: { label: 'Tech Assigned',     cls: 'bg-brand/15 text-brand border-brand/30' },
              };
              const s = statusStyles[b.status] ?? { label: b.status, cls: 'bg-surface-raised text-text-muted border-surface-border' };
              const dateStr = b.scheduledAt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
              const windowLabels: Record<string, string> = { morning: 'Morning', afternoon: 'Afternoon', evening: 'Evening' };
              return (
                <Link
                  key={b.bookingId}
                  href={`/bookings/${b.bookingId}`}
                  className="flex items-center justify-between gap-3 bg-surface-raised border border-surface-border rounded-xl px-4 py-3 hover:border-brand/30 transition-colors"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-text-primary truncate">{b.serviceSnapshot.name}</p>
                    <p className="text-xs text-text-muted">
                      {dateStr}
                      {b.scheduledTimeWindow ? ` · ${windowLabels[b.scheduledTimeWindow] ?? b.scheduledTimeWindow}` : ''}
                    </p>
                  </div>
                  <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border shrink-0 ${s.cls}`}>
                    {s.label}
                  </span>
                </Link>
              );
            })}
          </div>
        </section>
      )}

      {/* NHTSA open recalls (from vehicle doc cache) */}
      {vehicle.nhtsaRecalls !== undefined && vehicle.nhtsaRecalls !== null && (
        <section>
          <h2 className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">
            Open Recalls
          </h2>
          {vehicle.nhtsaRecalls.length === 0 ? (
            <div className="bg-surface-raised border border-surface-border rounded-xl px-4 py-3 flex items-center gap-2">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-status-optimal shrink-0">
                <polyline points="20 6 9 17 4 12" />
              </svg>
              <p className="text-sm text-status-optimal font-medium">No open recalls on file</p>
            </div>
          ) : (
            <div className="space-y-3">
              {vehicle.nhtsaRecalls.map((r, i) => (
                <div key={r.nhtsaId || i} className="bg-status-fault/10 border border-status-fault/30 rounded-xl p-3 space-y-1">
                  <p className="text-xs font-bold text-status-fault uppercase tracking-wide">{r.component}</p>
                  <p className="text-sm text-text-primary">{r.summary}</p>
                  {r.remedy && <p className="text-xs text-text-muted">Remedy: {r.remedy}</p>}
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* Vehicle specs from NHTSA decode */}
      {vehicle.nhtsaDecoded && Object.keys(vehicle.nhtsaDecoded).length > 0 && (
        <section>
          <h2 className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">
            Vehicle Specs
          </h2>
          <div className="bg-surface-raised border border-surface-border rounded-xl divide-y divide-surface-border">
            {([
              ['Engine',       vehicle.nhtsaDecoded['Engine Model'] ?? vehicle.nhtsaDecoded['Engine Configuration']],
              ['Displacement', vehicle.nhtsaDecoded['Displacement (L)'] ? `${vehicle.nhtsaDecoded['Displacement (L)']}L` : null],
              ['Fuel Type',    vehicle.nhtsaDecoded['Fuel Type - Primary']],
              ['Body Style',   vehicle.nhtsaDecoded['Body Class']],
              ['Drive Type',   vehicle.nhtsaDecoded['Drive Type']],
              ['Doors',        vehicle.nhtsaDecoded['Number of Doors']],
            ] as [string, string | null | undefined][])
              .filter(([, v]) => v)
              .map(([label, value]) => (
                <div key={label} className="flex items-center justify-between px-4 py-3 gap-4">
                  <span className="text-xs text-text-muted shrink-0">{label}</span>
                  <span className="text-sm text-text-primary text-right">{value}</span>
                </div>
              ))}
          </div>
        </section>
      )}

      {/* Factory maintenance schedule */}
      <section>
        <h2 className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">
          Factory Schedule
        </h2>
        {scheduleLoading ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-14 bg-surface-raised rounded-xl animate-pulse" />
            ))}
          </div>
        ) : factorySchedule && factorySchedule.length > 0 ? (
          <div className="bg-surface-raised border border-surface-border rounded-xl divide-y divide-surface-border">
            {factorySchedule.map((item, i) => (
              <div key={i} className="px-4 py-3 space-y-0.5">
                <p className="text-sm font-medium text-text-primary">{item.service}</p>
                <p className="text-xs text-text-muted">
                  Every {item.intervalMiles > 0 ? `${item.intervalMiles.toLocaleString()} mi` : ''}
                  {item.intervalMiles > 0 && item.intervalMonths > 0 ? ' or ' : ''}
                  {item.intervalMonths > 0 ? `${item.intervalMonths} mo` : ''}
                  {item.notes ? ` · ${item.notes}` : ''}
                </p>
              </div>
            ))}
          </div>
        ) : factorySchedule !== null ? (
          <p className="text-sm text-text-muted">No schedule available for this vehicle.</p>
        ) : null}
      </section>

      {/* Safety recalls (from /api/vehicles/recalls — make/model/year cache) */}
      {(recallsLoading || recalls.length > 0) && (
        <section>
          <h2 className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">
            Safety Recalls
          </h2>
          {recallsLoading ? (
            <div className="h-16 bg-surface-raised rounded-xl animate-pulse" />
          ) : (
            <div className="space-y-3">
              {recalls.map((r) => (
                <RecallAlert key={r.nhtsaId} recall={r} />
              ))}
            </div>
          )}
        </section>
      )}

      <p className="text-[10px] text-text-muted text-center">
        Vehicle ID: {vehicleId}
      </p>
    </div>
  );
}
