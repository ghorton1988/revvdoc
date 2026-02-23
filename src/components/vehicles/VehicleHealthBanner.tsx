/**
 * VehicleHealthBanner — compact health status card for the vehicle detail page.
 *
 * Shows the fleet alertLevel (none / soon / overdue) and the top-2 upcoming
 * services sorted by urgency. Used on the vehicle detail page and optionally
 * on the dashboard for per-vehicle health summaries.
 *
 * Data source: VehicleHealthSnapshot from vehicleHealth/{vehicleId} via useVehicleHealth().
 */

import type { VehicleHealthSnapshot, HealthAlertLevel, UpcomingServiceForecast } from '@/types';

// ── Style maps ────────────────────────────────────────────────────────────────

const ALERT_STYLES: Record<
  HealthAlertLevel,
  { bg: string; border: string; label: string; dot: string }
> = {
  none: {
    bg: 'bg-status-optimal/5',
    border: 'border-status-optimal/25',
    dot: 'bg-status-optimal',
    label: 'All Systems Normal',
  },
  soon: {
    bg: 'bg-status-serviceDue/5',
    border: 'border-status-serviceDue/25',
    dot: 'bg-status-serviceDue',
    label: 'Service Due Soon',
  },
  overdue: {
    bg: 'bg-status-fault/5',
    border: 'border-status-fault/25',
    dot: 'bg-status-fault',
    label: 'Service Overdue',
  },
};

const LABEL_COLOR: Record<HealthAlertLevel, string> = {
  none:    'text-status-optimal',
  soon:    'text-status-serviceDue',
  overdue: 'text-status-fault',
};

const URGENCY_COLOR: Record<string, string> = {
  overdue: 'text-status-fault',
  soon:    'text-status-serviceDue',
  routine: 'text-text-muted',
};

const SERVICE_TYPE_LABELS: Record<string, string> = {
  oil_change:           'Oil Change',
  tire_rotation:        'Tire Rotation',
  brake_inspection:     'Brake Inspection',
  air_filter:           'Air Filter',
  cabin_filter:         'Cabin Air Filter',
  coolant_flush:        'Coolant Flush',
  transmission_service: 'Transmission Service',
  spark_plugs:          'Spark Plugs',
  wiper_blades:         'Wiper Blades',
  custom:               'Custom Service',
};

// ── Component ─────────────────────────────────────────────────────────────────

interface VehicleHealthBannerProps {
  snapshot: VehicleHealthSnapshot | null;
  loading?: boolean;
}

export function VehicleHealthBanner({
  snapshot,
  loading = false,
}: VehicleHealthBannerProps) {
  if (loading) {
    return <div className="h-16 bg-surface-raised rounded-xl animate-pulse" />;
  }

  if (!snapshot) {
    return (
      <div className="bg-surface-raised rounded-xl px-4 py-3">
        <p className="text-sm text-text-muted">
          No health data yet — complete a service to generate your first health report.
        </p>
      </div>
    );
  }

  const style = ALERT_STYLES[snapshot.alertLevel];
  const labelColor = LABEL_COLOR[snapshot.alertLevel];

  // Sort by soonest-due and show top 2
  const top2: UpcomingServiceForecast[] = snapshot.upcomingServices
    .slice()
    .sort((a, b) => {
      const aVal = a.daysUntilDue ?? (a.milesUntilDue ?? Infinity);
      const bVal = b.daysUntilDue ?? (b.milesUntilDue ?? Infinity);
      return aVal - bVal;
    })
    .slice(0, 2);

  return (
    <div className={`rounded-xl border px-4 py-3 space-y-2 ${style.bg} ${style.border}`}>
      {/* Header */}
      <div className="flex items-center gap-2">
        <span className={`w-2 h-2 rounded-full shrink-0 ${style.dot}`} />
        <span className={`text-xs font-bold uppercase tracking-widest ${labelColor}`}>
          {style.label}
        </span>
      </div>

      {/* Top upcoming services */}
      {top2.map((item) => (
        <ForecastRow key={item.scheduleId} item={item} />
      ))}

      {snapshot.upcomingServices.length === 0 && (
        <p className="text-xs text-text-muted">No active maintenance schedules.</p>
      )}
    </div>
  );
}

// ── ForecastRow (private sub-component) ──────────────────────────────────────

function ForecastRow({ item }: { item: UpcomingServiceForecast }) {
  const label =
    item.customLabel ?? SERVICE_TYPE_LABELS[item.serviceType] ?? item.serviceType;

  let dueStr = '';
  if (item.daysUntilDue !== null) {
    dueStr =
      item.daysUntilDue < 0
        ? `${Math.abs(item.daysUntilDue)}d overdue`
        : item.daysUntilDue === 0
        ? 'due today'
        : `in ${item.daysUntilDue}d`;
  } else if (item.milesUntilDue !== null) {
    dueStr =
      item.milesUntilDue < 0
        ? `${Math.abs(item.milesUntilDue).toLocaleString()} mi overdue`
        : `in ${item.milesUntilDue.toLocaleString()} mi`;
  }

  return (
    <div className="flex items-center justify-between gap-2">
      <p className="text-sm text-text-primary truncate">{label}</p>
      {dueStr && (
        <span className={`text-xs font-medium shrink-0 ${URGENCY_COLOR[item.urgency]}`}>
          {dueStr}
        </span>
      )}
    </div>
  );
}
