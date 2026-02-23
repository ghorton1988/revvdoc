'use client';

/**
 * Landing / root page.
 *
 * First-time users: redirected to /onboarding (localStorage gate).
 * Returning users: see sign-in / create account CTAs.
 * Authenticated users: middleware redirects them to /dashboard or /queue before this renders.
 */

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { BrandMark } from '@/components/ui/BrandMark';
import { AppBackdrop } from '@/components/ui/AppBackdrop';
import { ONBOARDING_KEY } from '@/lib/onboarding';

export default function LandingPage() {
  const router = useRouter();
  // Prevent flash of landing content before the gate check resolves
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (localStorage.getItem(ONBOARDING_KEY) !== '1') {
      router.replace('/onboarding');
    } else {
      setReady(true);
    }
  }, [router]);

  // Render nothing until we know the user has seen onboarding
  if (!ready) return null;

  return (
    <div className="relative min-h-screen bg-surface-base flex flex-col items-center justify-center p-6 text-center overflow-hidden">
      <AppBackdrop />
      <div className="space-y-6 w-full max-w-xs animate-fade-up">

        {/* BrandMark — logo dissolves into background via mix-blend-screen */}
        <div className="flex flex-col items-center gap-3">
          <BrandMark size={220} />
          <p className="text-text-secondary text-sm tracking-wide">Mobile Vehicle Service</p>
        </div>

        {/* Tagline */}
        <p className="text-text-muted text-sm leading-relaxed">
          On-demand mechanics &amp; detailers that come to you.
        </p>

        {/* Auth CTAs */}
        <div className="space-y-3">
          <Link
            href="/sign-in"
            className="block w-full bg-brand text-surface-base font-semibold py-3 rounded-xl text-sm"
          >
            Sign In
          </Link>
          <Link
            href="/sign-up"
            className="block w-full border border-surface-border hover:border-brand/40 text-text-secondary hover:text-text-primary py-3 rounded-xl text-sm transition-all duration-200"
          >
            Create Account
          </Link>
        </div>
      </div>
    </div>
  );
}
