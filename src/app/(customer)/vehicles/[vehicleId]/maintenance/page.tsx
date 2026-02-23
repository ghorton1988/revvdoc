'use client';

/**
 * /vehicles/[vehicleId]/maintenance
 *
 * Lists all active maintenance schedules for a vehicle with their urgency
 * status, next-due date/mileage, and reminder settings.
 * Links to /maintenance/add to create a new schedule.
 *
 * TODO Wave 2: implement
 *  - Fetch vehicle doc + current mileage (vehicleService.getVehicleById)
 *  - Fetch active schedules (maintenanceService.getSchedulesByVehicle)
 *  - Render <MaintenanceScheduleCard> for each schedule
 *  - Link to /maintenance/add
 *  - Deactivate schedule action (maintenanceService.deactivateSchedule)
 */

export default function VehicleMaintenancePage({
  params,
}: {
  params: { vehicleId: string };
}) {
  return (
    <div className="flex-1 p-4">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-lg font-semibold text-text-primary">Maintenance Schedules</h1>
          <p className="text-sm text-text-muted">Vehicle ID: {params.vehicleId}</p>
        </div>
        {/* TODO Wave 2: link to /add */}
        <button className="text-sm text-brand font-medium opacity-50 cursor-not-allowed" disabled>
          + Add Schedule
        </button>
      </div>

      {/* TODO Wave 2: implement */}
      <p className="text-sm text-text-muted">
        Wave 2 — not yet implemented
      </p>
    </div>
  );
}
