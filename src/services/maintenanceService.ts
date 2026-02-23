/**
 * Maintenance Service — Firestore data access for maintenanceSchedules collection.
 *
 * Handles CRUD for per-vehicle recurring maintenance schedules.
 * nextDueDate and nextDueMileage are computed fields — they are written by the
 * server-side /api/maintenance/recompute Route Handler, not by this service.
 *
 * TODO Phase 3 (Wave 2): implement all function bodies.
 */

import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '@/lib/firebase/firebase';
import type { MaintenanceSchedule, MaintenanceServiceType } from '@/types';

const SCHEDULES = 'maintenanceSchedules';

/**
 * Returns all active maintenance schedules for a vehicle, sorted by nextDueMileage.
 * Uses composite index: vehicleId ASC, isActive ASC, nextDueMileage ASC.
 */
export async function getSchedulesByVehicle(
  vehicleId: string
): Promise<MaintenanceSchedule[]> {
  // TODO Phase 3: implement
  const q = query(
    collection(db, SCHEDULES),
    where('vehicleId', '==', vehicleId),
    where('isActive', '==', true),
    orderBy('nextDueMileage', 'asc')
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ scheduleId: d.id, ...d.data() }) as MaintenanceSchedule);
}

/**
 * Returns all active schedules for an owner, sorted by nextDueDate.
 * Used by the sign-in reminder sweep to check if any reminders need sending.
 * Uses composite index: ownerId ASC, isActive ASC, nextDueDate ASC.
 */
export async function getDueSchedulesByOwner(
  ownerId: string
): Promise<MaintenanceSchedule[]> {
  // TODO Phase 3: implement
  const q = query(
    collection(db, SCHEDULES),
    where('ownerId', '==', ownerId),
    where('isActive', '==', true),
    orderBy('nextDueDate', 'asc')
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ scheduleId: d.id, ...d.data() }) as MaintenanceSchedule);
}

/**
 * Returns a single schedule by ID.
 */
export async function getScheduleById(
  scheduleId: string
): Promise<MaintenanceSchedule | null> {
  // TODO Phase 3: implement
  const snap = await getDoc(doc(db, SCHEDULES, scheduleId));
  if (!snap.exists()) return null;
  return { scheduleId: snap.id, ...snap.data() } as MaintenanceSchedule;
}

/**
 * Finds an existing schedule for a vehicle + service type combination.
 * Used to prevent duplicate schedules for the same service.
 * Uses composite index: vehicleId ASC, serviceType ASC.
 */
export async function findScheduleByType(
  vehicleId: string,
  serviceType: MaintenanceServiceType
): Promise<MaintenanceSchedule | null> {
  // TODO Phase 3: implement
  const q = query(
    collection(db, SCHEDULES),
    where('vehicleId', '==', vehicleId),
    where('serviceType', '==', serviceType)
  );
  const snap = await getDocs(q);
  if (snap.empty) return null;
  const d = snap.docs[0];
  return { scheduleId: d.id, ...d.data() } as MaintenanceSchedule;
}

/**
 * Creates a new maintenance schedule for a vehicle.
 * Returns the new document ID.
 * nextDueDate and nextDueMileage are computed server-side; pass null here.
 */
export async function addSchedule(
  data: Omit<MaintenanceSchedule, 'scheduleId' | 'createdAt' | 'nextDueDate' | 'nextDueMileage' | 'reminderSentAt'>
): Promise<string> {
  // TODO Phase 3: implement
  const ref = await addDoc(collection(db, SCHEDULES), {
    ...data,
    nextDueDate: null,
    nextDueMileage: null,
    reminderSentAt: null,
    createdAt: serverTimestamp(),
  });
  return ref.id;
}

/**
 * Updates mutable fields on an existing schedule.
 * Immutable fields (ownerId, vehicleId, createdAt) are not in the allowed set.
 */
export async function updateSchedule(
  scheduleId: string,
  partial: Partial<
    Pick<
      MaintenanceSchedule,
      | 'customLabel'
      | 'intervalMiles'
      | 'intervalDays'
      | 'reminderLeadDays'
      | 'reminderLeadMiles'
      | 'isActive'
    >
  >
): Promise<void> {
  // TODO Phase 3: implement
  await updateDoc(doc(db, SCHEDULES, scheduleId), partial);
}

/**
 * Soft-deletes a schedule by setting isActive = false.
 * Hard delete is available but should be avoided — keeps history intact.
 */
export async function deactivateSchedule(scheduleId: string): Promise<void> {
  // TODO Phase 3: implement
  await updateDoc(doc(db, SCHEDULES, scheduleId), { isActive: false });
}

/**
 * Hard-deletes a schedule document. Use deactivateSchedule() in most cases.
 */
export async function deleteSchedule(scheduleId: string): Promise<void> {
  // TODO Phase 3: implement
  await deleteDoc(doc(db, SCHEDULES, scheduleId));
}
