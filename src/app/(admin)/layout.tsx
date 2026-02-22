import type { ReactNode } from 'react';

// Admin layout uses sidebar nav (desktop-first, different from mobile bottom nav)

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-surface-base flex">
      {/* Sidebar */}
      <aside className="w-56 bg-surface-raised border-r border-surface-border flex flex-col p-4 gap-2">
        <div className="text-brand font-bold tracking-widest text-sm mb-4">REVVDOC ADMIN</div>
        {['Dashboard', 'Bookings', 'Users', 'Services'].map((label) => (
          <button
            key={label}
            className="text-left text-text-secondary text-sm py-2 px-3 rounded-lg hover:bg-surface-overlay"
          >
            {label}
          </button>
        ))}
      </aside>
      {/* Main */}
      <main className="flex-1 p-6 overflow-auto">{children}</main>
    </div>
  );
}
