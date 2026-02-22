/**
 * GET /api/vehicles/decode-vin?vin=XXXXXXXXXXXXXXXX
 *
 * Proxies the NHTSA free VIN decode API (no API key required).
 * Validates the VIN, fetches NHTSA, extracts make/model/year/type.
 * Cached for 1 year — a VIN's decoded data never changes.
 */

interface NhtsaResult {
  Variable: string;
  Value: string | null;
}

function getField(results: NhtsaResult[], variable: string): string {
  return results.find((r) => r.Variable === variable)?.Value ?? '';
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const vin = searchParams.get('vin')?.toUpperCase().replace(/\s/g, '');

  // VIN must be exactly 17 chars, alphanumeric, no I / O / Q
  if (!vin || !/^[A-HJ-NPR-Z0-9]{17}$/.test(vin)) {
    return Response.json(
      { error: 'Invalid VIN. Must be 17 characters (no I, O, or Q).' },
      { status: 400 }
    );
  }

  try {
    const nhtsaUrl = `https://vpic.nhtsa.dot.gov/api/vehicles/decodevin/${vin}?format=json`;

    const nhtsaRes = await fetch(nhtsaUrl, {
      // VIN data is immutable — safe to cache for a very long time
      next: { revalidate: 86400 * 365 },
    });

    if (!nhtsaRes.ok) {
      return Response.json(
        { error: 'VIN lookup service unavailable. Please try again.' },
        { status: 502 }
      );
    }

    const data = await nhtsaRes.json();
    const results: NhtsaResult[] = data.Results ?? [];

    const make = getField(results, 'Make');
    const model = getField(results, 'Model');
    const yearStr = getField(results, 'Model Year');
    const vehicleType = getField(results, 'Vehicle Type');
    const year = parseInt(yearStr, 10);

    if (!make || !model || !year) {
      return Response.json(
        { error: 'VIN not recognized. Please check the number and try again.' },
        { status: 404 }
      );
    }

    return Response.json({ vin, make, model, year, vehicleType });
  } catch {
    return Response.json(
      { error: 'VIN lookup failed. Please try again.' },
      { status: 500 }
    );
  }
}
