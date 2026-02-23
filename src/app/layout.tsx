import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { HudBackground } from '@/components/ui/HudBackground';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'RevvDoc — Mobile Vehicle Service',
  description: 'Book mobile mechanics and detailers for at-home vehicle service.',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'RevvDoc',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,   // Prevent zoom on mobile input focus
  themeColor: '#070E17',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.variable} antialiased bg-surface-base text-text-primary`}>
        <HudBackground />
        {children}
      </body>
    </html>
  );
}
