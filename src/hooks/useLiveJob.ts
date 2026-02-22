'use client';

/**
 * useLiveJob — real-time Firestore listener for a job document.
 *
 * Used by:
 * - Customer's live job map page (to update tech marker position)
 * - Technician's active job page (to sync stage state)
 *
 * Always clean up the onSnapshot listener on unmount.
 */

import { useState, useEffect } from 'react';
import { listenToJob } from '@/services/jobService';
import type { Job } from '@/types';

export function useLiveJob(jobId: string): { job: Job | null; loading: boolean } {
  const [job, setJob] = useState<Job | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!jobId) return;
    const unsub = listenToJob(jobId, (updated) => {
      setJob(updated);
      setLoading(false);
    });
    return () => unsub();
  }, [jobId]);

  return { job, loading };
}
