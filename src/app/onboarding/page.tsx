'use client';

/**
 * Onboarding — 3-step first-run carousel.
 *
 * Shown once to new users (flag: localStorage "revvdoc_seen_onboarding").
 * On completion or skip: sets the flag and routes to /sign-in.
 *
 * Each step is built entirely in code (SVG + CSS + Tailwind animations).
 * Screenshot PNGs are NOT displayed here — they were used as visual reference only.
 *
 * Step 1 — "Calibrating Your Experience"
 *   Concentric sonar/ping rings radiating from a central BrandMark.
 *
 * Step 2 — "We Come to You"
 *   SVG map grid with a route line that draws itself, ending at a pulsing pin.
 *
 * Step 3 — "Track Every Job Live"
 *   Rotating radar sweep behind a live stage-progress strip.
 *
 * Transitions: directional slide + fade (Next → slide-in-right, Back → slide-in-left).
 */

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { BrandMark } from '@/components/ui/BrandMark';
import { AppBackdrop } from '@/components/ui/AppBackdrop';
import { ONBOARDING_KEY } from '@/lib/onboarding';

// ─── Step metadata ─────────────────────────────────────────────────────────────

const STEPS = [
  {
    headline: 'Calibrating Your Experience',
    subtext:
      'Scanning your vehicle profile and setting up your personalized service dashboard.',
  },
  {
    headline: 'We Come to You',
    subtext:
      'Book a service, set your location, and a certified technician will be on their way.',
  },
  {
    headline: 'Track Every Job Live',
    subtext:
      'Follow your technician on the map and get real-time updates from dispatch to completion.',
  },
] as const;

// ─── Illustrations (code-only, no PNG screenshots) ────────────────────────────

/** Step 1: Sonar rings radiating from center BrandMark — "calibrating" feel. */
function CalibrationIllustration() {
  return (
    <div className="relative w-56 h-56 flex items-center justify-center">
      {/* Sonar ring 1 — outermost, fastest */}
      <span
        aria-hidden="true"
        className="absolute w-56 h-56 rounded-full border border-brand/20 animate-ping"
        style={{ animationDuration: '2s' }}
      />
      {/* Sonar ring 2 — mid */}
      <span
        aria-hidden="true"
        className="absolute w-40 h-40 rounded-full border border-brand/28 animate-ping"
        style={{ animationDuration: '2.5s', animationDelay: '0.4s' }}
      />
      {/* Sonar ring 3 — tight, slowest */}
      <span
        aria-hidden="true"
        className="absolute w-28 h-28 rounded-full border border-brand/36 animate-ping"
        style={{ animationDuration: '1.8s', animationDelay: '0.8s' }}
      />

      {/* Static boundary ring */}
      <div
        aria-hidden="true"
        className="absolute w-48 h-48 rounded-full border border-brand/[0.12]"
      />

      {/* Progress arc — SVG circle partially filled with brand color */}
      <svg
        viewBox="0 0 120 120"
        className="absolute w-48 h-48 -rotate-90"
        aria-hidden="true"
      >
        <circle
          cx="60"
          cy="60"
          r="54"
          fill="none"
          stroke="rgba(0,229,180,0.07)"
          strokeWidth="3"
        />
        {/* ~75% filled arc (dashoffset = circumference * 0.25 = 339.3 * 0.25 ≈ 84.8) */}
        <circle
          cx="60"
          cy="60"
          r="54"
          fill="none"
          stroke="#00E5B4"
          strokeWidth="3"
          strokeLinecap="round"
          strokeDasharray="339.3"
          strokeDashoffset="84.8"
          style={{ filter: 'drop-shadow(0 0 4px rgba(0,229,180,0.55))' }}
        />
      </svg>

      {/* Center BrandMark — mix-blend + radial mask = no square edge */}
      <div className="relative z-10">
        <BrandMark size={72} className="[animation-duration:500ms]" />
      </div>
    </div>
  );
}

