// =============================================================================
// RevvDoc — TypeScript Type System
// Single source of truth for all entity interfaces, enums, and union types.
// =============================================================================

// ── ENUMS & UNION TYPES ────────────────────────────────────────────────────────

export type UserRole = 'customer' | 'technician' | 'admin';

export type VehicleStatus = 'OPTIMAL' | 'SERVICE_DUE' | 'FAULT';

export type ServiceCategory = 'mechanic' | 'detailing' | 'diagnostic';

export type BookingStatus =
  | 'pending'      // submitted, awaiting technician assignment
  | 'accepted'     // technician accepted the job
  | 'scheduled'    // appointment date/time confirmed by technician
  | 'en_route'     // technician is driving to customer
  | 'in_progress'  // service actively underway
  | 'complete'     // service done, payment captured
  | 'cancelled';   // cancelled by customer or admin

/** Time-of-day preference selected during booking flow. */
export type BookingTimeWindow = 'morning' | 'afternoon' | 'evening';

/** How the customer initiated the booking. */
export type BookingSource = 'assistant' | 'schedule' | 'history' | 'manual';

export type JobStage =
  | 'dispatched'
  | 'en_route'
  | 'arrived'
  | 'in_progress'
  | 'quality_check'
  | 'complete';

export type NotificationType =
  // ── original ──
  | 'booking_confirmed'
  | 'technician_accepted'
  | 'technician_en_route'
  | 'job_started'
  | 'job_complete'
  | 'payment_captured'
  | 'booking_cancelled'
  | 'system'
  // ── Wave 1 additions ──
  | 'maintenance_reminder'   // mileage or date threshold crossed
  | 'recall_detected'        // NHTSA found an active recall for this VIN
  | 'chat_message'           // new message from the other booking participant
  | 'new_job_offer'          // technician-facing: new pending booking available
  | 'subscription_renewal';  // subscription period ending soon

// ── SHARED EMBEDDED TYPES ──────────────────────────────────────────────────────

export interface GeoPoint {
  lat: number;
  lng: number;
}

export interface ServiceAddress {
  street: string;
  city: string;
  state: string;
  zip: string;
  lat: number;
  lng: number;
}

export interface TechLocation extends GeoPoint {
  updatedAt: Date;
}

// ── USER ───────────────────────────────────────────────────────────────────────

export interface User {
  uid: string;                         // Firestore doc ID = Firebase Auth UID
  role: UserRole;
  name: string;
  email: string;
  phone: string | null;
  photoUrl: string | null;
  stripeCustomerId: string | null;     // null until first payment method added
  // Wave 1: notification preferences — optional (null/missing = all channels enabled)
  notificationPreferences?: NotificationPreferences | null;
  createdAt: Date;
}

export interface TechnicianUser extends User {
  role: 'technician';
  isAvailable: boolean;
  serviceCategories: ServiceCategory[];
  currentJobId: string | null;         // null when idle
  rating: number | null;               // avg rating, updated on job complete
  totalJobsCompleted: number;
}

// ── VEHICLE ────────────────────────────────────────────────────────────────────

export interface Vehicle {
  vehicleId: string;
  ownerId: string;                     // users/{uid}
  vin: string;
  make: string;
  model: string;
  year: number;
  nickname: string | null;             // e.g. "Daily Driver"
  status: VehicleStatus;
  mileage: number;
  lastServiceDate: Date | null;
  photoUrl: string | null;
  createdAt: Date;
  // ── Phase 2 / Wave 1: NHTSA + weather cache (written by Route Handlers) ──
  nhtsaDecoded?: Record<string, string> | null;   // raw decoded fields from NHTSA VIN API
  nhtsaRecalls?: RecallRecord[] | null;            // active recalls for this VIN
  nhtsaLastFetchedAt?: Date | null;                // TTL: re-fetch after 7 days
  lastWeather?: WeatherSnapshot | null;            // most recent weather at vehicle location
  // ── Phase 2A: factory maintenance schedule ──
  factorySchedule?: FactoryMaintenanceItem[] | null;          // baseline OEM intervals
  factoryScheduleLastFetchedAt?: Date | null;                 // TTL: re-generate after 30 days
  // ── Phase 2C: last completed service (denormalized for quick access) ──
  lastServiceSnapshot?: { serviceTitle: string; date: Date } | null;
}

