'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { signOut } from 'firebase/auth';
import { auth } from '@/lib/firebase/firebase';
import { useAuth } from '@/hooks/useAuth';

export default function ProfilePage() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const [signingOut, setSigningOut] = useState(false);

  async function handleSignOut() {
    setSigningOut(true);
    try {
      // Clear server session cookie
      await fetch('/api/auth/session', { method: 'DELETE' });
      // Sign out of Firebase Auth client
      await signOut(auth);
      router.push('/sign-in');
    } catch (err) {
      console.error('[ProfilePage] Sign-out failed:', err);
      setSigningOut(false);
    }
  }

  const backHref = user?.role === 'technician' ? '/queue' : '/dashboard';

  if (loading) {
    return (
      <div className="min-h-screen bg-surface-base">
        <div className="max-w-lg mx-auto p-4 space-y-4 animate-pulse">
          <div className="h-14 bg-surface-raised rounded-2xl" />
          <div className="h-32 bg-surface-raised rounded-2xl" />
          <div className="h-24 bg-surface-raised rounded-2xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface-base">
      <div className="max-w-lg mx-auto">
        {/* Header */}
        <div className="sticky top-0 z-40 bg-surface-raised border-b border-surface-border px-4 h-14 flex items-center gap-3">
          <Link href={backHref} className="p-1 -ml-1 text-text-secondary hover:text-text-primary transition-colors">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </Link>
          <h1 className="text-lg font-bold text-text-primary">Profile</h1>
        </div>

        <div className="p-4 space-y-4">
          {/* User info card */}
          <div className="bg-surface-raised rounded-2xl p-5 space-y-4">
            {/* Avatar + name */}
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-full bg-brand/20 flex items-center justify-center flex-shrink-0">
                {user?.photoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={user.photoUrl} alt={user.name} className="w-14 h-14 rounded-full object-cover" />
                ) : (
                  <span className="text-brand font-bold text-xl">
                    {user?.name?.charAt(0).toUpperCase() ?? '?'}
                  </span>
                )}
              </div>
              <div className="min-w-0">
                <p className="text-text-primary font-bold text-lg truncate">{user?.name}</p>
                <p className="text-text-secondary text-sm truncate">{user?.email}</p>
              </div>
            </div>

            {/* Role badge */}
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-brand/20 text-brand capitalize">
                {user?.role}
              </span>
            </div>

            {/* Details */}
            <div className="space-y-3 border-t border-surface-border pt-4">
              <InfoRow label="Email" value={user?.email ?? '—'} />
              <InfoRow label="Phone" value={user?.phone ?? 'Not added'} />
            </div>
          </div>

          {/* Account actions */}
          <div className="bg-surface-raised rounded-2xl overflow-hidden">
            {user?.role === 'technician' && (
              <Link
                href="/queue"
                className="flex items-center justify-between px-5 py-4 border-b border-surface-border hover:bg-surface-overlay transition-colors"
              >
                <span className="text-text-primary font-medium">Job Queue</span>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-text-muted">
                  <path d="M9 18l6-6-6-6" />
                </svg>
              </Link>
            )}

            {user?.role === 'customer' && (
              <>
                <Link
                  href="/payment-methods"
                  className="flex items-center justify-between px-5 py-4 border-b border-surface-border hover:bg-surface-overlay transition-colors"
                >
                  <span className="text-text-primary font-medium">Payment Methods</span>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-text-muted">
                    <path d="M9 18l6-6-6-6" />
                  </svg>
                </Link>
                <Link
                  href="/vehicles"
                  className="flex items-center justify-between px-5 py-4 border-b border-surface-border hover:bg-surface-overlay transition-colors"
                >
                  <span className="text-text-primary font-medium">My Vehicles</span>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-text-muted">
                    <path d="M9 18l6-6-6-6" />
                  </svg>
                </Link>
              </>
            )}
          </div>

          {/* Sign out */}
          <button
            onClick={handleSignOut}
            disabled={signingOut}
            className="w-full flex items-center justify-center gap-2 bg-status-fault/10 border border-status-fault/30 hover:bg-status-fault/20 active:scale-[0.98] transition-all rounded-2xl py-4 text-status-fault font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9" />
            </svg>
            {signingOut ? 'Signing out…' : 'Sign Out'}
          </button>
        </div>
      </div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-text-secondary text-sm">{label}</span>
      <span className="text-text-primary text-sm truncate ml-4 max-w-[60%] text-right">{value}</span>
    </div>
  );
}
