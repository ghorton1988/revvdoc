'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  signInWithPhoneNumber,
  RecaptchaVerifier,
  type ConfirmationResult,
  type AuthError,
} from 'firebase/auth';
import { auth } from '@/lib/firebase/firebase';
import { getUserById, createUser } from '@/services/userService';

declare global {
  interface Window {
    recaptchaVerifier?: RecaptchaVerifier;
  }
}

export default function VerifyPhonePage() {
  const router = useRouter();
  const recaptchaContainerRef = useRef<HTMLDivElement>(null);
  const confirmationRef = useRef<ConfirmationResult | null>(null);

  const [step, setStep] = useState<'phone' | 'otp'>('phone');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Initialize invisible reCAPTCHA once on mount
  useEffect(() => {
    const container = recaptchaContainerRef.current;
    if (!container || window.recaptchaVerifier) return;

    window.recaptchaVerifier = new RecaptchaVerifier(auth, container, {
      size: 'invisible',
      callback: () => {},
      'expired-callback': () => {
        setError('Security check expired. Please try again.');
        setLoading(false);
      },
    });

    return () => {
      window.recaptchaVerifier?.clear();
      window.recaptchaVerifier = undefined;
    };
  }, []);

  async function handleSendOTP(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    // Normalize to E.164 (+1 for US if no country code provided)
    const digits = phone.replace(/\D/g, '');
    const formatted = phone.startsWith('+') ? phone : `+1${digits}`;

    try {
      const verifier = window.recaptchaVerifier!;
      confirmationRef.current = await signInWithPhoneNumber(auth, formatted, verifier);
      setStep('otp');
    } catch (err) {
      const authErr = err as AuthError;
      if (authErr.code === 'auth/invalid-phone-number') {
        setError('Invalid phone number. Please use a US number or include a country code.');
      } else if (authErr.code === 'auth/too-many-requests') {
        setError('Too many attempts. Please try again later.');
      } else {
        setError('Could not send verification code. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleVerifyOTP(e: React.FormEvent) {
    e.preventDefault();
    if (!confirmationRef.current) return;
    setError(null);
    setLoading(true);

    try {
      const cred = await confirmationRef.current.confirm(otp.trim());

      // Check for existing Firestore profile
      const existingUser = await getUserById(cred.user.uid);
      let role = existingUser?.role ?? 'customer';

      // New phone user → create a default customer profile
      if (!existingUser) {
        await createUser(cred.user.uid, {
          role: 'customer',
          name: cred.user.displayName || 'User',
          email: cred.user.email || '',
          phone: cred.user.phoneNumber,
          photoUrl: null,
          stripeCustomerId: null,
        });
        role = 'customer';
      }

      // Create server session
      const idToken = await cred.user.getIdToken();
      const res = await fetch('/api/auth/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken }),
      });

      if (!res.ok) throw new Error('Session creation failed');

      const destination = role === 'technician' ? '/queue' : '/dashboard';
      router.push(destination);
    } catch (err) {
      const authErr = err as AuthError;
      if (authErr.code === 'auth/invalid-verification-code') {
        setError('Incorrect code. Please check and try again.');
      } else if (authErr.code === 'auth/code-expired') {
        setError('Code expired. Please request a new one.');
        setStep('phone');
        setOtp('');
      } else {
        setError('Verification failed. Please try again.');
      }
      setLoading(false);
    }
  }

  return (
    <div className="bg-surface-raised rounded-2xl p-6 space-y-5 shadow-card">
      {step === 'phone' ? (
        <>
          <div>
            <h2 className="text-xl font-semibold text-text-primary">Phone sign-in</h2>
            <p className="text-text-secondary text-sm mt-1">
              Enter your phone number to receive a one-time code
            </p>
          </div>

          {error && (
            <div className="bg-status-fault/10 border border-status-fault/30 rounded-xl px-4 py-3">
              <p className="text-status-fault text-sm">{error}</p>
            </div>
          )}

          <form onSubmit={handleSendOTP} className="space-y-4">
            <div className="space-y-1">
              <label className="block text-text-secondary text-sm font-medium">Phone number</label>
              <div className="flex items-center gap-2 bg-surface-overlay border border-surface-border rounded-xl px-4 py-3 focus-within:border-brand transition-colors">
                <span className="text-text-muted text-sm flex-shrink-0">+1</span>
                <div className="w-px h-4 bg-surface-border flex-shrink-0" />
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="(555) 123-4567"
                  required
                  autoComplete="tel"
                  className="flex-1 bg-transparent text-text-primary placeholder-text-muted focus:outline-none text-sm min-w-0"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-brand hover:bg-brand-dark active:scale-[0.98] transition-all rounded-xl py-3 font-semibold text-surface-base disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Sending code…' : 'Send Code'}
            </button>
          </form>

          <p className="text-center text-text-secondary text-sm">
            Prefer email?{' '}
            <Link href="/sign-in" className="text-brand hover:text-brand-light transition-colors font-medium">
              Sign in with email
            </Link>
          </p>
        </>
      ) : (
        <>
          <div>
            <h2 className="text-xl font-semibold text-text-primary">Enter your code</h2>
            <p className="text-text-secondary text-sm mt-1">
              We sent a 6-digit code to {phone || 'your phone'}
            </p>
          </div>

          {error && (
            <div className="bg-status-fault/10 border border-status-fault/30 rounded-xl px-4 py-3">
              <p className="text-status-fault text-sm">{error}</p>
            </div>
          )}

          <form onSubmit={handleVerifyOTP} className="space-y-4">
            <div className="space-y-1">
              <label className="block text-text-secondary text-sm font-medium">Verification code</label>
              <input
                type="text"
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="123456"
                required
                inputMode="numeric"
                autoComplete="one-time-code"
                className="w-full bg-surface-overlay border border-surface-border rounded-xl px-4 py-3 text-text-primary placeholder-text-muted focus:outline-none focus:border-brand transition-colors tracking-[0.5em] text-center text-xl font-mono"
              />
            </div>

            <button
              type="submit"
              disabled={loading || otp.length < 6}
              className="w-full bg-brand hover:bg-brand-dark active:scale-[0.98] transition-all rounded-xl py-3 font-semibold text-surface-base disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Verifying…' : 'Verify & Sign In'}
            </button>
          </form>

          <button
            onClick={() => { setStep('phone'); setOtp(''); setError(null); }}
            className="w-full text-center text-text-secondary text-sm hover:text-text-primary transition-colors"
          >
            Use a different number
          </button>
        </>
      )}

      {/* Invisible reCAPTCHA mount point */}
      <div ref={recaptchaContainerRef} />
    </div>
  );
}