// ── SERVICE ────────────────────────────────────────────────────────────────────

export interface Service {
  serviceId: string;
  name: string;
  category: ServiceCategory;
  basePrice: number;                   // USD cents — never floats
  durationMins: number;
  description: string;
  isActive: boolean;
  createdAt: Date;
}

// ── BOOKING SNAPSHOTS (denormalized — stored at booking creation) ──────────────

export interface ServiceSnapshot {
  serviceId: string;
  name: string;
  category: ServiceCategory;
  basePrice: number;                   // USD cents
  durationMins: number;
}

export interface VehicleSnapshot {
  vehicleId: string;
  vin: string;
  make: string;
  model: string;
  year: number;
  nickname: string | null;
  mileage: number;
}

// ── BOOKING ────────────────────────────────────────────────────────────────────

export interface Booking {
  bookingId: string;
  customerId: string;                  // users/{uid}
  technicianId: string | null;         // null until accepted
  jobId: string | null;                // set atomically when status → 'accepted'
  vehicleId: string;
  serviceId: string;
  serviceSnapshot: ServiceSnapshot;   // denormalized at creation time
  vehicleSnapshot: VehicleSnapshot;   // denormalized at creation time
  scheduledAt: Date;                  // requested service date/time
  flexDateEnd: Date | null;           // if customer provides a date range
  status: BookingStatus;
  address?: ServiceAddress | null;    // provided once technician is assigned (optional at creation)
  totalPrice: number;                 // USD cents
  stripePaymentIntentId: string | null;
  subscriptionId?: string | null;     // Wave 1: set if subscription discount applied
  // Phase 2B — booking flow additions
  scheduledTimeWindow?: BookingTimeWindow | null;  // morning / afternoon / evening preference
  notes?: string | null;              // customer notes for the technician
  source?: BookingSource | null;      // how the booking was initiated
  createdAt: Date;
}

// ── JOB ───────────────────────────────────────────────────────────────────────

export interface JobStageRecord {
  stage: JobStage;
  enteredAt: Date;
  note: string | null;
}

export interface Job {
  jobId: string;
  bookingId: string;
  technicianId: string;
  customerId: string;
  stages: JobStageRecord[];
  currentStage: JobStage;
  techLocation: TechLocation | null;  // null until technician departs
  notes: string | null;
  startedAt: Date | null;
  completedAt: Date | null;
}

// ── SERVICE HISTORY ───────────────────────────────────────────────────────────

/** Single part used during a service job — stored inside ServiceHistoryRecord. */
export interface PartRecord {
  name: string;
  partNumber: string | null;
  brand: string | null;
  warrantyExpires: Date | null;
}

/** Warranty attached to a service — stored inside ServiceHistoryRecord. */
export interface WarrantyRecord {
  description: string;
  expiresAt: Date | null;
  claimContact: string | null;
}

/**
 * Service history record.
 * Wave 1 adds partsUsed, photoUrls, and warrantyInfo.
 * These fields are optional/default-empty — existing records without them
 * should be handled with `record.partsUsed ?? []` in the service layer.
 */
export interface ServiceHistoryRecord {
  recordId: string;
  vehicleId: string;
  bookingId: string;
  customerId: string;
  serviceType: ServiceCategory;
  date: Date;
  mileageAtService: number;
  cost: number;                        // USD cents
  techNotes: string | null;
  // Wave 1 additions — default [] / null on records created before Wave 1
  partsUsed: PartRecord[];
  photoUrls: string[];                 // Firebase Storage URLs
  warrantyInfo: WarrantyRecord | null;
  // Phase 2C additions — optional, populated for booking-sourced records
  serviceTitle?: string | null;        // human-readable name, e.g. "Oil Change"
  source?: 'booking' | 'manual' | null; // origin of the record
  completedAt?: Date | null;           // actual completion timestamp
}

