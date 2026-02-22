/**
 * Vehicle Service — Firestore data access for vehicles collection.
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
import type { Vehicle, VehicleStatus } from '@/types';

const VEHICLES = 'vehicles';

export async function getVehiclesByOwner(ownerId: string): Promise<Vehicle[]> {
  const q = query(
    collection(db, VEHICLES),
    where('ownerId', '==', ownerId),
    orderBy('createdAt', 'desc')
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ vehicleId: d.id, ...d.data() }) as Vehicle);
}

export async function getVehicleById(vehicleId: string): Promise<Vehicle | null> {
  const snap = await getDoc(doc(db, VEHICLES, vehicleId));
  if (!snap.exists()) return null;
  return { vehicleId: snap.id, ...snap.data() } as Vehicle;
}

export async function addVehicle(
  data: Omit<Vehicle, 'vehicleId' | 'createdAt'>
): Promise<string> {
  const ref = await addDoc(collection(db, VEHICLES), {
    ...data,
    createdAt: serverTimestamp(),
  });
  return ref.id;
}

export async function updateVehicle(
  vehicleId: string,
  partial: Partial<Pick<Vehicle, 'nickname' | 'mileage' | 'status' | 'lastServiceDate' | 'photoUrl'>>
): Promise<void> {
  await updateDoc(doc(db, VEHICLES, vehicleId), partial);
}

export async function deleteVehicle(vehicleId: string): Promise<void> {
  await deleteDoc(doc(db, VEHICLES, vehicleId));
}

export async function setVehicleStatus(
  vehicleId: string,
  status: VehicleStatus
): Promise<void> {
  await updateDoc(doc(db, VEHICLES, vehicleId), { status });
}
