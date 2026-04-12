# Critical Skills for Claude Code AI Assistance — SAMS Project

> A comprehensive reference guide defining the essential competencies, patterns, and knowledge areas that Claude Code must execute proficiently for the School Admission Management System to succeed. Use this document as a quality benchmark throughout development.

---

## Table of Contents

1. [Next.js 15 App Router Mastery](#1-nextjs-15-app-router-mastery)
2. [TypeScript Strict-Mode Engineering](#2-typescript-strict-mode-engineering)
3. [Database Architecture with Prisma & PostgreSQL](#3-database-architecture-with-prisma--postgresql)
4. [Authentication & Authorization Systems](#4-authentication--authorization-systems)
5. [Dynamic Form Engine Development](#5-dynamic-form-engine-development)
6. [File Upload & Document Management](#6-file-upload--document-management)
7. [Payment Gateway Integration (Nigerian Ecosystem)](#7-payment-gateway-integration-nigerian-ecosystem)
8. [Real-Time Notification System](#8-real-time-notification-system)
9. [Examination Engine & Proctoring](#9-examination-engine--proctoring)
10. [UI/UX Implementation with shadcn/ui & Tailwind](#10-uiux-implementation-with-shadcnui--tailwind)
11. [Multi-Tenancy & Data Isolation](#11-multi-tenancy--data-isolation)
12. [Performance Optimization for Nigerian Networks](#12-performance-optimization-for-nigerian-networks)
13. [Background Job Processing](#13-background-job-processing)
14. [Testing & Quality Assurance](#14-testing--quality-assurance)
15. [Security Hardening & NDPR Compliance](#15-security-hardening--ndpr-compliance)
16. [DevOps, CI/CD & Production Readiness](#16-devops-cicd--production-readiness)
17. [Nigerian Domain Knowledge](#17-nigerian-domain-knowledge)
18. [Error Handling & Resilience Patterns](#18-error-handling--resilience-patterns)
19. [State Management Architecture](#19-state-management-architecture)
20. [API Design & Integration Patterns](#20-api-design--integration-patterns)
21. [Prompt Engineering Strategy for Claude Code](#21-prompt-engineering-strategy-for-claude-code)

---

## 1. Next.js 15 App Router Mastery

### Why This Is Critical

The entire application is built on Next.js 15 with the App Router. Every page, API endpoint, layout, and middleware runs through this system. Incorrect usage leads to hydration errors, broken routing, poor SEO, and degraded performance.

### Required Competencies

**Server Components vs Client Components**
- Default to React Server Components (RSC) for all pages and layouts
- Only add `'use client'` directive when the component requires browser APIs, event handlers, `useState`, `useEffect`, or third-party client libraries
- Understand the serialization boundary — props passed from Server to Client components must be serializable (no functions, no Date objects without conversion, no class instances)
- Use Server Components for data fetching to eliminate client-side waterfalls

**Route Handlers (API Routes)**
- Build all API endpoints in `src/app/api/[resource]/route.ts` using the `GET`, `POST`, `PATCH`, `DELETE` export convention
- Return `NextResponse.json()` with proper HTTP status codes
- Parse request bodies with `request.json()` and validate immediately with Zod
- Handle `NextRequest` for accessing headers, cookies, search params
- Implement proper CORS headers for cross-origin requests

**Layouts and Route Groups**
- Use `layout.tsx` for shared UI shells (sidebar, header) that persist across navigation
- Use route groups `(auth)`, `(marketing)`, `(dashboard)` to organize routes without affecting URL structure
- Use `loading.tsx` for streaming suspense boundaries per route segment
- Use `error.tsx` for granular error boundaries per route segment
- Use `not-found.tsx` for custom 404 pages per section

**Server Actions**
- Use Server Actions (`'use server'`) for simple form mutations that don't need complex request/response handling
- Always validate inputs inside Server Actions with Zod
- Use `revalidatePath()` or `revalidateTag()` after mutations to refresh cached data
- Return structured results from Server Actions, never throw errors to the client

**Middleware**
- Implement `src/middleware.ts` for authentication checks, role-based route protection, and redirect logic
- Use `NextResponse.next()` for allowed requests, `NextResponse.redirect()` for unauthorized access
- Keep middleware lightweight — no database calls, no heavy computation
- Use matcher config to scope middleware to specific route patterns

**Data Fetching Patterns**
- Fetch data directly in Server Components using `async/await` with Prisma or service functions
- Use `fetch()` with `next: { revalidate: seconds }` for ISR (Incremental Static Regeneration) on semi-static pages like school listings
- Use `unstable_cache()` or `cache()` for deduplicating server-side data fetches within a single request
- Use TanStack Query on the client only for interactive data that requires refetching, pagination, or optimistic updates

**Parallel and Intercepting Routes**
- Use parallel routes (`@modal`) for overlay modals that preserve URL state (e.g., application detail modal over the applications list)
- Use intercepting routes for preview experiences (e.g., intercepting `/applications/[id]` to show a modal before full navigation)

### Quality Indicators

- Zero hydration mismatch warnings in development console
- No unnecessary `'use client'` directives — audit regularly
- API routes return consistent response envelopes
- Pages load with streaming (suspense boundaries visible in network waterfall)
- Navigation between dashboard sections doesn't re-render the sidebar/header

---

## 2. TypeScript Strict-Mode Engineering

### Why This Is Critical

SAMS handles sensitive personal data, financial transactions, and multi-role access control. Type safety prevents entire categories of bugs — wrong data passed to payment APIs, incorrect role checks, malformed database queries, and form validation gaps.

### Required Competencies

**Strict Configuration**
```jsonc
// tsconfig.json — non-negotiable settings
{
  "compilerOptions": {
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true,
    "exactOptionalPropertyTypes": false, // too aggressive for most libraries
    "forceConsistentCasingInFileNames": true
  }
}
```

**Zero `any` Policy**
- Never use `any` type anywhere in the codebase
- Use `unknown` for truly unknown data (e.g., webhook payloads) and narrow with type guards
- Use Zod's `z.infer<typeof schema>` to derive types from validation schemas
- Use Prisma's generated types for all database-related typing

**Discriminated Unions for Application Status**
```typescript
// Example: type-safe status handling
type ApplicationState =
  | { status: 'DRAFT'; data: DraftData }
  | { status: 'SUBMITTED'; data: SubmittedData; submittedAt: Date }
  | { status: 'APPROVED'; data: ApprovedData; reviewedBy: string }
  | { status: 'REJECTED'; data: RejectedData; reason: string };
```

**Generic Service Functions**
- Build type-safe API response wrappers: `ApiResponse<T> = { success: true; data: T } | { success: false; error: ApiError }`
- Create generic pagination types: `PaginatedResult<T> = { items: T[]; total: number; page: number; limit: number }`
- Use branded types for IDs to prevent mixing: `type ApplicationId = string & { __brand: 'ApplicationId' }`

**Prisma Type Integration**
- Use `Prisma.ApplicationGetPayload<{ include: { documents: true } }>` for queries with includes
- Create explicit return types for service functions using Prisma utility types
- Never cast Prisma results — let the types flow from query to response

### Quality Indicators

- `pnpm type-check` passes with zero errors
- No `@ts-ignore` or `@ts-expect-error` comments without adjacent explanation
- All API request/response shapes are typed with Zod inference
- IDE autocompletion works correctly throughout the entire codebase

---

## 3. Database Architecture with Prisma & PostgreSQL

### Why This Is Critical

The database is the foundation of every feature — applications, documents, exams, payments, notifications, and audit logs. Schema design mistakes are the most expensive to fix later. Query performance directly impacts user experience, especially on Nigerian networks where every millisecond of server time adds to already-high latency.

### Required Competencies

**Schema Design**
- Implement all models from `schema.prisma` with correct relations, constraints, and indexes
- Use UUID v4 for all primary keys (PostgreSQL `uuid_generate_v4()`)
- Implement soft deletes (`deletedAt` nullable timestamp) on all user-facing entities
- Use `@map()` for snake_case database column names while keeping camelCase in application code
- Use `@@map()` for snake_case table names
- Store monetary values as integers in kobo (not Naira, never floats)
- Use `Json` type for dynamic form data and score breakdowns with proper Zod validation on read/write

**Migration Strategy**
- Use `prisma migrate dev` for development migrations with descriptive names
- Use `prisma migrate deploy` for production (never `db push` in production)
- Write migration scripts for data transformations that can't be expressed as schema changes
- Test migrations against a copy of production data before deploying

**Query Optimization**
- Always use `select` to fetch only needed columns on large queries (application lists)
- Use `include` judiciously — never deep-nest includes without a clear need
- Implement cursor-based pagination for large datasets (application queue, audit logs)
- Use `groupBy` and `aggregate` for dashboard statistics instead of fetching all records
- Create composite indexes for all common query patterns (defined in schema)
- Use raw SQL via `$queryRaw` only for complex aggregations that Prisma can't express efficiently

**Connection Management**
- Use a singleton Prisma client instance (`src/lib/db.ts`) to prevent connection pool exhaustion
- Configure connection pooling via PgBouncer (Supabase/Neon provide this)
- Set appropriate pool sizes: `connection_limit` in DATABASE_URL for serverless environments
- Handle Prisma connection errors gracefully with retry logic

**Data Integrity**
- Use database-level unique constraints (not just application-level checks)
- Implement `@@unique` composites for business rules (e.g., one application per student per branch per cycle)
- Use Prisma transactions (`$transaction`) for operations that must be atomic (status change + notification + audit log)
- Validate all JSONB data with Zod schemas before writing and after reading

**Seeding**
- Create comprehensive seed script with Nigerian-specific data: all 36 states + FCT with their LGAs
- Seed realistic test data: sample organizations, branches, users, applications in various statuses
- Make seeding idempotent (safe to run multiple times without duplicates)

### Quality Indicators

- All queries complete in under 100ms for common operations (measured with Prisma query logging)
- Zero N+1 query patterns (use `include` or batch queries instead)
- Migrations are sequential, descriptive, and reversible
- Prisma Studio shows clean data with proper relations

---

## 4. Authentication & Authorization Systems

### Why This Is Critical

SAMS has three distinct user roles with vastly different permissions. A parent should never see another parent's application. A branch admin should never access another branch's data. Security failures here mean data breaches involving children's personal information — the highest possible stakes.

### Required Competencies

**NextAuth.js v5 (Auth.js) Implementation**
- Configure credentials provider with bcrypt password hashing (cost factor 12)
- Configure Google OAuth provider for convenience login
- Implement JWT strategy with short-lived access tokens (15 minutes) and refresh token rotation
- Store essential claims in JWT: `userId`, `role`, `organizationId`, `branchId`, `emailVerified`
- Implement custom sign-in page matching SAMS branding
- Handle session callbacks to enrich session with role and organization data

**Email/Phone Verification**
- Generate 6-digit OTP codes with 10-minute expiry
- Store OTP hashes (not plaintext) in the `VerificationToken` table
- Implement rate limiting: max 3 OTP requests per email/phone per hour
- Send OTP via Resend (email) and Termii (SMS) with retry logic
- Verify OTP atomically — mark as used in the same transaction that verifies the user

**Two-Factor Authentication (Admin)**
- Implement TOTP-based 2FA using `otpauth` or `speakeasy` library
- Generate QR code for authenticator app setup
- Store encrypted TOTP secret (AES-256) — never plaintext
- Enforce 2FA on all admin accounts before accessing admin dashboard
- Implement backup codes (10 single-use codes, hashed, stored securely)

**Role-Based Access Control (RBAC)**
- Define permission matrix mapping roles to allowed actions
- Implement `middleware.ts` that checks role on every request to protected routes
- Create `requireRole()` utility for API Route Handlers
- Create `requireOrganization()` check ensuring admin can only access own org data
- Create `requireBranch()` check ensuring branch admin only accesses assigned branch
- Implement row-level filtering: all Prisma queries for branch admins automatically include `branchId` filter

**Session Security**
- Set `HttpOnly`, `Secure`, `SameSite=Lax` on auth cookies
- Implement CSRF protection for all state-changing requests
- Log all authentication events (login, logout, failed attempts, password changes)
- Implement account lockout after 5 consecutive failed login attempts (30-minute lockout)
- Force session invalidation on password change

### Quality Indicators

- No route is accessible without proper authentication check
- Branch admin cannot see or modify data from another branch (tested explicitly)
- Applicant cannot access any admin API endpoint
- All auth events appear in audit logs
- 2FA cannot be bypassed by direct API calls

---

## 5. Dynamic Form Engine Development

### Why This Is Critical

The form builder is what makes SAMS flexible for different schools. Each school needs different application forms with different fields for different class levels. Without a robust dynamic form system, the platform becomes a rigid, one-school solution.

### Required Competencies

**Admin Form Builder Interface**
- Implement drag-and-drop form builder using `@dnd-kit/core` and `@dnd-kit/sortable`
- Support field types: text, number, email, phone, date, select, multi-select, checkbox, radio, file upload, textarea, rich text, section header, divider
- Field configuration panel: label, placeholder, help text, required flag, validation rules (min/max length, regex pattern, custom error message)
- Conditional logic engine: show/hide field B based on value of field A (supports equals, not-equals, contains, greater-than)
- Form preview mode rendering the exact form applicants will see
- Form versioning: editing a published form creates a new version, existing applications keep the old version reference
- Form cloning: duplicate a form template as a starting point for a new one

**JSON Schema Storage Format**
```typescript
// Form schema stored in FormTemplate.schema (JSONB)
interface FormSchema {
  version: number;
  fields: FormField[];
}

interface FormField {
  id: string;           // Unique field identifier
  type: FieldType;
  label: string;
  placeholder?: string;
  helpText?: string;
  required: boolean;
  validation?: ValidationRule[];
  options?: SelectOption[];    // For select, radio, checkbox
  conditionalLogic?: ConditionalRule;
  order: number;
  section?: string;     // Group fields into sections
  acceptedFileTypes?: string[];  // For file upload fields
  maxFileSize?: number;          // In bytes
}
```

**Applicant Form Renderer**
- Dynamic form renderer that builds React Hook Form fields from JSON schema
- Type-safe form data handling with dynamic Zod schema generation from form template
- Auto-save on every field change (debounced 2 seconds) storing draft in `Application.formData`
- Multi-step wizard splitting form sections into navigable steps
- Progress indicator showing completion percentage
- Mobile-optimized field layouts (full-width inputs, large touch targets)
- Inline validation messages matching the schema rules

**Validation Engine**
- Generate Zod validation schema dynamically from form template at runtime
- Validate on both client (immediate feedback) and server (security)
- Custom validators for Nigerian-specific fields: phone number format, NIN format, state/LGA dependency
- File upload validation: type, size, dimensions (for passport photos)

### Quality Indicators

- Admin can create a complete form with 15+ fields including conditional logic in under 5 minutes
- Form renders identically in builder preview and applicant view
- Auto-save never loses data, even on unexpected page closure
- Conditional logic works across field types without rendering glitches
- Form submissions are validated against the exact schema version used

---

## 6. File Upload & Document Management

### Why This Is Critical

Every application involves 3-8 document uploads (passport photos, birth certificates, academic records, testimonials). Uploads fail frequently on Nigerian networks. The system must handle interruptions gracefully, compress large images, and store documents securely.

### Required Competencies

**Upload Infrastructure**
- Implement presigned URL upload flow: client requests URL from API → API generates S3/R2 presigned URL → client uploads directly to storage → client confirms to API
- This offloads upload bandwidth from the application server to cloud storage
- Set presigned URL expiry to 15 minutes
- Generate unique file keys with structure: `{orgId}/{applicationId}/{documentType}/{timestamp}-{nanoid}.{ext}`

**Client-Side Upload Component**
- Drag-and-drop upload zone with click-to-browse fallback
- File type validation before upload (PDF, JPG, PNG, DOCX only)
- File size validation (max 5MB per file, configurable per field)
- Image preview with crop/resize tool for passport photographs (aspect ratio enforcement)
- Upload progress indicator with percentage and bytes transferred
- Retry logic: automatic retry up to 3 times on network failure
- Cancel upload capability
- Multi-file upload support where allowed

**Server-Side Processing**
- Image compression using Sharp: resize to max 1200px width, quality 80%, strip EXIF metadata
- Passport photo specific processing: enforce 3.5cm × 4.5cm aspect ratio, minimum 600×600px resolution
- PDF validation: verify file is valid PDF, not corrupted, within page count limits
- Virus/malware scanning integration point (can use ClamAV or cloud service)
- Generate thumbnails for image documents for admin preview

**Document Security**
- All files stored with encryption at rest (S3/R2 server-side encryption)
- No public URLs — all access via time-limited presigned URLs (15-minute expiry)
- Document access logged in audit trail
- Watermark sensitive documents with "CONFIDENTIAL" overlay when downloaded by admin
- Batch download as ZIP archive for admin (with progress tracking for large batches)

**Document Viewer**
- In-browser document preview: images rendered inline, PDFs via embedded viewer
- Zoom, rotate, and pan controls for reviewing documents
- Side-by-side view for comparing old and new document versions (resubmission)
- Admin verification checkbox per document with optional note

### Quality Indicators

- Upload succeeds reliably on 3G connections (tested with network throttling)
- Failed uploads resume from where they left off (or retry cleanly)
- Passport photos are consistently processed to correct dimensions
- No documents are publicly accessible without authentication
- Admin can review all application documents without downloading

---

## 7. Payment Gateway Integration (Nigerian Ecosystem)

### Why This Is Critical

Schools charge application fees, exam fees, and admission fees. Payment processing must work with Nigerian banking infrastructure: card payments often fail, bank transfers are preferred by many users, USSD is essential for users without smartphones. Revenue leakage from failed payment tracking is a real business risk.

### Required Competencies

**Paystack Integration (Primary)**
- Implement Paystack Popup integration for inline checkout experience
- Support payment channels: card, bank transfer, USSD, bank account
- Implement webhook handler at `/api/webhooks/paystack` for payment confirmation
- Verify webhook signature using Paystack's IP whitelist and HMAC validation
- Handle all Paystack events: `charge.success`, `transfer.success`, `transfer.failed`, `refund.processed`
- Implement transaction verification API call as fallback (in case webhook is missed)
- Store Paystack reference in `Payment.gatewayReference` for reconciliation

**Flutterwave Integration (Fallback)**
- Implement as secondary gateway when Paystack experiences downtime
- Same flow: inline checkout → webhook confirmation → transaction verification
- Map Flutterwave events to the same internal payment processing pipeline

**Payment Flow Architecture**
```
1. Applicant clicks "Submit & Pay"
2. API creates Payment record (status: PENDING) with amount from FeeStructure
3. API initializes Paystack transaction, returns authorization URL
4. Frontend opens Paystack Popup
5. User completes payment
6. Paystack sends webhook to /api/webhooks/paystack
7. Webhook handler verifies signature, verifies transaction via API
8. Update Payment record (status: PAID, gateway response stored)
9. Update Application (paymentStatus: PAID)
10. Trigger notification to applicant (receipt)
11. Log to audit trail
```

**Edge Cases**
- Handle abandoned payments: cron job checks PENDING payments older than 1 hour, verifies with Paystack API
- Handle duplicate webhooks (idempotency via gatewayReference unique check)
- Handle partial payments (shouldn't happen with fixed amounts but defend against it)
- Implement refund flow for cancelled applications
- Handle payment for resubmission (no double-charge — check if application fee already paid)

**Financial Reporting**
- Revenue tracking per branch, per class, per admission cycle
- Payment reconciliation report matching internal records with Paystack dashboard
- Generate payment receipts as downloadable PDFs with school branding
- Export financial data to CSV/Excel for accountant use

### Quality Indicators

- Payment succeeds via card, bank transfer, and USSD in testing
- Webhook failures don't result in lost payments (verification fallback works)
- No duplicate charges under any circumstance
- Financial reports match Paystack dashboard exactly
- Receipts generate correctly with school branding and Nigerian Naira formatting

---

## 8. Real-Time Notification System

### Why This Is Critical

Nigerian parents checking admission status is an anxious, high-frequency activity. Every status change — submission confirmed, revision needed, approved, exam scheduled, results released — must reach the applicant immediately through their preferred channel. Missed notifications mean confused parents, support overload, and lost trust.

### Required Competencies

**Multi-Channel Delivery**

| Channel | Provider | Use Case |
|---------|----------|----------|
| In-App | Zustand store + database | Always — primary notification display |
| Email | Resend API | Status changes, exam details, result notifications |
| SMS | Termii API | Critical alerts (approval, exam reminder, results) |
| Web Push | Web Push API | Real-time browser notifications for active users |

**Notification Service Architecture**
- Central `NotificationService` that accepts a notification intent and routes to appropriate channels
- Channel preference per user (stored in profile): allow users to opt out of SMS or email
- Template system with variable substitution: `"Dear {{parentName}}, {{studentName}}'s application (#{{applicationNumber}}) has been {{status}}."`
- Notification queue via BullMQ — never send notifications synchronously in request handlers
- Retry logic: 3 retries with exponential backoff for failed deliveries
- Delivery status tracking per notification: PENDING → SENT → DELIVERED / FAILED

**In-App Notification System**
- Notification bell icon in header with unread count badge
- Dropdown panel showing recent notifications with read/unread state
- Full notification center page with filtering by category
- Mark as read on click, mark all as read button
- Real-time updates: poll every 30 seconds or use Server-Sent Events (SSE)

**Email Templates**
- Design responsive HTML email templates that render well on Gmail, Yahoo, Outlook
- Templates for: welcome/verification, application received, revision requested, approved, rejected, exam scheduled, exam reminder (24h before), results released, admission offer
- Include school branding (logo, colors) from organization settings
- Plain text fallback for every HTML email

**SMS Integration (Termii)**
- Use Termii's API for SMS delivery (optimized for Nigerian carriers: MTN, Airtel, Glo, 9mobile)
- Keep SMS messages under 160 characters (single segment) for cost efficiency
- Register sender ID (e.g., "SAMS") with Termii for professional appearance
- Handle DND (Do Not Disturb) registered numbers gracefully — fall back to email
- Track SMS delivery status via Termii webhooks

**Automated Reminders**
- Incomplete application reminder: 3 days after last edit if still in DRAFT
- Exam reminder: 48 hours and 24 hours before scheduled exam
- Document expiry warning: 30 days before uploaded documents expire
- Admission cycle closing reminder: 7 days before deadline for draft applications

### Quality Indicators

- Notifications arrive within 30 seconds of triggering event
- Email deliverability rate above 95% (proper SPF, DKIM, DMARC configuration)
- SMS delivery confirmed on all major Nigerian carriers
- No duplicate notifications sent for the same event
- Users can control their notification preferences without missing critical updates

---

## 9. Examination Engine & Proctoring

### Why This Is Critical

The entrance exam is the primary academic assessment for admissions. The online exam must be secure against cheating, reliable on unstable connections, and fair to all applicants. The on-campus exam management must handle QR-based check-in, seat assignment, and manual score entry for hundreds of students.

### Required Competencies

**Exam Session Management (Admin)**
- Create exam sessions with: date, time range, duration, mode (online/on-campus), capacity, venue, target class levels
- View session dashboard: bookings vs capacity, checked-in vs no-show counts
- Generate seating charts for on-campus exams
- Cancel/reschedule sessions with automatic notification to all booked applicants

**Exam Scheduling (Applicant)**
- Calendar view showing available exam sessions after application approval
- Filter by mode preference (online / on-campus)
- Real-time slot availability (decrement on booking, increment on cancellation)
- Race condition handling: use database-level atomic decrement for slot booking
- Generate exam slip PDF with: student details, exam date/time/venue, QR code, instructions
- Allow one reschedule per applicant (subject to availability)

**Online Exam Engine**
- Timed exam interface with countdown timer (visible at all times)
- Question navigation panel showing answered/unanswered/flagged questions
- Question types: multiple choice (single answer), multiple choice (multiple answers), true/false, short answer
- Question randomization: shuffle question order and option order per student
- Auto-save answer on every selection (debounced 1 second) to prevent data loss
- Automatic submission when timer expires
- Manual submit with confirmation dialog

**Online Exam Security**
- Full-screen mode enforcement (exit full-screen triggers warning)
- Tab-switch detection: count and log tab switches, warn after 2, auto-submit after 5
- Copy/paste disabled within exam interface
- Right-click disabled
- Browser back/forward navigation blocked during exam
- Session token tied to single browser instance (prevent exam sharing)
- Record start time, end time, and total active time per student

**On-Campus Exam Management**
- QR code scanner interface for admin check-in (using device camera)
- Scan QR → verify booking → mark checked in → assign seat
- Manual attendance marking fallback (search by name/application number)
- Score entry interface: per-subject scores with auto-calculated totals and percentages
- Bulk score upload via CSV/Excel with validation and error reporting
- Score entry audit: track who entered/modified each score

**Result Processing**
- Automatic grading for online exams (immediate calculation on submission)
- Manual override capability for disputed answers
- Pass/fail threshold configuration per exam session
- Grade calculation based on Nigerian grading scale
- Result approval workflow: graded → reviewed by senior admin → approved for publishing
- Batch result publishing with notification trigger

### Quality Indicators

- Online exam works reliably on 3G connection (tested)
- Auto-save prevents data loss even on connection drop (answers persisted server-side)
- Tab-switch detection cannot be bypassed by common techniques
- QR check-in processes a student in under 3 seconds
- Bulk score upload handles 500 records without timeout
- Results are mathematically accurate with correct grade assignment

---

## 10. UI/UX Implementation with shadcn/ui & Tailwind

### Why This Is Critical

SAMS serves non-technical Nigerian parents on budget Android phones alongside school administrators on office desktops. The interface must be intuitive for first-time users, responsive across devices, fast to load, and visually professional to build trust. Schools choose software partly on how it looks.

### Required Competencies

**shadcn/ui Component Mastery**
- Use shadcn/ui as the foundational component library (not just install — customize)
- Extend base components with SAMS brand colors via CSS variables in `globals.css`
- Know every component available: Button, Card, Dialog, Sheet, Tabs, Table, Form, Select, Popover, Command, Calendar, Toast, Alert, Badge, Avatar, Skeleton, Progress, DropdownMenu, AlertDialog, Separator, Tooltip
- Compose complex components from shadcn primitives (e.g., ApplicationReviewPanel = Card + Tabs + Table + Dialog + Form)

**Tailwind CSS 4 Proficiency**
- Mobile-first responsive design using Tailwind breakpoints: `sm:`, `md:`, `lg:`, `xl:`
- Custom theme configuration in `tailwind.config.ts` matching SAMS design system
- Use CSS variables for dynamic theming (school-specific brand colors loaded at runtime)
- Avoid custom CSS files — everything through Tailwind utility classes
- Use `@apply` only in global styles for base typography, never in component files

**Responsive Design Patterns**
- Mobile (< 640px): single column, bottom navigation tab bar, full-width cards, stacked forms
- Tablet (640-1024px): two-column layouts where appropriate, collapsible sidebar
- Desktop (1024px+): persistent sidebar, multi-column grids, split-view panels
- Test every page at 320px width (minimum supported viewport)

**Dashboard Layout System**
- Persistent sidebar with collapsible behavior on smaller screens
- Header with breadcrumb navigation, notification bell, and user avatar dropdown
- Main content area with consistent padding and max-width constraint
- Page title + action buttons pattern for section headers
- KPI card row component for dashboard overview pages

**Data Display Components**
- Build reusable DataTable component wrapping TanStack Table with: sorting, filtering, pagination, column visibility toggle, row selection, bulk actions toolbar
- Status badge component with correct colors and icons for all 11 application states
- Timeline component for application status history (vertical, with icons and dates)
- Statistics card with trend indicator (up/down arrow, percentage change)
- Empty state illustrations for zero-data scenarios

**Form UX**
- Multi-step form wizard with step indicator and navigation
- Inline validation with error messages appearing below fields
- Loading states on all submit buttons (spinner + disabled state)
- Confirmation dialogs for destructive actions (reject, cancel, delete)
- Toast notifications for success/error feedback after actions
- Autosave indicator ("Saved" / "Saving..." / "Unsaved changes")

**Animation and Transitions**
- Page transition animations using Framer Motion for route changes
- Staggered list item animations for application cards loading
- Skeleton loading states matching the layout of actual content
- Smooth sidebar collapse/expand animation
- Status badge pulse animation for new status updates
- Toast notification slide-in/out animation

**Accessibility**
- All interactive elements have proper `aria-label` or `aria-labelledby`
- Keyboard navigation works for all flows (tab, enter, escape)
- Focus management: trap focus in modals, return focus on close
- Color contrast meets WCAG AA (4.5:1 for text, 3:1 for large text)
- Screen reader testing for critical flows (application submission, status checking)

### Quality Indicators

- Lighthouse Accessibility score above 90 on all pages
- All pages render correctly at 320px through 2560px viewport widths
- No layout shift during page load (CLS < 0.1)
- Interactive elements have visible focus indicators
- Loading states prevent user confusion on slow connections

---

## 11. Multi-Tenancy & Data Isolation

### Why This Is Critical

SAMS will serve multiple school organizations. School A's data must be completely invisible to School B. Within a school, Branch A's admin must not see Branch B's applications unless they're a Super Admin. Data leakage between tenants is a critical security failure.

### Required Competencies

**Tenant Isolation Strategy**
- Shared database, shared schema, organization-scoped data (most cost-effective for this scale)
- Every tenant-scoped table has `organizationId` foreign key
- Every database query for tenant-scoped data MUST include `organizationId` in the WHERE clause
- Create a `withOrganization()` Prisma extension or middleware that automatically injects `organizationId`

**Branch-Level Isolation**
- Branch admins see only their branch's data: applications, exam sessions, results
- All branch-scoped queries include `branchId` filter extracted from authenticated session
- Super Admins can query across branches within their organization (no branchId filter)

**Implementation Pattern**
```typescript
// Every service function receives context
interface TenantContext {
  userId: string;
  role: UserRole;
  organizationId: string;
  branchId?: string; // undefined for super admins and applicants
}

// Service function always filters by tenant
async function getApplications(ctx: TenantContext, filters: ApplicationFilters) {
  const where: Prisma.ApplicationWhereInput = {
    organizationId: ctx.organizationId,
    ...(ctx.branchId && { branchId: ctx.branchId }), // branch-level isolation
    ...filters,
  };
  return prisma.application.findMany({ where });
}
```

**Testing Isolation**
- Write explicit tests that attempt cross-tenant data access and verify it fails
- Test that branch admin cannot access another branch's applications via direct API call
- Test that applicant cannot see other applicants' data by guessing application IDs

### Quality Indicators

- No API endpoint returns data without organizationId filtering
- Branch admin API calls are always scoped to their assigned branch
- Applicant can only access their own applications regardless of URL manipulation
- Cross-tenant access attempts return 404 (not 403, to avoid information leakage)

---

## 12. Performance Optimization for Nigerian Networks

### Why This Is Critical

Many SAMS users access the platform on 2G/3G connections with high latency and frequent disconnections. Budget Android devices have limited RAM and processing power. The application must be fast and resilient under these conditions or users will abandon it.

### Required Competencies

**Bundle Optimization**
- Initial JavaScript bundle under 200KB (compressed)
- Use dynamic imports (`next/dynamic`) for heavy components: form builder, document viewer, chart libraries, rich text editor
- Analyze bundle with `@next/bundle-analyzer` — identify and eliminate unnecessary dependencies
- Tree-shake aggressively — import specific functions, not entire libraries

**Image Optimization**
- Use `next/image` for all images with proper `width`, `height`, and `sizes` attributes
- Serve WebP format with JPEG fallback
- Implement blur placeholder using base64 encoded tiny thumbnails
- Lazy load images below the fold
- Compress uploaded images server-side before storage

**Caching Strategy**
- Redis cache for: session data (5 min TTL), organization/branch config (1 hour TTL), form templates (30 min TTL), Nigerian states/LGA data (24 hour TTL), dashboard statistics (5 min TTL)
- HTTP cache headers: static assets (1 year, immutable), API responses (appropriate stale-while-revalidate)
- ISR for public school listing pages (revalidate every hour)
- Client-side caching via TanStack Query with appropriate stale times

**Offline Support (PWA)**
- Service worker for caching critical assets (app shell, fonts, icons)
- IndexedDB for storing form drafts offline
- Background sync for submitting queued form saves when connection restores
- Manifest file for Add to Home Screen capability
- Offline indicator banner when network is unavailable

**Loading UX**
- Skeleton screens matching actual content layout on every page
- Streaming SSR with React Suspense for progressive page loading
- Optimistic updates for user actions (mark notification read, save form field)
- Prefetch links on hover/focus for instant page transitions

**Database Performance**
- Connection pooling via PgBouncer (essential for serverless with many concurrent connections)
- Read replica for heavy reporting queries (dashboard analytics, data exports)
- Efficient pagination: cursor-based for infinite scroll, offset-based for numbered pages
- Avoid N+1 queries — use Prisma `include` or batch queries

### Quality Indicators

- Lighthouse Performance score above 85 on 3G throttled connection
- First Contentful Paint under 1.5 seconds on 4G
- Time to Interactive under 3.5 seconds on 3G
- Application form auto-save works during intermittent connectivity
- Dashboard loads statistics without blocking main content render

---

## 13. Background Job Processing

### Why This Is Critical

Many operations are too slow or unreliable for synchronous request handling: sending emails, sending SMS, generating PDF reports, processing bulk data imports, compressing images, and cleaning up expired data. Without background jobs, these operations either timeout or block the user interface.

### Required Competencies

**BullMQ + Redis Setup**
- Configure BullMQ with Upstash Redis or dedicated Redis instance
- Define named queues: `email`, `sms`, `pdf-generation`, `image-processing`, `data-export`, `cleanup`
- Implement worker processes for each queue with proper error handling
- Configure retry strategies: exponential backoff, max 3 retries, dead letter queue for failures

**Job Types**
- Email sending (Resend API calls with template rendering)
- SMS sending (Termii API calls)
- PDF generation (exam slips, admission letters, receipts, reports)
- Image compression and thumbnail generation
- CSV/Excel export for large datasets
- Bulk notification sending (e.g., result publication to 200 applicants)
- Stale session cleanup (daily)
- Expired OTP cleanup (hourly)
- Payment verification for abandoned transactions (every 30 minutes)

**For Serverless (Vercel)**
- Use QStash by Upstash for reliable job triggering from serverless functions
- Implement webhook-based job processing: QStash calls API endpoint, endpoint processes job
- Use Vercel Cron for scheduled jobs (cleanup, reminders, payment verification)

### Quality Indicators

- Emails arrive within 60 seconds of triggering event
- Failed jobs are retried automatically and appear in dead letter queue for manual review
- PDF generation completes within 10 seconds for single documents
- Bulk operations (200+ notifications) complete without timeout

---

## 14. Testing & Quality Assurance

### Why This Is Critical

SAMS handles personal data of minors, financial transactions, and institutional admissions decisions. Bugs in application status transitions, payment processing, or exam scoring have real-world consequences for families. Comprehensive testing prevents these failures.

### Required Competencies

**Unit Testing (Vitest)**
- Test all service functions with mocked Prisma client
- Test all Zod validation schemas with valid and invalid inputs
- Test utility functions: date formatting, money conversion, phone validation, application number generation
- Test conditional form logic engine with various field combinations
- Test exam scoring and grade calculation functions

**Component Testing (React Testing Library)**
- Test form components: field rendering, validation display, submit behavior
- Test status badge renders correct color/icon for each status
- Test multi-step wizard: step navigation, validation per step, data persistence
- Test data table: sorting, filtering, pagination, row selection
- Test upload component: file type validation, progress display, error handling

**Integration Testing (Vitest + MSW)**
- Test API route handlers end-to-end with mocked database responses
- Test authentication flow: register → verify → login → access protected route
- Test application submission flow: create → fill → upload docs → submit
- Test admin review flow: fetch → review → approve/reject → notification triggered
- Mock external services (Paystack, Resend, Termii) with MSW

**E2E Testing (Playwright)**
- Complete applicant journey: register → apply → schedule exam → view results
- Complete admin journey: login with 2FA → review application → approve → manage exam → publish results
- Payment flow with Paystack test mode
- Form builder: create form → publish → verify applicant sees correct fields
- Multi-browser testing: Chrome, Firefox, Safari
- Mobile viewport testing: 375px (iPhone SE), 390px (iPhone 14)

**Nigerian-Specific Test Data**
- Test with realistic Nigerian names, phone numbers (+234 format), addresses
- Test all 36 states + FCT with their LGAs in form dropdowns
- Test Naira formatting: ₦1,500.00, ₦50,000.00
- Test date formatting in WAT timezone
- Test phone validation for all Nigerian carrier prefixes

### Quality Indicators

- 80%+ code coverage on services and validators
- All critical user flows covered by E2E tests
- Tests run in CI pipeline and block merge on failure
- Test suite completes in under 5 minutes
- Zero flaky tests in CI

---

## 15. Security Hardening & NDPR Compliance

### Why This Is Critical

SAMS stores personal information of children, including photographs, birth certificates, and health records. Nigerian Data Protection Regulation (NDPR) mandates specific protections. A data breach involving children's data would be catastrophic for the platform and the schools using it.

### Required Competencies

**Input Validation & Sanitization**
- Validate ALL inputs with Zod on both client and server
- Sanitize HTML in any user-provided rich text to prevent XSS (use `sanitize-html` or `dompurify`)
- Parameterized queries via Prisma (SQL injection prevented by design)
- Validate file uploads server-side (don't trust client-side validation alone)

**API Security**
- Rate limiting on all endpoints via `@upstash/ratelimit` (100 req/min applicants, 300 req/min admins)
- CORS configuration allowing only production domain
- Request size limits: 10MB max for file upload endpoints, 1MB for all others
- Input length limits on all string fields
- Remove sensitive data from API responses (never return password hashes, TOTP secrets)

**Data Protection (NDPR)**
- Encrypt PII at rest using AES-256 encryption for: birth certificates, health records, home addresses
- Implement data consent tracking: what consent was given, when, for what purpose
- Build data export API: applicant can download all their personal data as JSON
- Build data deletion API: complete cascade deletion with 30-day recovery window
- Implement data retention policies: auto-archive applications older than 5 years
- Log all access to PII with accessor identity and reason

**Infrastructure Security**
- Environment variables for all secrets (never commit to Git)
- Different secrets for development, staging, and production
- Database access restricted to application server IP only
- S3/R2 bucket policy denying public access
- Regular dependency vulnerability scanning with `pnpm audit`

**Security Headers**
```typescript
// next.config.ts — security headers
const securityHeaders = [
  { key: 'X-DNS-Prefetch-Control', value: 'on' },
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
  { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
  { key: 'Content-Security-Policy', value: "default-src 'self'; ..." },
];
```

### Quality Indicators

- No OWASP Top 10 vulnerabilities found in security audit
- All PII is encrypted at rest (verified by database inspection)
- Data export produces complete, accurate personal data package
- Data deletion removes all traces (verified by database and storage inspection)
- `pnpm audit` shows zero high/critical vulnerabilities

---

## 16. DevOps, CI/CD & Production Readiness

### Why This Is Critical

Reliable deployment and monitoring prevents downtime during critical admission periods. Schools lose trust if the platform is unreachable when parents need to apply or check status. Automated pipelines prevent human error in deployment.

### Required Competencies

**CI/CD Pipeline (GitHub Actions)**
```yaml
# .github/workflows/ci.yml — triggered on every PR
jobs:
  quality:
    steps:
      - Checkout code
      - Install dependencies (pnpm, cached)
      - Run ESLint
      - Run TypeScript type-check (tsc --noEmit)
      - Run Vitest unit + integration tests
      - Run Playwright E2E tests against preview deployment
      - Check bundle size budget (fail if exceeded)
      - Report code coverage

  deploy-preview:
    steps:
      - Deploy to Vercel preview URL
      - Comment PR with preview URL

  deploy-production:
    # Only on merge to main
    steps:
      - Run Prisma migrations against production DB
      - Deploy to Vercel production
      - Run smoke tests against production
      - Notify team on success/failure
```

**Environment Management**
- Three environments: development (local), staging (auto-deploy from `develop`), production (manual approve from `main`)
- Environment-specific configuration via Vercel environment variables
- Database per environment (never share databases between environments)
- Seed data loaded automatically in development and staging

**Monitoring and Alerting**
- Sentry for error tracking with source maps
- Vercel Analytics for Web Vitals and performance
- Uptime monitoring with SMS alerts to school IT contacts
- Database monitoring: slow query alerts, connection pool exhaustion alerts
- Custom business metrics: application submissions/hour, payment success rate

**Backup and Recovery**
- Automated database backups every 6 hours (managed by Supabase/Neon)
- Point-in-time recovery capability
- File storage replication across availability zones
- Documented disaster recovery procedure with RTO of 4 hours

### Quality Indicators

- Deployment takes under 5 minutes from merge to live
- Zero manual steps in deployment process
- Error alerts arrive within 1 minute of occurrence
- Database can be restored to any point in the last 7 days
- Staging environment mirrors production configuration exactly

---

## 17. Nigerian Domain Knowledge

### Why This Is Critical

SAMS is built specifically for Nigerian secondary schools. Generic solutions miss crucial details — state/LGA hierarchies, grading systems, academic calendar, naming conventions, phone number formats, and cultural expectations. Getting these wrong makes the platform feel foreign and untrustworthy to Nigerian users.

### Required Competencies

**Education System**
- Understand the 6-3-3-4 system: 6 years primary, 3 years junior secondary (JSS1-JSS3), 3 years senior secondary (SS1-SS3), 4 years university
- Know the examination bodies: WAEC (West African Examinations Council), NECO (National Examinations Council), JAMB (Joint Admissions and Matriculation Board)
- Understand continuous assessment (CA) vs examination scoring
- Know the academic calendar: typically September-July with three terms
- Understand admission periods: typically January-March (main) and June-August (supplementary)

**Geographic Data**
- All 36 states + FCT (Abuja) with correct spelling
- All 774 LGAs mapped to their correct states
- Major cities within each state
- Geopolitical zones: North Central, North East, North West, South East, South South, South West

**Currency and Payments**
- Nigerian Naira (NGN), symbol: ₦
- Store as kobo (100 kobo = 1 Naira) — integer, never float
- Format: ₦1,500.00 (comma separator, two decimal places)
- Typical fee ranges: application fee ₦5,000-₦20,000, exam fee ₦2,000-₦10,000
- Bank transfer is often preferred over card payment

**Phone Numbers**
- Format: +234 followed by 10 digits
- Major carriers: MTN (0803, 0806, 0703, 0706, 0813, 0816, 0903, 0906), Airtel (0802, 0808, 0708, 0812, 0902), Glo (0805, 0807, 0705, 0815, 0905), 9mobile (0809, 0818, 0817, 0908, 0909)
- Validate against Nigerian mobile number patterns

**Names and Addressing**
- Common titles: Mr, Mrs, Chief, Dr, Engr, Alhaji, Alhaja, Pastor, Elder
- Names may include traditional titles and may be very long
- Address format: Number, Street, Area/Estate, City, LGA, State

### Quality Indicators

- All 36+1 states with correct LGAs load in form dropdowns
- Phone number validation accepts all Nigerian carrier formats
- Currency displays consistently as ₦X,XXX.XX throughout the application
- Grading scale calculations match WAEC/NECO standards
- Academic year format (YYYY/YYYY) used consistently

---

## 18. Error Handling & Resilience Patterns

### Why This Is Critical

On Nigerian networks, failures are the norm — API calls timeout, uploads fail, payment webhooks arrive late or never. The application must handle every failure mode gracefully, preserve user data, and provide clear recovery paths.

### Required Competencies

**API Error Handling**
```typescript
// Consistent error response format
interface ApiError {
  code: string;           // Machine-readable: VALIDATION_ERROR, NOT_FOUND, UNAUTHORIZED
  message: string;        // Human-readable message
  details?: unknown;      // Field-level errors for validation
  statusCode: number;     // HTTP status code
}

// Global error handler for API routes
function handleApiError(error: unknown): NextResponse {
  if (error instanceof ZodError) {
    return NextResponse.json({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: 'Invalid input', details: error.flatten() }
    }, { status: 400 });
  }
  if (error instanceof PrismaClientKnownRequestError) {
    // Handle specific Prisma errors (unique constraint, not found, etc.)
  }
  // Log unexpected errors to Sentry, return generic message to client
  return NextResponse.json({
    success: false,
    error: { code: 'INTERNAL_ERROR', message: 'Something went wrong' }
  }, { status: 500 });
}
```

**Client-Side Error Handling**
- React Error Boundaries at route segment level (via `error.tsx`)
- Global error boundary for unexpected rendering errors
- TanStack Query error handling with retry logic (3 retries, exponential backoff)
- Form submission error display with specific field-level feedback
- Network error detection and retry prompts
- Toast notifications for transient errors

**Data Resilience**
- Auto-save form data on every field change (debounced)
- Store form drafts in both server (Application.formData) and client (IndexedDB fallback)
- Optimistic updates with rollback on failure
- Idempotent API operations (safe to retry without side effects)
- Transaction-based operations for multi-step mutations

**External Service Resilience**
- Circuit breaker pattern for external APIs (Paystack, Termii, Resend)
- Fallback strategies: if Paystack is down, queue payment for retry; if email fails, queue for retry
- Timeout configuration: 10 seconds for payment APIs, 5 seconds for notification APIs
- Health check endpoints for monitoring external service availability

### Quality Indicators

- No unhandled promise rejections in server logs
- User never sees a raw error message or stack trace
- Form data is never lost due to errors
- Failed operations are automatically retried where safe
- Error monitoring captures and categorizes all errors

---

## 19. State Management Architecture

### Why This Is Critical

SAMS has complex state across multiple concerns: authenticated user session, in-progress form data, notification counts, active filters on data tables, file upload progress, exam timer countdown. Clean state management prevents bugs, stale data, and memory leaks.

### Required Competencies

**Server State (TanStack Query)**
- Use for ALL data fetched from APIs: applications, notifications, exam sessions, form templates
- Configure appropriate `staleTime` per query type: dashboard stats (30s), application list (1min), organization config (5min)
- Implement query invalidation after mutations
- Use `useMutation` with `onSuccess` callbacks to invalidate related queries
- Implement optimistic updates for immediate UI feedback
- Use `useInfiniteQuery` for paginated lists (application queue)

**Client State (Zustand)**
- Global UI state: sidebar collapsed, active theme, toast queue
- Notification store: unread count, recent notifications, mark as read
- Form builder state: current form layout, selected field, drag state
- Exam state: current question, answers, timer, tab-switch count
- Keep stores small and focused — one store per domain concern

**URL State**
- Use URL search params for: table filters, pagination, sort order, active tab
- Sync URL state with `useSearchParams` hook
- This enables bookmarkable filtered views and browser back/forward navigation

**Form State (React Hook Form)**
- Use React Hook Form for all forms (registration, application, review, exam management)
- Integrate with Zod via `@hookform/resolvers/zod`
- Use `useFieldArray` for dynamic form fields
- Persist form state to server on change (auto-save)

### Quality Indicators

- No stale data visible after mutations (proper invalidation)
- Page refresh preserves table filters and pagination (URL state)
- Form state survives page navigation within the wizard
- No unnecessary re-renders (verified with React DevTools profiler)
- Memory usage stable over extended sessions

---

## 20. API Design & Integration Patterns

### Why This Is Critical

Clean API design ensures the frontend and backend communicate efficiently, third-party integrations work reliably, and the system can evolve without breaking changes. Poor API design leads to over-fetching, N+1 patterns, and brittle integrations.

### Required Competencies

**RESTful API Conventions**
- Consistent resource naming: plural nouns (`/applications`, not `/application`)
- Proper HTTP methods: GET (read), POST (create), PATCH (partial update), DELETE (remove)
- Appropriate status codes: 200 (success), 201 (created), 400 (bad input), 401 (unauthorized), 403 (forbidden), 404 (not found), 409 (conflict), 422 (unprocessable), 429 (rate limited), 500 (server error)
- Consistent pagination: `?page=1&limit=20` with response metadata `{ total, page, limit, totalPages }`
- Filtering via query params: `?status=APPROVED&branch=uuid&class=JSS1`
- Sorting: `?sort=createdAt&order=desc`

**Response Envelope**
```typescript
// Every API response follows this structure
type ApiResponse<T> =
  | { success: true; data: T; meta?: PaginationMeta }
  | { success: false; error: ApiError };
```

**Webhook Handling**
- Paystack webhook: verify HMAC signature, process idempotently, respond 200 quickly then process async
- Implement webhook retry handling: same event may arrive multiple times
- Log all incoming webhooks for debugging
- Use webhook event queuing: receive → acknowledge → queue → process

**Third-Party API Integration Pattern**
- Create dedicated client modules: `src/lib/paystack.ts`, `src/lib/termii.ts`, `src/lib/resend.ts`
- Abstract provider-specific details behind clean interfaces
- Implement request/response logging for debugging
- Handle rate limits with backoff and retry
- Store API responses for reconciliation (Payment.gatewayResponse)

### Quality Indicators

- All API endpoints return consistent response envelopes
- API documentation is auto-generated or easily maintained
- Webhook handling is idempotent (safe to receive duplicate events)
- Third-party API failures don't crash the application
- API responses contain only necessary data (no over-fetching)

---

## 21. Prompt Engineering Strategy for Claude Code

### Why This Is Critical

Claude Code is your primary development tool. How you prompt it directly determines code quality, consistency, and development speed. Poor prompts produce generic code that doesn't follow project conventions. Excellent prompts produce production-ready code that fits seamlessly into the existing codebase.

### Required Competencies

**Context Loading**
- Always have `CLAUDE.md` in project root — Claude Code reads it automatically
- Reference existing files: "Follow the pattern established in `src/app/admin/applications/page.tsx`"
- Specify the Prisma models involved: "Use the `Application`, `Branch`, and `ExamSession` models"
- State the user role context: "This is for the School Admin dashboard"

**Prompt Structure Formula**
```
1. WHAT to build (feature name, component, API endpoint)
2. WHERE it lives (file paths, route structure)
3. HOW it should work (business logic, user interaction)
4. WHAT it connects to (related models, services, components)
5. WHAT standards to follow (validation, error handling, testing)
```

**Iterative Refinement**
- Start with the data model and service layer before UI
- Build API routes next, testing with curl or Postman
- Then build the UI components that consume the API
- Finally add polish: animations, loading states, error handling

**Quality Enforcement Prompts**
- "Add proper TypeScript types — no any types"
- "Include Zod validation for all inputs"
- "Add error handling with proper HTTP status codes"
- "Include loading and error states in the UI"
- "Make it responsive — mobile-first with Tailwind breakpoints"
- "Follow the existing auth pattern — check session and role"

**Debugging with Claude Code**
- Paste exact error messages with full stack traces
- Share the relevant file content for context
- Ask Claude Code to check logs: "Read the terminal output and identify the issue"
- Ask for root cause analysis: "Why is this query returning empty results?"

**Code Review with Claude Code**
- After building a feature: "Review this file for security issues, performance problems, and missing edge cases"
- Periodically: "Scan the codebase for duplicate code that should be extracted into shared utilities"
- Before deployment: "Check all API routes for proper authentication and authorization checks"

### Quality Indicators

- Each Claude Code session produces code that passes lint, type-check, and tests on first run
- Generated code follows existing project patterns without manual adjustment
- Complex features are built incrementally (3-5 focused prompts) rather than one monolithic request
- Claude Code successfully debugs issues when given proper error context

---

## Summary: Skill Priority Matrix

| Priority | Skill Area | Impact if Missing |
|----------|-----------|-------------------|
| **P0 — Blocking** | Next.js 15 App Router | Nothing works without correct routing, SSR, and API patterns |
| **P0 — Blocking** | TypeScript Strict Mode | Type errors cascade into runtime bugs across the system |
| **P0 — Blocking** | Auth & Authorization | Data breaches, unauthorized access to children's data |
| **P0 — Blocking** | Database Architecture | Data corruption, performance collapse, impossible migrations |
| **P0 — Blocking** | Multi-Tenancy Isolation | Cross-school data leakage — existential security failure |
| **P1 — Critical** | Dynamic Form Engine | Core feature — schools can't customize without it |
| **P1 — Critical** | File Upload System | Applications incomplete without document uploads |
| **P1 — Critical** | Payment Integration | Revenue collection fails — schools won't adopt |
| **P1 — Critical** | Error Handling & Resilience | Users lose data on Nigerian networks |
| **P1 — Critical** | Security & NDPR | Legal liability and reputation damage |
| **P2 — Important** | UI/UX with shadcn/Tailwind | Poor UX drives schools to competitors |
| **P2 — Important** | Notification System | Users miss critical status updates |
| **P2 — Important** | Exam Engine | Core admission workflow incomplete |
| **P2 — Important** | Performance Optimization | Unusable on budget devices / slow networks |
| **P2 — Important** | Testing | Bugs reach production, erode trust |
| **P3 — Enhancing** | Background Jobs | Features work but are slow or unreliable |
| **P3 — Enhancing** | State Management | UI inconsistencies and stale data |
| **P3 — Enhancing** | DevOps / CI/CD | Manual deployment errors and slower iteration |
| **P3 — Enhancing** | API Design Patterns | Integration friction but still functional |
| **P3 — Enhancing** | Nigerian Domain Knowledge | Usability friction — fixable post-launch |
| **P3 — Enhancing** | Prompt Engineering | Slower development but still achievable |

---

> **This document should be placed in your project repository alongside CLAUDE.md. Reference it during every development phase to ensure Claude Code is applying the right skills at the right depth for SAMS to succeed.**
