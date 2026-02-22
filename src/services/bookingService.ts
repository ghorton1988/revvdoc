/**
 * Booking Service — Firestore data access for bookings collection.
 * Client-side only. For server-side operations use the Admin SDK in Route Handlers.
 */

import {
  collection,
  doc,
  addDoc,
  updateDoc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  runTransaction,
  serverTimestamp,
  type Unsubscribe,
} from 'firebase/firestore';
import { db } from '@/lib/firebase/firebase';
import type { Booking, BookingStatus } from '@/types';

const BOOKINGS = 'bookings';

function mapBooking(id: string, data: Record<string, unknown>): Booking {
  return {
    bookingId: id,
    customerId: data.customerId as string,
    technicianId: (data.technicianId as string | null) ?? null,
    vehicleId: data.vehicleId as string,
    serviceId: data.serviceId as string,
    serviceSnapshot: data.serviceSnapshot as Booking['serviceSnapshot'],
    vehicleSnapshot: data.vehicleSnapshot as Booking['vehicleSnapshot'],
    scheduledAt: (data.scheduledAt as { toDate(): Date }).toDate(),
    flexDateEnd: data.flexDateEnd
      ? (data.flexDateEnd as { toDate(): Date }).toDate()
      : null,
    status: data.status as BookingStatus,
    address: data.address as Booking['address'],
    totalPrice: data.totalPrice as number,
    stripePaymentIntentId: (data.stripePaymentIntentId as string | null) ?? null,
    createdAt: (data.createdAt as { toDate(): Date }).toDate(),
  };
}

// ── CUSTOMER ─────────────────────────────────────────────────────────────────

export async function createBooking(
  data: Omit<Booking, 'bookingId' | 'createdAt'>
): Promise<string> {
  const ref = await addDoc(collection(db, BOOKINGS), {
    ...data,
    createdAt: serverTimestamp(),
  });
  return ref.id;
}

export async function getBookingsByCustomer(
  customerId: string
): Promise<Booking[]> {
  const q = query(
    collection(db, BOOKINGS),
    where('customerId', '==', customerId),
    orderBy('createdAt', 'desc')
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => mapBooking(d.id, d.data() as Record<string, unknown>));
}

export function listenToBooking(
  bookingId: string,
  onUpdate: (booking: Booking | null) => void
): Unsubscribe {
  return onSnapshot(
    doc(db, BOOKINGS, bookingId),
    (snap) => {
      if (snap.exists()) {
        onUpdate(mapBooking(snap.id, snap.data() as Record<string, unknown>));
      } else {
        onUpdate(null);
      }
    },
    (err) => {
      console.error('[listenToBooking]', err);
      onUpdate(null);
    }
  );
}

export async function cancelBooking(bookingId: string): Promise<void> {
  await updateDoc(doc(db, BOOKINGS, bookingId), { status: 'cancelled' });
}

export async function getBookingById(bookingId: string): Promise<Booking | null> {
  const snap = await getDoc(doc(db, BOOKINGS, bookingId));
  if (!snap.exists()) return null;
  return mapBooking(snap.id, snap.data() as Record<string, unknown>);
}

export async function getActiveBookingForCustomer(
  customerId: string
): Promise<Booking | null> {
  const activeStatuses: BookingStatus[] = ['accepted', 'en_route', 'in_progress'];
  for (const status of activeStatuses) {
    const q = query(
      collection(db, BOOKINGS),
      where('customerId', '==', customerId),
      where('status', '==', status),
      limit(1)
    );
    const snap = await getDocs(q);
    if (!snap.empty) {
      return mapBooking(snap.docs[0].id, snap.docs[0].data() as Record<string, unknown>);
    }
  }
  return null;
}

// ── TECHNICIAN ───────────────────────────────────────────────────────────────

export async function getPendingBookings(): Promise<Booking[]> {
  const q = query(
    collection(db, BOOKINGS),
    where('status', '==', 'pending'),
    orderBy('scheduledAt', 'asc')
  );
  const snap = await getDocs(q);
  return snap.docs
    .map((d) => mapBooking(d.id, d.data() as Record<string, unknown>))
    .filter((b) => b.technicianId === null);
}

export async function acceptBooking(
  bookingId: string,
  technicianId: string
): Promise<void> {
  const bookingRef = doc(db, BOOKINGS, bookingId);
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(bookingRef);
    if (!snap.exists()) throw new Error('Booking not found');
    const data = snap.data();
    if (data.technicianId !== null && data.technicianId !== undefined) {
      throw new Error('Booking already accepted by another technician');
    }
    if (data.status !== 'pending') {
      throw new Error('Booking is no longer pending');
    }
    tx.update(bookingRef, { technicianId, status: 'accepted' });
  });
}

export async function updateBookingStatus(
  bookingId: string,
  status: BookingStatus
): Promise<void> {
  await updateDoc(doc(db, BOOKINGS, bookingId), { status });
}

export async function getTechnicianBookings(
  technicianId: string,
  status?: BookingStatus
): Promise<Booking[]> {
  const constraints = [where('technicianId', '==', technicianId)];
  if (status) constraints.push(where('status', '==', status));
  const q = query(collection(db, BOOKINGS), ...constraints, orderBy('scheduledAt', 'asc'));
  const snap = await getDocs(q);
  return snap.docs.map((d) => mapBooking(d.id, d.data() as Record<string, unknown>));
}