/** Step 2: SVG map motif — route line draws itself to a pulsing location pin. */
function LocationIllustration() {
  return (
    <div className="relative w-56 h-56 flex items-center justify-center">
      {/* Map grid texture */}
      <svg
        viewBox="0 0 200 200"
        className="absolute inset-0 w-full h-full opacity-[0.06]"
        aria-hidden="true"
      >
        <defs>
          <pattern id="ob-map-grid" width="32" height="32" patternUnits="userSpaceOnUse">
            <path d="M 32 0 L 0 0 0 32" fill="none" stroke="#00E5B4" strokeWidth="0.6" />
          </pattern>
        </defs>
        <rect width="200" height="200" fill="url(#ob-map-grid)" />
      </svg>

      {/* Route + destination SVG */}
      <svg viewBox="0 0 200 200" className="absolute inset-0 w-full h-full" aria-hidden="true">
        {/* Dashed route path — stroke-dashoffset animation draws it on */}
        <path
          d="M 40 160 C 70 130 90 90 130 72"
          fill="none"
          stroke="#00E5B4"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeDasharray="160"
          strokeDashoffset="160"
          className="animate-route-draw"
          style={{ filter: 'drop-shadow(0 0 3px rgba(0,229,180,0.5))' }}
        />

        {/* Origin dot */}
        <circle cx="40" cy="160" r="5" fill="#00E5B4" opacity="0.45" />
        <circle cx="40" cy="160" r="9" fill="rgba(0,229,180,0.12)" />

        {/* Destination: location pin (circle + tail) */}
        {/* Outer ping ring */}
        <circle
          cx="130"
          cy="72"
          r="18"
          fill="rgba(0,229,180,0.07)"
          className="animate-ping"
          style={{ animationDuration: '2.2s' }}
        />
        {/* Pin halo */}
        <circle
          cx="130"
          cy="72"
          r="12"
          fill="rgba(0,229,180,0.14)"
          stroke="#00E5B4"
          strokeWidth="1.5"
          style={{ filter: 'drop-shadow(0 0 5px rgba(0,229,180,0.45))' }}
        />
        {/* Pin center */}
        <circle cx="130" cy="72" r="4.5" fill="#00E5B4" />
        {/* Pin tail */}
        <line
          x1="130"
          y1="84"
          x2="130"
          y2="97"
          stroke="#00E5B4"
          strokeWidth="2.5"
          strokeLinecap="round"
          opacity="0.65"
        />

        {/* Technician dot — mid-route */}
        <circle
          cx="80"
          cy="122"
          r="5"
          fill="#00E5B4"
          style={{ filter: 'drop-shadow(0 0 4px rgba(0,229,180,0.7))' }}
        />
        <circle
          cx="80"
          cy="122"
          r="9"
          fill="rgba(0,229,180,0.14)"
          className="animate-ping"
          style={{ animationDuration: '1.7s' }}
        />
      </svg>
    </div>
  );
}

/** Step 3: Rotating radar sweep behind a live stage-progress strip. */
function TrackingIllustration() {
  const stages = ['Dispatched', 'En Route', 'Arrived', 'Complete'] as const;

  return (
    <div className="relative w-56 h-56 flex items-center justify-center">
      {/* Outer and inner static rings */}
      <div
        aria-hidden="true"
        className="absolute w-48 h-48 rounded-full border border-brand/[0.14]"
      />
      <div
        aria-hidden="true"
        className="absolute w-28 h-28 rounded-full border border-brand/[0.09]"
      />

      {/* Rotating radar conic sweep */}
      <div
        aria-hidden="true"
        className="absolute w-48 h-48 rounded-full animate-radar-sweep"
        style={{
          background:
            'conic-gradient(from 0deg, transparent 0deg, rgba(0,229,180,0.16) 55deg, transparent 90deg)',
        }}
      />

      {/* Center hub dot */}
      <div
        aria-hidden="true"
        className="absolute w-3 h-3 rounded-full bg-brand"
        style={{ boxShadow: '0 0 8px rgba(0,229,180,0.75)' }}
      />

      {/* Radar blip dots */}
      <div
        aria-hidden="true"
        className="absolute w-2 h-2 rounded-full bg-brand/70 animate-ping"
        style={{ top: '27%', left: '63%', animationDuration: '2.1s' }}
      />
      <div
        aria-hidden="true"
        className="absolute w-1.5 h-1.5 rounded-full bg-brand/40"
        style={{ top: '58%', left: '28%' }}
      />

      {/* Stage progress strip */}
      <div className="absolute bottom-3 left-0 right-0 flex flex-col items-center gap-2">
        <div className="flex items-center">
          {stages.map((stage, i) => (
            <div key={stage} className="flex items-center">
              {/* Stage dot */}
              <div
                className={`rounded-full ${
                  i < 2
                    ? 'w-2.5 h-2.5 bg-brand'
                    : i === 2
                    ? 'w-3 h-3 bg-brand animate-ping'
                    : 'w-2.5 h-2.5 bg-surface-border'
                }`}
                style={
                  i === 2
                    ? { boxShadow: '0 0 6px rgba(0,229,180,0.65)' }
                    : undefined
                }
              />
              {/* Connector */}
              {i < stages.length - 1 && (
                <div
                  className={`h-px w-5 ${i < 2 ? 'bg-brand/50' : 'bg-surface-border'}`}
                />
              )}
            </div>
          ))}
        </div>
        <p className="text-brand text-[10px] font-semibold tracking-[0.18em] uppercase">
          Arrived
        </p>
      </div>
    </div>
  );
}

