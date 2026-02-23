/**
 * POST /api/diagnose
 *
 * AI Troubleshooting Assistant — rule-based symptom analysis (MVP).
 *
 * 1. Verifies auth + vehicle ownership
 * 2. Extracts keyword-matched symptom tags from the description
 * 3. Matches keywords → serviceIds via SYMPTOM_KEYWORD_MAP
 * 4. Creates a SymptomReport in Firestore with matched serviceIds
 * 5. Fetches matching Service docs and returns them
 *
 * Body: { vehicleId: string; description: string }
 *
 * Returns: {
 *   reportId: string;
 *   symptoms: string[];            — extracted keyword tags
 *   recommendedServices: Service[]; — matched catalog services (may be empty)
 * }
 *
 * MVP NOTE: SYMPTOM_KEYWORD_MAP in symptomService.ts has empty serviceId arrays
 * until the service catalog is seeded with real IDs. recommendedServices will be []
 * until those are populated. The report is still created and stored.
 *
 * FUTURE: Replace matchSymptoms() with an LLM call when aiResponse slot is activated.
 *
 * Auth: Firebase ID token required in Authorization header.
 */

import { z } from 'zod';
import { FieldValue } from 'firebase-admin/firestore';
import { adminAuth, adminDb } from '@/lib/firebase/firebaseAdmin';
import { matchSymptoms } from '@/services/symptomService';
import type { Service, SymptomReportStatus } from '@/types';

export const runtime = 'nodejs';

const schema = z.object({
  vehicleId:   z.string().min(1),
  description: z.string().min(10, 'Please describe your symptoms in more detail (at least 10 characters)'),
});

/** Extracts lowercase keyword tags present in the description. */
function extractSymptomTags(description: string): string[] {
  const lower = description.toLowerCase();
  const KEYWORDS = [
    'oil', 'leak', 'smoke', 'overheating', 'brake', 'squeal', 'grinding',
    'tire', 'flat', 'alignment', 'battery', 'starter', 'alternator',
    'detail', 'wash', 'scratch', 'dent', 'noise', 'vibration', 'stall',
    'coolant', 'transmission', 'check engine', 'warning light',
  ];
  return KEYWORDS.filter((kw) => lower.includes(kw));
}

export async function POST(request: Request) {
  // 1. Verify Firebase ID token
  const authorization = request.headers.get('Authorization') ?? '';
  const idToken = authorization.replace('Bearer ', '');
  if (!idToken) {
    return Response.json({ error: 'Missing Authorization header' }, { status: 401 });
  }

  let decodedToken;
  try {
    decodedToken = await adminAuth.verifyIdToken(idToken);
  } catch {
    return Response.json({ error: 'Invalid token' }, { status: 401 });
  }

  // 2. Validate body
  let body;
  try {
    body = schema.parse(await request.json());
  } catch (err) {
    return Response.json({ error: 'Invalid request body', details: err }, { status: 400 });
  }

  const { vehicleId, description } = body;
  const customerId = decodedToken.uid;

  // 3. Verify vehicle ownership
  const vehicleSnap = await adminDb.collection('vehicles').doc(vehicleId).get();
  if (!vehicleSnap.exists || vehicleSnap.data()?.ownerId !== customerId) {
    return Response.json({ error: 'Vehicle not found or not yours' }, { status: 403 });
  }

  // 4. Run rule-based keyword matching
  const symptoms           = extractSymptomTags(description);
  const recommendedServiceIds = matchSymptoms(description); // returns [] until catalog is seeded

  // 5. Create SymptomReport via Admin SDK
  const reportRef = await adminDb.collection('symptomReports').add({
    customerId,
    vehicleId,
    description,
    symptoms,
    recommendedServiceIds,
    estimatedCostRange:  null,
    aiResponse:          null, // reserved for future LLM
    status:              'submitted' as SymptomReportStatus,
    relatedBookingId:    null,
    createdAt:           FieldValue.serverTimestamp(),
  });

  // 6. Fetch matching service documents (may be empty if map not yet seeded)
  let recommendedServices: Service[] = [];

  if (recommendedServiceIds.length > 0) {
    // Firestore 'in' operator supports up to 30 values
    const chunk = recommendedServiceIds.slice(0, 30);
    const servicesSnap = await adminDb
      .collection('services')
      .where('__name__', 'in', chunk)
      .where('isActive', '==', true)
      .get();

    // Preserve the ranked order from matchSymptoms()
    const serviceMap = new Map<string, Service>();
    servicesSnap.docs.forEach((d) => {
      serviceMap.set(d.id, { serviceId: d.id, ...d.data() } as Service);
    });

    recommendedServices = chunk
      .map((id) => serviceMap.get(id))
      .filter((s): s is Service => s !== undefined);
  }

  return Response.json({
    reportId: reportRef.id,
    symptoms,
    recommendedServices,
  }, { status: 201 });
}
