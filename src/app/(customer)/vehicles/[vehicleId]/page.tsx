// TODO Phase 3: Vehicle detail page
// - Vehicle info: make/model/year/VIN/nickname
// - Status badge + last service date + mileage
// - Edit mileage / update status CTA
// - Service history list for this vehicle (getHistoryByVehicle)

export default function VehicleDetailPage({
  params,
}: {
  params: { vehicleId: string };
}) {
  return (
    <div className="p-4 space-y-4">
      <h1 className="text-2xl font-bold text-text-primary">Vehicle Detail</h1>
      <p className="text-text-muted text-sm">ID: {params.vehicleId}</p>
      <p className="text-text-muted text-sm">Phase 3 — not yet implemented</p>
    </div>
  );
}
