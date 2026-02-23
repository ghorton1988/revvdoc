/**
 * Weather helper — server-only (used in Route Handlers only).
 *
 * Uses Open-Meteo (https://open-meteo.com) — completely free, no API key.
 * Returns current conditions + risk flags for the RevvDoc vehicle dashboard.
 *
 * WMO Weather Code spec: https://open-meteo.com/en/docs#weathervariables
 *
 * IMPORTANT: server-only. Never import in components or hooks.
 */

import type { WeatherSnapshot, WeatherRiskFlags } from '@/types';

// ── WMO code → human-readable condition ──────────────────────────────────────

const WMO_CONDITION: Record<number, string> = {
  0:  'Clear sky',
  1:  'Mainly clear',
  2:  'Partly cloudy',
  3:  'Overcast',
  45: 'Foggy',
  48: 'Icy fog',
  51: 'Light drizzle',
  53: 'Moderate drizzle',
  55: 'Dense drizzle',
  56: 'Light freezing drizzle',
  57: 'Heavy freezing drizzle',
  61: 'Slight rain',
  63: 'Moderate rain',
  65: 'Heavy rain',
  66: 'Light freezing rain',
  67: 'Heavy freezing rain',
  71: 'Slight snowfall',
  73: 'Moderate snowfall',
  75: 'Heavy snowfall',
  77: 'Snow grains',
  80: 'Slight showers',
  81: 'Moderate showers',
  82: 'Violent showers',
  85: 'Slight snow showers',
  86: 'Heavy snow showers',
  95: 'Thunderstorm',
  96: 'Thunderstorm with hail',
  99: 'Heavy thunderstorm with hail',
};

function wmoCondition(code: number): string {
  return WMO_CONDITION[code] ?? `Weather code ${code}`;
}

// ── Open-Meteo response shape ─────────────────────────────────────────────────

interface OpenMeteoResponse {
  current: {
    temperature_2m: number;       // Fahrenheit (we request temperature_unit=fahrenheit)
    precipitation: number;        // mm
    snowfall: number;             // cm
    weather_code: number;         // WMO code
  };
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Fetches current weather for the given coordinates from Open-Meteo.
 * Throws on network failure or invalid coordinates.
 */
export async function fetchWeather(lat: number, lon: number): Promise<WeatherSnapshot> {
  const params = new URLSearchParams({
    latitude:          String(lat),
    longitude:         String(lon),
    current:           'temperature_2m,precipitation,snowfall,weather_code',
    temperature_unit:  'fahrenheit',
    timezone:          'auto',
  });

  const url = `https://api.open-meteo.com/v1/forecast?${params}`;
  const res = await fetch(url, { next: { revalidate: 0 } });

  if (!res.ok) {
    throw new Error(`Open-Meteo returned ${res.status}`);
  }

  const data: OpenMeteoResponse = await res.json();
  const cur = data.current;

  const temp     = cur.temperature_2m;
  const precip   = cur.precipitation;
  const snowfall = cur.snowfall;
  const code     = cur.weather_code;

  const riskFlags: WeatherRiskFlags = {
    coldRisk: temp <= 32,
    heatRisk: temp >= 90,
    rainRisk: precip > 0,
    snowRisk: snowfall > 0,
  };

  return {
    temp,
    precip,
    snowfall,
    condition: wmoCondition(code),
    riskFlags,
    fetchedAt: new Date(),
  };
}