// ── NOTIFICATION ──────────────────────────────────────────────────────────────

export interface Notification {
  notifId: string;
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  read: boolean;
  relatedBookingId: string | null;
  relatedJobId: string | null;
  createdAt: Date;
}

// ── BOOKING FLOW STATE (client-side only, not persisted) ──────────────────────

export interface BookingFlowState {
  step: 1 | 2 | 3 | 4 | 5;           // service → vehicle → date → confirm → pay
  selectedServiceId: string | null;
  selectedVehicleId: string | null;
  scheduledAt: Date | null;
  flexDateEnd: Date | null;
  address: ServiceAddress | null;
}

// ── API REQUEST / RESPONSE TYPES ──────────────────────────────────────────────

export interface CreatePaymentIntentRequest {
  bookingId: string;
  customerId: string;
  amountCents: number;
}

export interface CreatePaymentIntentResponse {
  clientSecret: string;
  paymentIntentId: string;
}

export interface CapturePaymentRequest {
  bookingId: string;
  jobId: string;
}

export interface CapturePaymentResponse {
  success: boolean;
  amountCaptured: number;
}

export interface DecodeVinResponse {
  vin: string;
  make: string;
  model: string;
  year: number;
  vehicleType: string;
}

export interface AssignTechnicianRequest {
  bookingId: string;
  technicianId: string;
}

// ── DISPLAY HELPERS ───────────────────────────────────────────────────────────

/** Maps VehicleStatus to Tailwind color classes for badges */
export const VEHICLE_STATUS_STYLES: Record<VehicleStatus, { bg: string; text: string; label: string }> = {
  OPTIMAL:     { bg: 'bg-status-optimal/20',    text: 'text-status-optimal',    label: 'OPTIMAL' },
  SERVICE_DUE: { bg: 'bg-status-serviceDue/20', text: 'text-status-serviceDue', label: 'SERVICE DUE' },
  FAULT:       { bg: 'bg-status-fault/20',       text: 'text-status-fault',       label: 'FAULT' },
};

/** Ordered stages for job progress display */
export const JOB_STAGE_ORDER: JobStage[] = [
  'dispatched',
  'en_route',
  'arrived',
  'in_progress',
  'quality_check',
  'complete',
];

export const JOB_STAGE_LABELS: Record<JobStage, string> = {
  dispatched:    'Dispatched',
  en_route:      'En Route',
  arrived:       'Arrived',
  in_progress:   'In Progress',
  quality_check: 'Quality Check',
  complete:      'Complete',
};

// =============================================================================
// WAVE 1 — GROWTH FEATURES TYPE SYSTEM
// All types below are new additions. Nothing above this line was changed.
// =============================================================================

// ── PUSH NOTIFICATIONS (FCM) ──────────────────────────────────────────────────

/**
 * A single FCM device token stored in users/{uid}/fcmTokens/{tokenId}.
 * Subcollection (not embedded array) so individual tokens can be deleted
 * when FCM returns a 410 UNREGISTERED response, without rewriting the user doc.
 */
export interface FCMToken {
  tokenId: string;
  token: string;
  device: 'web' | 'ios' | 'android';
  userAgent: string | null;
  createdAt: Date;
  lastSeen: Date;
}

/**
 * Per-event notification preference map.
 * Embedded on users/{uid}.notificationPreferences.
 * null on the user doc means all channels are enabled (treat as all-true default).
 */
export interface NotificationPreferences {
  booking_confirmed: boolean;
  technician_accepted: boolean;
  technician_en_route: boolean;
  job_complete: boolean;
  payment_captured: boolean;
  maintenance_reminder: boolean;
  chat_message: boolean;
  recall_detected: boolean;
  subscription_renewal: boolean;
}

// ── MAINTENANCE REMINDER ENGINE ───────────────────────────────────────────────

