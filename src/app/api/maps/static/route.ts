/**
 * GET /api/maps/static
 *
 * Server-side proxy for the Google Static Maps API.
 * The Maps API key is read from process.env.GOOGLE_MAPS_API_KEY (no NEXT_PUBLIC_
 * prefix) so it is never sent to the browser.
 *
 * Query params:
 *   lat  — destination latitude  (required, number -90..90)
 *   lng  — destination longitude (required, number -180..180)
 *   zoom — map zoom level        (optional, integer 0-21, default 15)
 *
 * Returns:
 *   The raw image bytes from Google with the original Content-Type header.
 *   Cached for 10 minutes at the CDN edge (Cache-Control: public, max-age=600).
 */

import type { NextRequest } from 'next/server';

export const runtime = 'nodejs';

const STATIC_MAPS_BASE = 'https://maps.googleapis.com/maps/api/staticmap';

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;

  const latStr  = searchParams.get('lat');
  const lngStr  = searchParams.get('lng');
  const zoomStr = searchParams.get('zoom');

  // ── Validate lat / lng ────────────────────────────────────────────────
  const lat = Number(latStr);
  const lng = Number(lngStr);

  if (!latStr || !lngStr || Number.isNaN(lat) || Number.isNaN(lng)) {
    return Response.json(
      { error: 'lat and lng are required and must be numbers' },
      { status: 400 },
    );
  }

  if (lat < -90 || lat > 90) {
    return Response.json({ error: 'lat must be between -90 and 90' }, { status: 400 });
  }

  if (lng < -180 || lng > 180) {
    return Response.json({ error: 'lng must be between -180 and 180' }, { status: 400 });
  }

  // ── Parse zoom (optional) ─────────────────────────────────────────────
  const rawZoom = parseInt(zoomStr ?? '15', 10);
  const zoom    = Number.isNaN(rawZoom) ? 15 : Math.min(21, Math.max(0, rawZoom));

  // ── API key ───────────────────────────────────────────────────────────
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey) {
    console.error('[maps/static] GOOGLE_MAPS_API_KEY is not set');
    return Response.json({ error: 'Maps API key not configured' }, { status: 500 });
  }

  // ── Build upstream URL ────────────────────────────────────────────────
  const params = new URLSearchParams({
    center:  `${lat},${lng}`,
    zoom:    String(zoom),
    size:    '640x360',
    scale:   '2',
    markers: `color:purple|${lat},${lng}`,
    key:     apiKey,
  });

  const upstreamUrl = `${STATIC_MAPS_BASE}?${params.toString()}`;

  // ── Proxy request ─────────────────────────────────────────────────────
  let upstream: Response;
  try {
    upstream = await fetch(upstreamUrl);
  } catch (err) {
    console.error('[maps/static] network error reaching Google:', err);
    return Response.json({ error: 'Failed to reach Google Maps' }, { status: 502 });
  }

  if (!upstream.ok) {
    console.error('[maps/static] Google returned', upstream.status, upstream.statusText);
    return Response.json({ error: 'Google Maps request failed' }, { status: 502 });
  }

  // ── Stream image back with caching ────────────────────────────────────
  const contentType = upstream.headers.get('Content-Type') ?? 'image/png';
  const imageBytes  = await upstream.arrayBuffer();

  return new Response(imageBytes, {
    status: 200,
    headers: {
      'Content-Type':  contentType,
      'Cache-Control': 'public, max-age=600',
    },
  });
}
