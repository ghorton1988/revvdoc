'use client';

/**
 * /vehicles/[vehicleId]/maintenance/add
 *
 * Form to create a new recurring maintenance schedule for a vehicle.
 * Uses maintenanceService.addSchedule() on submit, then redirects back
 * to the maintenance list page (/maintenance).
 *
 * After a schedule is created, POST /api/maintenance/recompute is called
 * to compute nextDueDate / nextDueMileage immediately.
 *
 * TODO Wave 2: implement
 *  - Service type selector (MaintenanceServiceType enum)
 *  - Custom label input (visible when serviceType = 'custom')
 *  - Interval inputs: intervalMiles, intervalDays
 *  - Reminder lead inputs: reminderLeadDays, reminderLeadMiles
 *  - Duplicate-check via maintenanceService.findScheduleByType before submit
 *  - Call maintenanceService.addSchedule + POST /api/maintenance/recompute
 *  - Redirect to /vehicles/[vehicleId]/maintenance on success
 */

export default function AddMaintenanceSchedulePage({
  params,
}: {
  params: { vehicleId: string };
}) {
  return (
    <div className="flex-1 p-4">
      <h1 className="text-lg font-semibold text-text-primary mb-1">Add Maintenance Schedule</h1>
      <p className="text-sm text-text-muted mb-6">Vehicle ID: {params.vehicleId}</p>

      {/* TODO Wave 2: implement form */}
      <p className="text-sm text-text-muted">
        Wave 2 — not yet implemented
      </p>
    </div>
  );
}
