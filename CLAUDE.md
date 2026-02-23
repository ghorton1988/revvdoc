# CLAUDE.md — AI Operating Manual

> This file is read automatically by Claude Code at the start of every session.
> It defines how Claude should behave, what the project is, and what the rules are.
> Keep this file updated as your project evolves.

---

## 1. Project Identity

**Project Name:** RevvDoc
**Owner:** George Horton
**Purpose:** A mobile marketplace app that connects customers with mobile mechanics and detailers for at-home vehicle service.
**Stack:** Next.js 14 (App Router) + TypeScript strict + Tailwind CSS + Firebase Auth + Firestore + Stripe (test mode) + Google Maps JS API
**Repo:** Local project (not on GitHub yet)

---

## 2. Claude's Role in This Project

You are a senior engineering partner, not just a code generator. Your responsibilities:

- Understand the full context of the project before writing a single line of code
- Ask clarifying questions when requirements are ambiguous — do not assume
- Follow the phase system defined below — always confirm which phase we are in
- Write production-quality code: typed, documented, testable, and consistent with existing patterns
- Call out risks, tradeoffs, and architectural concerns proactively
- Never silently change behavior or rename things without flagging it

---

## 3. Coding Standards

### General
- Use clear, descriptive variable and function names — no abbreviations unless they are universal (e.g., `id`, `url`, `uid`)
- Write docstrings on all functions and classes
- Prefer explicit over implicit
- No commented-out dead code in commits

### TypeScript
- Strict mode — always (`tsconfig.json` already set)
- All types and interfaces live in `src/types/index.ts` — the single source of truth
- Use `zod` for form and API request validation
- No `any` — use `unknown` and narrow it

### React / Next.js
- Functional components only
- Client components: add `'use client'` directive at top
- Server components by default (Next.js App Router)
- Format with `prettier`, lint with `eslint`

### File Organization
```
/src
  /app              # Next.js App Router pages and API routes
    /(auth)         # Sign-in, sign-up, verify-phone
    /(customer)     # Dashboard, booking, vehicles, history
    /(technician)   # Job queue, active job
    /(admin)        # Admin panel
    /api            # Route Handlers (server-side)
  /components       # Shared UI components
    /ui             # Atomic: Button, Card, Badge, Modal
    /maps           # LiveJobMap, AddressAutocomplete
    /booking        # Booking flow components
    /vehicles       # VehicleCard, VinLookupForm
    /jobs           # StageProgressBar, TechLocationBroadcaster
  /hooks            # useAuth, useLiveJob, useGeoLocation, useNotifications
  /lib              # Firebase, Stripe, Maps clients and utilities
    /firebase       # firebase.ts (client), firebaseAdmin.ts (server-only)
    /stripe         # stripe.ts (server-only)
    /maps           # googleMaps.ts
  /services         # Firestore data access layer (one file per collection)
  /types            # index.ts — all TypeScript interfaces (single source of truth)
```

### Critical Rules
- **NEVER** import `src/lib/firebase/firebaseAdmin.ts` in components, hooks, or client services
- **NEVER** import `src/lib/stripe/stripe.ts` in components, hooks, or client services
- These server-only files are used exclusively in `src/app/api/**` Route Handlers
- All prices stored in **USD cents** (integer) — never floats
- All dates stored as Firestore `serverTimestamp()` — converted to `Date` in service layer

---

## 4. The Phase System

Every work session operates within a defined phase. **Claude must confirm the current phase before starting any substantive work.**

| Phase | Name | Focus |
|-------|------|--------|
| 0 | **Discovery** | Understand the problem fully before touching code |
| 1 | **Architecture** | Plan structure, data models, and interfaces |
| 2 | **Scaffold** | Create skeleton files, directories, configs ✅ **COMPLETE** |
| 3 | **Core Build** | Implement primary functionality |
| 4 | **Integration** | Connect components, wire up services |
| 5 | **Testing** | Write and run tests, fix failures |
| 6 | **Hardening** | Error handling, edge cases, logging |
| 7 | **Review** | Code review, cleanup, documentation |
| 8 | **Ship** | Deploy, verify, monitor |

### Phase Rules
- **Do not skip phases.** If Phase 1 is incomplete, Phase 2 has not started.
- Each phase ends with an explicit "done" checkpoint.
- If a task requires going back to a previous phase, say so explicitly.

---

## 5. Session Start Protocol

At the beginning of every session, Claude must:

1. Confirm it has read this `CLAUDE.md`
2. Ask: "Which phase are we in today, and what is the specific task?"
3. Briefly summarize its understanding of the task before starting
4. Flag any ambiguity or dependencies that need to be resolved first

---

## 6. Communication Protocol

- **Think out loud.** Before writing code, explain your plan in plain English.
- **Checkpoint before long tasks.** If a task will touch more than 3 files or take more than a few steps, pause and get confirmation before proceeding.
- **Surface tradeoffs.** When there are multiple valid approaches, present them with pros/cons.
- **Flag departures.** If following the current approach would be a mistake, say so.

---

## 7. What Claude Should Never Do

- ❌ Rename, reorganize, or refactor code that was not part of the requested task
- ❌ Delete files without explicit confirmation
- ❌ Add dependencies without asking first
- ❌ Make assumptions about environment variables — always check `.env.local` template
- ❌ Write tests that test nothing (mocks that confirm the mock works)
- ❌ Leave `TODO` comments without flagging them at the end of the session
- ❌ Start Phase 3+ work before the plan from Phase 1 has been confirmed
- ❌ Import `firebaseAdmin.ts` or `stripe.ts` (server-only) in client-side files

---

## 8. Key Decisions Log

| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-02-21 | Next.js 14 App Router (not Pages Router) | Modern routing, server components, route groups for role-based layouts |
| 2026-02-21 | Google Maps JS API (not Mapbox) | One key covers Maps + Places + Geocoding; $200/mo free credit sufficient for MVP |
| 2026-02-21 | Firestore onSnapshot for real-time (not polling) | Sub-second GPS updates to customer map; efficient delta reads |
| 2026-02-21 | Stripe PaymentIntent with capture_method: 'manual' | Pre-authorize at booking, capture only on job completion — protects customer |
| 2026-02-21 | Stripe webhook in Next.js Route Handler (not Firebase Functions) | Simpler deployment; co-located with app; Admin SDK available |
| 2026-02-21 | vehicleSnapshot denormalized in bookings | Technicians get vehicle data from booking — no direct vehicles/ query needed |
| 2026-02-21 | runTransaction for technician job acceptance | First-accept-wins — prevents two techs booking the same job |
| 2026-02-21 | GPS throttle: >10m moved AND >5s elapsed | Reduces Firestore writes from continuous to ~5-12/min |
| 2026-02-21 | OBD2 / vehicle diagnostics out of MVP scope | Manual entry only; too complex for MVP |
| 2026-02-21 | Fleet/business accounts out of MVP scope | Individual customers only; B2B is Phase 2 product |

---

## 9. Environment

```bash
# Install Node.js (if not installed)
export NVM_DIR="$HOME/.nvm" && . "$NVM_DIR/nvm.sh" && nvm use 20

# Install dependencies
npm install

# Start development server
npm run dev

# Test Stripe webhooks locally (requires Stripe CLI)
stripe listen --forward-to localhost:3000/api/stripe/webhook
```

**Required environment variables** — fill in `.env.local`:
```
NEXT_PUBLIC_FIREBASE_API_KEY
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN
NEXT_PUBLIC_FIREBASE_PROJECT_ID
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID
NEXT_PUBLIC_FIREBASE_APP_ID
FIREBASE_ADMIN_PROJECT_ID
FIREBASE_ADMIN_CLIENT_EMAIL
FIREBASE_ADMIN_PRIVATE_KEY
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
STRIPE_SECRET_KEY
STRIPE_WEBHOOK_SECRET
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
NEXT_PUBLIC_APP_URL
```

---

## 10. Current Project Status

**Last updated:** 2026-02-22
**Current phase:** 5 — Visuals ✅ COMPLETE → entering Phase 6 (Testing)

**What's working:**
- Next.js 14 project scaffolded with TypeScript + Tailwind
- Full directory structure (all route groups, pages, API routes)
- All TypeScript interfaces defined (`src/types/index.ts`)
- Firestore security rules deployed, 12 services seeded
- Firebase client + Admin SDK initialized
- Stripe server singleton + webhook handler
- Google Maps dark-theme utilities + Haversine GPS throttle
- Middleware auth + role guards (`src/middleware.ts`)
- **Auth system:** sign-in, sign-up (email + Google OAuth), verify-phone (SMS OTP), session cookies
- **Services:** userService, vehicleService, serviceService, bookingService, jobService, notificationService — all fully implemented
- **Hooks:** useAuth, useLiveJob, useGeoLocation, useNotifications — all implemented
- **Customer pages:** dashboard, vehicles, vehicles/add (VIN decode), services, bookings, booking detail, live job map (/jobs/[jobId])
- **Booking flow:** 5-step (service → vehicle → date+address → review → Stripe Elements payment)
- **Technician pages:** queue (job list + accept CTA), active-job (stage stepper + GPS broadcaster + Complete → capture payment)
- **API routes:** /api/auth/session, /api/vehicles/decode-vin, /api/admin/assign-technician, /api/stripe/create-payment-intent, /api/stripe/capture-payment, /api/stripe/webhook
- **Design system (Phase 5):**
  - Leonardo-style dark navy + neon teal palette (replacing gold + neutral dark)
  - Brand accent: `#00E5B4` (neon teal); Backgrounds: `#070E17` / `#0E1B28` / `#162436`
  - Teal glow animations: `animate-fade-up`, `animate-shimmer`, `animate-glow-pulse`
  - Global brand button hover glow (`.bg-brand:hover`)
  - Vehicle card hover: teal border glow (`hover:shadow-glow-sm`)
  - Active nav: teal line indicator at top of active item
  - Shimmer skeleton loader (replaces `animate-pulse`)
  - Subtle radial teal glow bleeding from top of body background
- **Build:** `npm run build` passes clean (30 routes, 0 errors)

**What's in progress:**
- Nothing — Phase 5 is complete

**Blockers / open questions:**
- `.env.local` must be filled in with real Firebase, Stripe, and Google Maps API keys before running
- Firestore rules deployed ✅; vehicles index (ownerId ASC, createdAt DESC) must be created manually in Firebase Console
- Stripe webhook must be registered in Stripe Dashboard (or use `stripe listen` for local dev)
- Google Maps JS API key must have Maps JavaScript API + Places API enabled in GCP Console

**Next session should start with:**
Phase 6 — Testing. Suggested order:

1. End-to-end auth flow (sign-up → sign-in → session cookie → middleware redirect)
2. Add vehicle via VIN decode (NHTSA API)
3. Full booking flow with Stripe test card (4242 4242 4242 4242)
4. Technician accept → GPS broadcast → stage advance → capture payment
5. Notifications (unread badge, mark-read)
6. Remaining stub pages: admin panel pages, /history, /job-history, /notifications, /payment-methods, /vehicles/[vehicleId]

---

*This file is a living document. Update it as the project grows.*
