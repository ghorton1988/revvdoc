'use client';

/**
 * useVehicleHealth — real-time subscription to a vehicle's health snapshot.
 *
 * Subscribes to vehicleHealth/{vehicleId} via Firestore onSnapshot.
 * The snapshot is written server-side by /api/maintenance/recompute after every
 * job completion and whenever the customer updates vehicle mileage.
 *
 * Returns null snapshot if the vehicle has no completed services yet.
 *
 * Usage:
 *   const { snapshot, loading } = useVehicleHealth(vehicleId);
 */

import { useState, useEffect } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase/firebase';
import type { VehicleHealthSnapshot } from '@/types';

export interface VehicleHealthState {
  snapshot: VehicleHealthSnapshot | null;
  loading: boolean;
}

export function useVehicleHealth(vehicleId: string | null): VehicleHealthState {
  const [snapshot, setSnapshot] = useState<VehicleHealthSnapshot | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!vehicleId) {
      setSnapshot(null);
      setLoading(false);
      return;
    }

    setLoading(true);

    const unsub = onSnapshot(
      doc(db, 'vehicleHealth', vehicleId),
      (snap) => {
        setSnapshot(snap.exists() ? (snap.data() as VehicleHealthSnapshot) : null);
        setLoading(false);
      },
      (err) => {
        console.error('[useVehicleHealth]', err);
        setLoading(false);
      }
    );

    return () => unsub();
  }, [vehicleId]);

  return { snapshot, loading };
}
