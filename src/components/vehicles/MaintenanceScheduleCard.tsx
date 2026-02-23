/**
 * MaintenanceScheduleCard — one card in the vehicle maintenance schedule list.
 *
 * Displays:
 *  - Service type label + custom label (if type = 'custom')
 *  - Next due: mileage and/or date, whichever is set
 *  - Urgency badge (routine / soon / overdue) derived from VehicleHealthSnapshot
 *    OR computed locally from nextDueMileage + currentMileage
 *  - Interval definition (e.g. "Every 5,000 mi or 6 months")
 *  - Reminder lead settings
 *  - Deactivate (soft-delete) action
 *
 * TODO Wave 2: implement
 *  - Connect urgency from VehicleHealthSnapshot.upcomingServices
 *  - Deactivate handler → maintenanceService.deactivateSchedule(scheduleId)
 *  - onDeactivate callback to re-fetch parent list
 */

import type { MaintenanceSchedule, MaintenanceServiceType } from '@/types';

const SERVICE_TYPE_LABELS: Record<MaintenanceServiceType, string> = {
  oil_change:            'Oil Change',
  tire_rotation:         'Tire Rotation',
  brake_inspection:      'Brake Inspection',
  air_filter:            'Air Filter',
  cabin_filter:          'Cabin Air Filter',
  coolant_flush:         'Coolant Flush',
  transmission_service:  'Transmission Service',
  spark_plugs:           'Spark Plugs',
  wiper_blades:          'Wiper Blades',
  custom:                'Custom',
};

interface MaintenanceScheduleCardProps {
  schedule: MaintenanceSchedule;
  currentMileage: number;
  onDeactivate?: (scheduleId: string) => void;
}

export function MaintenanceScheduleCard({
  schedule,
  currentMileage,
  onDeactivate,
}: MaintenanceScheduleCardProps) {
  const label =
    schedule.serviceType === 'custom' && schedule.customLabel
      ? schedule.customLabel
      : SERVICE_TYPE_LABELS[schedule.serviceType];

  // Local urgency fallback (authoritative value comes from VehicleHealthSnapshot)
  const milesUntilDue =
    schedule.nextDueMileage !== null ? schedule.nextDueMileage - currentMileage : null;
  const daysUntilDue =
    schedule.nextDueDate !== null
      ? Math.floor((new Date(schedule.nextDueDate).getTime() - Date.now()) / (24 * 60 * 60 * 1000))
      : null;

  let urgency: 'routine' | 'soon' | 'overdue' = 'routine';
  if (
    (milesUntilDue !== null && milesUntilDue < 0) ||
    (daysUntilDue !== null && daysUntilDue < 0)
  ) {
    urgency = 'overdue';
  } else if (
    (milesUntilDue !== null && milesUntilDue < schedule.reminderLeadMiles) ||
    (daysUntilDue !== null && daysUntilDue < schedule.reminderLeadDays)
  ) {
    urgency = 'soon';
  }

  const urgencyStyles = {
    routine: 'text-text-muted bg-surface-high',
    soon:    'text-status-serviceDue bg-status-serviceDue/10',
    overdue: 'text-status-fault bg-status-fault/10',
  };

  const urgencyLabel = {
    routine: 'On Track',
    soon:    'Due Soon',
    overdue: 'Overdue',
  };

  return (
    <div className="bg-surface-mid rounded-xl p-4 space-y-3">
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-semibold text-text-primary">{label}</p>
        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${urgencyStyles[urgency]}`}>
          {urgencyLabel[urgency]}
        </span>
      </div>

      {/* Next due */}
      <div className="flex gap-4 text-xs text-text-muted">
        {schedule.nextDueMileage !== null && (
          <span>{schedule.nextDueMileage.toLocaleString()} mi</span>
        )}
        {schedule.nextDueDate !== null && (
          <span>{new Date(schedule.nextDueDate).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}</span>
        )}
        {schedule.nextDueMileage === null && schedule.nextDueDate === null && (
          <span className="italic">No service recorded yet</span>
        )}
      </div>

      {/* Interval definition */}
      <p className="text-xs text-text-muted">
        Every{' '}
        {schedule.intervalMiles !== null && `${schedule.intervalMiles.toLocaleString()} mi`}
        {schedule.intervalMiles !== null && schedule.intervalDays !== null && ' or '}
        {schedule.intervalDays !== null && `${Math.round(schedule.intervalDays / 30)} months`}
      </p>

      {/* Deactivate */}
      {onDeactivate && (
        <button
          onClick={() => onDeactivate(schedule.scheduleId)}
          className="text-xs text-text-muted hover:text-status-fault transition-colors"
        >
          Deactivate schedule
        </button>
      )}
    </div>
  );
}
