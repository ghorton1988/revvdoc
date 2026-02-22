'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/hooks/useAuth';
import { addVehicle } from '@/services/vehicleService';
import type { DecodeVinResponse, VehicleStatus } from '@/types';

type Step = 'vin' | 'confirm';

export default function AddVehiclePage() {
  const router = useRouter();
  const { user } = useAuth();

  const [step, setStep] = useState<Step>('vin');
  const [vin, setVin] = useState('');
  const [decoded, setDecoded] = useState<DecodeVinResponse | null>(null);
  const [nickname, setNickname] = useState('');
  const [mileage, setMileage] = useState('');
  const [status, setStatus] = useState<VehicleStatus>('OPTIMAL');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleVinLookup(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const cleanVin = vin.trim().toUpperCase().replace(/\s/g, '');

    try {
      const res = await fetch(`/api/vehicles/decode-vin?vin=${cleanVin}`);
      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? 'VIN lookup failed.');
        return;
      }

      setDecoded(data);
      setStep('confirm');
    } catch {
      setError('Network error. Please check your connection and try again.');
    } finally {
      setLoading(false);
    }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!decoded || !user?.uid) return;

    const miles = parseInt(mileage.replace(/,/g, ''), 10);
    if (isNaN(miles) || miles < 0) {
      setError('Please enter a valid mileage.');
      return;
    }

    setError(null);
    setLoading(true);

    try {
      await addVehicle({
        ownerId: user.uid,
        vin: decoded.vin,
        make: decoded.make,
        model: decoded.model,
        year: decoded.year,
        nickname: nickname.trim() || null,
        status,
        mileage: miles,
        lastServiceDate: null,
        photoUrl: null,
      });
      router.push('/vehicles');
    } catch {
      setError('Failed to save vehicle. Please try again.');
      setLoading(false);
    }
  }

  return (
    <div className="p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3 pt-2">
        <Link href="/vehicles" className="p-1 -ml-1 text-text-secondary hover:text-text-primary transition-colors">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </Link>
        <h1 className="text-xl font-bold text-text-primary">Add Vehicle</h1>
      </div>

      {/* Step 1: VIN entry */}
      {step === 'vin' && (
        <div className="bg-surface-raised rounded-2xl p-5 space-y-4">
          <div>
            <h2 className="text-text-primary font-semibold">Enter your VIN</h2>
            <p className="text-text-secondary text-sm mt-1">
              Found on your dashboard, driver door jamb, or registration. 17 characters.
            </p>
          </div>

          {error && (
            <div className="bg-status-fault/10 border border-status-fault/30 rounded-xl px-4 py-3">
              <p className="text-status-fault text-sm">{error}</p>
            </div>
          )}

          <form onSubmit={handleVinLookup} className="space-y-4">
            <div className="space-y-1">
              <label className="block text-text-secondary text-sm font-medium">VIN</label>
              <input
                type="text"
                value={vin}
                onChange={(e) => setVin(e.target.value.toUpperCase())}
                placeholder="e.g. 1HGCM82633A123456"
                required
                maxLength={17}
                autoCapitalize="characters"
                autoComplete="off"
                spellCheck={false}
                className="w-full bg-surface-overlay border border-surface-border rounded-xl px-4 py-3 text-text-primary placeholder-text-muted focus:outline-none focus:border-brand transition-colors font-mono tracking-wider uppercase"
              />
              <p className="text-text-muted text-xs">{vin.trim().length} / 17 characters</p>
            </div>

            <button
              type="submit"
              disabled={loading || vin.trim().length !== 17}
              className="w-full bg-brand hover:bg-brand-dark active:scale-[0.98] transition-all rounded-xl py-3 font-semibold text-surface-base disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Looking up VIN…' : 'Look Up Vehicle'}
            </button>
          </form>
        </div>
      )}

      {/* Step 2: Confirm + details */}
      {step === 'confirm' && decoded && (
        <div className="space-y-4">
          {/* Decoded vehicle card */}
          <div className="bg-surface-raised rounded-2xl p-5 space-y-3">
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-text-primary font-bold text-lg">
                  {decoded.year} {decoded.make} {decoded.model}
                </h2>
                <p className="text-text-muted text-sm mt-0.5 font-mono">{decoded.vin}</p>
              </div>
              <button
                onClick={() => { setStep('vin'); setError(null); }}
                className="text-brand text-sm font-medium hover:text-brand-light transition-colors"
              >
                Change
              </button>
            </div>
          </div>

          {/* Details form */}
          <div className="bg-surface-raised rounded-2xl p-5 space-y-4">
            <h3 className="text-text-primary font-semibold">Vehicle details</h3>

            {error && (
              <div className="bg-status-fault/10 border border-status-fault/30 rounded-xl px-4 py-3">
                <p className="text-status-fault text-sm">{error}</p>
              </div>
            )}

            <form onSubmit={handleSave} className="space-y-4">
              <div className="space-y-1">
                <label className="block text-text-secondary text-sm font-medium">
                  Current mileage <span className="text-status-fault">*</span>
                </label>
                <input
                  type="number"
                  value={mileage}
                  onChange={(e) => setMileage(e.target.value)}
                  placeholder="e.g. 45000"
                  required
                  min={0}
                  max={999999}
                  className="w-full bg-surface-overlay border border-surface-border rounded-xl px-4 py-3 text-text-primary placeholder-text-muted focus:outline-none focus:border-brand transition-colors"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-text-secondary text-sm font-medium">
                  Nickname <span className="text-text-muted">(optional)</span>
                </label>
                <input
                  type="text"
                  value={nickname}
                  onChange={(e) => setNickname(e.target.value)}
                  placeholder="e.g. Daily Driver, Weekend Car"
                  maxLength={40}
                  className="w-full bg-surface-overlay border border-surface-border rounded-xl px-4 py-3 text-text-primary placeholder-text-muted focus:outline-none focus:border-brand transition-colors"
                />
              </div>

              <div className="space-y-2">
                <label className="block text-text-secondary text-sm font-medium">Current status</label>
                <div className="grid grid-cols-3 gap-2">
                  {(
                    [
                      { value: 'OPTIMAL', label: 'Optimal', color: 'text-status-optimal border-status-optimal/30 bg-status-optimal/10' },
                      { value: 'SERVICE_DUE', label: 'Service Due', color: 'text-status-serviceDue border-status-serviceDue/30 bg-status-serviceDue/10' },
                      { value: 'FAULT', label: 'Fault', color: 'text-status-fault border-status-fault/30 bg-status-fault/10' },
                    ] as const
                  ).map(({ value, label, color }) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setStatus(value)}
                      className={`py-2 rounded-xl border-2 text-xs font-bold transition-all ${
                        status === value ? color : 'border-surface-border text-text-muted hover:border-text-muted'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              <button
                type="submit"
                disabled={loading || !mileage}
                className="w-full bg-brand hover:bg-brand-dark active:scale-[0.98] transition-all rounded-xl py-3 font-semibold text-surface-base disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Saving…' : 'Add Vehicle'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
