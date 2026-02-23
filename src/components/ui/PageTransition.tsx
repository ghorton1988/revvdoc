'use client';

/**
 * PageTransition — Route-change animation wrapper.
 *
 * Keys a div by the current pathname so that every navigation within a
 * route group triggers a fresh animate-fade-up. Requires no external deps;
 * uses only the existing Tailwind animation utilities.
 *
 * Usage:
 *   Wrap {children} in a layout that wants page-entry animations.
 *   The layout itself stays mounted; only the keyed inner div re-animates.
 */

import type { ReactNode } from 'react';
import { usePathname } from 'next/navigation';

interface PageTransitionProps {
  children: ReactNode;
  className?: string;
}

export function PageTransition({ children, className = '' }: PageTransitionProps) {
  const pathname = usePathname();
  return (
    <div key={pathname} className={`animate-fade-up ${className}`}>
      {children}
    </div>
  );
}
