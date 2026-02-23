/**
 * Next.js Middleware — Auth + Role Guards
 *
 * Runs on every matched request before the page renders.
 * Reads the Firebase session cookie, verifies the ID token using the
 * Firebase Admin SDK, and redirects based on authentication state and role.
 *
 * NOTE: Middleware runs in the Edge runtime. Firebase Admin SDK uses Node.js
 * APIs and cannot run in Edge. The session cookie verification here uses a
 * lightweight check: we read the user's role from the cookie claims rather
 * than hitting Firestore on every request.
 *
 * Implementation strategy for MVP:
 * - Store role in a separate lightweight cookie (set at sign-in via an API route)
 * - Middleware reads the role cookie for fast routing decisions
 * - The actual ID token is verified in individual API Route Handlers
 *   using the Admin SDK (Node.js runtime)
 */

import { NextResponse, type NextRequest } from 'next/server';

// Routes accessible without authentication
const PUBLIC_PATHS = [
  '/',               // Landing page — shows sign-in CTA if not authed
  '/sign-in',
  '/sign-up',
  '/verify-phone',
  '/onboarding',     // First-run carousel (localStorage-gated client-side)
];

// Route prefixes and the role required to access them
const ROLE_PROTECTED: Array<{ prefix: string; role: string }> = [
  { prefix: '/dashboard',       role: 'customer' },
  { prefix: '/vehicles',        role: 'customer' },
  { prefix: '/services',        role: 'customer' },
  { prefix: '/book',            role: 'customer' },
  { prefix: '/bookings',        role: 'customer' },
  { prefix: '/jobs',            role: 'customer' },
  { prefix: '/history',         role: 'customer' },
  { prefix: '/notifications',   role: 'customer' },
  { prefix: '/payment-methods', role: 'customer' },
  // /profile is a top-level shared page — handled separately below
  { prefix: '/queue',           role: 'technician' },
  { prefix: '/active-job',      role: 'technician' },
  { prefix: '/job-history',     role: 'technician' },
  { prefix: '/admin',           role: 'admin' },
];

export function middleware(request: NextRequest): NextResponse {
  const { pathname } = request.nextUrl;

  // Skip middleware for Next.js internals and static assets
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api') ||
    pathname.includes('.')
  ) {
    return NextResponse.next();
  }

  // Read auth cookies set at sign-in (by /api/auth/session Route Handler)
  const authToken = request.cookies.get('__session')?.value;
  const userRole = request.cookies.get('__role')?.value;

  const isAuthenticated = Boolean(authToken);
  const isPublicPath = PUBLIC_PATHS.some(
    (p) => pathname === p || pathname.startsWith(p + '/')
  );

  // Redirect unauthenticated users away from protected routes
  if (!isAuthenticated && !isPublicPath) {
    const signInUrl = new URL('/sign-in', request.url);
    signInUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(signInUrl);
  }

  // Redirect authenticated users away from auth pages
  if (isAuthenticated && (pathname === '/sign-in' || pathname === '/sign-up')) {
    const destination = userRole === 'technician' ? '/queue' : '/dashboard';
    return NextResponse.redirect(new URL(destination, request.url));
  }

  // /profile is accessible to any authenticated user (customer or technician)
  if (isAuthenticated && pathname.startsWith('/profile')) {
    return NextResponse.next();
  }

  // Role-based access control
  if (isAuthenticated && userRole) {
    const matchedRoute = ROLE_PROTECTED.find((r) => pathname.startsWith(r.prefix));

    if (matchedRoute && matchedRoute.role !== userRole) {
      // Wrong role — redirect to their own dashboard
      const destination = userRole === 'technician' ? '/queue'
        : userRole === 'admin' ? '/admin'
        : '/dashboard';
      return NextResponse.redirect(new URL(destination, request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all paths except:
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - favicon.ico
     * - public folder files
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
