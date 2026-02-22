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
            className="block w-full border border-surface-border text-text-secondary py-3 rounded-xl text-sm"
          >
            Create Account
          </Link>
        </div>
      </div>
    </div>
  );
}
