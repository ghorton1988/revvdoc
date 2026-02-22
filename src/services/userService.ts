/**
 * User Service — Firestore data access for users collection.
 */

import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  onSnapshot,
  serverTimestamp,
  type Unsubscribe,
} from 'firebase/firestore';
import { db } from '@/lib/firebase/firebase';
import type { User, TechnicianUser } from '@/types';

const USERS = 'users';

export async function getUserById(uid: string): Promise<User | null> {
  const snap = await getDoc(doc(db, USERS, uid));
  if (!snap.exists()) return null;
  return { uid: snap.id, ...snap.data() } as User;
}

export async function createUser(
  uid: string,
  data: Omit<User, 'uid' | 'createdAt'>
): Promise<void> {
  const base = { uid, ...data, createdAt: serverTimestamp() };

  if (data.role === 'technician') {
    const techDefaults: Omit<TechnicianUser, keyof User> = {
      isAvailable: false,
      serviceCategories: [],
      currentJobId: null,
      rating: null,
      totalJobsCompleted: 0,
    };
    await setDoc(doc(db, USERS, uid), { ...base, ...techDefaults });
  } else {
    await setDoc(doc(db, USERS, uid), base);
  }
}

export async function updateUser(
  uid: string,
  partial: Partial<Pick<User, 'name' | 'phone' | 'photoUrl'>>
): Promise<void> {
  await updateDoc(doc(db, USERS, uid), partial);
}

export function listenToUser(
  uid: string,
  onUpdate: (user: User | null) => void
): Unsubscribe {
  return onSnapshot(
    doc(db, USERS, uid),
    (snap) => {
      if (!snap.exists()) {
        onUpdate(null);
        return;
      }
      onUpdate({ uid: snap.id, ...snap.data() } as User);
    },
    (error) => {
      console.error('[listenToUser]', error);
      onUpdate(null);
    }
  );
}

export async function updateTechnicianAvailability(
  uid: string,
  isAvailable: boolean
): Promise<void> {
  await updateDoc(doc(db, USERS, uid), { isAvailable });
}
