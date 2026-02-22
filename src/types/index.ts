// =============================================================================
// RevvDoc — TypeScript Type System
// Single source of truth for all entity interfaces, enums, and union types.
// =============================================================================

// ── ENUMS & UNION TYPES ────────────────────────────────────────────────────────

export type UserRole = 'customer' | 'technician' | 'admin';

export type VehicleStatus = 'OPTIMAL' | 'SERVICE_DUE' | 'FAULT';

export type ServiceCategory = 'mechanic' | 'detailing' | 'diagnostic';

export type BookingStatus =
  | 'pending'
  | 'accepted'
  | 'en_route'
  | 'in_progress'
  | 'complete'
  | 'cancelled';

export type JobStage =
  | 'dispatched'
  | 'en_route'
  | 'arrived'
  | 'in_progress'
  | 'quality_check'
  | 'complete';

export type NotificationType =
  | 'booking_confirmed'
  | 'technician_accepted'
  | 'technician_en_route'
  | 'job_started'
  | 'job_complete'
  | 'payment_captured'
  | 'booking_cancelled'
  | 'system';

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
}

// ── SERVICE ────────────────────────────────────────────────────────────────────

export interface Service {
  serviceId: string;
  name: string;
  category: ServiceCategory;
  basePrice: number;                   // USD cents to avoid float issues
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
  vehicleId: string;
  serviceId: string;
  serviceSnapshot: ServiceSnapshot;   // denormalized at creation time
  vehicleSnapshot: VehicleSnapshot;   // denormalized at creation time
  scheduledAt: Date;                  // requested service date/time
  flexDateEnd: Date | null;           // if customer provides a date range
  status: BookingStatus;
  address: ServiceAddress;
  totalPrice: number;                 // USD cents
  stripePaymentIntentId: string | null;
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