/** Service types that support recurring maintenance schedules. */
export type MaintenanceServiceType =
  | 'oil_change'
  | 'tire_rotation'
  | 'brake_inspection'
  | 'air_filter'
  | 'cabin_filter'
  | 'coolant_flush'
  | 'transmission_service'
  | 'spark_plugs'
  | 'wiper_blades'
  | 'custom';

/**
 * One recurring maintenance schedule for one vehicle.
 * Stored in maintenanceSchedules/{scheduleId}.
 *
 * Interval triggers are independent — either, both, or neither can be set.
 * nextDueDate and nextDueMileage are recomputed server-side (by
 * /api/maintenance/recompute) after every matching service completion.
 */
export interface MaintenanceSchedule {
  scheduleId: string;
  vehicleId: string;
  ownerId: string;
  serviceType: MaintenanceServiceType;
  customLabel: string | null;          // used only when serviceType = 'custom'

  // Interval definition (at least one should be non-null for a useful schedule)
  intervalMiles: number | null;        // e.g. 5000 for every-5k-mile oil change
  intervalDays: number | null;         // e.g. 180 for 6-month brake inspection

  // Anchor points from the most recent completed service
  lastServiceDate: Date | null;
  lastServiceMileage: number | null;

  // Computed — written by /api/maintenance/recompute, read by health layer and UI
  nextDueDate: Date | null;
  nextDueMileage: number | null;

  // Reminder trigger thresholds
  reminderLeadDays: number;            // default: 7 — remind N days before nextDueDate
  reminderLeadMiles: number;           // default: 500 — remind within N miles of nextDueMileage
  reminderSentAt: Date | null;         // null = not sent this cycle; reset after service complete

  isActive: boolean;
  createdAt: Date;
}

// ── SUBSCRIPTION PLANS ────────────────────────────────────────────────────────

export type SubscriptionStatus = 'active' | 'cancelled' | 'paused' | 'pending_payment';
export type SubscriptionPeriod = 'monthly' | 'quarterly' | 'annual';

/** Defines what a subscriber is entitled to within each billing period. */
export interface SubscriptionEntitlement {
  serviceId: string | null;            // null = any service within the category qualifies
  serviceCategory: ServiceCategory;
  usagesPerPeriod: number;             // e.g. 1 = one use per period
  periodDays: number;                  // e.g. 30 = monthly reset window
}

/**
 * Admin-managed subscription plan catalog.
 * Stored in subscriptionPlans/{planId}.
 * Stripe fields are null in MVP — reserved for future payment wiring.
 */
export interface SubscriptionPlan {
  planId: string;
  name: string;                        // e.g. "Oil Change Club"
  tagline: string;
  priceMonthly: number;                // USD cents
  period: SubscriptionPeriod;
  entitlements: SubscriptionEntitlement[];
  isActive: boolean;
  stripeProductId: string | null;      // reserved — not yet wired
  stripePriceId: string | null;        // reserved — not yet wired
  createdAt: Date;
}

/** Records a single entitlement use within a subscription period. */
export interface SubscriptionUsageRecord {
  bookingId: string;
  serviceId: string;
  usedAt: Date;
}

/**
 * Per-customer plan enrollment.
 * Stored in subscriptions/{subscriptionId}.
 * All writes via Admin SDK Route Handlers — no direct client write allowed.
 */
export interface CustomerSubscription {
  subscriptionId: string;
  customerId: string;
  planId: string;
  vehicleId: string;                   // plan is scoped to a specific vehicle
  status: SubscriptionStatus;
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  usageThisPeriod: SubscriptionUsageRecord[];
  stripeSubscriptionId: string | null; // reserved — not yet wired
  createdAt: Date;
  cancelledAt: Date | null;
}

// ── SERVICE CHAT ──────────────────────────────────────────────────────────────

/** Why a chat thread is locked (used to show appropriate UI messaging). */
export type ChatLockReason = 'pending' | 'cancelled';

