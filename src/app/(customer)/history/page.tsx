'use client';

/**
 * Service History — all service records across the customer's vehicles,
 * sorted newest first.
 *
 * Features:
 *  - Fetches all service history via getHistoryByCustomer (one-time)
 *  - Vehicle filter dropdown — shows "All vehicles" or filters to one
 *  - Renders each record as a ServiceTimelineEntry
 *  - Empty state when no records exist
 */

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAuth } from '@/hooks/useAuth';
import { getHistoryByCustomer } from '@/services/serviceHistoryService';
import { getVehiclesByOwner } from '@/services/vehicleService';
import { ServiceTimelineEntry } from '@/components/vehicles/ServiceTimelineEntry';
import type { ServiceHistoryRecord, Vehicle } from '@/types';

const ALL_VEHICLES = '__all__';

export default function HistoryPage() {
  const { user } = useAuth();

  const [records, setRecords] = useState<ServiceHistoryRecord[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterVehicleId, setFilterVehicleId] = useState<string>(ALL_VEHICLES);

  useEffect(() => {
    if (!user) return;

    Promise.all([
      getHistoryByCustomer(user.uid),
      getVehiclesByOwner(user.uid),
    ])
      .then(([recs, vehs]) => {
        setRecords(recs);
        setVehicles(vehs);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.uid]);

  // Build vehicle lookup for display names
  const vehicleMap = new Map<string, Vehicle>(
    vehicles.map((v) => [v.vehicleId, v])
  );

  const filtered =
    filterVehicleId === ALL_VEHICLES
      ? records
      : records.filter((r) => r.vehicleId === filterVehicleId);

  return (
    <div className="space-y-0">
      {/* Header */}
      <div className="px-4 pt-6 pb-4">
        <h1 className="text-2xl font-bold text-text-primary">Service History</h1>
        <p className="text-text-secondary text-sm mt-1">All services across your vehicles</p>
      </div>

      {/* Vehicle filter */}
      {!loading && vehicles.length > 1 && (
        <div className="px-4 pb-4">
          <select
            value={filterVehicleId}
            onChange={(e) => setFilterVehicleId(e.target.value)}
            className="w-full bg-surface-raised border border-surface-border rounded-xl px-4 py-2.5 text-sm text-text-primary focus:outline-none focus:border-brand/50"
          >
            <option value={ALL_VEHICLES}>All vehicles</option>
            {vehicles.map((v) => (
              <option key={v.vehicleId} value={v.vehicleId}>
                {v.year} {v.make} {v.model}{v.nickname ? ` — ${v.nickname}` : ''}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Content */}
      <div className="px-4 pb-8">
        {loading ? (
          /* Loading skeletons */
          <div className="pl-6 space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-24 bg-surface-raised rounded-xl animate-pulse" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          /* Empty state */
          <div className="flex flex-col items-center justify-center py-16 space-y-3 text-center">
            <svg
              className="text-text-muted"
              width="40"
              height="40"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            <div className="space-y-1">
              <p className="text-text-primary text-sm font-medium">No completed services yet</p>
              <p className="text-text-muted text-xs">
                {filterVehicleId === ALL_VEHICLES
                  ? 'Completed bookings will appear here.'
                  : 'No completed services for this vehicle.'}
              </p>
            </div>
            {filterVehicleId === ALL_VEHICLES && (
              <Link
                href="/bookings"
                className="px-4 py-2 bg-brand/10 border border-brand/30 text-brand rounded-lg text-sm font-semibold"
              >
                View Upcoming Bookings
              </Link>
            )}
          </div>
        ) : (
          /* Timeline */
          <div>
            {/* Vehicle label inline — only shown when viewing all vehicles */}
            {filterVehicleId === ALL_VEHICLES
              ? filtered.map((record) => {
                  const v = vehicleMap.get(record.vehicleId);
                  const vehicleLabel = v
                    ? `${v.year} ${v.make} ${v.model}${v.nickname ? ` — ${v.nickname}` : ''}`
                    : null;

                  return (
                    <div key={record.recordId}>
                      {vehicleLabel && (
                        <p className="text-[10px] font-semibold text-text-muted uppercase tracking-wider mb-1 pl-6">
                          {vehicleLabel}
                        </p>
                      )}
                      <ServiceTimelineEntry record={record} />
                    </div>
                  );
                })
              : filtered.map((record) => (
                  <ServiceTimelineEntry key={record.recordId} record={record} />
                ))}
          </div>
        )}
      </div>
    </div>
  );
}
