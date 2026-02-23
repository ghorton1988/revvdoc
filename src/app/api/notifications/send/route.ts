/**
 * POST /api/notifications/send
 *
 * Internal endpoint for sending a notification to a user. Writes a Firestore
 * notification document AND dispatches an FCM push to all registered devices.
 *
 * Protected by an internal API secret (X-Internal-Secret header) — this route
 * is called by other Route Handlers, not directly from the client.
 *
 * Required env var: INTERNAL_API_SECRET (any random string, e.g. openssl rand -base64 32)
 *
 * Body:
 *   uid              string   — target user's Firebase uid
 *   type             string   — NotificationType value
 *   title            string   — notification heading
 *   body             string   — notification body text
 *   link?            string   — URL to open on tap (default: '/')
 *   relatedBookingId? string
 *   relatedJobId?    string
 *
 * Returns: { success: true, fcmSent: number }
 */

import { z } from 'zod';
import { FieldValue } from 'firebase-admin/firestore';
import { adminDb } from '@/lib/firebase/firebaseAdmin';
import { sendFCMToUser } from '@/lib/firebase/fcmAdmin';

export const runtime = 'nodejs';

const schema = z.object({
  uid:              z.string().min(1),
  type:             z.string().min(1),
  title:            z.string().min(1),
  body:             z.string().min(1),
  link:             z.string().optional(),
  relatedBookingId: z.string().optional(),
  relatedJobId:     z.string().optional(),
});

const INTERNAL_SECRET = process.env.INTERNAL_API_SECRET;

export async function POST(request: Request) {
  // Verify internal caller identity
  if (!INTERNAL_SECRET) {
    console.error('[notifications/send] INTERNAL_API_SECRET not configured');
    return Response.json({ error: 'Server misconfiguration' }, { status: 500 });
  }
  if (request.headers.get('X-Internal-Secret') !== INTERNAL_SECRET) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body;
  try {
    body = schema.parse(await request.json());
  } catch (err) {
    return Response.json({ error: 'Invalid request body', details: err }, { status: 400 });
  }

  const { uid, type, title, body: msgBody, link, relatedBookingId, relatedJobId } = body;

  // 1. Write Firestore notification (source of truth — always attempted first)
  try {
    await adminDb.collection('notifications').add({
      userId:           uid,
      type,
      title,
      body:             msgBody,
      read:             false,
      relatedBookingId: relatedBookingId ?? null,
      relatedJobId:     relatedJobId     ?? null,
      createdAt:        FieldValue.serverTimestamp(),
    });
  } catch (err) {
    console.error('[notifications/send] Firestore write error:', err);
    return Response.json({ error: 'Failed to create notification document' }, { status: 500 });
  }

  // 2. Dispatch FCM push (non-critical — Firestore notification already written)
  let fcmSent = 0;
  try {
    fcmSent = await sendFCMToUser(uid, { title, body: msgBody, link });
  } catch (err) {
    console.error('[notifications/send] FCM dispatch error:', err);
  }

  return Response.json({ success: true, fcmSent });
}