/**
 * Computed client-side from booking.status — never persisted.
 * 'locked'    → pending or cancelled
 * 'active'    → accepted | en_route | in_progress
 * 'read_only' → complete
 */
export type ChatState = 'locked' | 'active' | 'read_only';

/**
 * A single chat message stored in bookings/{bookingId}/messages/{messageId}.
 *
 * DENORMALIZATION: customerId, technicianId, and bookingStatus are copied
 * from the parent booking at write time. This avoids cross-document get()
 * calls inside Firestore security rules (each costs 1 read per evaluation).
 * chatService.sendMessage() is responsible for populating these fields.
 */
export interface ChatMessage {
  messageId: string;
  bookingId: string;
  senderId: string;
  senderRole: 'customer' | 'technician';
  body: string;
  type: 'text' | 'system';            // 'system' = automated status-change messages
  readBy: string[];                    // uids that have seen this message

  // Denormalized from parent booking for rule-level efficiency
  customerId: string;
  technicianId: string;
  bookingStatus: BookingStatus;

  createdAt: Date;
}

// ── AI TROUBLESHOOTING ASSISTANT ──────────────────────────────────────────────

export type SymptomReportStatus = 'draft' | 'submitted' | 'converted_to_booking';

/** Rough cost estimate for a symptom recommendation. */
export interface CostRange {
  minCents: number;
  maxCents: number;
}

/**
 * User-submitted vehicle symptom report.
 * Stored in symptomReports/{reportId}.
 *
 * recommendedServiceIds is populated by rule-based keyword matching in MVP.
 * aiResponse is a null slot reserved for future LLM integration.
 * UI MUST label all output as "suggested, not diagnosed."
 */
export interface SymptomReport {
  reportId: string;
  customerId: string;
  vehicleId: string;
  description: string;                 // raw free-text from user
  symptoms: string[];                  // parsed keyword tags extracted from description
  recommendedServiceIds: string[];     // matched service IDs from catalog
  estimatedCostRange: CostRange | null;
  aiResponse: string | null;           // reserved — null until LLM is wired
  status: SymptomReportStatus;
  relatedBookingId: string | null;     // set when user proceeds to booking
  createdAt: Date;
}

// ── PREDICTIVE VEHICLE HEALTH ─────────────────────────────────────────────────

/**
 * Fleet health alert level derived from all active maintenance schedules.
 * 'overdue' → at least one schedule is past its due date or mileage
 * 'soon'    → at least one schedule is within its reminder lead threshold
 * 'none'    → all schedules comfortably in the future
 */
export type HealthAlertLevel = 'none' | 'soon' | 'overdue';

export type ServiceUrgency = 'routine' | 'soon' | 'overdue';

/**
 * Forward-looking forecast for a single upcoming maintenance item.
 * Negative daysUntilDue or milesUntilDue means the service is already overdue.
 */
export interface UpcomingServiceForecast {
  scheduleId: string;
  serviceType: MaintenanceServiceType;
  customLabel: string | null;
  nextDueDate: Date | null;
  nextDueMileage: number | null;
  daysUntilDue: number | null;         // negative = overdue
  milesUntilDue: number | null;        // negative = overdue
  estimatedCostCents: number | null;
  urgency: ServiceUrgency;
}

/**
 * Computed health snapshot for a vehicle.
 * Stored in vehicleHealth/{vehicleId} — document ID matches vehicleId.
 * Written server-side by /api/maintenance/recompute after every service completion.
 *
 * alertLevel derivation rule:
 *   ANY daysUntilDue < 0 || milesUntilDue < 0 → 'overdue'
 *   ANY daysUntilDue < reminderLeadDays || milesUntilDue < reminderLeadMiles → 'soon'
 *   otherwise → 'none'
 */
export interface VehicleHealthSnapshot {
  vehicleId: string;
  ownerId: string;
  alertLevel: HealthAlertLevel;
  upcomingServices: UpcomingServiceForecast[];
  costForecastCentsMonthly: number | null;       // rough monthly spend forecast
  estimatedResaleValueBoostCents: number | null; // informational placeholder
  updatedAt: Date;
}

