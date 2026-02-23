'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAuth } from '@/hooks/useAuth';
import { getVehiclesByOwner } from '@/services/vehicleService';
import { getUpcomingBookingsForCustomer } from '@/services/bookingService';
import { VEHICLE_STATUS_STYLES } from '@/types';
import type { Vehicle, WeatherSnapshot, Booking } from '@/types';

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

// ── Phase 2 / Wave 1: status derivation incorporating recalls + weather ────────

/**
 * Returns a display-status key for the gauge, incorporating:
 *  1. Open NHTSA recalls → 'NEEDS_ATTENTION'
 *  2. Weather risk (cold or heat) → 'NEEDS_ATTENTION'
 *  3. Fallback to the vehicle's stored VehicleStatus
 *
 * Display-only — does NOT write back to Firestore.
 */
function computeDisplayStatus(vehicle: Vehicle): string {
  const hasRecall   = (vehicle.nhtsaRecalls?.length ?? 0) > 0;
  const weatherRisk = vehicle.lastWeather?.riskFlags.coldRisk || vehicle.lastWeather?.riskFlags.heatRisk;
  if (hasRecall || weatherRisk) return 'NEEDS_ATTENTION';
  return vehicle.status;
}

/**
 * Derives the worst-case fleet display-status across all vehicles.
 * Priority: FAULT > NEEDS_ATTENTION > SERVICE_DUE > OPTIMAL
 */
function fleetStatus(vehicles: Vehicle[]): string {
  if (vehicles.some((v) => v.status === 'FAULT'))                         return 'FAULT';
  if (vehicles.some((v) => computeDisplayStatus(v) === 'NEEDS_ATTENTION')) return 'NEEDS_ATTENTION';
  if (vehicles.some((v) => v.status === 'SERVICE_DUE'))                   return 'SERVICE_DUE';
  return 'OPTIMAL';
}

// ─── Gauge config ──────────────────────────────────────────────────────────────

/**
 * Maps every vehicle status (current + future) to gauge display values.
 *
 * Percentages reflect visual health level:
 *   OPTIMAL         → 85–95%  (center: 90)
 *   SERVICE_DUE     → 55–70%  (center: 62)
 *   NEEDS_ATTENTION → 25–45%  (center: 35) — future status
 *   FAULT / CRITICAL→  5–20%  (center: 12)
 *
 * Colors stay within the RevvDoc neon teal / amber / red palette.
 * Unknown statuses fall back to OPTIMAL.
 */
const GAUGE_CONFIG: Record<
  string,
  { pct: number; color: string; label: string; glowRgb: string }
> = {
  OPTIMAL:         { pct: 90, color: '#00E5B4', label: 'OPTIMAL',          glowRgb: '0,229,180' },
  SERVICE_DUE:     { pct: 62, color: '#F59E0B', label: 'SERVICE DUE',       glowRgb: '245,158,11' },
  NEEDS_ATTENTION: { pct: 35, color: '#F59E0B', label: 'NEEDS ATTENTION',   glowRgb: '245,158,11' },
  FAULT:           { pct: 12, color: '#EF4444', label: 'FAULT DETECTED',    glowRgb: '239,68,68' },
  CRITICAL:        { pct: 8,  color: '#EF4444', label: 'CRITICAL',          glowRgb: '239,68,68' },
};

// ─── SVG Arc Gauge ─────────────────────────────────────────────────────────────

/**
 * StatusGauge — semicircular SVG arc gauge replacing the old boxed PNG tile.
 *
 * Geometry:
 *   viewBox 0 0 200 115 · center (100, 100) · radius 80
 *   Arc: M 20 100 A 80 80 0 0 1 180 100  (left → top → right, 180° sweep)
 *   Circumference (semicircle): π × 80 ≈ 251.33
 *
 * Animation:
 *   stroke-dashoffset transitions from full (hidden) to target via CSS transition.
 *   Needle rotates via CSS transform (same 1.2s easing).
 *   Number counter increments via setInterval, completing in ~1.2s.
 *
 * Status → needle position:
 *   0%  → rotate(-90°) needle points left
 *   50% → rotate(0°)   needle points up
 *   100%→ rotate(90°)  needle points right
 */