const ILLUSTRATIONS = [
  CalibrationIllustration,
  LocationIllustration,
  TrackingIllustration,
] as const;

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function OnboardingPage() {
  const router = useRouter();

  const [step, setStep] = useState(0);
  const [animKey, setAnimKey] = useState(0);
  const [direction, setDirection] = useState<'right' | 'left'>('right');

  const current = STEPS[step];
  const isLast = step === STEPS.length - 1;
  const Illustration = ILLUSTRATIONS[step];

  function complete() {
    localStorage.setItem(ONBOARDING_KEY, '1');
    router.replace('/sign-in');
  }

  function goNext() {
    if (isLast) {
      complete();
    } else {
      setDirection('right');
      setAnimKey((k) => k + 1);
      setStep((s) => s + 1);
    }
  }

  function goBack() {
    if (step === 0) return;
    setDirection('left');
    setAnimKey((k) => k + 1);
    setStep((s) => s - 1);
  }

  const slideClass =
    direction === 'right' ? 'animate-slide-in-right' : 'animate-slide-in-left';

  return (
    <div className="relative min-h-screen bg-surface-base flex flex-col items-center justify-between p-6 pb-10 select-none overflow-hidden">
      <AppBackdrop />

      {/* Skip — top right */}
      <div className="w-full flex justify-end pt-2 relative z-10">
        <button
          onClick={complete}
          className="text-text-muted text-sm hover:text-text-secondary transition-colors py-1 px-2"
        >
          Skip
        </button>
      </div>

      {/*
        Step content — key={animKey} forces React to unmount/remount this div
        on every step change, re-triggering the directional slide animation.
      */}
      <div
        key={animKey}
        className={`flex flex-col items-center gap-8 flex-1 justify-center w-full max-w-xs relative z-10 ${slideClass}`}
      >
        {/* Code-native illustration — zero screenshot PNGs */}
        <div className="flex items-center justify-center">
          <Illustration />
        </div>

        {/* Headline + subtext */}
        <div className="text-center space-y-3 px-2">
          <h2 className="text-2xl font-bold text-text-primary leading-tight">
            {current.headline}
          </h2>
          <p className="text-text-secondary text-sm leading-relaxed">{current.subtext}</p>
        </div>
      </div>

      {/* Bottom controls */}
      <div className="w-full max-w-xs space-y-5 relative z-10">

        {/* Progress dots — active expands to teal pill */}
        <div className="flex justify-center items-center gap-2">
          {STEPS.map((_, i) => (
            <div
              key={i}
              className={`rounded-full transition-all duration-300 ${
                i === step
                  ? 'w-6 h-2 bg-brand shadow-glow-sm'
                  : 'w-2 h-2 bg-surface-border'
              }`}
            />
          ))}
        </div>

        {/* Back / Next */}
        <div className="flex gap-3">
          {step > 0 && (
            <button
              onClick={goBack}
              className="flex-1 border border-surface-border text-text-secondary py-3.5 rounded-xl text-sm font-medium hover:border-brand/30 transition-all duration-200"
            >
              Back
            </button>
          )}
          <button
            onClick={goNext}
            className={`bg-brand text-surface-base font-semibold py-3.5 rounded-xl text-sm active:scale-[0.97] transition-all duration-200 ${
              step > 0 ? 'flex-1' : 'w-full'
            }`}
          >
            {isLast ? 'Get Started' : 'Next'}
          </button>
        </div>
      </div>
    </div>
  );
}
