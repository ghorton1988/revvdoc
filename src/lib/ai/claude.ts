/**
 * Claude AI helper — server-only (used in Route Handlers only).
 *
 * Calls the Anthropic Messages API via native fetch (no extra SDK dependency).
 * Requires ANTHROPIC_API_KEY in environment variables.
 *
 * Model: claude-sonnet-4-6 — best balance of quality and speed for chat.
 *
 * IMPORTANT: server-only. Never import in components or hooks.
 */

import type { AIAssistantResponse, AIUrgency, AINextAction, AIRecommendedService } from '@/types';

// ── Config ────────────────────────────────────────────────────────────────────

const ANTHROPIC_API = 'https://api.anthropic.com/v1/messages';
const MODEL         = 'claude-sonnet-4-6';
const MAX_TOKENS    = 1024;

// ── Anthropic API types ───────────────────────────────────────────────────────

interface TextBlock {
  type: 'text';
  text: string;
}

interface ImageBlock {
  type: 'image';
  source: {
    type: 'base64';
    media_type: 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp';
    data: string;
  };
}

type ContentBlock = TextBlock | ImageBlock;

interface AnthropicMessage {
  role: 'user' | 'assistant';
  content: ContentBlock[] | string;
}

interface AnthropicResponse {
  content: Array<{ type: string; text?: string }>;
}

// ── Vehicle context builder ───────────────────────────────────────────────────

export interface VehicleContext {
  make: string;
  model: string;
  year: number;
  mileage: number;
  nhtsaDecoded?: Record<string, string> | null;
  openRecalls?: Array<{ component: string; summary: string }> | null;
  recentServices?: Array<{ serviceType: string; date: string; mileage: number; notes: string | null }> | null;
  upcomingBookings?: Array<{ service: string; scheduledAt: string; status: string }> | null;
  weather?: {
    temp: number;
    condition: string;
    riskFlags: { coldRisk: boolean; heatRisk: boolean; rainRisk: boolean; snowRisk: boolean };
  } | null;
}

/**
 * Builds the system prompt for the RevvDoc vehicle assistant.
 * Embeds structured vehicle context so Claude can give specific advice.
 */
export function buildSystemPrompt(ctx: VehicleContext): string {
  const sections: string[] = [
    `You are the RevvDoc Vehicle Assistant, a friendly expert helping a customer with their ${ctx.year} ${ctx.make} ${ctx.model} (${ctx.mileage.toLocaleString()} miles).`,
    '',
    'Your job: give concise, actionable vehicle service advice. Always err toward recommending professional inspection for safety issues.',
    '',
    '## Response format',
    'You MUST respond with a valid JSON object matching this exact schema:',
    '```json',
    '{',
    '  "replyText": "Your conversational response here",',
    '  "urgency": "LOW" | "MED" | "HIGH",',
    '  "recommendedServices": [{ "id": "", "name": "service name", "reason": "why recommended" }],',
    '  "suggestedNextAction": "BOOK" | "SAVE_NOTE" | "VIEW_RECALLS" | "UPLOAD_PHOTO"',
    '}',
    '```',
    '- urgency HIGH = safety concern, act immediately',
    '- urgency MED = should address within a week or two',
    '- urgency LOW = routine, informational',
    '- recommendedServices: array of relevant services (use empty array if none)',
    '- suggestedNextAction: most important single next step',
  ];

  // Open recalls
  if (ctx.openRecalls && ctx.openRecalls.length > 0) {
    sections.push('', '## ACTIVE SAFETY RECALLS');
    for (const r of ctx.openRecalls) {
      sections.push(`- ${r.component}: ${r.summary}`);
    }
    sections.push('⚠️ This vehicle has open recalls — treat as HIGH urgency context.');
  }

  // Recent service history
  if (ctx.recentServices && ctx.recentServices.length > 0) {
    sections.push('', '## Recent service history (newest first)');
    for (const s of ctx.recentServices) {
      sections.push(`- ${s.serviceType} on ${s.date} at ${s.mileage.toLocaleString()} mi${s.notes ? `: ${s.notes}` : ''}`);
    }
  }

  // Upcoming booked services
  if (ctx.upcomingBookings && ctx.upcomingBookings.length > 0) {
    sections.push('', '## Upcoming booked services');
    for (const b of ctx.upcomingBookings) {
      sections.push(`- ${b.service} — ${b.scheduledAt} (${b.status})`);
    }
  }

  // Weather context
  if (ctx.weather) {
    const { temp, condition, riskFlags } = ctx.weather;
    const risks = Object.entries(riskFlags)
      .filter(([, v]) => v)
      .map(([k]) => k.replace('Risk', ''))
      .join(', ');

    sections.push('', '## Current weather');
    sections.push(`${condition}, ${temp}°F${risks ? ` — ${risks} risk active` : ''}`);
  }

  // NHTSA decoded extras
  if (ctx.nhtsaDecoded) {
    const engine = ctx.nhtsaDecoded['Engine Model'] ?? ctx.nhtsaDecoded['Engine Configuration'];
    const fuel   = ctx.nhtsaDecoded['Fuel Type - Primary'];
    if (engine || fuel) {
      sections.push('', '## Vehicle specs');
      if (engine) sections.push(`- Engine: ${engine}`);
      if (fuel)   sections.push(`- Fuel: ${fuel}`);
    }
  }

  sections.push('', 'Keep replies concise (2–4 sentences max). Respond ONLY with the JSON object, no markdown fences.');

  return sections.join('\n');
}

