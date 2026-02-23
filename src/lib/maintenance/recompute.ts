/**
 * recomputeVehicleHealth — server-side only utility.
 *
 * Reads all active maintenanceSchedules for a vehicle, recomputes each
 * schedule's nextDueMileage and nextDueDate from its interval definition and
 * anchor points (lastServiceMileage / lastServiceDate), then writes an updated
 * VehicleHealthSnapshot to vehicleHealth/{vehicleId}.
 *
 * Called by:
 *  - POST /api/maintenance/recompute  (user-triggered mileage update or manual refresh)
 *  - POST /api/stripe/capture-payment (auto-triggered after every job completion)
 *
 * IMPORTANT: This file uses the Firebase Admin SDK and must NEVER be imported
 * in components, hooks, or client-side service files.
 */

import { FieldValue } from 'firebase-admin/firestore';
import { adminDb } from '@/lib/firebase/firebaseAdmin';
import type { HealthAlertLevel, ServiceUrgency } from '@/types';

export interface RecomputeResult {
  schedulesUpdated: number;
  alertLevel: HealthAlertLevel;
}

/**
 * Recomputes all maintenance schedules and the health snapshot for a vehicle.
 * Uses a Firestore batch to write all schedule updates and the snapshot atomically.
 *
 * @param vehicleId - The Firestore document ID of the vehicle.
 * @returns The number of schedules updated and the derived alertLevel.
 * @throws If the vehicle document does not exist.
 */
export async function recomputeVehicleHealth(vehicleId: string): Promise<RecomputeResult> {
  // 1. Fetch vehicle for current mileage and ownerId
  const vehicleSnap = await adminDb.collection('vehicles').doc(vehicleId).get();
  if (!vehicleSnap.exists) {
    throw new Error(`recomputeVehicleHealth: vehicle not found — ${vehicleId}`);
  }
  const vehicle = vehicleSnap.data()!;
  const currentMileage: number = typeof vehicle.mileage === 'number' ? vehicle.mileage : 0;
  const ownerId: string = vehicle.ownerId;
  const now = new Date();

  // 2. Fetch all active schedules for this vehicle
  const schedulesSnap = await adminDb
    .collection('maintenanceSchedules')
    .where('vehicleId', '==', vehicleId)
    .where('isActive', '==', true)
    .get();

  const batch = adminDb.batch();

  // upcomingServices is serialized plain-object array for Firestore
  const upcomingServices: object[] = [];
  let alertLevel: HealthAlertLevel = 'none';

  for (const schedDoc of schedulesSnap.docs) {
    const sched = schedDoc.data();

    // ── Compute nextDueMileage ─────────────────────────────────────────────
    let nextDueMileage: number | null = null;
    if (sched.intervalMiles != null && sched.lastServiceMileage != null) {
      nextDueMileage = sched.lastServiceMileage + sched.intervalMiles;
    }

    // ── Compute nextDueDate ────────────────────────────────────────────────
    let nextDueDate: Date | null = null;
    if (sched.intervalDays != null && sched.lastServiceDate != null) {
      // Firestore Timestamps need .toDate() — raw Date objects are already Date
      const lastDate: Date =
        typeof sched.lastServiceDate.toDate === 'function'
          ? sched.lastServiceDate.toDate()
          : new Date(sched.lastServiceDate);
      nextDueDate = new Date(lastDate.getTime() + sched.intervalDays * 24 * 60 * 60 * 1000);
    }

    // Queue schedule update in batch
    batch.update(schedDoc.ref, {
      nextDueMileage,
      nextDueDate,
    });

    // ── Compute urgency for this schedule ──────────────────────────────────
    const daysUntilDue: number | null =
      nextDueDate !== null
        ? Math.floor((nextDueDate.getTime() - now.getTime()) / (24 * 60 * 60 * 1000))
        : null;
    const milesUntilDue: number | null =
      nextDueMileage !== null ? nextDueMileage - currentMileage : null;

    const leadDays: number = typeof sched.reminderLeadDays === 'number' ? sched.reminderLeadDays : 7;
    const leadMiles: number = typeof sched.reminderLeadMiles === 'number' ? sched.reminderLeadMiles : 500;

    let urgency: ServiceUrgency = 'routine';

    if (
      (daysUntilDue !== null && daysUntilDue < 0) ||
      (milesUntilDue !== null && milesUntilDue < 0)
    ) {
      urgency = 'overdue';
      alertLevel = 'overdue';
    } else if (
      (daysUntilDue !== null && daysUntilDue < leadDays) ||
      (milesUntilDue !== null && milesUntilDue < leadMiles)
    ) {
      urgency = 'soon';
      if (alertLevel !== 'overdue') alertLevel = 'soon';
    }

    upcomingServices.push({
      scheduleId: schedDoc.id,
      serviceType: sched.serviceType,
      customLabel: sched.customLabel ?? null,
      nextDueDate: nextDueDate ?? null,
      nextDueMileage: nextDueMileage ?? null,
      daysUntilDue,
      milesUntilDue,
      estimatedCostCents: null,
      urgency,
    });
  }

  // 3. Write vehicleHealth snapshot — set (overwrite) with server timestamp
  const healthRef = adminDb.collection('vehicleHealth').doc(vehicleId);
  batch.set(healthRef, {
    vehicleId,
    ownerId,
    alertLevel,
    upcomingServices,
    costForecastCentsMonthly: null,
    estimatedResaleValueBoostCents: null,
    updatedAt: FieldValue.serverTimestamp(),
  });

  await batch.commit();

  return { schedulesUpdated: schedulesSnap.size, alertLevel };
}
