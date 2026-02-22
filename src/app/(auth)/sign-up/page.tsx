'use client';

import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
  createUserWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  updateProfile,
  type AuthError,
} from 'firebase/auth';
import { auth } from '@/lib/firebase/firebase';
import { createUser, getUserById } from '@/services/userService';
import type { UserRole } from '@/types';

const googleProvider = new GoogleAuthProvider();

function getRoleDestination(role: string): string {
  if (role === 'technician') return '/queue';
  if (role === 'admin') return '/admin';
  return '/dashboard';
}

async function createSession(idToken: string): Promise<{ role: string }> {
  const res = await fetch('/api/auth/session', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ idToken }),
  });
  if (!res.ok) throw new Error('Session creation failed');
  return res.json();
}

export default function SignUpPage() {
  return (
    <Suspense fallback={<div className="bg-surface-raised rounded-2xl p-6 h-64 animate-pulse" />}>
      <SignUpForm />
    </Suspense>
  );
}

function SignUpForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirect = searchParams.get('redirect');
  // google=true means user just signed in with Google and needs to pick a role
  const googleFlow = searchParams.get('google') === 'true';

  // 'form' = full sign-up form; 'role-only' = Google user just needs to pick role
  const [step, setStep] = useState<'form' | 'role-only'>(googleFlow ? 'role-only' : 'form');

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [role, setRole] = useState<UserRole>('customer');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  async function handleEmailSignUp(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError('Please enter your name.');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);

    try {
      const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
      await updateProfile(cred.user, { displayName: name.trim() });

      await createUser(cred.user.uid, {
        role,
        name: name.trim(),
        email: email.trim(),
        phone: null,
        photoUrl: null,
        stripeCustomerId: null,
      });

      const idToken = await cred.user.getIdToken();
      const session = await createSession(idToken);
      router.push(redirect || getRoleDestination(session.role));
    } catch (err) {
      const authErr = err as AuthError;
      if (authErr.code === 'auth/email-already-in-use') {
        setError('An account with this email already exists.');
      } else if (authErr.code === 'auth/invalid-email') {
        setError('Please enter a valid email address.');
      } else if (authErr.code === 'auth/weak-password') {
        setError('Password must be at least 8 characters.');
      } else {
        setError('Sign up failed. Please try again.');
      }
      setLoading(false);
    }
  }

  async function handleGoogleSignUp() {
    setError(null);
    setGoogleLoading(true);

    try {
      const cred = await signInWithPopup(auth, googleProvider);

      // If user already has a Firestore profile, sign them in directly
      const existingUser = await getUserById(cred.user.uid);
      if (existingUser) {
        const idToken = await cred.user.getIdToken();
        const session = await createSession(idToken);
        router.push(redirect || getRoleDestination(session.role));
        return;
      }

      // New Google user — pre-fill name/email and move to role selection
      setName(cred.user.displayName || '');
      setEmail(cred.user.email || '');
      setStep('role-only');
      setGoogleLoading(false);
    } catch (err) {
      const authErr = err as AuthError;
      if (authErr.code !== 'auth/popup-closed-by-user') {
        setError('Google sign-up failed. Please try again.');
      }
      setGoogleLoading(false);
    }
  }

  async function handleGoogleRoleConfirm() {
    setError(null);
    const currentUser = auth.currentUser;

    if (!currentUser) {
      setError('Session expired. Please sign in with Google again.');
      setStep('form');
      return;
    }

    setLoading(true);

    try {
      await createUser(currentUser.uid, {
        role,
        name: currentUser.displayName || name || 'User',
        email: currentUser.email || email || '',
        phone: currentUser.phoneNumber || null,
        photoUrl: currentUser.photoURL || null,
        stripeCustomerId: null,
      });

      const idToken = await currentUser.getIdToken();
      const session = await createSession(idToken);
      router.push(redirect || getRoleDestination(session.role));
    } catch {
      setError('Failed to create account. Please try again.');
      setLoading(false);
    }
  }

  // ── Role-only step (Google new users) ───────────────────────────────────────
  if (step === 'role-only') {
    return (
      <div className="bg-surface-raised rounded-2xl p-6 space-y-5 shadow-card">
        <div>
          <h2 className="text-xl font-semibold text-text-primary">
            {name ? `Welcome, ${name.split(' ')[0]}!` : 'One last step'}
          </h2>
          <p className="text-text-secondary text-sm mt-1">How will you use RevvDoc?</p>
        </div>

        {error && (
          <div className="bg-status-fault/10 border border-status-fault/30 rounded-xl px-4 py-3">
            <p className="text-status-fault text-sm">{error}</p>
          </div>
        )}

        <div className="space-y-3">
          {(['customer', 'technician'] as const).map((r) => (
            <button
              key={r}
              onClick={() => setRole(r)}
              className={`w-full flex items-start gap-4 p-4 rounded-xl border-2 transition-all text-left ${
                role === r
                  ? 'border-brand bg-brand/10'
                  : 'border-surface-border bg-surface-overlay hover:border-text-muted'
              }`}
            >
              <div
                className={`mt-0.5 w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                  role === r ? 'border-brand' : 'border-text-muted'
                }`}
              >
                {role === r && <div className="w-2.5 h-2.5 rounded-full bg-brand" />}
              </div>
              <div>
                <p className="font-semibold text-text-primary capitalize">{r}</p>
                <p className="text-text-secondary text-sm mt-0.5">
                  {r === 'customer'
                    ? 'Book mobile mechanics and detailers for your vehicles'
                    : 'Offer your services and accept jobs in your area'}
                </p>
              </div>
            </button>
          ))}
        </div>

        <button
          onClick={handleGoogleRoleConfirm}
          disabled={loading}
          className="w-full bg-brand hover:bg-brand-dark active:scale-[0.98] transition-all rounded-xl py-3 font-semibold text-surface-base disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? 'Creating account…' : 'Get Started'}
        </button>
      </div>
    );
  }

  // ── Full registration form ───────────────────────────────────────────────────
  return (
    <div className="bg-surface-raised rounded-2xl p-6 space-y-5 shadow-card">
      <div>
        <h2 className="text-xl font-semibold text-text-primary">Create account</h2>
        <p className="text-text-secondary text-sm mt-1">Join RevvDoc today</p>
      </div>

      {error && (
        <div className="bg-status-fault/10 border border-status-fault/30 rounded-xl px-4 py-3">
          <p className="text-status-fault text-sm">{error}</p>
        </div>
      )}

      <form onSubmit={handleEmailSignUp} className="space-y-4">
        <div className="space-y-1">
          <label className="block text-text-secondary text-sm font-medium">Full name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your name"
            required
            autoComplete="name"
            className="w-full bg-surface-overlay border border-surface-border rounded-xl px-4 py-3 text-text-primary placeholder-text-muted focus:outline-none focus:border-brand transition-colors"
          />
        </div>

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
            placeholder="Min. 8 characters"
            required
            autoComplete="new-password"
            className="w-full bg-surface-overlay border border-surface-border rounded-xl px-4 py-3 text-text-primary placeholder-text-muted focus:outline-none focus:border-brand transition-colors"
          />
        </div>

        <div className="space-y-1">
          <label className="block text-text-secondary text-sm font-medium">Confirm password</label>
          <input
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="••••••••"
            required
            autoComplete="new-password"
            className="w-full bg-surface-overlay border border-surface-border rounded-xl px-4 py-3 text-text-primary placeholder-text-muted focus:outline-none focus:border-brand transition-colors"
          />
        </div>

        {/* Role selection */}
        <div className="space-y-2">
          <label className="block text-text-secondary text-sm font-medium">I am a…</label>
          <div className="grid grid-cols-2 gap-2">
            {(['customer', 'technician'] as const).map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setRole(r)}
                className={`py-2.5 rounded-xl border-2 font-medium text-sm capitalize transition-all ${
                  role === r
                    ? 'border-brand bg-brand/10 text-brand'
                    : 'border-surface-border text-text-secondary hover:border-text-muted'
                }`}
              >
                {r}
              </button>
            ))}
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-brand hover:bg-brand-dark active:scale-[0.98] transition-all rounded-xl py-3 font-semibold text-surface-base disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? 'Creating account…' : 'Create Account'}
        </button>
      </form>

      <div className="flex items-center gap-3">
        <div className="flex-1 h-px bg-surface-border" />
        <span className="text-text-muted text-xs">or</span>
        <div className="flex-1 h-px bg-surface-border" />
      </div>

      <button
        onClick={handleGoogleSignUp}
        disabled={googleLoading}
        className="w-full flex items-center justify-center gap-3 bg-surface-overlay border border-surface-border hover:border-text-muted active:scale-[0.98] transition-all rounded-xl py-3 text-text-primary font-medium disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <GoogleIcon />
        {googleLoading ? 'Continuing…' : 'Continue with Google'}
      </button>

      <p className="text-center text-text-secondary text-sm">
        Already have an account?{' '}
        <Link href="/sign-in" className="text-brand hover:text-brand-light transition-colors font-medium">
          Sign in
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