// ── Image processing ──────────────────────────────────────────────────────────

/**
 * Extracts a base64 data string + media type from a data URL.
 * Returns null if the data URL is invalid or the media type is unsupported.
 */
function parseDataUrl(dataUrl: string): { data: string; mediaType: ImageBlock['source']['media_type'] } | null {
  const match = dataUrl.match(/^data:(image\/(?:jpeg|png|gif|webp));base64,(.+)$/);
  if (!match) return null;
  return {
    mediaType: match[1] as ImageBlock['source']['media_type'],
    data: match[2],
  };
}

/**
 * Runs a lightweight vision analysis step on provided images.
 * Returns a text description of what's visible, for inclusion in the main context.
 * Returns empty string on failure — never throws.
 */
export async function analyzeImages(
  imageDataUrls: string[],
  apiKey: string
): Promise<string> {
  if (!imageDataUrls.length) return '';

  const imageBlocks: ImageBlock[] = imageDataUrls
    .slice(0, 4) // max 4 images per request
    .map(parseDataUrl)
    .filter((p): p is NonNullable<typeof p> => p !== null)
    .map((p) => ({
      type: 'image' as const,
      source: { type: 'base64' as const, media_type: p.mediaType, data: p.data },
    }));

  if (!imageBlocks.length) return '';

  const messages: AnthropicMessage[] = [
    {
      role: 'user',
      content: [
        ...imageBlocks,
        {
          type: 'text',
          text: 'Describe what you see in these vehicle photos. Focus on any visible damage, wear, warning lights, or maintenance issues. Be specific and technical. 2–3 sentences.',
        },
      ],
    },
  ];

  try {
    const res = await fetch(ANTHROPIC_API, {
      method: 'POST',
      headers: {
        'x-api-key':         apiKey,
        'anthropic-version': '2023-06-01',
        'content-type':      'application/json',
      },
      body: JSON.stringify({ model: MODEL, max_tokens: 256, messages }),
    });

    if (!res.ok) return '';
    const data: AnthropicResponse = await res.json();
    return data.content?.[0]?.text ?? '';
  } catch {
    return '';
  }
}

// ── Main chat call ────────────────────────────────────────────────────────────

export interface ChatTurn {
  role: 'user' | 'assistant';
  content: string;
}

/**
 * Calls Claude with the vehicle assistant system prompt and conversation history.
 * Returns structured AIAssistantResponse parsed from the model's JSON output.
 * Throws on API failure.
 */
export async function callAssistant(
  systemPrompt: string,
  history: ChatTurn[],
  userMessage: string,
  apiKey: string,
  visionDescription?: string
): Promise<AIAssistantResponse> {
  // Combine vision description into user message if present
  const userContent = visionDescription
    ? `${userMessage}\n\n[Photo analysis: ${visionDescription}]`
    : userMessage;

  const messages: AnthropicMessage[] = [
    ...history.map((t) => ({ role: t.role, content: t.content })),
    { role: 'user', content: userContent },
  ];

  const res = await fetch(ANTHROPIC_API, {
    method: 'POST',
    headers: {
      'x-api-key':         apiKey,
      'anthropic-version': '2023-06-01',
      'content-type':      'application/json',
    },
    body: JSON.stringify({
      model:  MODEL,
      max_tokens: MAX_TOKENS,
      system: systemPrompt,
      messages,
    }),
  });

  if (!res.ok) {
    const errBody = await res.text().catch(() => '');
    throw new Error(`Anthropic API error ${res.status}: ${errBody}`);
  }

  const data: AnthropicResponse = await res.json();
  const raw = data.content?.[0]?.text ?? '';

  // Parse structured JSON output
  try {
    const parsed = JSON.parse(raw) as {
      replyText: string;
      urgency: string;
      recommendedServices: Array<{ id: string; name: string; reason: string }>;
      suggestedNextAction: string;
    };

    const VALID_URGENCY: AIUrgency[] = ['LOW', 'MED', 'HIGH'];
    const VALID_NEXT:    AINextAction[] = ['BOOK', 'SAVE_NOTE', 'VIEW_RECALLS', 'UPLOAD_PHOTO'];

    return {
      replyText: String(parsed.replyText ?? ''),
      urgency:   VALID_URGENCY.includes(parsed.urgency as AIUrgency) ? (parsed.urgency as AIUrgency) : 'LOW',
      recommendedServices: (parsed.recommendedServices ?? []).map((s): AIRecommendedService => ({
        id:     String(s.id ?? ''),
        name:   String(s.name ?? ''),
        reason: String(s.reason ?? ''),
      })),
      suggestedNextAction: VALID_NEXT.includes(parsed.suggestedNextAction as AINextAction)
        ? (parsed.suggestedNextAction as AINextAction)
        : 'SAVE_NOTE',
    };
  } catch {
    // Model returned plain text instead of JSON (fallback)
    return {
      replyText: raw,
      urgency: 'LOW',
      recommendedServices: [],
      suggestedNextAction: 'SAVE_NOTE',
    };
  }
}