function StatusGauge({ status }: { status: string }) {
  const config = GAUGE_CONFIG[status] ?? GAUGE_CONFIG.OPTIMAL;
  const { pct: targetPct, color, label, glowRgb } = config;

  // Animate from 0 → targetPct on mount and whenever status changes
  const [displayPct, setDisplayPct] = useState(0);

  useEffect(() => {
    setDisplayPct(0);
    let interval: ReturnType<typeof setInterval> | undefined;

    const timeout = setTimeout(() => {
      let current = 0;
      const step = Math.max(1, Math.ceil(targetPct / 40));
      interval = setInterval(() => {
        current += step;
        if (current >= targetPct) {
          setDisplayPct(targetPct);
          clearInterval(interval);
        } else {
          setDisplayPct(current);
        }
      }, 30); // ~40 steps × 30ms = ~1.2s total
    }, 120); // brief delay lets the component render first

    return () => {
      clearTimeout(timeout);
      if (interval !== undefined) clearInterval(interval);
    };
  }, [targetPct]);

  const radius = 80;
  const circumference = Math.PI * radius; // 251.327

  // stroke-dashoffset: full circumference = 0% visible; 0 = 100% visible
  const dashOffset = circumference - (displayPct / 100) * circumference;

  // Needle: drawn pointing up (x1=100,y1=100 → x2=100,y2=32).
  // Rotated: -90° = left (0%), 0° = top (50%), +90° = right (100%)
  const needleAngle = (displayPct / 100) * 180 - 90;

  return (
    <div className="flex flex-col items-center py-2 gap-2 animate-fade-up stagger-1">
      {/* Gauge + dynamic glow halo */}
      <div className="relative w-[220px]">
        {/* Status-colored radial glow under the gauge */}
        <div
          aria-hidden="true"
          className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-40 h-28 rounded-full blur-3xl transition-all duration-1000"
          style={{ backgroundColor: `rgba(${glowRgb}, 0.18)` }}
        />

        <svg
          viewBox="0 0 200 115"
          className="w-full"
          role="img"
          aria-label={`Vehicle health gauge: ${targetPct}% — ${label}`}
        >
          <defs>
            {/* Glow filter for the filled arc */}
            <filter id="arc-glow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur in="SourceGraphic" stdDeviation="3" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
            {/* Glow filter for the needle */}
            <filter id="needle-glow" x="-60%" y="-60%" width="220%" height="220%">
              <feGaussianBlur in="SourceGraphic" stdDeviation="2" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {/* Track arc — always full, dark */}
          <path
            d="M 20 100 A 80 80 0 0 1 180 100"
            fill="none"
            stroke="#1E3347"
            strokeWidth="10"
            strokeLinecap="round"
          />

          {/* Fill arc — animates via stroke-dashoffset */}
          <path
            d="M 20 100 A 80 80 0 0 1 180 100"
            fill="none"
            stroke={color}
            strokeWidth="10"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={dashOffset}
            filter="url(#arc-glow)"
            style={{
              transition:
                'stroke-dashoffset 1.2s cubic-bezier(0.4, 0, 0.2, 1), stroke 0.8s ease',
            }}
          />

          {/* Needle */}
          <line
            x1="100"
            y1="100"
            x2="100"
            y2="32"
            stroke={color}
            strokeWidth="3"
            strokeLinecap="round"
            filter="url(#needle-glow)"
            style={{
              transformOrigin: '100px 100px',
              transform: `rotate(${needleAngle}deg)`,
              transition: 'transform 1.2s cubic-bezier(0.4, 0, 0.2, 1)',
            }}
          />

          {/* Center hub */}
          <circle cx="100" cy="100" r="9" fill="#0E1B28" stroke={color} strokeWidth="2" />
          <circle cx="100" cy="100" r="4" fill={color} />

          {/* Percentage label — centered inside the arc */}
          <text
            x="100"
            y="80"
            textAnchor="middle"
            fill="white"
            fontSize="20"
            fontWeight="700"
            fontFamily="system-ui, -apple-system, sans-serif"
          >
            {displayPct}
            <tspan fontSize="11" fontWeight="400" fill="#8FA3B0">%</tspan>
          </text>
        </svg>
      </div>

      {/* Status readout below gauge */}
      <div className="text-center">
        <p className="text-text-muted text-[10px] uppercase tracking-[0.22em]">Vehicle Health</p>
        <p
          className="text-base font-bold tracking-widest mt-0.5 transition-colors duration-700"
          style={{ color }}
        >
          {label}
        </p>
      </div>
    </div>
  );
}

