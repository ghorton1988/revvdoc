/**
 * Service History Service — Firestore data access for serviceHistory collection.
 * Read-only from the client (records are created server-side on job completion).
 *
 * Wave 1 additions on ServiceHistoryRecord (partsUsed, photoUrls, warrantyInfo)
 * default to [] / null on records created before Wave 1 — guard with ??.
 */

import {
  collection,
  getDocs,
  query,
  where,
  orderBy,
} from 'firebase/firestore';
import { db } from '@/lib/firebase/firebase';
import type { ServiceHistoryRecord } from '@/types';

const SERVICE_HISTORY = 'serviceHistory';

/**
 * Returns all service history records for a customer, newest first.
 * Used on the customer history timeline page (/history).
 * Uses composite index: customerId ASC, date DESC.
 */
export async function getHistoryByCustomer(
  customerId: string
): Promise<ServiceHistoryRecord[]> {
  const q = query(
    collection(db, SERVICE_HISTORY),
    where('customerId', '==', customerId),
    orderBy('date', 'desc')
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ recordId: d.id, ...d.data() }) as ServiceHistoryRecord);
}

/**
 * Returns all service history records for a specific vehicle, newest first.
 * Used on the vehicle detail page and timeline page.
 * Uses composite index: vehicleId ASC, date DESC.
 */
export async function getHistoryByVehicle(
  vehicleId: string
): Promise<ServiceHistoryRecord[]> {
  const q = query(
    collection(db, SERVICE_HISTORY),
    where('vehicleId', '==', vehicleId),
    orderBy('date', 'desc')
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ recordId: d.id, ...d.data() }) as ServiceHistoryRecord);
}
