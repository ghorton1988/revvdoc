/* eslint-disable @typescript-eslint/no-unused-vars */
/**
 * Google Maps utilities.
 * The Maps JS API is loaded client-side via @react-google-maps/api LoadScript.
 * This file provides helper functions for geo calculations used in
 * GPS throttling and distance display.
 */

/**
 * Calculates the distance in meters between two geographic points
 * using the Haversine formula.
 * Used by TechLocationBroadcaster to throttle Firestore GPS writes.
 */
export function haversineDistanceMeters(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number }
): number {
  const R = 6_371_000; // Earth radius in meters
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const sinDLat = Math.sin(dLat / 2);
  const sinDLng = Math.sin(dLng / 2);
  const a_ =
    sinDLat * sinDLat +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * sinDLng * sinDLng;
  return R * 2 * Math.atan2(Math.sqrt(a_), Math.sqrt(1 - a_));
}

function toRad(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

/** Google Maps API key for use in LoadScript / useJsApiLoader */
export const MAPS_API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? '';

/** Libraries to load with the Maps JS API */
export const MAPS_LIBRARIES: ('places' | 'geometry')[] = ['places', 'geometry'];

/**
 * Default map options for the live job tracking map.
 * Dark-themed to match the RevvDoc design system.
 */
export const DARK_MAP_OPTIONS: google.maps.MapOptions = {
  disableDefaultUI: true,
  zoomControl: true,
  styles: [
    { elementType: 'geometry', stylers: [{ color: '#1a1a1a' }] },
    { elementType: 'labels.text.stroke', stylers: [{ color: '#0a0a0a' }] },
    { elementType: 'labels.text.fill', stylers: [{ color: '#a0a0a0' }] },
    {
      featureType: 'road',
      elementType: 'geometry',
      stylers: [{ color: '#2a2a2a' }],
    },
    {
      featureType: 'road',
      elementType: 'geometry.stroke',
      stylers: [{ color: '#1a1a1a' }],
    },
    {
      featureType: 'road.highway',
      elementType: 'geometry',
      stylers: [{ color: '#3a3a3a' }],
    },
    {
      featureType: 'poi',
      elementType: 'geometry',
      stylers: [{ color: '#1e1e1e' }],
    },
    {
      featureType: 'water',
      elementType: 'geometry',
      stylers: [{ color: '#0d1117' }],
    },
  ],
};
