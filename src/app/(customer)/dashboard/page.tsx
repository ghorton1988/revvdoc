'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAuth } from '@/hooks/useAuth';
import { getVehiclesByOwner } from '@/services/vehicleService';
import { VEHICLE_STATUS_STYLES } from '@/types';
import type { Vehicle } from '@/types';

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

export default function DashboardPage() {
  const { user, loading: authLoading } = useAuth();
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [vehiclesLoading, setVehiclesLoading] = useState(true);

  useEffect(() => {
    if (!user?.uid) return;
    getVehiclesByOwner(user.uid)
      .then(setVehicles)
      .catch(console.error)
      .finally(() => setVehiclesLoading(false));
  }, [user?.uid]);

  if (authLoading) {
    return <DashboardSkeleton />;
  }

  const firstName = user?.name?.split(' ')[0] ?? 'there';
  const faultCount = vehicles.filter((v) => v.status === 'FAULT').length;
  const serviceDueCount = vehicles.filter((v) => v.status === 'SERVICE_DUE').length;

  return (
    <div className="p-4 space-y-6">
      {/* Greeting */}
      <div className="pt-2">
        <p className="text-text-secondary text-sm">{getGreeting()}</p>
        <h1 className="text-2xl font-bold text-text-primary mt-0.5">{firstName}</h1>
      </div>

      {/* Fleet health summary — only if there are issues */}
      {(faultCount > 0 || serviceDueCount > 0) && (
        <div className="bg-status-fault/10 border border-status-fault/30 rounded-2xl p-4 space-y-1">
          <p className="text-status-fault font-semibold text-sm">Attention needed</p>
          {faultCount > 0 && (
            <p className="text-text-secondary text-sm">
              {faultCount} vehicle{faultCount > 1 ? 's have' : ' has'} a fault
            </p>
          )}
          {serviceDueCount > 0 && (
            <p className="text-text-secondary text-sm">
              {serviceDueCount} vehicle{serviceDueCount > 1 ? 's are' : ' is'} due for service
            </p>
          )}
        </div>
      )}

      {/* Vehicles section */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-text-primary font-semibold">Your Vehicles</h2>
          <Link href="/vehicles" className="text-brand text-sm font-medium">
            See all
          </Link>
        </div>

        {vehiclesLoading ? (
          <div className="space-y-3">
            {[1, 2].map((i) => (
              <div key={i} className="h-20 bg-surface-raised rounded-2xl animate-pulse" />
            ))}
          </div>
        ) : vehicles.length === 0 ? (
          <div className="bg-surface-raised rounded-2xl p-5 text-center space-y-3">
            <p className="text-text-secondary text-sm">No vehicles added yet</p>
            <Link
              href="/vehicles/add"
              className="inline-block bg-brand text-surface-base font-semibold text-sm px-5 py-2.5 rounded-xl"
            >
              Add Your First Vehicle
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {vehicles.slice(0, 3).map((v) => (
              <VehicleCard key={v.vehicleId} vehicle={v} />
            ))}
            {vehicles.length > 3 && (
              <Link href="/vehicles" className="block text-center text-brand text-sm font-medium py-2">
                View all {vehicles.length} vehicles
              </Link>
            )}
          </div>
        )}
      </section>

      {/* Quick actions */}
      <section className="space-y-3">
        <h2 className="text-text-primary font-semibold">Quick Actions</h2>
        <div className="grid grid-cols-2 gap-3">
          <Link
            href="/services"
            className="bg-brand hover:bg-brand-dark active:scale-[0.98] transition-all rounded-2xl p-4 flex flex-col gap-2"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#0A0A0A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 5v14M5 12h14" />
            </svg>
            <span className="font-semibold text-surface-base text-sm">Book Service</span>
          </Link>

          <Link
            href="/vehicles/add"
            className="bg-surface-raised border border-surface-border hover:border-text-muted active:scale-[0.98] transition-all rounded-2xl p-4 flex flex-col gap-2"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-brand">
              <path d="M12 5v14M5 12h14" />
            </svg>
            <span className="font-semibold text-text-primary text-sm">Add Vehicle</span>
          </Link>
        </div>
      </section>
    </div>
  );
}

function VehicleCard({ vehicle }: { vehicle: Vehicle }) {
  const style = VEHICLE_STATUS_STYLES[vehicle.status];
  return (
    <Link
      href={`/vehicles/${vehicle.vehicleId}`}
      className="block bg-surface-raised rounded-2xl p-4 border border-surface-border hover:border-surface-overlay transition-colors"
    >
      <div className="flex items-center justify-between">
        <div className="min-w-0">
          <p className="text-text-primary font-semibold truncate">
            {vehicle.year} {vehicle.make} {vehicle.model}
          </p>
          <p className="text-text-muted text-sm mt-0.5">
            {vehicle.nickname ? `${vehicle.nickname} · ` : ''}
            {vehicle.mileage.toLocaleString()} mi
          </p>
        </div>
        <span className={`text-xs font-bold px-2.5 py-1 rounded-full flex-shrink-0 ml-3 ${style.bg} ${style.text}`}>
          {style.label}
        </span>
      </div>
    </Link>
  );
}

function DashboardSkeleton() {
  return (
    <div className="p-4 space-y-6 animate-pulse">
      <div className="pt-2 space-y-2">
        <div className="h-4 w-24 bg-surface-raised rounded" />
        <div className="h-8 w-32 bg-surface-raised rounded" />
      </div>
      <div className="space-y-3">
        <div className="h-5 w-32 bg-surface-raised rounded" />
        {[1, 2].map((i) => (
          <div key={i} className="h-20 bg-surface-raised rounded-2xl" />
        ))}
      </div>
    </div>
  );
}
