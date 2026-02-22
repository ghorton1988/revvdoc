/**
 * Job Service — Firestore data access for jobs collection.
 * Real-time operations (onSnapshot, GPS writes) live here.
 */

import {
  doc,
  getDoc,
  updateDoc,
  getDocs,
  query,
  collection,
  where,
  limit,
  onSnapshot,
  arrayUnion,
  serverTimestamp,
  type Unsubscribe,
} from 'firebase/firestore';
import { db } from '@/lib/firebase/firebase';
import type { Job, JobStage, JobStageRecord } from '@/types';

const JOBS = 'jobs';

function mapJob(id: string, data: Record<string, unknown>): Job {
  const stages = ((data.stages as Record<string, unknown>[]) ?? []).map(
    (s): JobStageRecord => ({
      stage: s.stage as JobStage,
      enteredAt: (s.enteredAt as { toDate(): Date }).toDate(),
      note: (s.note as string | null) ?? null,
    })
  );

  return {
    jobId: id,
    bookingId: data.bookingId as string,
    technicianId: data.technicianId as string,
    customerId: data.customerId as string,
    stages,
    currentStage: data.currentStage as JobStage,
    techLocation: data.techLocation
      ? {
          lat: (data.techLocation as Record<string, unknown>).lat as number,
          lng: (data.techLocation as Record<string, unknown>).lng as number,
          updatedAt: (
            (data.techLocation as Record<string, unknown>).updatedAt as {
              toDate(): Date;
            }
          ).toDate(),
        }
      : null,
    notes: (data.notes as string | null) ?? null,
    startedAt: data.startedAt
      ? (data.startedAt as { toDate(): Date }).toDate()
      : null,
    completedAt: data.completedAt
      ? (data.completedAt as { toDate(): Date }).toDate()
      : null,
  };
}

export function listenToJob(
  jobId: string,
  onUpdate: (job: Job | null) => void
): Unsubscribe {
  return onSnapshot(
    doc(db, JOBS, jobId),
    (snap) => {
      if (snap.exists()) {
        onUpdate(mapJob(snap.id, snap.data() as Record<string, unknown>));
      } else {
        onUpdate(null);
      }
    },
    (err) => {
      console.error('[listenToJob]', err);
      onUpdate(null);
    }
  );
}

export async function getJobByBookingId(bookingId: string): Promise<Job | null> {
  const q = query(
    collection(db, JOBS),
    where('bookingId', '==', bookingId),
    limit(1)
  );
  const snap = await getDocs(q);
  if (snap.empty) return null;
  return mapJob(snap.docs[0].id, snap.docs[0].data() as Record<string, unknown>);
}

export async function getJobById(jobId: string): Promise<Job | null> {
  const snap = await getDoc(doc(db, JOBS, jobId));
  if (!snap.exists()) return null;
  return mapJob(snap.id, snap.data() as Record<string, unknown>);
}

export async function updateTechLocation(
  jobId: string,
  location: { lat: number; lng: number }
): Promise<void> {
  await updateDoc(doc(db, JOBS, jobId), {
    techLocation: {
      lat: location.lat,
      lng: location.lng,
      updatedAt: serverTimestamp(),
    },
  });
}

export async function advanceJobStage(
  jobId: string,
  newStage: JobStage,
  note?: string
): Promise<void> {
  const stageRecord: Omit<JobStageRecord, 'enteredAt'> & { enteredAt: unknown } = {
    stage: newStage,
    enteredAt: serverTimestamp(),
    note: note ?? null,
  };
  await updateDoc(doc(db, JOBS, jobId), {
    currentStage: newStage,
    stages: arrayUnion(stageRecord),
    ...(newStage === 'in_progress' ? { startedAt: serverTimestamp() } : {}),
  });
}

export async function getTechnicianActiveJob(
  technicianId: string
): Promise<Job | null> {
  const activeStages: JobStage[] = ['dispatched', 'en_route', 'arrived', 'in_progress', 'quality_check'];
  for (const stage of activeStages) {
    const q = query(
      collection(db, JOBS),
      where('technicianId', '==', technicianId),
      where('currentStage', '==', stage),
      limit(1)
    );
    const snap = await getDocs(q);
    if (!snap.empty) {
      return mapJob(snap.docs[0].id, snap.docs[0].data() as Record<string, unknown>);
    }
  }
  return null;
}
