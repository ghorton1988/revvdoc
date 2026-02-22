/* eslint-disable @typescript-eslint/no-unused-vars */
/**
 * Service History Service — Firestore data access for serviceHistory collection.
 * Read-only from the client (records are created server-side on job completion).
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

export async function getHistoryByCustomer(
  customerId: string
): Promise<ServiceHistoryRecord[]> {
  // TODO Phase 3: query where customerId == uid, orderBy date desc
  throw new Error('Not implemented');
}

export async function getHistoryByVehicle(
  vehicleId: string
): Promise<ServiceHistoryRecord[]> {
  // TODO Phase 3: query where vehicleId == id, orderBy date desc
  throw new Error('Not implemented');
}
