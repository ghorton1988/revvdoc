'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { useNotifications } from '@/hooks/useNotifications';

const NAV_ITEMS = [
  {
    href: '/dashboard',
    label: 'Home',
    svgPath: 'M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25',
  },
  {
    href: '/services',
    label: 'Book',
    svgPath: 'M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5',
  },
  {
    href: '/history',
    label: 'History',
    svgPath: 'M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z',
  },
  {
    href: '/profile',
    label: 'Profile',
    svgPath: 'M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z',
  },
];

export default function CustomerLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { user } = useAuth();
  const { unreadCount } = useNotifications(user?.uid ?? null);

  return (
    <div className="min-h-screen bg-surface-base flex flex-col">
      {/* Top bar */}
      <header className="sticky top-0 z-40 bg-surface-raised border-b border-surface-border">
        <div className="max-w-lg mx-auto px-4 h-14 flex items-center justify-between">
          <span className="font-bold tracking-widest text-brand-gradient text-sm">REVVDOC</span>
          <Link href="/notifications" className="relative p-2 -mr-2 text-text-secondary hover:text-text-primary transition-colors">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
            </svg>
            {unreadCount > 0 && (
              <span className="absolute top-1 right-1 min-w-[16px] h-4 bg-status-fault text-white text-[10px] font-bold rounded-full flex items-center justify-center px-0.5 leading-none">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </Link>
        </div>
      </header>

      {/* Page content — keyed by pathname so animate-fade-up re-triggers on every navigation */}
      <main className="flex-1 pb-20">
        <div key={pathname} className="max-w-lg mx-auto animate-fade-up">
          {children}
        </div>
      </main>

      {/* Bottom navigation */}
      <nav className="fixed bottom-0 inset-x-0 z-40 bg-surface-raised border-t border-surface-border pb-safe">
        <div className="max-w-lg mx-auto flex items-stretch h-16">
          {NAV_ITEMS.map(({ href, label, svgPath }) => {
            const isActive =
              pathname === href ||
              (href !== '/dashboard' && pathname.startsWith(href + '/')) ||
              (href !== '/dashboard' && pathname === href);
            return (
              <Link
                key={href}
                href={href}
                className={`relative flex-1 flex flex-col items-center justify-center gap-0.5 text-xs font-medium transition-all duration-200 ${
                  isActive ? 'text-brand' : 'text-text-muted hover:text-text-secondary'
                }`}
              >
                {/* Active indicator — always rendered; width transitions 0→6 on active */}
                <span
                  className={`absolute top-0 left-1/2 -translate-x-1/2 h-0.5 bg-brand rounded-full transition-all duration-300 ease-out ${
                    isActive ? 'w-6 shadow-glow-sm' : 'w-0'
                  }`}
                />
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                  <path d={svgPath} />
                </svg>
                <span>{label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
