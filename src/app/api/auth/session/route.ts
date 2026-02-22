/**
 * /api/auth/session — Session cookie management.
 *
 * POST: Exchanges a Firebase ID token for a server-side session cookie.
 *       Looks up the user's role from Firestore (not trusted from client).
 *       Sets __session (Firebase session cookie) + __role (for middleware routing).
 *
 * DELETE: Clears session cookies on sign-out.
 */

import { NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase/firebaseAdmin';
import type { UserRole } from '@/types';

// 7 days in milliseconds
const SESSION_DURATION_MS = 60 * 60 * 24 * 7 * 1000;

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { idToken } = body as { idToken?: string };

    if (!idToken || typeof idToken !== 'string') {
      return NextResponse.json({ error: 'Missing idToken' }, { status: 400 });
    }

    // Verify the ID token with Firebase Admin
    const decodedToken = await adminAuth.verifyIdToken(idToken);
    const uid = decodedToken.uid;

    // Fetch user role from Firestore — never trust the client for role
    const userSnap = await adminDb.collection('users').doc(uid).get();
    if (!userSnap.exists) {
      return NextResponse.json(
        { error: 'User profile not found. Please complete sign-up.' },
        { status: 404 }
      );
    }

    const role = userSnap.data()?.role as UserRole;

    // Create a Firebase session cookie (httpOnly, server-verifiable)
    const sessionCookie = await adminAuth.createSessionCookie(idToken, {
      expiresIn: SESSION_DURATION_MS,
    });

    const response = NextResponse.json({ success: true, role });

    // __session: httpOnly — not readable by JS, verified server-side
    response.cookies.set('__session', sessionCookie, {
      maxAge: SESSION_DURATION_MS / 1000,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
    });

    // __role: readable by Edge middleware for fast routing decisions
    response.cookies.set('__role', role, {
      maxAge: SESSION_DURATION_MS / 1000,
      httpOnly: false,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
    });

    return response;
  } catch (error) {
    console.error('[api/auth/session POST]', error);
    return NextResponse.json({ error: 'Authentication failed' }, { status: 401 });
  }
}

export async function DELETE() {
  const response = NextResponse.json({ success: true });

  // Clear both cookies
  response.cookies.set('__session', '', { maxAge: 0, path: '/' });
  response.cookies.set('__role', '', { maxAge: 0, path: '/' });

  return response;
}
