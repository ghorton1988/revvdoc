/**
 * Server-side geocoding utility.
 *
 * Uses the Google Geocoding REST API directly — no Maps JS SDK required.
 * Safe to import from any Next.js Route Handler (runtime = 'nodejs').
 * Never import this file in client components or hooks.
 *
 * Usage:
 *   const coords = await geocodeAddress('41554 Briarwood Cir, Leonardtown, MD 20650');
 *   if (coords) { // write coords.lat / coords.lng back to Firestore }
 */

export type GeoCoords = { lat: number; lng: number };

/**
 * Resolves a human-readable address string to { lat, lng }.
 *
 * - Reads NEXT_PUBLIC_GOOGLE_MAPS_API_KEY from process.env.
 * - Retries once on transient failure (network error or non-OK API status).
 * - Returns null if geocoding ultimately fails — never throws.
 */
export async function geocodeAddress(
  fullAddress: string,
): Promise<GeoCoords | null> {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  if (!apiKey) {
    console.error('[geocode] NEXT_PUBLIC_GOOGLE_MAPS_API_KEY is not configured');
    return null;
  }

  const url =
    `https://maps.googleapis.com/maps/api/geocode/json` +
    `?address=${encodeURIComponent(fullAddress)}&key=${apiKey}`;

  type GeoResponse = {
    status:  string;
    results: Array<{ geometry: { location: GeoCoords } }>;
  };

  async function attempt(): Promise<GeoCoords | null> {
    try {
      const res  = await fetch(url);
      const json = (await res.json()) as GeoResponse;
      if (json.status === 'OK' && json.results.length > 0) {
        return json.results[0].geometry.location;
      }
      console.warn(`[geocode] status "${json.status}" for "${fullAddress}"`);
      return null;
    } catch (err) {
      console.error('[geocode] fetch error:', err);
      return null;
    }
  }

  const first = await attempt();
  if (first) return first;

  console.warn(`[geocode] retrying "${fullAddress}"`);
  return attempt();
}

/**
 * Builds the full address string used for geocoding requests.
 * Exported so both route handlers produce identical query strings.
 */
export function buildAddressString(address: {
  street: string;
  city:   string;
  state:  string;
  zip:    string;
}): string {
  return `${address.street}, ${address.city}, ${address.state} ${address.zip}`;
}
