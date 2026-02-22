// TODO Phase 3: Admin booking detail — assign technician
// - Booking details display
// - Technician dropdown (all active technicians with matching service category)
// - Assign → POST /api/admin/assign-technician → updates booking, creates Job doc

export default function AdminBookingDetailPage({
  params,
}: {
  params: { bookingId: string };
}) {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-text-primary">Booking Detail</h1>
      <p className="text-text-muted text-sm">ID: {params.bookingId}</p>
      <p className="text-text-muted text-sm">Phase 3 — not yet implemented</p>
    </div>
  );
}
