/**
 * POST /api/ai/chat
 *
 * RevvDoc Vehicle Assistant — powered by Claude claude-sonnet-4-6.
 * Provides structured vehicle service advice using real context from Firestore.
 *
 * Request body:
 * {
 *   userId:        string;          // Firebase UID of the customer
 *   vehicleId:     string;          // Firestore vehicle doc ID
 *   message:       string;          // User's text message
 *   sessionId?:    string;          // Existing session ID (creates new if omitted)
 *   imageDataUrls?: string[];       // Optional base64 image data URLs (max 4)
 * }
 *
 * Response:
 * {
 *   sessionId:   string;
 *   messageId:   string;            // ID of the assistant's message in Firestore
 *   replyText:   string;
 *   urgency:     'LOW'|'MED'|'HIGH';
 *   recommendedServices: [{ id, name, reason }];
 *   suggestedNextAction: 'BOOK'|'SAVE_NOTE'|'VIEW_RECALLS'|'UPLOAD_PHOTO';
 * }
 *
 * Context loaded for the AI:
 *   - Vehicle: make, model, year, mileage, NHTSA decoded fields, open recalls
 *   - Service history: last 10 records
 *   - Current weather: lastWeather risk flags
 *   - Prior conversation: last 10 turns from this session
 *
 * Requires: ANTHROPIC_API_KEY environment variable.
 * Auth: Firebase ID token required in Authorization header.
 */

import { z } from 'zod';
import { FieldValue } from 'firebase-admin/firestore';
import { adminAuth, adminDb } from '@/lib/firebase/firebaseAdmin';
import {
  buildSystemPrompt,
  callAssistant,
  analyzeImages,
  type VehicleContext,
  type ChatTurn,
} from '@/lib/ai/claude';
import type { ServiceHistoryRecord, RecallRecord, AIMessage, AIAssistantResponse, AIUrgency, AINextAction } from '@/types';

// ── Free-mode fallback (rule-based, no AI credits required) ──────────────────

/**
 * Keyword → service category rules for rule-based assistant responses.
 * Used when ANTHROPIC_API_KEY is absent or the billing quota is exceeded.
 */
const FREE_MODE_RULES: Array<{
  keywords: string[];
  service:  string;
  reason:   string;
  urgency:  AIUrgency;
  action:   AINextAction;
}> = [
  {
    keywords: ['brake', 'brakes', 'squeal', 'squeaking', 'grind', 'grinding', 'rotor', 'pad', 'pads', 'stopping', 'skid', 'pedal'],
    service:  'Brake Inspection',
    reason:   'Brake symptoms detected in your description',
    urgency:  'HIGH',
    action:   'BOOK',
  },
  {
    keywords: ['oil', 'leak', 'drip', 'smoke', 'overheat', 'overheating', 'coolant', 'temperature', 'radiator', 'engine light', 'check engine'],
    service:  'Engine Diagnostics',
    reason:   'Engine or fluid issue detected',
    urgency:  'HIGH',
    action:   'BOOK',
  },
  {
    keywords: ['tire', 'tyre', 'flat', 'pressure', 'rotation', 'rotate', 'alignment', 'wobble', 'vibration', 'tread'],
    service:  'Tire Service',
    reason:   'Tire-related issue detected',
    urgency:  'MED',
    action:   'BOOK',
  },
  {
    keywords: ['battery', 'start', 'starting', 'wont start', "won't start", 'alternator', 'electrical', 'fuse', 'power', 'dead'],
    service:  'Electrical Inspection',
    reason:   'Electrical system issue detected',
    urgency:  'MED',
    action:   'BOOK',
  },
  {
    keywords: ['recall', 'safety recall', 'nhtsa', 'campaign'],
    service:  'Safety Recall Check',
    reason:   'Recall-related query detected',
    urgency:  'HIGH',
    action:   'VIEW_RECALLS',
  },
  {
    keywords: ['detail', 'wash', 'clean', 'scratch', 'dent', 'paint', 'polish', 'wax', 'interior'],
    service:  'Vehicle Detailing',
    reason:   'Cosmetic service request detected',
    urgency:  'LOW',
    action:   'BOOK',
  },
];

/**
 * Generates a rule-based response when Claude AI is unavailable.
 * Matches the user's message against keyword categories and returns
 * a structured AIAssistantResponse with a "Free Mode" notice.
 */
