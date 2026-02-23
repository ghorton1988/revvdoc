'use client';

/**
 * Diagnose page — AI Troubleshooting Assistant.
 *
 * Three-state flow:
 *   1. 'form'    — SymptomForm: vehicle selector + free-text description
 *   2. 'loading' — analyzing spinner
 *   3. 'results' — RecommendationCard list + book CTAs
 *
 * All results are labeled "Suggested based on your description — not a diagnosis."
 * per the UI CONTRACT in symptomService.ts.
 *
 * The API call goes to /api/diagnose which performs rule-based keyword matching
 * and creates a SymptomReport. No client-side Firestore writes.
 */

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { getVehiclesByOwner } from '@/services/vehicleService';
import { SymptomForm } from '@/components/diagnose/SymptomForm';
import { RecommendationCard } from '@/components/diagnose/RecommendationCard';
import type { Vehicle, Service } from '@/types';

type PageState = 'form' | 'loading' | 'results';

interface DiagnoseResult {
  reportId: string;
  symptoms: string[];
  recommendedServices: Service[];
}

export default function DiagnosePage() {
  const { user } = useAuth();
  const router = useRouter();

  const [pageState, setPageState] = useState<PageState>('form');
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [vehiclesLoading, setVehiclesLoading] = useState(true);
  const [result, setResult] = useState<DiagnoseResult | null>(null);
  const [error, setError] = useState('');

  // Load vehicles on mount
  useEffect(() => {
    if (!user) return;
    getVehiclesByOwner(user.uid)
      .then(setVehicles)
      .catch(console.error)
      .finally(() => setVehiclesLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.uid]);

  async function handleSubmit(vehicleId: string, description: string) {
    if (!user) return;
    setPageState('loading');
    setError('');

    try {
      const { getAuth } = await import('firebase/auth');
      const idToken = await getAuth().currentUser?.getIdToken();
      if (!idToken) throw new Error('Not authenticated');

      const res = await fetch('/api/diagnose', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({ vehicleId, description }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? 'Analysis failed');
      }

      const data = await res.json();
      setResult(data);
      setPageState('results');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Analysis failed. Please try again.');
      setPageState('form');
    }
  }

  function handleReset() {
    setResult(null);
    setError('');
    setPageState('form');
  }

  // ── Loading skeleton (vehicles fetch) ─────────────────────────────────────

  if (vehiclesLoading) {
    return (
      <div className="p-4 space-y-4">
        <div className="h-8 w-48 bg-surface-raised rounded animate-pulse" />
        <div className="h-40 bg-surface-raised rounded-xl animate-pulse" />
        <div className="h-12 bg-surface-raised rounded-xl animate-pulse" />
      </div>
    );
  }

  return (
    <div className="p-4 pb-8 space-y-5">
      {/* Header */}
      <div>
        {pageState === 'results' ? (
          <div className="flex items-center gap-3">
            <button onClick={handleReset} className="text-text-secondary shrink-0">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M15 18l-6-6 6-6" />
              </svg>
            </button>
            <div>
              <h1 className="text-xl font-bold text-text-primary">Recommendations</h1>
              <p className="text-xs text-text-muted">Based on your description</p>
            </div>
          </div>
        ) : (
          <div>
            <h1 className="text-2xl font-bold text-text-primary">Symptom Check</h1>
            <p className="text-text-secondary text-sm mt-1">
              Describe what&apos;s wrong and we&apos;ll suggest relevant services
            </p>
          </div>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-xl bg-status-fault/10 border border-status-fault/30 px-4 py-3">
          <p className="text-sm text-status-fault">{error}</p>
        </div>
      )}

      {/* ── Form state ──────────────────────────────────────────────────────── */}
      {pageState === 'form' && (
        <SymptomForm
          vehicles={vehicles}
          onSubmit={handleSubmit}
          loading={false}
        />
      )}

      {/* ── Loading state ───────────────────────────────────────────────────── */}
      {pageState === 'loading' && (
        <div className="flex flex-col items-center justify-center py-16 space-y-4">
          {/* Animated wrench icon */}
          <div className="relative">
            <div className="h-16 w-16 rounded-full bg-brand/10 flex items-center justify-center animate-pulse">
              <svg
                className="text-brand"
                width="28"
                height="28"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z" />
              </svg>
            </div>
          </div>
          <div className="text-center space-y-1">
            <p className="text-text-primary font-medium">Analyzing your symptoms…</p>
            <p className="text-xs text-text-muted">Matching to our service catalog</p>
          </div>
        </div>
      )}

      {/* ── Results state ───────────────────────────────────────────────────── */}
      {pageState === 'results' && result && (
        <div className="space-y-5">
          {/* Detected symptom tags */}
          {result.symptoms.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">
                Keywords detected
              </p>
              <div className="flex flex-wrap gap-2">
                {result.symptoms.map((tag) => (
                  <span
                    key={tag}
                    className="px-2.5 py-1 rounded-full bg-surface-raised border border-surface-border text-xs text-text-secondary"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Recommended services */}
          {result.recommendedServices.length > 0 ? (
            <div className="space-y-4">
              <p className="text-xs font-semibold text-text-muted uppercase tracking-wider">
                Suggested services
              </p>
              {result.recommendedServices.map((service, index) => (
                <RecommendationCard
                  key={service.serviceId}
                  service={service}
                  rank={index + 1}
                />
              ))}
            </div>
          ) : (
            <div className="bg-surface-raised border border-surface-border rounded-xl p-6 text-center space-y-3">
              {/* No-match icon */}
              <svg
                className="mx-auto text-text-muted"
                width="32"
                height="32"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
                <line x1="11" y1="8" x2="11" y2="14" />
                <line x1="11" y1="16" x2="11.01" y2="16" />
              </svg>
              <div>
                <p className="text-text-primary font-medium">No specific matches found</p>
                <p className="text-sm text-text-muted mt-1">
                  We couldn&apos;t pinpoint a service from your description.
                  Browse our full catalog or speak with a technician.
                </p>
              </div>
              <button
                onClick={() => router.push('/services')}
                className="text-brand text-sm font-medium"
              >
                Browse all services
              </button>
            </div>
          )}

          {/* Start over CTA */}
          <button
            onClick={handleReset}
            className="w-full py-3 rounded-xl border border-surface-border text-sm text-text-secondary hover:border-brand/30 hover:text-text-primary transition-colors"
          >
            Describe different symptoms
          </button>
        </div>
      )}
    </div>
  );
}
