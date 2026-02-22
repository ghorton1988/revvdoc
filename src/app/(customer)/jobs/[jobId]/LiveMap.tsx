'use client';

/**
 * LiveMap — Google Maps component for real-time technician tracking.
 * Dynamically imported (no SSR) by the parent live job page.
 *
 * Key design decision: we use a ref to hold the Google Maps Marker and call
 * marker.setPosition() on GPS updates rather than re-rendering the map.
 * This prevents the map from flickering or re-centering on every GPS write.
 */

import { useEffect, useRef } from 'react';
import { GoogleMap, useJsApiLoader } from '@react-google-maps/api';
import { MAPS_API_KEY, MAPS_LIBRARIES, DARK_MAP_OPTIONS } from '@/lib/maps/googleMaps';

interface LiveMapProps {
  techLat: number | null;
  techLng: number | null;
  destLat: number;
  destLng: number;
}

const MAP_CONTAINER_STYLE = { width: '100%', height: '100%' };

// Default center: Austin, TX (fallback when no coordinates available)
const DEFAULT_CENTER = { lat: 30.2672, lng: -97.7431 };

export default function LiveMap({ techLat, techLng, destLat, destLng }: LiveMapProps) {
  const { isLoaded, loadError } = useJsApiLoader({
    googleMapsApiKey: MAPS_API_KEY,
    libraries: MAPS_LIBRARIES,
  });

  const mapRef = useRef<google.maps.Map | null>(null);
  const techMarkerRef = useRef<google.maps.Marker | null>(null);
  const destMarkerRef = useRef<google.maps.Marker | null>(null);

  const hasTechLocation = techLat !== null && techLng !== null;
  const hasDestLocation = destLat !== 0 || destLng !== 0;

  const center = hasTechLocation
    ? { lat: techLat!, lng: techLng! }
    : hasDestLocation
    ? { lat: destLat, lng: destLng }
    : DEFAULT_CENTER;

  function onMapLoad(map: google.maps.Map) {
    mapRef.current = map;

    // Destination marker (customer's address) — gold pin
    if (hasDestLocation) {
      destMarkerRef.current = new google.maps.Marker({
        position: { lat: destLat, lng: destLng },
        map,
        title: 'Service Location',
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          scale: 10,
          fillColor: '#D4A843',
          fillOpacity: 1,
          strokeColor: '#0A0A0A',
          strokeWeight: 2,
        },
      });
    }

    // Tech marker — white dot with pulse effect emulated via scale
    if (hasTechLocation) {
      techMarkerRef.current = new google.maps.Marker({
        position: { lat: techLat!, lng: techLng! },
        map,
        title: 'Technician',
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          scale: 8,
          fillColor: '#FFFFFF',
          fillOpacity: 1,
          strokeColor: '#D4A843',
          strokeWeight: 3,
        },
      });
    }
  }

  // Update tech marker position without re-rendering the map
  useEffect(() => {
    if (!techMarkerRef.current || techLat === null || techLng === null) return;
    techMarkerRef.current.setPosition({ lat: techLat, lng: techLng });
  }, [techLat, techLng]);

  // Fit bounds to show both markers when both are available
  useEffect(() => {
    if (!mapRef.current || !hasTechLocation || !hasDestLocation) return;
    const bounds = new google.maps.LatLngBounds();
    bounds.extend({ lat: techLat!, lng: techLng! });
    bounds.extend({ lat: destLat, lng: destLng });
    mapRef.current.fitBounds(bounds, { top: 60, right: 40, bottom: 40, left: 40 });
  }, [techLat, techLng, destLat, destLng, hasTechLocation, hasDestLocation]);

  if (loadError) {
    return (
      <div className="flex-1 bg-surface-raised flex items-center justify-center text-text-muted text-sm">
        Map failed to load.
      </div>
    );
  }

  if (!isLoaded) {
    return (
      <div className="flex-1 bg-surface-raised flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-brand border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="w-full h-full">
      <GoogleMap
        mapContainerStyle={MAP_CONTAINER_STYLE}
        center={center}
        zoom={14}
        options={DARK_MAP_OPTIONS}
        onLoad={onMapLoad}
      >
        {/* Markers are managed imperatively via refs above */}
      </GoogleMap>
    </div>
  );
}
