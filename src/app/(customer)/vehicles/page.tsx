'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAuth } from '@/hooks/useAuth';
import { getVehiclesByOwner } from '@/services/vehicleService';
import { VEHICLE_STATUS_STYLES } from '@/types';
import type { Vehicle } from '@/types';

export default function VehiclesPage() {
  const { user, loading: authLoading } = useAuth();
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.uid) return;
    getVehiclesByOwner(user.uid)
      .then(setVehicles)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [user?.uid]);

  return (
    <div className="p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between pt-2">
        <h1 className="text-2xl font-bold text-text-primary">My Vehicles</h1>
        <Link
          href="/vehicles/add"
          className="flex items-center gap-1.5 bg-brand text-surface-base text-sm font-semibold px-4 py-2 rounded-xl active:scale-[0.98] transition-all"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <path d="M12 5v14M5 12h14" />
          </svg>
          Add
        </Link>
      </div>

      {/* Vehicle list */}
      {authLoading || loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-24 bg-surface-raised rounded-2xl animate-pulse" />
          ))}
        </div>
      ) : vehicles.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="space-y-3">
          {vehicles.map((v) => (
            <VehicleCard key={v.vehicleId} vehicle={v} />
          ))}
        </div>
      )}
    </div>
  );
}

function VehicleCard({ vehicle }: { vehicle: Vehicle }) {
  const style = VEHICLE_STATUS_STYLES[vehicle.status];
  return (
    <Link
      href={`/vehicles/${vehicle.vehicleId}`}
      className="block bg-surface-raised rounded-2xl p-4 border border-surface-border hover:border-surface-overlay active:scale-[0.99] transition-all"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <p className="text-text-primary font-semibold">
            {vehicle.year} {vehicle.make} {vehicle.model}
          </p>
          {vehicle.nickname && (
            <p className="text-brand text-sm">{vehicle.nickname}</p>
          )}
          <p className="text-text-muted text-sm">
            {vehicle.mileage.toLocaleString()} mi
            {vehicle.lastServiceDate && (
              <> · Last service {new Date(vehicle.lastServiceDate).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}</>
            )}
          </p>
        </div>
        <div className="flex-shrink-0 flex flex-col items-end gap-2">
          <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${style.bg} ${style.text}`}>
            {style.label}
          </span>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-text-muted">
            <path d="M9 18l6-6-6-6" />
          </svg>
        </div>
      </div>
    </Link>
  );
}

function EmptyState() {
  return (
    <div className="bg-surface-raised rounded-2xl p-8 text-center space-y-4 mt-4">
      <div className="w-14 h-14 bg-surface-overlay rounded-full flex items-center justify-center mx-auto">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="text-text-muted">
          <path d="M5 17H3a2 2 0 01-2-2V5a2 2 0 012-2h11a2 2 0 012 2v3m0 0h3l3 3v4a2 2 0 01-2 2h-1M5 17a2 2 0 100 4 2 2 0 000-4zm11 0a2 2 0 100 4 2 2 0 000-4z" />
        </svg>
      </div>
      <div>
        <p className="text-text-primary font-semibold">No vehicles yet</p>
        <p className="text-text-secondary text-sm mt-1">Add your first vehicle to get started</p>
      </div>
      <Link
        href="/vehicles/add"
        className="inline-block bg-brand text-surface-base font-semibold px-6 py-3 rounded-xl active:scale-[0.98] transition-all"
      >
        Add Vehicle
      </Link>
    </div>
  );
}