// ── VEHICLE INTELLIGENCE / METADATA ──────────────────────────────────────────

/** One item from the OEM factory maintenance schedule. */
export interface FactoryMaintenanceItem {
  service: string;                     // e.g. "Engine Oil & Filter"
  intervalMiles: number;
  intervalMonths: number;
  notes: string | null;
}

/**
 * An NHTSA safety recall for a vehicle.
 * Source: NHTSA Complaints & Recalls API (no API key required).
 */
export interface RecallRecord {
  nhtsaId: string;
  component: string;
  summary: string;
  consequence: string | null;
  remedy: string | null;
  reportDate: Date;
}

// ── WEATHER ───────────────────────────────────────────────────────────────────

/**
 * Binary risk flags derived from current weather conditions.
 * Used by the dashboard gauge and AI assistant context.
 */
export interface WeatherRiskFlags {
  coldRisk: boolean;   // temp <= 32°F — battery / tire pressure risk
  heatRisk: boolean;   // temp >= 90°F — coolant / tire pressure risk
  rainRisk: boolean;   // precipitation > 0 mm
  snowRisk: boolean;   // snowfall > 0 cm
}

/**
 * Current-conditions weather snapshot for a vehicle's location.
 * Stored in vehicles/{vehicleId}.lastWeather.
 * Fetched from Open-Meteo (free, no API key required).
 */
export interface WeatherSnapshot {
  temp: number;            // Fahrenheit
  precip: number;          // mm (rain)
  snowfall: number;        // cm
  condition: string;       // WMO weather code description
  riskFlags: WeatherRiskFlags;
  fetchedAt: Date;
}

// ── AI ASSISTANT SESSION ──────────────────────────────────────────────────────

export type AIUrgency = 'LOW' | 'MED' | 'HIGH';
export type AINextAction = 'BOOK' | 'SAVE_NOTE' | 'VIEW_RECALLS' | 'UPLOAD_PHOTO';

/** A single service recommendation returned by the AI assistant. */
export interface AIRecommendedService {
  id: string;
  name: string;
  reason: string;
}

/**
 * Structured output from the AI assistant.
 * Returned by /api/ai/chat and stored on the assistant's AIMessage.
 */
export interface AIAssistantResponse {
  replyText: string;
  urgency: AIUrgency;
  recommendedServices: AIRecommendedService[];
  suggestedNextAction: AINextAction;
}

/**
 * A single message in an AI assistant session.
 * Stored in aiSessions/{sessionId}/messages/{messageId}.
 */
export interface AIMessage {
  messageId: string;
  sessionId: string;
  role: 'user' | 'assistant';
  content: string;
  imageDataUrls?: string[];       // base64 data URLs (user messages only)
  // Structured assistant output — populated only for role='assistant'
  urgency?: AIUrgency;
  recommendedServices?: AIRecommendedService[];
  suggestedNextAction?: AINextAction;
  createdAt: Date;
}

/**
 * An AI chat session anchored to one vehicle.
 * Stored in aiSessions/{sessionId}.
 * Messages stored in the messages subcollection.
 */
export interface AISession {
  sessionId: string;
  userId: string;
  vehicleId: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Normalized vehicle make/model/year metadata — shared across all vehicles
 * of the same type. Document ID = `${year}_${make}_${model}` (normalized).
 * Stored in vehicleMetadata/{key}.
 *
 * Cache TTL: if recallsLastChecked is null or > 30 days old, the
 * /api/vehicles/recalls handler re-fetches from NHTSA and overwrites recalls[].
 */
export interface VehicleMetadata {
  key: string;                         // doc ID
  make: string;
  model: string;
  year: number;
  factorySchedule: FactoryMaintenanceItem[];
  recalls: RecallRecord[];
  recallsLastChecked: Date | null;
  createdAt: Date;
  updatedAt: Date;
}
