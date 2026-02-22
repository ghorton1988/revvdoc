import type { ReactNode } from 'react';

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-surface-base flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* RevvDoc wordmark */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold tracking-widest text-brand-gradient">
            REVVDOC
          </h1>
          <p className="text-text-secondary text-sm mt-1">Mobile Vehicle Service</p>
        </div>
        {children}
      </div>
    </div>
  );
}
