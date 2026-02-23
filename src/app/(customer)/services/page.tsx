'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { getAllActiveServices } from '@/services/serviceService';
import { formatPrice, formatDuration } from '@/lib/formatters';
import type { Service, ServiceCategory } from '@/types';

type Tab = 'all' | ServiceCategory;

const TABS: { key: Tab; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'mechanic', label: 'Mechanic' },
  { key: 'detailing', label: 'Detailing' },
  { key: 'diagnostic', label: 'Diagnostic' },
];

const CATEGORY_LABELS: Record<ServiceCategory, string> = {
  mechanic: 'Mechanic',
  detailing: 'Detailing',
  diagnostic: 'Diagnostic',
};

export default function ServicesPage() {
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>('all');

  useEffect(() => {
    getAllActiveServices()
      .then(setServices)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const displayed =
    activeTab === 'all'
      ? services
      : services.filter((s) => s.category === activeTab);

  return (
    <div className="space-y-0">
      {/* Header */}
      <div className="px-4 pt-6 pb-4">
        <h1 className="text-2xl font-bold text-text-primary">Services</h1>
        <p className="text-text-secondary text-sm mt-1">Mobile vehicle service at your door</p>
      </div>

      {/* Category tabs */}
      <div className="flex gap-2 px-4 pb-4 overflow-x-auto scrollbar-hide">
        {TABS.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={`flex-shrink-0 px-4 py-2 rounded-full text-sm font-medium transition-all ${
              activeTab === key
                ? 'bg-brand text-surface-base'
                : 'bg-surface-raised text-text-secondary hover:text-text-primary border border-surface-border'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Service list */}
      <div className="px-4 space-y-3 pb-4">
        {loading ? (
          <>
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-32 bg-surface-raised rounded-2xl animate-pulse" />
            ))}
          </>
        ) : displayed.length === 0 ? (
          <div className="bg-surface-raised rounded-2xl p-8 text-center">
            <p className="text-text-secondary">No services available in this category.</p>
          </div>
        ) : (
          displayed.map((service) => (
            <ServiceCard key={service.serviceId} service={service} />
          ))
        )}
      </div>
    </div>
  );
}

function ServiceCard({ service }: { service: Service }) {
  return (
    <div className="bg-surface-raised rounded-2xl p-4 border border-surface-border space-y-3 hover:-translate-y-0.5 hover:shadow-glow-sm hover:border-brand/30 transition-all duration-200">
      {/* Category badge + title row */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <span className="text-xs font-medium text-text-muted uppercase tracking-wide">
            {CATEGORY_LABELS[service.category]}
          </span>
          <h3 className="text-text-primary font-semibold leading-snug">{service.name}</h3>
        </div>
        <div className="flex-shrink-0 text-right">
          <p className="text-brand font-bold text-lg">{formatPrice(service.basePrice)}</p>
          <p className="text-text-muted text-xs">{formatDuration(service.durationMins)}</p>
        </div>
      </div>

      {/* Description */}
      {service.description && (
        <p className="text-text-secondary text-sm leading-relaxed">{service.description}</p>
      )}

      {/* Book CTA */}
      <Link
        href={`/book?serviceId=${service.serviceId}`}
        className="block w-full text-center bg-brand hover:bg-brand-dark active:scale-[0.97] transition-all rounded-xl py-2.5 font-semibold text-surface-base text-sm"
      >
        Book Now
      </Link>
    </div>
  );
}
