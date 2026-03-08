# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev          # Start dev server with Turbopack
npm run build        # Production build
npm run lint         # Run ESLint

# Database
npm run db:generate  # Generate Prisma client (no engine)
npm run db:push      # Push schema changes (dev only)
npm run db:migrate   # Run migrations
npm run db:seed      # Seed database (tsx prisma/seed.ts)
npm run db:studio    # Open Prisma Studio
```

> No test suite exists in this project.

## Architecture Overview

**Vynl** is a collaborative annotation/feedback SaaS built on Next.js 15 (App Router). Users upload files, annotate them, and collaborate via comments in real-time.

### Tech Stack
- **Framework**: Next.js 15 + React 19, TypeScript, Tailwind v4
- **Auth**: Clerk (JWT-based; `clerkId` is the canonical user ID — `users.id === users.clerkId`)
- **Database**: PostgreSQL via Prisma ORM with Prisma Accelerate for connection pooling. Generated client lives in `generated/prisma/` (not `node_modules`).
- **Storage**: Supabase Storage (file uploads, snapshots)
- **Realtime**: Supabase Realtime channels for live annotation/comment sync
- **Payments**: Stripe (webhooks at `/api/webhooks/stripe`, subscriptions, Stripe Customer Portal)
- **UI**: Radix UI primitives + shadcn/ui + Tailwind

### Data Model Hierarchy
```
workspaces → projects → files → annotations → comments
```
- `workspace_members` stores roles (VIEWER, COMMENTER, EDITOR, REVIEWER, ADMIN). Workspace `ownerId` is separate from members.
- Authorization always traverses up to workspace. Use `AuthorizationService` in `src/lib/authorization.ts` — a single DB query resolves access at any level.
- Role hierarchy: VIEWER(0) < COMMENTER(1) < EDITOR(2) < REVIEWER(2.5) < ADMIN(3). OWNER bypasses all role checks.

### Key Directories
- `src/app/api/` — Route handlers grouped by resource (annotations, comments, files, workspaces, etc.)
- `src/lib/` — Shared server-side utilities; key files:
  - `auth.ts` — `getCurrentUser()`, `requireAuth()`, `checkWorkspaceAccess()`, `syncUserWithClerk()`
  - `authorization.ts` — `AuthorizationService` (single source of truth for access checks)
  - `prisma.ts` — Lazy Prisma client singleton (supports both Accelerate and direct URLs)
  - `supabase.ts` / `supabase-realtime.ts` — Supabase clients (lazy proxies); admin client uses service role key
  - `subscription.ts` — Subscription management, usage limits, Stripe plan resolution
  - `limit-config.ts` — Plan limits read from env vars (not DB)
  - `annotation-types.ts` — Annotation coordinate/target type system
  - `query-keys.ts` — Centralized React Query cache keys
- `src/components/viewers/` — File type viewers (PDF, image, video, website)
- `src/components/annotation/` — Annotation overlay, toolbar, marker components
- `src/contexts/` — `UserContext` (user profile + subscription + memberships), `WorkspaceContext`
- `config/plans.json` — Plan definitions; Stripe price IDs are env var references, not hardcoded

### Annotation Coordinate System
Annotations use a structured `target` (JSON) field, not raw coordinates. See `src/lib/annotation-types.ts`. Legacy annotations use `coordinates` field — `isLegacyAnnotation()` and `migrateLegacyCoordinates()` handle backward compat.

Website files support three viewports: DESKTOP (1440×900), TABLET (768×1024), MOBILE (375×667). Annotations are viewport-scoped.

### Realtime
Server-side: `broadcastAnnotationEvent()` in `supabase-realtime.ts` sends events after API mutations. Uses a server-side channel cache. Revisions share the channel of their original file.
Client-side: `use-realtime.ts` hook subscribes to annotation/comment channels.

### Subscription / Billing
- Two plans: `free` (trial) and `pro` (monthly/yearly, multi-currency with country detection)
- Plan limits come from env vars (`FREE_PLAN_*`, `PRO_PLAN_*`) via `limit-config.ts`
- Stripe webhooks update `subscriptions` table and can lock workspaces if subscription lapses
- Users get a 14-day trial on signup

### File Types
`IMAGE`, `PDF`, `VIDEO`, `WEBSITE`. Website files are captured as snapshots via a Cloudflare Worker service and stored in Supabase Storage. Proxy URL support for serving private files.

### Environment Variables
Copy `env.example` to `.env.local`. Required:
- `DATABASE_URL` — Prisma Accelerate URL (`prisma://...`) or direct PostgreSQL URL
- `DIRECT_URL` — Direct PostgreSQL URL (for migrations)
- Clerk keys (`NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`)
- Supabase keys (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`)
- Stripe keys (`STRIPE_SECRET_KEY`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`, `STRIPE_WEBHOOK_SECRET`)
- Stripe price IDs referenced in `config/plans.json` (e.g., `STRIPE_PRO_PRICE_ID_USD`)

### Middleware
`src/middleware.ts` uses Clerk. Public routes include `/`, `/pricing`, `/blogs`, `/legal`, `/api/webhooks`, `/invite/*`, etc. All other routes require authentication.

### Deployment
Deployed on Vercel. `vercel.json` sets 60s max duration for all API routes. Build uses `build:vercel` script which sets Puppeteer env vars and runs `prisma generate` before `next build`. Cron jobs run daily for trial reminders and Stripe event processing.
