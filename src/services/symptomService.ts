/**
 * Symptom Service — Firestore data access for symptomReports collection.
 *
 * Handles the AI Troubleshooting Assistant data layer.
 * In MVP, recommendation generation is rule-based (keyword → service matching).
 * The aiResponse field is null and reserved for future LLM integration.
 *
 * UI CONTRACT: All recommended services must be labeled
 * "Suggested based on your description — not a diagnosis."
 *
 * TODO Phase 3 (Wave 4): implement all function bodies + keyword matching logic.
 */

import {
  collection,
  doc,
  addDoc,
  updateDoc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  limit,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '@/lib/firebase/firebase';
import type { SymptomReport, SymptomReportStatus } from '@/types';

const REPORTS = 'symptomReports';

/**
 * Returns a customer's symptom report history, newest first.
 * Uses composite index: customerId ASC, status ASC, createdAt DESC.
 */
export async function getReportsByCustomer(
  customerId: string,
  statusFilter?: SymptomReportStatus,
  limitCount = 20
): Promise<SymptomReport[]> {
  // TODO Phase 3: implement
  const constraints = [
    where('customerId', '==', customerId),
    ...(statusFilter ? [where('status', '==', statusFilter)] : []),
    orderBy('createdAt', 'desc'),
    limit(limitCount),
  ];
  const q = query(collection(db, REPORTS), ...constraints);
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ reportId: d.id, ...d.data() }) as SymptomReport);
}

/**
 * Returns symptom reports for a specific vehicle, newest first.
 * Uses composite index: vehicleId ASC, createdAt DESC.
 */
export async function getReportsByVehicle(
  vehicleId: string,
  limitCount = 10
): Promise<SymptomReport[]> {
  // TODO Phase 3: implement
  const q = query(
    collection(db, REPORTS),
    where('vehicleId', '==', vehicleId),
    orderBy('createdAt', 'desc'),
    limit(limitCount)
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ reportId: d.id, ...d.data() }) as SymptomReport);
}

/**
 * Returns a single symptom report by ID.
 */
export async function getReportById(reportId: string): Promise<SymptomReport | null> {
  // TODO Phase 3: implement
  const snap = await getDoc(doc(db, REPORTS, reportId));
  if (!snap.exists()) return null;
  return { reportId: snap.id, ...snap.data() } as SymptomReport;
}

/**
 * Creates a new symptom report.
 * The recommendedServiceIds field is populated by the /api/symptom/analyze
 * Route Handler after creation — pass [] here.
 */
export async function createReport(
  data: Omit<SymptomReport, 'reportId' | 'createdAt' | 'recommendedServiceIds' | 'estimatedCostRange' | 'aiResponse' | 'relatedBookingId'>
): Promise<string> {
  // TODO Phase 3: implement
  const ref = await addDoc(collection(db, REPORTS), {
    ...data,
    recommendedServiceIds: [],
    estimatedCostRange: null,
    aiResponse: null,
    relatedBookingId: null,
    createdAt: serverTimestamp(),
  });
  return ref.id;
}

/**
 * Updates a report after symptom analysis completes.
 * Called by the /api/symptom/analyze Route Handler (via Admin SDK).
 * The client may also update description/symptoms while status = 'draft'.
 */
export async function updateReportAnalysis(
  reportId: string,
  partial: Partial<
    Pick<SymptomReport, 'symptoms' | 'recommendedServiceIds' | 'estimatedCostRange' | 'status'>
  >
): Promise<void> {
  // TODO Phase 3: implement
  await updateDoc(doc(db, REPORTS, reportId), partial);
}

/**
 * Marks a report as converted when the user proceeds to booking.
 * Sets status = 'converted_to_booking' and stores the resulting bookingId.
 */
export async function markReportConverted(
  reportId: string,
  bookingId: string
): Promise<void> {
  // TODO Phase 3: implement
  await updateDoc(doc(db, REPORTS, reportId), {
    status: 'converted_to_booking' as SymptomReportStatus,
    relatedBookingId: bookingId,
  });
}

// ── Keyword matching (MVP rule-based, AI slot reserved) ───────────────────────

/**
 * Maps raw symptom description keywords to service IDs.
 * This is a static config — no ML or API call involved.
 * Replace or augment with LLM call when aiResponse slot is activated.
 *
 * Key: lowercase keyword fragment
 * Value: serviceId from the services catalog
 *
 * TODO Phase 3 (Wave 4): populate with actual service IDs from the catalog.
 */
export const SYMPTOM_KEYWORD_MAP: Record<string, string[]> = {
  // engine / oil
  oil:          [],  // TODO: fill with oil change serviceId
  leak:         [],
  smoke:        [],
  overheating:  [],
  // brakes
  brake:        [],  // TODO: fill with brake inspection serviceId
  squeal:       [],
  grinding:     [],
  // tires
  tire:         [],  // TODO: fill with tire rotation serviceId
  flat:         [],
  alignment:    [],
  // electrical
  battery:      [],
  starter:      [],
  alternator:   [],
  // misc
  detail:       [],  // TODO: fill with detailing serviceId
  wash:         [],
  scratch:      [],
  dent:         [],
};

/**
 * Extracts matching service IDs from a free-text symptom description.
 * Returns a deduplicated array of serviceIds, sorted by occurrence frequency.
 */
export function matchSymptoms(description: string): string[] {
  // TODO Phase 3 (Wave 4): implement with actual service IDs populated above
  const lower = description.toLowerCase();
  const hits: Record<string, number> = {};

  for (const [keyword, serviceIds] of Object.entries(SYMPTOM_KEYWORD_MAP)) {
    if (lower.includes(keyword)) {
      for (const id of serviceIds) {
        hits[id] = (hits[id] ?? 0) + 1;
      }
    }
  }

  // Sort by frequency descending (most-matched services first)
  return Object.entries(hits)
    .sort(([, a], [, b]) => b - a)
    .map(([serviceId]) => serviceId);
}
