/**
 * Subscription Service — Firestore data access for subscriptionPlans
 * and subscriptions collections.
 *
 * IMPORTANT: CustomerSubscription writes (enroll, cancel, use entitlement)
 * go through Admin SDK Route Handlers (/api/subscriptions/*), NOT this service.
 * This service provides read access only for customer-facing pages.
 *
 * The Stripe integration is not wired yet. stripeSubscriptionId is null in MVP.
 * The EnrollCTA component must render as disabled until Stripe is connected.
 *
 * TODO Phase 3 (Wave 4): implement all function bodies.
 */

import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
} from 'firebase/firestore';
import { db } from '@/lib/firebase/firebase';
import type {
  SubscriptionPlan,
  CustomerSubscription,
  SubscriptionEntitlement,
} from '@/types';

const PLANS = 'subscriptionPlans';
const SUBSCRIPTIONS = 'subscriptions';

// ── Subscription Plan catalog (read-only) ────────────────────────────────────

/**
 * Returns all active subscription plans for the browse page.
 * Uses composite index: isActive ASC, period ASC.
 */
export async function getActivePlans(): Promise<SubscriptionPlan[]> {
  // TODO Phase 3: implement
  const q = query(
    collection(db, PLANS),
    where('isActive', '==', true),
    orderBy('period', 'asc')
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ planId: d.id, ...d.data() }) as SubscriptionPlan);
}

/**
 * Returns a single subscription plan by ID.
 */
export async function getPlanById(planId: string): Promise<SubscriptionPlan | null> {
  // TODO Phase 3: implement
  const snap = await getDoc(doc(db, PLANS, planId));
  if (!snap.exists()) return null;
  return { planId: snap.id, ...snap.data() } as SubscriptionPlan;
}

// ── Customer subscriptions (read-only from client) ───────────────────────────

/**
 * Returns a customer's active subscriptions.
 * Uses composite index: customerId ASC, status ASC, currentPeriodEnd DESC.
 */
export async function getActiveSubscriptions(
  customerId: string
): Promise<CustomerSubscription[]> {
  // TODO Phase 3: implement
  const q = query(
    collection(db, SUBSCRIPTIONS),
    where('customerId', '==', customerId),
    where('status', '==', 'active'),
    orderBy('currentPeriodEnd', 'desc')
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({
    subscriptionId: d.id,
    ...d.data(),
  }) as CustomerSubscription);
}

/**
 * Returns the active subscription for a specific vehicle, if any.
 * Used at booking time to check if a covered service applies.
 * Uses composite index: vehicleId ASC, status ASC.
 */
export async function getSubscriptionByVehicle(
  vehicleId: string
): Promise<CustomerSubscription | null> {
  // TODO Phase 3: implement
  const q = query(
    collection(db, SUBSCRIPTIONS),
    where('vehicleId', '==', vehicleId),
    where('status', '==', 'active')
  );
  const snap = await getDocs(q);
  if (snap.empty) return null;
  const d = snap.docs[0];
  return { subscriptionId: d.id, ...d.data() } as CustomerSubscription;
}

// ── Entitlement helpers (client-side computation) ────────────────────────────

/**
 * Returns the remaining entitlement uses for a specific service category
 * within the current billing period.
 *
 * This is a client-side check for UI display only.
 * The authoritative check happens server-side in /api/subscriptions/use.
 */
export function getRemainingUses(
  subscription: CustomerSubscription,
  plan: SubscriptionPlan,
  serviceId: string
): number {
  // TODO Phase 3: implement
  const entitlement = plan.entitlements.find(
    (e: SubscriptionEntitlement) =>
      e.serviceId === serviceId || e.serviceId === null
  );
  if (!entitlement) return 0;

  const used = subscription.usageThisPeriod.filter(
    (u) => u.serviceId === serviceId
  ).length;

  return Math.max(0, entitlement.usagesPerPeriod - used);
}

/**
 * Returns true if the subscription covers a given serviceId in the current period.
 * Checks both exact service match and category-level coverage.
 */
export function isCovered(
  subscription: CustomerSubscription,
  plan: SubscriptionPlan,
  serviceId: string,
  serviceCategory: string
): boolean {
  // TODO Phase 3: implement
  return getRemainingUses(subscription, plan, serviceId) > 0 ||
    plan.entitlements.some(
      (e: SubscriptionEntitlement) =>
        e.serviceId === null &&
        e.serviceCategory === serviceCategory &&
        subscription.usageThisPeriod.filter((u) => u.serviceId === serviceId).length <
          e.usagesPerPeriod
    );
}
