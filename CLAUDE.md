# CLAUDE.md — SAMS (School Admission Management System)

## Project Overview
A multi-tenant, web-based admission management platform for Nigerian secondary schools. It enables applicants (parents/guardians) to submit applications digitally, school admins to review and process them, and super admins to manage branches, staff, and analytics.

## Tech Stack
- **Framework**: Next.js 15 (App Router) + React 19 + TypeScript 5 (strict mode)
- **Styling**: Tailwind CSS 4 + shadcn/ui (Radix UI primitives)
- **Database**: PostgreSQL 16 via Prisma 6 ORM
- **Auth**: NextAuth.js v5 (Auth.js) — credentials + Google OAuth
- **Forms**: React Hook Form + Zod (shared client/server validation)
- **Server State**: TanStack Query v5
- **Client State**: Zustand v5
- **Background Jobs**: BullMQ + Redis 7
- **File Storage**: AWS S3 / Cloudflare R2 (presigned URLs)
- **Payments**: Paystack (primary), Flutterwave (fallback)
- **Email**: Resend
- **SMS**: Termii (Nigerian carrier optimized)
- **Monitoring**: Sentry + PostHog

## Architecture Patterns
- **Multi-tenancy**: Shared database with organizationId on all tenant-scoped tables. RLS at query level.
- **Route Handlers**: All API logic in `src/app/api/` using Next.js Route Handlers (not Pages API routes).
- **Service Layer**: Route Handler → Service → Prisma. Business logic lives in `src/services/`.
- **Server Components by default**: Only add `'use client'` when hooks, event handlers, or browser APIs are needed.
- **Server Actions**: Use for simple mutations (form submissions). Use Route Handlers for complex operations.
- **RBAC Middleware**: `src/middleware.ts` checks auth + role on every protected route.

## Code Standards
- **TypeScript**: Strict mode. No `any` types. Define interfaces/types in `src/types/`.
- **Validation**: Every API input validated with Zod. Schemas in `src/validators/`. Shared between client forms and server routes.
- **Error Handling**: All API routes return `{ success: boolean, data?: T, error?: { code: string, message: string, details?: any } }`.
- **Auth Checks**: Every protected API route must verify session AND role. Use `getServerSession()` or `auth()`.
- **Audit Logging**: All admin mutations must log to `AuditLog` table (who, what, when, from where).
- **Money**: Store in kobo (integer). Display in Naira with ₦ symbol. Never use float for money.
- **Dates**: Store as UTC. Display in WAT (West Africa Time, UTC+1). Use `date-fns` for formatting.
- **IDs**: UUID v4 for all primary keys. Use `nanoid` for short human-readable codes (application numbers).

## Naming Conventions
| Type | Convention | Example |
|------|-----------|---------|
| Components | PascalCase | `ApplicationCard.tsx` |
| Pages | `page.tsx` in route folder | `src/app/dashboard/page.tsx` |
| API Routes | `route.ts` in api folder | `src/app/api/applications/route.ts` |
| Services | camelCase + Service | `applicationService.ts` |
| Hooks | use + PascalCase | `useApplications.ts` |
| Validators | camelCase + Schema | `applicationSchema.ts` |
| Types/Interfaces | PascalCase | `Application`, `CreateApplicationInput` |
| Constants | SCREAMING_SNAKE | `APPLICATION_STATUS`, `MAX_FILE_SIZE` |
| CSS | Tailwind utilities | No custom CSS files unless absolutely necessary |

## File Organization
```
src/
├── app/                    # Next.js App Router
│   ├── (auth)/             # Auth pages (login, register, verify, forgot-password)
│   ├── (marketing)/        # Public pages (landing, about, contact)
│   ├── dashboard/          # Applicant portal
│   ├── admin/              # School admin portal
│   ├── super-admin/        # Organization admin portal
│   └── api/                # API Route Handlers
├── components/
│   ├── ui/                 # shadcn/ui base components (DO NOT edit directly)
│   ├── forms/              # Reusable form field components
│   ├── layouts/            # Sidebar, Header, Footer, PageWrapper
│   └── shared/             # StatusBadge, FileUpload, DataTable, Timeline, etc.
├── lib/                    # Core utilities (auth, db, redis, storage, email, sms)
├── services/               # Business logic layer
├── validators/             # Zod schemas
├── types/                  # TypeScript type definitions
├── hooks/                  # Custom React hooks
├── stores/                 # Zustand stores
└── constants/              # App-wide constants (states, LGAs, class levels, etc.)
```

## Nigerian Context
- **States**: 36 states + FCT. Each has multiple LGAs. Seed data in `prisma/seed.ts`.
- **Class Levels**: JSS1, JSS2, JSS3 (Junior), SS1, SS2, SS3 (Senior)
- **Grading**: A1(75-100), B2(70-74), B3(65-69), C4(60-64), C5(55-59), C6(50-54), D7(45-49), E8(40-44), F9(0-39)
- **Currency**: Nigerian Naira (NGN). Store as kobo (1 Naira = 100 kobo). Format: ₦1,500.00
- **Phone**: +234 format. Validate Nigerian mobile patterns (070x, 080x, 081x, 090x, 091x)
- **Academic Year**: Format YYYY/YYYY (e.g., 2026/2027). Runs September to July typically.

## Application Status Flow
```
DRAFT → SUBMITTED → UNDER_REVIEW → APPROVED → EXAM_SCHEDULED → EXAM_COMPLETED → ADMITTED → ENROLLED
                                  → REJECTED (terminal, can appeal)
                                  → REVISION_REQUIRED → SUBMITTED (resubmission)
```

## Key Business Rules
1. An applicant can have only ONE active application per branch per admission cycle.
2. Application submission requires all mandatory form fields AND payment (if fee is set).
3. Admin approval is required before exam scheduling is unlocked.
4. Exam results must go through admin approval workflow before publishing to applicants.
5. Branch admins can only see/manage applications for their assigned branch.
6. Super admins have unrestricted access across all branches.
7. All document uploads are limited to 5MB per file. Accepted: PDF, JPG, PNG, DOCX.
8. Auto-save application drafts on every field change (debounced 2 seconds).

## Commands
```bash
pnpm dev              # Start development server
pnpm build            # Production build
pnpm lint             # ESLint check
pnpm type-check       # TypeScript check (tsc --noEmit)
pnpm test             # Run Vitest
pnpm test:e2e         # Run Playwright E2E tests
pnpm db:push          # Push Prisma schema to DB (dev)
pnpm db:migrate       # Create and apply migration
pnpm db:seed          # Run seed script
pnpm db:studio        # Open Prisma Studio
```
