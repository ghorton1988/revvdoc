import type { ReactNode } from 'react';
import { BrandMark } from '@/components/ui/BrandMark';
import { PageTransition } from '@/components/ui/PageTransition';
import { AppBackdrop } from '@/components/ui/AppBackdrop';

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="relative min-h-screen bg-surface-base flex items-center justify-center p-4 overflow-hidden">
      <AppBackdrop />
      <div className="w-full max-w-sm">
        {/* BrandMark — gauge dissolves into dark background (no square edge) */}
        <div className="flex flex-col items-center mb-8 gap-2">
          <BrandMark size={110} />
          <p className="text-text-secondary text-xs tracking-widest uppercase">
            Mobile Vehicle Service
          </p>
        </div>
        <PageTransition>{children}</PageTransition>
      </div>
    </div>
  );
}
