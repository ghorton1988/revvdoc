/**
 * SymptomForm — free-text symptom entry with vehicle selector.
 *
 * The user describes what their vehicle is doing in plain English.
 * A vehicle must be selected (subscriptions are vehicle-scoped and
 * the symptom report is always attached to a vehicle).
 *
 * On submit, calls onSubmit(vehicleId, description).
 * The parent is responsible for the API call and showing results.
 *
 * Usage:
 *   <SymptomForm vehicles={vehicles} onSubmit={handleSubmit} loading={loading} />
 */

import type { Vehicle } from '@/types';

interface SymptomFormProps {
  vehicles: Vehicle[];
  onSubmit: (vehicleId: string, description: string) => void;
  loading?: boolean;
}

export function SymptomForm({ vehicles, onSubmit, loading = false }: SymptomFormProps) {
  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (loading) return;

    const form = e.currentTarget;
    const vehicleId   = (form.elements.namedItem('vehicleId')   as HTMLSelectElement).value;
    const description = (form.elements.namedItem('description') as HTMLTextAreaElement).value.trim();

    if (!vehicleId || !description) return;
    onSubmit(vehicleId, description);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Vehicle selector */}
      {vehicles.length > 0 ? (
        <div className="space-y-1.5">
          <label htmlFor="vehicleId" className="block text-xs font-semibold text-text-muted uppercase tracking-wider">
            Which vehicle?
          </label>
          <select
            id="vehicleId"
            name="vehicleId"
            required
            className="w-full bg-surface-raised border border-surface-border rounded-xl px-4 py-3 text-sm text-text-primary focus:outline-none focus:border-brand/50"
          >
            {vehicles.map((v) => (
              <option key={v.vehicleId} value={v.vehicleId}>
                {v.year} {v.make} {v.model}{v.nickname ? ` — ${v.nickname}` : ''}
              </option>
            ))}
          </select>
        </div>
      ) : (
        <div className="rounded-xl bg-surface-raised border border-surface-border px-4 py-3 text-sm text-text-muted">
          No vehicles found. Add a vehicle first.
        </div>
      )}

      {/* Description textarea */}
      <div className="space-y-1.5">
        <label htmlFor="description" className="block text-xs font-semibold text-text-muted uppercase tracking-wider">
          Describe what&apos;s happening
        </label>
        <textarea
          id="description"
          name="description"
          rows={5}
          required
          minLength={10}
          placeholder="e.g. My car makes a grinding sound when I brake. I also noticed it pulls to the left..."
          className="w-full bg-surface-raised border border-surface-border rounded-xl px-4 py-3 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-brand/50 resize-none"
        />
        <p className="text-[10px] text-text-muted">
          Be as specific as possible — when does it happen? What does it sound or feel like?
        </p>
      </div>

      {/* Disclaimer */}
      <div className="flex items-start gap-2.5 rounded-xl bg-surface-raised border border-surface-border px-4 py-3">
        {/* Info icon */}
        <svg
          className="shrink-0 mt-0.5 text-text-muted"
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="8" x2="12" y2="12" />
          <line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
        <p className="text-[11px] text-text-muted leading-snug">
          Results are <strong className="text-text-secondary">suggested based on your description — not a diagnosis.</strong>{' '}
          Always have a qualified technician inspect your vehicle.
        </p>
      </div>

      {/* Submit */}
      <button
        type="submit"
        disabled={loading || vehicles.length === 0}
        className={[
          'w-full py-3 rounded-xl text-sm font-semibold transition-all',
          !loading && vehicles.length > 0
            ? 'bg-brand text-black hover:bg-brand/90 active:scale-[0.98]'
            : 'bg-surface-mid text-text-muted cursor-not-allowed',
        ].join(' ')}
      >
        {loading ? 'Analyzing…' : 'Analyze Symptoms'}
      </button>
    </form>
  );
}
