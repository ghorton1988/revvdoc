'use client';

/**
 * Assistant page — AI vehicle assistant entry point.
 *
 * Shows a vehicle selector dropdown (if user has multiple vehicles),
 * then renders AssistantPanel anchored to the selected vehicle.
 *
 * Sessions are per-vehicle. Switching vehicles creates or resumes
 * a different session.
 */

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { getVehiclesByOwner } from '@/services/vehicleService';
import { AssistantPanel } from '@/components/ai/AssistantPanel';
import type { Vehicle } from '@/types';

export default function AssistantPage() {
  const { user } = useAuth();
  const router = useRouter();

  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [selectedVehicleId, setSelectedVehicleId] = useState<string>('');

  useEffect(() => {
    if (!user?.uid) return;
    getVehiclesByOwner(user.uid)
      .then((vehs) => {
        setVehicles(vehs);
        if (vehs.length > 0) setSelectedVehicleId(vehs[0].vehicleId);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.uid]);

  const selectedVehicle = vehicles.find((v) => v.vehicleId === selectedVehicleId);
  const vehicleName = selectedVehicle
    ? `${selectedVehicle.year} ${selectedVehicle.make} ${selectedVehicle.model}${selectedVehicle.nickname ? ` — ${selectedVehicle.nickname}` : ''}`
    : undefined;

  if (loading) {
    return (
      <div className="flex flex-col h-screen">
        <div className="p-4 space-y-3">
          <div className="h-10 w-36 bg-surface-raised rounded-xl animate-pulse" />
          <div className="h-12 bg-surface-raised rounded-xl animate-pulse" />
        </div>
        <div className="flex-1 px-4 space-y-4 pt-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className={`flex ${i % 2 === 0 ? 'justify-end' : 'justify-start'}`}>
              <div className="h-14 w-3/5 bg-surface-raised rounded-2xl animate-pulse" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (vehicles.length === 0) {
    return (
      <div className="p-6 flex flex-col items-center justify-center min-h-[60vh] space-y-4 text-center">
        <svg className="text-text-muted" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M9 17a2 2 0 11-4 0 2 2 0 014 0zM19 17a2 2 0 11-4 0 2 2 0 014 0z" />
          <path d="M13 6h-2a4 4 0 00-4 4v1H3v4h.268a2 2 0 011.832 1.2M5 11H3" />
          <path d="M16 3l3 3-3 3M18 6H9" />
        </svg>
        <p className="text-text-primary font-medium">No vehicles added yet</p>
        <p className="text-sm text-text-muted">Add a vehicle to start chatting with the assistant.</p>
        <button
          onClick={() => router.push('/vehicles/add')}
          className="bg-brand text-black font-semibold text-sm px-5 py-2.5 rounded-xl"
        >
          Add Vehicle
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col" style={{ height: 'calc(100vh - 64px)' }}>
      {/* Vehicle selector */}
      {vehicles.length > 1 && (
        <div className="px-4 pt-4 pb-2 shrink-0">
          <select
            value={selectedVehicleId}
            onChange={(e) => setSelectedVehicleId(e.target.value)}
            className="w-full bg-surface-raised border border-surface-border rounded-xl px-4 py-2.5 text-sm text-text-primary focus:outline-none focus:border-brand/50"
          >
            {vehicles.map((v) => (
              <option key={v.vehicleId} value={v.vehicleId}>
                {v.year} {v.make} {v.model}{v.nickname ? ` — ${v.nickname}` : ''}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Chat panel — fills remaining height */}
      {selectedVehicleId && (
        <div className="flex-1 min-h-0">
          <AssistantPanel
            key={selectedVehicleId} // re-mount on vehicle change to reset session
            vehicleId={selectedVehicleId}
            vehicleName={vehicleName}
          />
        </div>
      )}
    </div>
  );
}
