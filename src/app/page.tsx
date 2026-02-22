import Link from 'next/link';

/**
 * Landing / root page.
 * Unauthenticated users land here and see sign-in / sign-up CTAs.
 * Middleware redirects authenticated users to /dashboard or /queue based on role.
 */
export default function LandingPage() {
  return (
    <div className="min-h-screen bg-surface-base flex flex-col items-center justify-center p-6 text-center">
      <div className="space-y-6 w-full max-w-xs">
        {/* Brand */}
        <div>
          <h1 className="text-4xl font-bold tracking-widest text-brand-gradient">
            REVVDOC
          </h1>
          <p className="text-text-secondary mt-2 text-sm">Mobile Vehicle Service</p>
        </div>

        {/* Build status card */}
        <div className="bg-surface-raised rounded-2xl p-4 text-left space-y-2">
          <p className="text-xs text-text-muted uppercase tracking-widest">Build Status</p>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-status-serviceDue animate-pulse" />
            <span className="text-sm text-text-secondary">Phase 2 — Scaffold complete</span>
          </div>
          <p className="text-xs text-text-muted">Phase 3 (Core Build) next</p>
        </div>

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
            className="block w-full border border-surface-border text-text-secondary py-3 rounded-xl text-sm"
          >
            Create Account
          </Link>
        </div>
      </div>
    </div>
  );
}
