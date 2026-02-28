'use client';

/**
 * BookingLiveMap — compact embedded map for the booking detail page.
 *
 * Features:
 *  - Tech marker (white dot, teal stroke) — updated imperatively on GPS ticks
 *  - Destination marker (gold pin) — static service address
 *  - Route polyline — teal line following actual roads via DirectionsService
 *  - Auto-center — map fits to route bounds on load; no re-centering on GPS ticks
 *
 * Architecture:
 *  - All map objects are held in refs so GPS updates never cause a React re-render
 *    or a map flicker (same pattern as LiveMap in /jobs/[jobId]/LiveMap.tsx)
 *  - DirectionsService is called exactly once (guarded by routeFetchedRef)
 *  - If tech location arrives after the map has loaded, the marker + route are
 *    created in the GPS-update useEffect rather than onMapLoad
 *
 * Dynamically imported (SSR disabled) by the parent booking detail page.
 */

import { useEffect, useRef, useState } from 'react';
import { GoogleMap, useJsApiLoader } from '@react-google-maps/api';
import { MAPS_API_KEY, MAPS_LIBRARIES, DARK_MAP_OPTIONS } from '@/lib/maps/googleMaps';

// ─── DEBUG ─── Remove before shipping ─────────────────────────────────────────
// Mirrors the flag in the parent page.tsx.
// Shows a status badge over the map: "OK — route drawn" or "FAILED: REQUEST_DENIED"
const DEBUG_MAP = true;
// ──────────────────────────────────────────────────────────────────────────────

interface BookingLiveMapProps {
  techLat: number | null;
  techLng: number | null;
  destLat: number;
  destLng: number;
}

const MAP_CONTAINER_STYLE = { width: '100%', height: '100%' };

const COMPACT_MAP_OPTIONS = {
  ...DARK_MAP_OPTIONS,
  zoomControl: false,
  gestureHandling: 'none' as const,
};

// Default center: Austin, TX (shown only while neither coord is available)
const DEFAULT_CENTER = { lat: 30.2672, lng: -97.7431 };

// ─── Marker icon factories ─────────────────────────────────────────────────

function techIcon(): google.maps.Symbol {
  return {
    path: google.maps.SymbolPath.CIRCLE,
    scale: 8,
    fillColor: '#FFFFFF',
    fillOpacity: 1,
    strokeColor: '#00E5B4',
    strokeWeight: 3,
  };
}

function destIcon(): google.maps.Symbol {
  return {
    path: google.maps.SymbolPath.CIRCLE,
    scale: 10,
    fillColor: '#D4A843',
    fillOpacity: 1,
    strokeColor: '#0A0A0A',
    strokeWeight: 2,
  };
}

// ─── Component ────────────────────────────────────────────────────────────

