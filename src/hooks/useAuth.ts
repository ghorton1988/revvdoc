'use client';

/**
 * useAuth — Firebase Auth state with Firestore role resolution.
 *
 * Listens to Firebase Auth state changes. On sign-in, fetches the user's
 * Firestore document to resolve their role. Returns user + loading state.
 *
 * Use this hook in layouts and protected pages to gate access by role.
 */

import { useState, useEffect } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '@/lib/firebase/firebase';
import { getUserById } from '@/services/userService';
import type { User } from '@/types';

export interface AuthState {
  user: User | null;
  loading: boolean;
}

export function useAuth(): AuthState {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (!firebaseUser) {
        setUser(null);
        setLoading(false);
        return;
      }

      try {
        const userDoc = await getUserById(firebaseUser.uid);
        setUser(userDoc);
      } catch (err) {
        console.error('[useAuth] Failed to fetch user doc:', err);
        setUser(null);
      } finally {
        setLoading(false);
      }
    });

    return unsubscribe;
  }, []);

  return { user, loading };
}