function buildFreeModeFallback(
  message: string,
  ctx: VehicleContext
): AIAssistantResponse {
  const lower   = message.toLowerCase();
  const matched = FREE_MODE_RULES.filter((rule) =>
    rule.keywords.some((kw) => lower.includes(kw))
  );

  const urgency: AIUrgency =
    matched.some((r) => r.urgency === 'HIGH') ? 'HIGH' :
    matched.some((r) => r.urgency === 'MED')  ? 'MED'  : 'LOW';

  const action: AINextAction = matched[0]?.action ?? 'BOOK';

  const recommendedServices = matched.map((r) => ({
    id:     '',
    name:   r.service,
    reason: r.reason,
  }));

  let replyText: string;
  if (matched.length === 0) {
    replyText =
      `Assistant is in Free Mode (limited). Add AI credits to unlock full diagnostics.\n\n` +
      `I couldn't identify specific symptoms from your description of your ` +
      `${ctx.year} ${ctx.make} ${ctx.model}. Try describing sounds, warning lights, ` +
      `or the specific part that seems affected — for example, "grinding when braking" ` +
      `or "check engine light came on."`;
  } else {
    const names = matched.map((r) => r.service).join(', ');
    replyText =
      `Assistant is in Free Mode (limited). Add AI credits to unlock full diagnostics.\n\n` +
      `Based on your description of your ${ctx.year} ${ctx.make} ${ctx.model}, ` +
      `I found potential matches for: **${names}**. ` +
      (urgency === 'HIGH'
        ? `This may be a safety concern — I recommend booking an inspection promptly.`
        : `Consider scheduling a service appointment when convenient.`);
  }

  return { replyText, urgency, recommendedServices, suggestedNextAction: action };
}

export const runtime = 'nodejs';

const bodySchema = z.object({
  userId:        z.string().min(1),
  vehicleId:     z.string().min(1),
  message:       z.string().min(1).max(2000),
  sessionId:     z.string().min(1).optional(),
  imageDataUrls: z.array(z.string()).max(4).optional(),
});

// ── Context loaders ───────────────────────────────────────────────────────────

async function loadVehicleContext(vehicleId: string): Promise<VehicleContext | null> {
  const snap = await adminDb.collection('vehicles').doc(vehicleId).get();
  if (!snap.exists) return null;

  const v = snap.data()!;
  return {
    make:         v.make ?? '',
    model:        v.model ?? '',
    year:         v.year ?? 0,
    mileage:      v.mileage ?? 0,
    nhtsaDecoded: v.nhtsaDecoded ?? null,
    openRecalls:  (v.nhtsaRecalls as RecallRecord[] ?? []).map((r) => ({
      component: r.component,
      summary:   r.summary,
    })),
    weather: v.lastWeather
      ? {
          temp:      v.lastWeather.temp,
          condition: v.lastWeather.condition,
          riskFlags: v.lastWeather.riskFlags,
        }
      : null,
  };
}

async function loadRecentServices(vehicleId: string): Promise<VehicleContext['recentServices']> {
  const snap = await adminDb
    .collection('serviceHistory')
    .where('vehicleId', '==', vehicleId)
    .orderBy('date', 'desc')
    .limit(10)
    .get();

  return snap.docs.map((d) => {
    const r = d.data() as ServiceHistoryRecord;
    const date = typeof r.date === 'object' && 'toDate' in r.date
      ? (r.date as { toDate(): Date }).toDate().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
      : String(r.date);
    return {
      serviceType: r.serviceType,
      date,
      mileage:     r.mileageAtService,
      notes:       r.techNotes,
    };
  });
}

async function loadSessionHistory(sessionId: string): Promise<ChatTurn[]> {
  const snap = await adminDb
    .collection('aiSessions')
    .doc(sessionId)
    .collection('messages')
    .orderBy('createdAt', 'asc')
    .limit(20) // last 20 messages = 10 turns
    .get();

  return snap.docs.map((d) => {
    const m = d.data() as AIMessage;
    return { role: m.role, content: m.content };
  });
}

async function loadUpcomingBookings(
  vehicleId: string,
  customerId: string
): Promise<VehicleContext['upcomingBookings']> {
  const snap = await adminDb
    .collection('bookings')
    .where('customerId', '==', customerId)
    .where('status', 'in', ['pending', 'accepted'])
    .orderBy('scheduledAt', 'asc')
    .limit(10)
    .get();

  const upcoming = snap.docs
    .filter((d) => d.data().vehicleId === vehicleId)
    .map((d) => {
      const data = d.data();
      const rawAt = data.scheduledAt;
      const scheduledAt: Date =
        rawAt && typeof rawAt.toDate === 'function'
          ? rawAt.toDate()
          : new Date(rawAt);

      const scheduledAtStr = scheduledAt.toLocaleDateString('en-US', {
        month: 'short',
        day:   'numeric',
        year:  'numeric',
      });

      const service: string =
        (data.serviceSnapshot as { name?: string })?.name ?? 'Service';
      const status: string = data.status as string;

      return { service, scheduledAt: scheduledAtStr, status };
    });

  return upcoming.length > 0 ? upcoming : null;
}

// ── Route handler ─────────────────────────────────────────────────────────────

