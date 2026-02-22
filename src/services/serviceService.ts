/**
 * Service (Catalog) Service — Firestore data access for services collection.
 * Public read — no auth required for catalog queries.
 */

import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
} from 'firebase/firestore';
import { db } from '@/lib/firebase/firebase';
import type { Service, ServiceCategory } from '@/types';

const SERVICES = 'services';

export async function getAllActiveServices(): Promise<Service[]> {
  const q = query(collection(db, SERVICES), where('isActive', '==', true));
  const snap = await getDocs(q);
  const services = snap.docs.map((d) => ({ serviceId: d.id, ...d.data() }) as Service);
  // Client-side sort (catalog is small): by category, then by price
  return services.sort(
    (a, b) => a.category.localeCompare(b.category) || a.basePrice - b.basePrice
  );
}

export async function getServicesByCategory(
  category: ServiceCategory
): Promise<Service[]> {
  const q = query(
    collection(db, SERVICES),
    where('category', '==', category),
    where('isActive', '==', true)
  );
  const snap = await getDocs(q);
  return snap.docs
    .map((d) => ({ serviceId: d.id, ...d.data() }) as Service)
    .sort((a, b) => a.basePrice - b.basePrice);
}

export async function getServiceById(serviceId: string): Promise<Service | null> {
  const snap = await getDoc(doc(db, SERVICES, serviceId));
  if (!snap.exists()) return null;
  return { serviceId: snap.id, ...snap.data() } as Service;
}