export default function BookingLiveMap({ techLat, techLng, destLat, destLng }: BookingLiveMapProps) {
  const { isLoaded, loadError } = useJsApiLoader({
    googleMapsApiKey: MAPS_API_KEY,
    libraries: MAPS_LIBRARIES,
  });

  const mapRef           = useRef<google.maps.Map | null>(null);
  const techMarkerRef    = useRef<google.maps.Marker | null>(null);
  const destMarkerRef    = useRef<google.maps.Marker | null>(null);
  const routePolylineRef = useRef<google.maps.Polyline | null>(null);
  const routeFetchedRef  = useRef(false);

  // DEBUG: tracks the DirectionsService response status — remove with DEBUG_MAP
  const [directionsStatus, setDirectionsStatus] = useState<string | null>(null);

  const hasTechLocation = techLat !== null && techLng !== null;
  const hasDestLocation = destLat !== 0 || destLng !== 0;

  const initialCenter = hasTechLocation
    ? { lat: techLat!, lng: techLng! }
    : hasDestLocation
    ? { lat: destLat, lng: destLng }
    : DEFAULT_CENTER;

  // ── Route fetcher ─────────────────────────────────────────────────────
  //
  // Called at most once per component mount. Draws a teal Polyline along
  // real roads and fits the map to the route bounding box.
  // Falls back to a simple 2-point fitBounds if Directions fails.

  function fetchRoute(map: google.maps.Map, originLat: number, originLng: number) {
    if (routeFetchedRef.current || !hasDestLocation) return;
    routeFetchedRef.current = true;

    const service = new google.maps.DirectionsService();
    service.route(
      {
        origin:      { lat: originLat, lng: originLng },
        destination: { lat: destLat,   lng: destLng   },
        travelMode:  google.maps.TravelMode.DRIVING,
      },
      (result, status) => {
        if (status === 'OK' && result) {
          // Draw polyline along the route path
          routePolylineRef.current?.setMap(null);
          routePolylineRef.current = new google.maps.Polyline({
            path:         result.routes[0].overview_path,
            map,
            strokeColor:   '#00E5B4',
            strokeOpacity: 0.75,
            strokeWeight:  3,
            geodesic:      true,
          });
          // Fit map to the route bounding box
          map.fitBounds(result.routes[0].bounds, { top: 40, right: 32, bottom: 56, left: 32 });
          // DEBUG ─────────────────────────────────────────────────────────────
          if (DEBUG_MAP) setDirectionsStatus('OK — route drawn');
          // ───────────────────────────────────────────────────────────────────
        } else {
          // Always log Directions errors — REQUEST_DENIED means the API key
          // doesn't have Directions API enabled or is restricted too tightly.
          console.error('[BookingLiveMap] DirectionsService error:', status);
          // DEBUG ─────────────────────────────────────────────────────────────
          if (DEBUG_MAP) setDirectionsStatus(`FAILED: ${status}`);
          // ───────────────────────────────────────────────────────────────────
          // Fallback: manual 2-point fitBounds
          const bounds = new google.maps.LatLngBounds();
          bounds.extend({ lat: originLat, lng: originLng });
          bounds.extend({ lat: destLat,   lng: destLng   });
          map.fitBounds(bounds, { top: 32, right: 32, bottom: 32, left: 32 });
        }
      },
    );
  }

  // ── Map load ──────────────────────────────────────────────────────────
  //
  // Creates destination marker (always) and tech marker (if GPS is already
  // available at load time, e.g. when the user is navigating back to this page).

  function onMapLoad(map: google.maps.Map) {
    mapRef.current = map;

    if (hasDestLocation) {
      destMarkerRef.current = new google.maps.Marker({
        position: { lat: destLat, lng: destLng },
        map,
        title: 'Service Location',
        icon:  destIcon(),
      });
    }

    if (hasTechLocation) {
      techMarkerRef.current = new google.maps.Marker({
        position: { lat: techLat!, lng: techLng! },
        map,
        title: 'Technician',
        icon:  techIcon(),
      });
      fetchRoute(map, techLat!, techLng!);
    }
  }

  // ── GPS update effect ─────────────────────────────────────────────────
  //
  // Runs on every technician GPS write.
  //
  // Fast path (marker already exists): call setPosition() — no re-render.
  //
  // Slow path (tech location arrived after map load): create the marker
  // and kick off the one-time route fetch.

  useEffect(() => {
    if (techLat === null || techLng === null) return;

    if (techMarkerRef.current) {
      // Imperatively move the marker — map stays still, no React update
      techMarkerRef.current.setPosition({ lat: techLat, lng: techLng });
    } else if (mapRef.current) {
      // First GPS fix received after the map was already loaded
      techMarkerRef.current = new google.maps.Marker({
        position: { lat: techLat, lng: techLng },
        map:   mapRef.current,
        title: 'Technician',
        icon:  techIcon(),
      });
      fetchRoute(mapRef.current, techLat, techLng);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [techLat, techLng]);

  // ── Render ────────────────────────────────────────────────────────────

  if (loadError) {
    return (
      <div className="w-full h-full bg-surface-raised flex items-center justify-center text-text-muted text-xs">
        Map unavailable
      </div>
    );
  }

  if (!isLoaded) {
    return (
      <div className="w-full h-full bg-surface-raised flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-brand border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="w-full h-full relative">
      <GoogleMap
        mapContainerStyle={MAP_CONTAINER_STYLE}
        center={initialCenter}
        zoom={14}
        options={COMPACT_MAP_OPTIONS}
        onLoad={onMapLoad}
      />
      {/* DEBUG: DirectionsService status badge — remove with DEBUG_MAP ──── */}
      {DEBUG_MAP && (
        <div className="absolute top-1.5 left-1.5 z-10 font-mono text-[9px] px-1.5 py-0.5 rounded
          bg-black/70 border border-white/20 leading-tight pointer-events-none">
          {directionsStatus === null && (
            <span className="text-yellow-300">directions: waiting…</span>
          )}
          {directionsStatus?.startsWith('OK') && (
            <span className="text-green-400">{directionsStatus}</span>
          )}
          {directionsStatus?.startsWith('FAILED') && (
            <span className="text-red-400">{directionsStatus}</span>
          )}
          <span className="text-white/40 ml-1">
            dest:{destLat ? destLat.toFixed(4) : 'MISSING'},{destLng ? destLng.toFixed(4) : 'MISSING'}
          </span>
        </div>
      )}
      {/* END DEBUG ──────────────────────────────────────────────────────── */}
    </div>
  );
}