export async function POST(request: Request) {
  // 1. Auth
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
    body = bodySchema.parse(await request.json());
  } catch (err) {
    return Response.json({ error: 'Invalid request body', details: err }, { status: 400 });
  }

  const { userId, vehicleId, message, imageDataUrls } = body;
  let { sessionId } = body;

  // Ensure the authenticated user matches the requested userId
  if (decodedToken.uid !== userId) {
    return Response.json({ error: 'Forbidden — userId mismatch' }, { status: 403 });
  }

  // 3. Verify vehicle ownership
  const vehicleOwnerSnap = await adminDb.collection('vehicles').doc(vehicleId).get();
  if (!vehicleOwnerSnap.exists || vehicleOwnerSnap.data()?.ownerId !== userId) {
    return Response.json({ error: 'Forbidden — not your vehicle' }, { status: 403 });
  }

  // 4. Load ANTHROPIC_API_KEY — absence triggers free-mode fallback (not a hard fail)
  const apiKey = process.env.ANTHROPIC_API_KEY ?? null;

  // 5. Create or validate session
  const sessionsRef = adminDb.collection('aiSessions');

  if (!sessionId) {
    const newSession = await sessionsRef.add({
      userId,
      vehicleId,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
    sessionId = newSession.id;
  } else {
    const sessSnap = await sessionsRef.doc(sessionId).get();
    if (!sessSnap.exists || sessSnap.data()?.userId !== userId) {
      return Response.json({ error: 'Session not found or not yours' }, { status: 404 });
    }
  }

  // 6. Load context in parallel
  const [vehicleCtx, recentServices, history, upcomingBookings] = await Promise.all([
    loadVehicleContext(vehicleId),
    loadRecentServices(vehicleId),
    loadSessionHistory(sessionId),
    loadUpcomingBookings(vehicleId, userId),
  ]);

  if (!vehicleCtx) {
    return Response.json({ error: 'Vehicle not found' }, { status: 404 });
  }

  vehicleCtx.recentServices  = recentServices;
  vehicleCtx.upcomingBookings = upcomingBookings;

  // 7. Store user message in Firestore (before calling AI, so it's always recorded)
  const userMsgRef = await sessionsRef.doc(sessionId).collection('messages').add({
    sessionId,
    role:          'user',
    content:       message,
    imageDataUrls: imageDataUrls ?? [],
    createdAt:     FieldValue.serverTimestamp(),
  });

  // 8. Optionally analyze images first (skipped when no API key)
  let visionDescription = '';
  if (apiKey && imageDataUrls && imageDataUrls.length > 0) {
    visionDescription = await analyzeImages(imageDataUrls, apiKey);
  }

  // 9. Build system prompt + call Claude (or fall back to rule-based response)
  const systemPrompt = buildSystemPrompt(vehicleCtx);

  let aiResponse: AIAssistantResponse;
  let freeMode = false;

  if (!apiKey) {
    // No API key configured — use rule-based free mode
    console.warn('[ai/chat] ANTHROPIC_API_KEY not set — using free-mode fallback');
    aiResponse  = buildFreeModeFallback(message, vehicleCtx);
    freeMode    = true;
  } else {
    try {
      aiResponse = await callAssistant(
        systemPrompt, history, message, apiKey, visionDescription || undefined
      );
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : 'AI call failed';

      // Detect billing / credit errors → free-mode fallback instead of hard error
      const isBillingError =
        errMsg.includes('402') ||
        errMsg.toLowerCase().includes('credit') ||
        errMsg.toLowerCase().includes('balance') ||
        errMsg.toLowerCase().includes('quota');

      if (isBillingError) {
        console.warn('[ai/chat] AI billing error — using free-mode fallback:', errMsg);
        aiResponse = buildFreeModeFallback(message, vehicleCtx);
        freeMode   = true;
      } else {
        console.error('[ai/chat] Claude error:', err);
        return Response.json({ error: errMsg }, { status: 502 });
      }
    }
  }

  // 10. Store assistant response in Firestore
  const assistantMsgRef = await sessionsRef.doc(sessionId).collection('messages').add({
    sessionId,
    role:                 'assistant',
    content:              aiResponse.replyText,
    urgency:              aiResponse.urgency,
    recommendedServices:  aiResponse.recommendedServices,
    suggestedNextAction:  aiResponse.suggestedNextAction,
    createdAt:            FieldValue.serverTimestamp(),
  });

  // Update session updatedAt (fire-and-forget)
  sessionsRef.doc(sessionId).update({
    updatedAt: FieldValue.serverTimestamp(),
  }).catch(console.error);

  // 11. Return structured response
  return Response.json({
    sessionId,
    userMessageId:       userMsgRef.id,
    messageId:           assistantMsgRef.id,
    replyText:           aiResponse.replyText,
    urgency:             aiResponse.urgency,
    recommendedServices: aiResponse.recommendedServices,
    suggestedNextAction: aiResponse.suggestedNextAction,
    freeMode,            // true when rule-based fallback was used
  }, { status: 200 });
}
