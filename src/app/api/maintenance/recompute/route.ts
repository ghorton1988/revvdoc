/**
 * POST /api/maintenance/recompute
 *
 * Recomputes all maintenance schedule next-due dates/mileages and the
 * VehicleHealthSnapshot for a given vehicle. Call this when:
 *  - The customer updates their vehicle's current mileage
 *  - A service is completed (capture-payment calls recomputeVehicleHealth() directly)
 *  - An admin or automated sweep refreshes health data
 *
 * Body: { vehicleId: string }
 * Returns: { success: true, schedulesUpdated: number, alertLevel: HealthAlertLevel }
 *
 * Auth: Firebase ID token required in Authorization header.
 * The token holder must be the vehicle's owner or an admin.
 */

import { z } from 'zod';
import { adminAuth, adminDb } from '@/lib/firebase/firebaseAdmin';
import { recomputeVehicleHealth } from '@/lib/maintenance/recompute';

export const runtime = 'nodejs';

const schema = z.object({
  vehicleId: z.string().min(1),
});

export async function POST(request: Request) {
  // 1. Verify Firebase ID token
  const authorization = request.headers.get('Authorization') ?? '';
  const idToken = authorization.replace('Bearer ', '');
  if (!idToken) {
    return Response.json({ error: 'Missing Authorization header' }, { status: 401 });
  }

  let decodedToken;
  try {
    decodedToken = await adminAuth.verifyIdToken(idToken);
  } catch {
    return Response.json({ error: 'Invalid token' }, { status: 401 });
  }

  // 2. Validate body
  let body;
  try {
    body = schema.parse(await request.json());
  } catch (err) {
    return Response.json({ error: 'Invalid request body', details: err }, { status: 400 });
  }

  const { vehicleId } = body;

  // 3. Verify caller owns the vehicle (or is admin)
  const vehicleSnap = await adminDb.collection('vehicles').doc(vehicleId).get();
  if (!vehicleSnap.exists) {
    return Response.json({ error: 'Vehicle not found' }, { status: 404 });
  }

  const vehicleData = vehicleSnap.data()!;
  const callerIsOwner = vehicleData.ownerId === decodedToken.uid;

  // Fetch caller's role to check admin
  let callerIsAdmin = false;
  try {
    const userSnap = await adminDb.collection('users').doc(decodedToken.uid).get();
    callerIsAdmin = userSnap.exists && userSnap.data()?.role === 'admin';
  } catch {
    // Non-critical: fall through to ownership check
  }

  if (!callerIsOwner && !callerIsAdmin) {
    return Response.json({ error: 'Forbidden — not your vehicle' }, { status: 403 });
  }

  // 4. Recompute schedules + health snapshot
  try {
    const result = await recomputeVehicleHealth(vehicleId);
    return Response.json({ success: true, ...result });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Recompute failed';
    console.error('[maintenance/recompute] error:', err);
    return Response.json({ error: message }, { status: 500 });
  }
}
