'use client';

import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
  signInWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  type AuthError,
} from 'firebase/auth';
import { auth } from '@/lib/firebase/firebase';
import { getUserById } from '@/services/userService';

const googleProvider = new GoogleAuthProvider();

function getRoleDestination(role: string): string {
  if (role === 'technician') return '/queue';
  if (role === 'admin') return '/admin';
  return '/dashboard';
}

async function createSession(idToken: string): Promise<{ role: string } | null> {
  const res = await fetch('/api/auth/session', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ idToken }),
  });
  if (!res.ok) return null;
  return res.json();
}

export default function SignInPage() {
  return (
    <Suspense fallback={<div className="bg-surface-raised rounded-2xl p-6 h-64 animate-pulse" />}>
      <SignInForm />
    </Suspense>
  );
}

function SignInForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirect = searchParams.get('redirect');

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  async function handleEmailSignIn(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const cred = await signInWithEmailAndPassword(auth, email.trim(), password);
      const idToken = await cred.user.getIdToken();
      const session = await createSession(idToken);

      if (!session) {
        setError('Account setup incomplete. Please sign up to create your profile.');
        setLoading(false);
        return;
      }

      router.push(redirect || getRoleDestination(session.role));
    } catch (err) {
      const authErr = err as AuthError;
      if (
        authErr.code === 'auth/invalid-credential' ||
        authErr.code === 'auth/wrong-password' ||
        authErr.code === 'auth/user-not-found'
      ) {
        setError('Incorrect email or password.');
      } else if (authErr.code === 'auth/too-many-requests') {
        setError('Too many attempts. Please try again later.');
      } else {
        setError('Sign in failed. Please try again.');
      }
      setLoading(false);
    }
  }

  async function handleGoogleSignIn() {
    setError(null);
    setGoogleLoading(true);

    try {
      const cred = await signInWithPopup(auth, googleProvider);

      // Check if the user has a Firestore profile (completed sign-up)
      const userDoc = await getUserById(cred.user.uid);
      if (!userDoc) {
        // New Google user — redirect to sign-up to choose role
        router.push('/sign-up?google=true');
        return;
      }

      const idToken = await cred.user.getIdToken();
      const session = await createSession(idToken);
      if (!session) throw new Error('Session creation failed');

      router.push(redirect || getRoleDestination(session.role));
    } catch (err) {
      const authErr = err as AuthError;
      if (authErr.code !== 'auth/popup-closed-by-user') {
        setError('Google sign-in failed. Please try again.');
      }
      setGoogleLoading(false);
    }
  }

  return (
    <div className="bg-surface-raised rounded-2xl p-6 space-y-5 shadow-card">
      <div>
        <h2 className="text-xl font-semibold text-text-primary">Welcome back</h2>
        <p className="text-text-secondary text-sm mt-1">Sign in to your account</p>
      </div>

      {error && (
        <div className="bg-status-fault/10 border border-status-fault/30 rounded-xl px-4 py-3">
          <p className="text-status-fault text-sm">{error}</p>
        </div>
      )}

      <form onSubmit={handleEmailSignIn} className="space-y-4">
        <div className="space-y-1">
          <label className="block text-text-secondary text-sm font-medium">Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            required
            autoComplete="email"
            className="w-full bg-surface-overlay border border-surface-border rounded-xl px-4 py-3 text-text-primary placeholder-text-muted focus:outline-none focus:border-brand transition-colors"
          />
        </div>

        <div className="space-y-1">
          <label className="block text-text-secondary text-sm font-medium">Password</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            required
            autoComplete="current-password"
            className="w-full bg-surface-overlay border border-surface-border rounded-xl px-4 py-3 text-text-primary placeholder-text-muted focus:outline-none focus:border-brand transition-colors"
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-brand hover:bg-brand-dark active:scale-[0.98] transition-all rounded-xl py-3 font-semibold text-surface-base disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? 'Signing in…' : 'Sign In'}
        </button>
      </form>

      <div className="flex items-center gap-3">
        <div className="flex-1 h-px bg-surface-border" />
        <span className="text-text-muted text-xs">or</span>
        <div className="flex-1 h-px bg-surface-border" />
      </div>

      <button
        onClick={handleGoogleSignIn}
        disabled={googleLoading}
        className="w-full flex items-center justify-center gap-3 bg-surface-overlay border border-surface-border hover:border-text-muted active:scale-[0.98] transition-all rounded-xl py-3 text-text-primary font-medium disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <GoogleIcon />
        {googleLoading ? 'Signing in…' : 'Continue with Google'}
      </button>

      <p className="text-center text-text-secondary text-sm">
        New to RevvDoc?{' '}
        <Link href="/sign-up" className="text-brand hover:text-brand-light transition-colors font-medium">
          Create account
        </Link>
      </p>

      <p className="text-center text-text-secondary text-sm">
        Have a phone number?{' '}
        <Link href="/verify-phone" className="text-brand hover:text-brand-light transition-colors font-medium">
          Sign in with SMS
        </Link>
      </p>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05" />
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
    </svg>
  );
}