// ─── Weather tile ──────────────────────────────────────────────────────────────

const RISK_LABELS: Record<
  keyof WeatherSnapshot['riskFlags'],
  { label: string; color: string; bg: string }
> = {
  coldRisk: { label: 'Ice/Cold',  color: 'text-blue-400',   bg: 'bg-blue-400/15'   },
  heatRisk: { label: 'Heat',      color: 'text-orange-400', bg: 'bg-orange-400/15' },
  rainRisk: { label: 'Rain',      color: 'text-blue-300',   bg: 'bg-blue-300/15'   },
  snowRisk: { label: 'Snow',      color: 'text-indigo-300', bg: 'bg-indigo-300/15' },
};

function WeatherTile({
  weather,
  loading,
}: {
  weather: WeatherSnapshot | null;
  loading: boolean;
}) {
  if (loading) {
    return (
      <div className="bg-surface-raised border border-surface-border rounded-2xl p-4 flex-1 space-y-2">
        <div className="h-3 w-20 rounded shimmer" />
        <div className="h-6 w-24 rounded shimmer" />
        <div className="h-3 w-32 rounded shimmer" />
      </div>
    );
  }

  if (!weather) {
    return (
      <div className="bg-surface-raised border border-surface-border rounded-2xl p-4 flex-1 flex items-center gap-2">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-text-muted shrink-0">
          <path d="M17.5 19H9a7 7 0 116.71-9h1.79a4.5 4.5 0 110 9z" />
        </svg>
        <p className="text-xs text-text-muted">Weather unavailable — enable location to check conditions.</p>
      </div>
    );
  }

  const activeRisks = (Object.entries(weather.riskFlags) as [keyof WeatherSnapshot['riskFlags'], boolean][])
    .filter(([, v]) => v);

  return (
    <div className="bg-surface-raised border border-surface-border rounded-2xl p-4 flex-1 space-y-2">
      <p className="text-[10px] font-semibold text-text-muted uppercase tracking-wider">Current Weather</p>
      <div className="flex items-baseline gap-1.5">
        <span className="text-2xl font-bold text-text-primary">{Math.round(weather.temp)}°</span>
        <span className="text-xs text-text-muted">F</span>
      </div>
      <p className="text-xs text-text-secondary truncate">{weather.condition}</p>

      {activeRisks.length > 0 ? (
        <div className="flex flex-wrap gap-1 pt-0.5">
          {activeRisks.map(([key]) => {
            const r = RISK_LABELS[key];
            return (
              <span key={key} className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${r.bg} ${r.color}`}>
                {r.label}
              </span>
            );
          })}
        </div>
      ) : (
        <p className="text-[10px] text-status-optimal font-medium">Clear conditions</p>
      )}
    </div>
  );
}

// ─── Recalls tile ──────────────────────────────────────────────────────────────

function RecallsTile({
  vehicles,
  checking,
}: {
  vehicles: Vehicle[];
  checking: boolean;
}) {
  const totalRecalls  = vehicles.reduce((sum, v) => sum + (v.nhtsaRecalls?.length ?? 0), 0);
  const vehicleLabel  = vehicles.length === 1 ? vehicles[0].make : 'fleet';

  return (
    <div className="bg-surface-raised border border-surface-border rounded-2xl p-4 flex-1 space-y-2">
      <p className="text-[10px] font-semibold text-text-muted uppercase tracking-wider">Safety Recalls</p>

      {checking ? (
        <>
          <div className="h-6 w-16 rounded shimmer" />
          <p className="text-xs text-text-muted">Checking recalls…</p>
        </>
      ) : totalRecalls > 0 ? (
        <>
          <p className="text-2xl font-bold text-status-fault">{totalRecalls}</p>
          <p className="text-xs text-status-fault font-medium">
            Open recall{totalRecalls > 1 ? 's' : ''} — action required
          </p>
          <Link href="/vehicles" className="text-[11px] text-brand font-medium">
            View vehicles →
          </Link>
        </>
      ) : (
        <>
          <p className="text-2xl font-bold text-status-optimal">0</p>
          <p className="text-xs text-status-optimal font-medium">No open recalls for your {vehicleLabel}</p>
        </>
      )}
    </div>
  );
}

// ─── Page ──────────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const { user, loading: authLoading } = useAuth();
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [vehiclesLoading, setVehiclesLoading] = useState(true);

  // Weather state
  const [weatherData,    setWeatherData]    = useState<WeatherSnapshot | null>(null);
  const [weatherLoading, setWeatherLoading] = useState(false);

  // NHTSA recall check state (for primary vehicle)
  const [nhtsaChecking, setNhtsaChecking] = useState(false);

  // Upcoming bookings across all vehicles
  const [upcomingBookings, setUpcomingBookings] = useState<Booking[]>([]);

  useEffect(() => {
    if (!user?.uid) return;
    getVehiclesByOwner(user.uid)
      .then(setVehicles)
      .catch(console.error)
      .finally(() => setVehiclesLoading(false));
  }, [user?.uid]);

  // Fetch upcoming bookings after user loads
  useEffect(() => {
    if (!user?.uid) return;
    getUpcomingBookingsForCustomer(user.uid)
      .then(setUpcomingBookings)
      .catch(console.error);
  }, [user?.uid]);

  // After vehicles load: fetch weather + check NHTSA for primary vehicle
  useEffect(() => {
    if (vehiclesLoading || !vehicles.length || !user) return;

    const primary = vehicles[0];

    // Show cached weather immediately if available
    if (primary.lastWeather) setWeatherData(primary.lastWeather);

    // Refresh (or initial fetch) weather via browser geolocation
    if (typeof window !== 'undefined' && 'geolocation' in navigator) {
      if (!primary.lastWeather) setWeatherLoading(true);

      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          try {
            const { getAuth } = await import('firebase/auth');
            const idToken = await getAuth().currentUser?.getIdToken();
            if (!idToken) return;

            const res = await fetch(
              `/api/weather?lat=${pos.coords.latitude}&lon=${pos.coords.longitude}&vehicleId=${primary.vehicleId}`,
              { headers: { Authorization: `Bearer ${idToken}` } }
            );
            if (res.ok) {
              const fresh = await res.json();
              setWeatherData(fresh);
            }
          } catch {
            // silent — cached data (if any) already shown
          } finally {
            setWeatherLoading(false);
          }
        },
        () => setWeatherLoading(false), // location permission denied
        { timeout: 8000, maximumAge: 600000 }
      );
    }

    // Trigger NHTSA recall fetch if primary vehicle has never been checked
    if (!primary.nhtsaLastFetchedAt && primary.vin) {
      setNhtsaChecking(true);

      (async () => {
        try {
          const { getAuth } = await import('firebase/auth');
          const idToken = await getAuth().currentUser?.getIdToken();
          if (!idToken) return;

          const res = await fetch(
            `/api/nhtsa/recalls?vin=${encodeURIComponent(primary.vin)}&vehicleId=${primary.vehicleId}`,
            { headers: { Authorization: `Bearer ${idToken}` } }
          );
          if (res.ok) {
            const data = await res.json();
            setVehicles((prev) =>
              prev.map((v) =>
                v.vehicleId === primary.vehicleId
                  ? { ...v, nhtsaRecalls: data.recalls ?? [], nhtsaLastFetchedAt: new Date() }
                  : v
              )
            );
          }
        } catch {
          // silent
        } finally {
          setNhtsaChecking(false);
        }
      })();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vehiclesLoading]);

  if (authLoading) {
    return <DashboardSkeleton />;
  }

  const firstName = user?.name?.split(' ')[0] ?? 'there';
  const status = vehiclesLoading ? 'OPTIMAL' : fleetStatus(vehicles);
  const faultCount       = vehicles.filter((v) => v.status === 'FAULT').length;
  const serviceDueCount  = vehicles.filter((v) => v.status === 'SERVICE_DUE').length;
  const recallCount      = vehicles.filter((v) => (v.nhtsaRecalls?.length ?? 0) > 0).length;
  const weatherRiskCount = vehicles.filter((v) => v.lastWeather?.riskFlags.coldRisk || v.lastWeather?.riskFlags.heatRisk).length;

  return (
    <div className="p-4 space-y-6">
      {/* Greeting */}
      <div className="pt-2 animate-fade-up">
        <p className="text-text-secondary text-sm">{getGreeting()}</p>
        <h1 className="text-2xl font-bold text-text-primary mt-0.5">{firstName}</h1>
      </div>

      {/* SVG arc gauge — replaces old boxed PNG tile */}
      {!vehiclesLoading && <StatusGauge status={status} />}

      {/* Fleet health alert — only when issues exist */}
      {(faultCount > 0 || serviceDueCount > 0 || recallCount > 0 || weatherRiskCount > 0) && (
        <div className="bg-status-fault/10 border border-status-fault/30 rounded-2xl p-4 space-y-1 animate-fade-up stagger-2">
          <p className="text-status-fault font-semibold text-sm">Attention needed</p>
          {faultCount > 0 && (
            <p className="text-text-secondary text-sm">
              {faultCount} vehicle{faultCount > 1 ? 's have' : ' has'} a fault
            </p>
          )}
          {serviceDueCount > 0 && (
            <p className="text-text-secondary text-sm">
              {serviceDueCount} vehicle{serviceDueCount > 1 ? 's are' : ' is'} due for service
            </p>
          )}
          {recallCount > 0 && (
            <p className="text-text-secondary text-sm">
              {recallCount} vehicle{recallCount > 1 ? 's have' : ' has'} open safety recalls
            </p>
          )}
          {weatherRiskCount > 0 && (
            <p className="text-text-secondary text-sm">
              Weather risk detected — check tire pressure and battery
            </p>
          )}
        </div>
      )}

      {/* Weather + Recalls insight tiles */}
      {!vehiclesLoading && vehicles.length > 0 && (
        <section className="flex gap-3 animate-fade-up stagger-3">
          <WeatherTile weather={weatherData} loading={weatherLoading} />
          <RecallsTile vehicles={vehicles} checking={nhtsaChecking} />
        </section>
      )}

      {/* Active bookings tile — shown only when there are upcoming bookings */}
      {upcomingBookings.length > 0 && (
        <section className="animate-fade-up stagger-3">
          <Link
            href="/bookings"
            className="flex items-center gap-3 bg-brand/10 border border-brand/30 rounded-2xl px-4 py-3 hover:border-brand/60 transition-colors"
          >
            {/* Calendar icon */}
            <svg className="text-brand shrink-0" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
              <line x1="16" y1="2" x2="16" y2="6" />
              <line x1="8" y1="2" x2="8" y2="6" />
              <line x1="3" y1="10" x2="21" y2="10" />
            </svg>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-brand">
                {upcomingBookings.length === 1
                  ? '1 upcoming service'
                  : `${upcomingBookings.length} upcoming services`}
              </p>
              <p className="text-xs text-text-muted truncate">
                {upcomingBookings[0].serviceSnapshot.name} ·{' '}
                {upcomingBookings[0].scheduledAt.toLocaleDateString('en-US', {
                  month: 'short', day: 'numeric',
                })}
              </p>
            </div>
            <svg className="text-brand shrink-0" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 18l6-6-6-6" />
            </svg>
          </Link>
        </section>
      )}

      {/* Vehicles section */}
      <section className="space-y-3 animate-fade-up stagger-4">
        <div className="flex items-center justify-between">
          <h2 className="text-text-primary font-semibold">Your Vehicles</h2>
          <Link href="/vehicles" className="text-brand text-sm font-medium">
            See all
          </Link>
        </div>

        {vehiclesLoading ? (
          <div className="space-y-3">
            {[1, 2].map((i) => (
              <div key={i} className="h-20 rounded-2xl shimmer" />
            ))}
          </div>
        ) : vehicles.length === 0 ? (
          <div className="bg-surface-raised rounded-2xl p-5 text-center space-y-3">
            <p className="text-text-secondary text-sm">No vehicles added yet</p>
            <Link
              href="/vehicles/add"
              className="inline-block bg-brand text-surface-base font-semibold text-sm px-5 py-2.5 rounded-xl"
            >
              Add Your First Vehicle
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {vehicles.slice(0, 3).map((v) => (
              <VehicleCard key={v.vehicleId} vehicle={v} />
            ))}
            {vehicles.length > 3 && (
              <Link href="/vehicles" className="block text-center text-brand text-sm font-medium py-2">
                View all {vehicles.length} vehicles
              </Link>
            )}
          </div>
        )}
      </section>

      {/* Quick actions */}
      <section className="space-y-3 animate-fade-up stagger-5">
        <h2 className="text-text-primary font-semibold">Quick Actions</h2>
        <div className="grid grid-cols-2 gap-3">
          <Link
            href="/services"
            className="bg-brand hover:bg-brand-dark active:scale-[0.97] transition-all rounded-2xl p-4 flex flex-col gap-2"
          >
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="text-surface-base"
            >
              <path d="M12 5v14M5 12h14" />
            </svg>
            <span className="font-semibold text-surface-base text-sm">Book Service</span>
          </Link>

          <Link
            href="/vehicles/add"
            className="bg-surface-raised border border-surface-border hover:border-brand/30 active:scale-[0.97] transition-all rounded-2xl p-4 flex flex-col gap-2"
          >
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="text-brand"
            >
              <path d="M12 5v14M5 12h14" />
            </svg>
            <span className="font-semibold text-text-primary text-sm">Add Vehicle</span>
          </Link>

          {/* AI Assistant — spans full width so it stands out */}
          <Link
            href="/assistant"
            className="col-span-2 bg-surface-raised border border-brand/20 hover:border-brand/50 hover:shadow-glow-sm active:scale-[0.97] transition-all rounded-2xl p-4 flex items-center gap-3"
          >
            <div className="h-9 w-9 rounded-full bg-brand/15 flex items-center justify-center shrink-0">
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="text-brand"
              >
                <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" />
              </svg>
            </div>
            <div>
              <p className="font-semibold text-text-primary text-sm">Ask the Assistant</p>
              <p className="text-xs text-text-muted">AI-powered vehicle advice</p>
            </div>
            <svg
              className="ml-auto text-text-muted shrink-0"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M9 18l6-6-6-6" />
            </svg>
          </Link>
        </div>
      </section>
    </div>
  );
}

function VehicleCard({ vehicle }: { vehicle: Vehicle }) {
  const style = VEHICLE_STATUS_STYLES[vehicle.status];
  return (
    <Link
      href={`/vehicles/${vehicle.vehicleId}`}
      className="block bg-surface-raised rounded-2xl p-4 border border-surface-border hover:border-brand/30 hover:shadow-glow-sm transition-all duration-200"
    >
      <div className="flex items-center justify-between">
        <div className="min-w-0">
          <p className="text-text-primary font-semibold truncate">
            {vehicle.year} {vehicle.make} {vehicle.model}
          </p>
          <p className="text-text-muted text-sm mt-0.5">
            {vehicle.nickname ? `${vehicle.nickname} · ` : ''}
            {vehicle.mileage.toLocaleString()} mi
          </p>
        </div>
        <span
          className={`text-xs font-bold px-2.5 py-1 rounded-full flex-shrink-0 ml-3 ${style.bg} ${style.text}`}
        >
          {style.label}
        </span>
      </div>
    </Link>
  );
}

function DashboardSkeleton() {
  return (
    <div className="p-4 space-y-6">
      <div className="pt-2 space-y-2">
        <div className="h-4 w-24 rounded shimmer" />
        <div className="h-8 w-32 rounded shimmer" />
      </div>
      {/* Gauge skeleton — matches SVG gauge dimensions */}
      <div className="flex flex-col items-center gap-3 py-2">
        <div className="w-[220px] h-[115px] rounded-2xl shimmer" />
        <div className="h-4 w-28 rounded shimmer" />
      </div>
      <div className="space-y-3">
        <div className="h-5 w-32 rounded shimmer" />
        {[1, 2].map((i) => (
          <div key={i} className="h-20 rounded-2xl shimmer" />
        ))}
      </div>
    </div>
  );
}
