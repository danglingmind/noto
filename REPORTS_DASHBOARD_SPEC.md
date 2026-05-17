# Vynl Reports Dashboard — Specification & Architecture

> **Purpose**: This document is a self-contained reference for building a standalone DevTools app with a Reports module backed by the Vynl PostgreSQL database.  
> Generated: 2026-04-06

---

## 1. Database Schema Overview

### 1.1 Entity Hierarchy

```
users
  └── workspaces (owned or membered)
        └── projects
              └── files
                    ├── annotations
                    │     └── comments
                    │           └── comment_mentions
                    │           └── task_assignments
                    └── revision_signoffs
                    └── shareable_links
  └── subscriptions → subscription_plans
  └── payment_history
```

### 1.2 Core Models

| Model | Primary Key | Key Fields | Notes |
|---|---|---|---|
| `users` | `id` (= `clerkId`) | `email`, `name`, `createdAt`, `trialStartDate`, `trialEndDate`, `stripeCustomerId` | Canonical user record |
| `workspaces` | `id` | `name`, `ownerId`, `subscriptionTier`, `createdAt` | Owner is separate from members |
| `workspace_members` | `id` | `userId`, `workspaceId`, `role`, `createdAt` | Roles: VIEWER < COMMENTER < EDITOR < REVIEWER < ADMIN |
| `workspace_invitations` | `id` | `email`, `workspaceId`, `status`, `invitedBy`, `createdAt`, `acceptedAt` | Statuses: PENDING, ACCEPTED, EXPIRED, CANCELLED |
| `projects` | `id` | `name`, `workspaceId`, `ownerId`, `createdAt` | |
| `files` | `id` | `fileName`, `fileType`, `fileSize`, `status`, `projectId`, `isRevision`, `parentFileId`, `revisionNumber`, `createdAt` | Types: IMAGE, PDF, VIDEO, WEBSITE |
| `annotations` | `id` | `annotationType`, `fileId`, `userId`, `createdAt`, `viewport` | Types: PIN, BOX, HIGHLIGHT, TIMESTAMP |
| `comments` | `id` | `annotationId`, `userId`, `status`, `parentId`, `createdAt` | Statuses: OPEN, IN_PROGRESS, RESOLVED; `parentId` = thread reply |
| `task_assignments` | `id` | `assignedTo`, `assignedBy`, `status`, `priority`, `dueDate`, `completedAt` | Statuses: TODO, IN_PROGRESS, REVIEW, DONE, CANCELLED |
| `subscriptions` | `id` | `userId`, `planId`, `status`, `trialStart`, `trialEnd`, `currentPeriodEnd`, `cancelAtPeriodEnd`, `canceledAt` | |
| `subscription_plans` | `id` | `name`, `displayName`, `price`, `billingInterval` | |
| `payment_history` | `id` | `userId`, `amount`, `currency`, `status`, `paidAt`, `failedAt` | Statuses: SUCCEEDED, FAILED, PENDING, REFUNDED |
| `usage_records` | `id` | `userId`, `workspaceId`, `feature`, `count`, `recordedAt` | Feature usage log |
| `shareable_links` | `id` | `token`, `projectId`, `fileId`, `permissions`, `viewCount`, `createdBy`, `expiresAt`, `lastAccessed` | |
| `tags` / `file_tags` / `project_tags` | `id` | `name`, `workspaceId`, `createdBy` | Many-to-many for files and projects |
| `folders` | `id` | `name`, `projectId`, `parentId`, `createdBy` | Nested folder hierarchy |
| `revision_signoffs` | `id` | `fileId`, `signedOffBy`, `signedOffAt`, `notes` | One per file revision |

### 1.3 Enum Reference

```
Role:               VIEWER | COMMENTER | EDITOR | REVIEWER | ADMIN
FileType:           IMAGE | PDF | VIDEO | WEBSITE
FileStatus:         PENDING | READY | FAILED
AnnotationType:     PIN | BOX | HIGHLIGHT | TIMESTAMP
CommentStatus:      OPEN | IN_PROGRESS | RESOLVED
TaskStatus:         TODO | IN_PROGRESS | REVIEW | DONE | CANCELLED
TaskPriority:       LOW | MEDIUM | HIGH | URGENT
PaymentStatus:      SUCCEEDED | FAILED | PENDING | REFUNDED
InvitationStatus:   PENDING | ACCEPTED | EXPIRED | CANCELLED
ViewportType:       DESKTOP | TABLET | MOBILE
BillingInterval:    MONTHLY | YEARLY
```

---

## 2. Report Catalogue

Each report is listed with: **description**, **data source tables**, and a **reference SQL query**.

---

### 2.1 User Analytics

#### R-U1: User Growth Over Time
Tracks new user sign-ups per day/week/month.

**Tables**: `users`

```sql
SELECT
  DATE_TRUNC('week', "createdAt") AS period,
  COUNT(*) AS new_users
FROM users
GROUP BY 1
ORDER BY 1;
```

---

#### R-U2: User Profile Summary
Per-user snapshot: workspaces owned, total memberships, projects created, files uploaded, annotations, comments.

**Tables**: `users`, `workspaces`, `workspace_members`, `projects`, `files`, `annotations`, `comments`

```sql
SELECT
  u.id,
  u.email,
  u.name,
  u."createdAt"                                AS joined_at,
  u."trialEndDate",
  COUNT(DISTINCT w.id)                         AS workspaces_owned,
  COUNT(DISTINCT wm."workspaceId")             AS workspaces_membered,
  COUNT(DISTINCT p.id)                         AS projects_created,
  COUNT(DISTINCT f.id)                         AS files_uploaded,
  COUNT(DISTINCT a.id)                         AS annotations_made,
  COUNT(DISTINCT c.id)                         AS comments_made,
  s.status                                     AS subscription_status,
  sp.name                                      AS plan_name
FROM users u
LEFT JOIN workspaces w        ON w."ownerId" = u.id
LEFT JOIN workspace_members wm ON wm."userId" = u.id
LEFT JOIN projects p          ON p."ownerId" = u.id
LEFT JOIN files f             ON f."projectId" IN (SELECT id FROM projects WHERE "ownerId" = u.id) AND f."isRevision" = false
LEFT JOIN annotations a       ON a."userId" = u.id
LEFT JOIN comments c          ON c."userId" = u.id
LEFT JOIN subscriptions s     ON s."userId" = u.id
LEFT JOIN subscription_plans sp ON sp.id = s."planId"
GROUP BY u.id, u.email, u.name, u."createdAt", u."trialEndDate", s.status, sp.name
ORDER BY u."createdAt" DESC;
```

---

#### R-U3: Trial Conversion Funnel
Users in trial → converted to paid → canceled.

**Tables**: `users`, `subscriptions`, `subscription_plans`

```sql
SELECT
  CASE
    WHEN s.status = 'TRIALING'                              THEN 'In Trial'
    WHEN s.status = 'ACTIVE' AND sp.name != 'free'         THEN 'Converted (Paid)'
    WHEN s.status IN ('CANCELED','PAST_DUE','UNPAID')       THEN 'Churned'
    ELSE 'Free / Other'
  END AS cohort,
  COUNT(DISTINCT u.id) AS user_count
FROM users u
LEFT JOIN subscriptions s  ON s."userId" = u.id
LEFT JOIN subscription_plans sp ON sp.id = s."planId"
GROUP BY 1;
```

---

### 2.2 Workspace Analytics

#### R-W1: Workspace Overview
All workspaces with owner info, member count, project count, file count, and subscription tier.

**Tables**: `workspaces`, `users`, `workspace_members`, `projects`, `files`

```sql
SELECT
  ws.id,
  ws.name,
  ws."createdAt",
  ws."subscriptionTier",
  u.email                          AS owner_email,
  COUNT(DISTINCT wm.id)            AS member_count,
  COUNT(DISTINCT p.id)             AS project_count,
  COUNT(DISTINCT f.id)             AS file_count
FROM workspaces ws
JOIN users u                ON u.id = ws."ownerId"
LEFT JOIN workspace_members wm ON wm."workspaceId" = ws.id
LEFT JOIN projects p        ON p."workspaceId" = ws.id
LEFT JOIN files f           ON f."projectId" = p.id AND f."isRevision" = false
GROUP BY ws.id, ws.name, ws."createdAt", ws."subscriptionTier", u.email
ORDER BY ws."createdAt" DESC;
```

---

#### R-W2: Workspace Member Roles Distribution
Role breakdown per workspace.

**Tables**: `workspace_members`, `workspaces`

```sql
SELECT
  ws.name AS workspace_name,
  wm.role,
  COUNT(*) AS count
FROM workspace_members wm
JOIN workspaces ws ON ws.id = wm."workspaceId"
GROUP BY ws.name, wm.role
ORDER BY ws.name, wm.role;
```

---

#### R-W3: Invitation Funnel
Invite send → accept rate per workspace.

**Tables**: `workspace_invitations`, `workspaces`

```sql
SELECT
  ws.name AS workspace_name,
  wi.status,
  COUNT(*) AS count,
  ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER (PARTITION BY ws.id), 2) AS pct
FROM workspace_invitations wi
JOIN workspaces ws ON ws.id = wi."workspaceId"
GROUP BY ws.id, ws.name, wi.status;
```

---

### 2.3 Project Analytics

#### R-P1: Project Summary per Workspace
Projects with file count, annotation count, comment count.

**Tables**: `projects`, `files`, `annotations`, `comments`

```sql
SELECT
  p.id,
  p.name,
  p."workspaceId",
  p."createdAt",
  COUNT(DISTINCT f.id)  AS file_count,
  COUNT(DISTINCT a.id)  AS annotation_count,
  COUNT(DISTINCT c.id)  AS comment_count
FROM projects p
LEFT JOIN files f       ON f."projectId" = p.id AND f."isRevision" = false
LEFT JOIN annotations a ON a."fileId" = f.id
LEFT JOIN comments c    ON c."annotationId" = a.id
GROUP BY p.id, p.name, p."workspaceId", p."createdAt"
ORDER BY p."createdAt" DESC;
```

---

#### R-P2: Activity Heatmap (projects with no recent activity)
Projects where no annotation/comment was created in the last 30 days.

**Tables**: `projects`, `annotations`, `comments`

```sql
SELECT
  p.id,
  p.name,
  MAX(a."createdAt") AS last_annotation,
  MAX(c."createdAt") AS last_comment
FROM projects p
LEFT JOIN files f       ON f."projectId" = p.id
LEFT JOIN annotations a ON a."fileId" = f.id
LEFT JOIN comments c    ON c."annotationId" = a.id
GROUP BY p.id, p.name
HAVING MAX(a."createdAt") < NOW() - INTERVAL '30 days'
    OR MAX(a."createdAt") IS NULL
ORDER BY last_annotation ASC NULLS FIRST;
```

---

### 2.4 File Analytics

#### R-F1: Files per Project (with type breakdown)

**Tables**: `files`, `projects`

```sql
SELECT
  p.id   AS project_id,
  p.name AS project_name,
  f."fileType",
  COUNT(*) AS file_count,
  SUM(f."fileSize") AS total_size_bytes
FROM files f
JOIN projects p ON p.id = f."projectId"
WHERE f."isRevision" = false
GROUP BY p.id, p.name, f."fileType"
ORDER BY p.name, f."fileType";
```

---

#### R-F2: File Revision Depth
Which files have the most revisions.

**Tables**: `files`

```sql
SELECT
  f.id,
  f."fileName",
  f."projectId",
  MAX(r."revisionNumber") AS revision_count
FROM files f
JOIN files r ON r."parentFileId" = f.id
WHERE f."isRevision" = false
GROUP BY f.id, f."fileName", f."projectId"
ORDER BY revision_count DESC
LIMIT 50;
```

---

#### R-F3: File Status Distribution
PENDING / READY / FAILED counts.

**Tables**: `files`

```sql
SELECT
  status,
  COUNT(*) AS count
FROM files
GROUP BY status;
```

---

#### R-F4: Shareable Links Usage
Most-viewed shared files/projects.

**Tables**: `shareable_links`, `files`, `projects`

```sql
SELECT
  sl.id,
  sl.permissions,
  sl."viewCount",
  sl."lastAccessed",
  sl."expiresAt",
  COALESCE(f."fileName", p.name) AS resource_name,
  CASE WHEN sl."fileId" IS NOT NULL THEN 'file' ELSE 'project' END AS resource_type
FROM shareable_links sl
LEFT JOIN files f    ON f.id = sl."fileId"
LEFT JOIN projects p ON p.id = sl."projectId"
ORDER BY sl."viewCount" DESC;
```

---

### 2.5 Annotation & Comment Analytics

#### R-A1: Annotation Volume per File Type

**Tables**: `annotations`, `files`

```sql
SELECT
  f."fileType",
  a."annotationType",
  COUNT(*) AS annotation_count
FROM annotations a
JOIN files f ON f.id = a."fileId"
GROUP BY f."fileType", a."annotationType"
ORDER BY f."fileType", annotation_count DESC;
```

---

#### R-A2: Comment Resolution Rate

**Tables**: `comments`

```sql
SELECT
  status,
  COUNT(*) AS count,
  ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER (), 2) AS pct
FROM comments
WHERE "parentId" IS NULL   -- top-level thread starters only
GROUP BY status;
```

---

#### R-A3: Top Annotators

**Tables**: `annotations`, `users`

```sql
SELECT
  u.id,
  u.email,
  COUNT(a.id) AS annotation_count
FROM annotations a
JOIN users u ON u.id = a."userId"
GROUP BY u.id, u.email
ORDER BY annotation_count DESC
LIMIT 20;
```

---

#### R-A4: Viewport Usage (Website annotations)

**Tables**: `annotations`

```sql
SELECT
  viewport,
  COUNT(*) AS count
FROM annotations
WHERE viewport IS NOT NULL
GROUP BY viewport;
```

---

### 2.6 Task Analytics

#### R-T1: Task Status & Priority Distribution

**Tables**: `task_assignments`

```sql
SELECT
  status,
  priority,
  COUNT(*) AS count
FROM task_assignments
GROUP BY status, priority
ORDER BY status, priority;
```

---

#### R-T2: Overdue Tasks

**Tables**: `task_assignments`, `users`

```sql
SELECT
  ta.id,
  ta.title,
  ta."dueDate",
  ta.status,
  ta.priority,
  u.email AS assigned_to_email
FROM task_assignments ta
JOIN users u ON u.id = ta."assignedTo"
WHERE ta."dueDate" < NOW()
  AND ta.status NOT IN ('DONE', 'CANCELLED')
ORDER BY ta."dueDate" ASC;
```

---

#### R-T3: Task Completion Time (avg days to done)

**Tables**: `task_assignments`

```sql
SELECT
  priority,
  AVG(EXTRACT(EPOCH FROM ("completedAt" - "createdAt")) / 86400) AS avg_days_to_complete
FROM task_assignments
WHERE status = 'DONE' AND "completedAt" IS NOT NULL
GROUP BY priority;
```

---

### 2.7 Subscription & Revenue Analytics

#### R-S1: Plan Distribution

**Tables**: `subscriptions`, `subscription_plans`

```sql
SELECT
  sp.name         AS plan,
  s.status,
  COUNT(*)        AS subscriber_count
FROM subscriptions s
JOIN subscription_plans sp ON sp.id = s."planId"
GROUP BY sp.name, s.status
ORDER BY sp.name, s.status;
```

---

#### R-S2: MRR (Monthly Recurring Revenue)

**Tables**: `subscriptions`, `subscription_plans`

```sql
SELECT
  DATE_TRUNC('month', s."currentPeriodStart") AS month,
  sp."billingInterval",
  SUM(
    CASE sp."billingInterval"
      WHEN 'YEARLY' THEN sp.price / 12
      ELSE sp.price
    END
  ) AS mrr_usd
FROM subscriptions s
JOIN subscription_plans sp ON sp.id = s."planId"
WHERE s.status = 'ACTIVE'
GROUP BY 1, 2
ORDER BY 1;
```

---

#### R-S3: Churn (Canceled subscriptions over time)

**Tables**: `subscriptions`

```sql
SELECT
  DATE_TRUNC('month', "canceledAt") AS month,
  COUNT(*) AS churned
FROM subscriptions
WHERE "canceledAt" IS NOT NULL
GROUP BY 1
ORDER BY 1;
```

---

#### R-S4: Payment Failure Rate

**Tables**: `payment_history`

```sql
SELECT
  DATE_TRUNC('month', "createdAt") AS month,
  status,
  COUNT(*) AS count,
  SUM(amount) AS total_amount
FROM payment_history
GROUP BY 1, 2
ORDER BY 1, 2;
```

---

#### R-S5: Trial-to-Paid Conversion Time (days)

**Tables**: `subscriptions`

```sql
SELECT
  AVG(EXTRACT(EPOCH FROM (
    "currentPeriodStart" - "trialStart"
  )) / 86400) AS avg_days_trial_to_paid
FROM subscriptions
WHERE "trialStart" IS NOT NULL
  AND status = 'ACTIVE';
```

---

### 2.8 Usage Analytics

#### R-UG1: Feature Usage by User

**Tables**: `usage_records`

```sql
SELECT
  "userId",
  feature,
  SUM(count) AS total_usage,
  DATE_TRUNC('week', "recordedAt") AS week
FROM usage_records
GROUP BY "userId", feature, week
ORDER BY week DESC, total_usage DESC;
```

---

#### R-UG2: Revision Sign-off Rate

**Tables**: `revision_signoffs`, `files`

```sql
SELECT
  f."fileType",
  COUNT(DISTINCT f.id)   AS total_revisions,
  COUNT(DISTINCT rs.id)  AS signed_off,
  ROUND(COUNT(DISTINCT rs.id) * 100.0 / NULLIF(COUNT(DISTINCT f.id), 0), 2) AS signoff_rate_pct
FROM files f
LEFT JOIN revision_signoffs rs ON rs."fileId" = f.id
WHERE f."isRevision" = true
GROUP BY f."fileType";
```

---

## 3. Reports Module Architecture (SOLID)

This section defines how to structure the Reports module in the DevTools app so it's easily extensible.

---

### 3.1 Principles Applied

| Principle | Application |
|---|---|
| **S** — Single Responsibility | Each report is its own class/module. The runner, the renderer, and the data fetcher are separate concerns. |
| **O** — Open/Closed | New reports are added by creating a new class implementing `IReport` — no existing code changes. |
| **L** — Liskov Substitution | Any `IReport` implementation is interchangeable in `ReportRegistry`. |
| **I** — Interface Segregation | `IReport`, `IReportFilter`, `IReportRenderer` are narrow interfaces; not all reports need all filters. |
| **D** — Dependency Inversion | Reports depend on `IDataSource` (abstraction), not a concrete DB client. |

---

### 3.2 Core Interfaces

```typescript
// The single contract every report must satisfy
interface IReport<TResult = unknown> {
  readonly id: string;           // e.g. "user-growth"
  readonly title: string;
  readonly description: string;
  readonly category: ReportCategory;
  readonly filters: IReportFilter[];

  fetch(params: ReportParams): Promise<TResult>;
}

// How a report fetches data (swappable: Prisma, REST, mock)
interface IDataSource {
  query<T>(sql: string, params?: unknown[]): Promise<T[]>;
}

// How a report presents data (table, chart, number card, etc.)
interface IReportRenderer<TResult = unknown> {
  render(data: TResult): React.ReactNode;
}

// Optional filter a report may expose
interface IReportFilter {
  key: string;
  label: string;
  type: 'date-range' | 'select' | 'multi-select' | 'text';
  options?: { label: string; value: string }[];
}

interface ReportParams {
  filters: Record<string, unknown>;
  pagination?: { page: number; pageSize: number };
}

type ReportCategory =
  | 'users'
  | 'workspaces'
  | 'projects'
  | 'files'
  | 'annotations'
  | 'tasks'
  | 'subscriptions'
  | 'usage';
```

---

### 3.3 Registry Pattern

```typescript
class ReportRegistry {
  private reports = new Map<string, IReport>();

  register(report: IReport): void {
    this.reports.set(report.id, report);
  }

  getAll(): IReport[] {
    return [...this.reports.values()];
  }

  getByCategory(category: ReportCategory): IReport[] {
    return this.getAll().filter(r => r.category === category);
  }

  getById(id: string): IReport | undefined {
    return this.reports.get(id);
  }
}

// Singleton export
export const reportRegistry = new ReportRegistry();
```

---

### 3.4 Example Report Implementation

```typescript
// reports/user-growth.report.ts
import { IReport, IDataSource, ReportParams } from '@/reports/types';

export interface UserGrowthRow {
  period: string;
  new_users: number;
}

export class UserGrowthReport implements IReport<UserGrowthRow[]> {
  id = 'user-growth';
  title = 'User Growth Over Time';
  description = 'New user sign-ups grouped by week';
  category = 'users' as const;
  filters = [
    {
      key: 'granularity',
      label: 'Granularity',
      type: 'select' as const,
      options: [
        { label: 'Daily', value: 'day' },
        { label: 'Weekly', value: 'week' },
        { label: 'Monthly', value: 'month' },
      ],
    },
  ];

  constructor(private readonly db: IDataSource) {}

  async fetch(params: ReportParams): Promise<UserGrowthRow[]> {
    const granularity = (params.filters.granularity as string) ?? 'week';
    return this.db.query<UserGrowthRow>(`
      SELECT
        DATE_TRUNC($1, "createdAt") AS period,
        COUNT(*) AS new_users
      FROM users
      GROUP BY 1
      ORDER BY 1
    `, [granularity]);
  }
}
```

---

### 3.5 Registering Reports

```typescript
// reports/index.ts  — the only file to edit when adding a new report
import { reportRegistry } from './registry';
import { prismaDataSource } from './data-source';
import { UserGrowthReport } from './user-growth.report';
import { WorkspaceOverviewReport } from './workspace-overview.report';
// ... other imports

reportRegistry.register(new UserGrowthReport(prismaDataSource));
reportRegistry.register(new WorkspaceOverviewReport(prismaDataSource));
// adding a new report = one new line here
```

---

### 3.6 Directory Structure

```
src/
  reports/
    types.ts                       # IReport, IDataSource, IReportFilter, etc.
    registry.ts                    # ReportRegistry singleton
    data-source.ts                 # Concrete IDataSource (Prisma / pg)
    index.ts                       # Registers all reports
    renderers/
      table-renderer.tsx           # Generic table IReportRenderer
      chart-renderer.tsx           # Line/bar chart IReportRenderer
      kpi-card-renderer.tsx        # Single-number KPI card
    categories/
      users/
        user-growth.report.ts      # R-U1
        user-profile.report.ts     # R-U2
        trial-conversion.report.ts # R-U3
      workspaces/
        workspace-overview.report.ts   # R-W1
        member-roles.report.ts         # R-W2
        invitation-funnel.report.ts    # R-W3
      projects/
        project-summary.report.ts      # R-P1
        inactive-projects.report.ts    # R-P2
      files/
        files-per-project.report.ts    # R-F1
        revision-depth.report.ts       # R-F2
        file-status.report.ts          # R-F3
        shareable-links.report.ts      # R-F4
      annotations/
        annotation-volume.report.ts    # R-A1
        comment-resolution.report.ts   # R-A2
        top-annotators.report.ts       # R-A3
        viewport-usage.report.ts       # R-A4
      tasks/
        task-distribution.report.ts    # R-T1
        overdue-tasks.report.ts        # R-T2
        completion-time.report.ts      # R-T3
      subscriptions/
        plan-distribution.report.ts    # R-S1
        mrr.report.ts                  # R-S2
        churn.report.ts                # R-S3
        payment-failures.report.ts     # R-S4
        trial-conversion-time.report.ts # R-S5
      usage/
        feature-usage.report.ts        # R-UG1
        signoff-rate.report.ts         # R-UG2
  app/
    devtools/
      reports/
        page.tsx                   # Report browser (list all, filter by category)
        [reportId]/
          page.tsx                 # Individual report page (fetch + render)
```

---

## 4. Data Source Implementation

```typescript
// reports/data-source.ts
import { PrismaClient } from '@prisma/client';
import { IDataSource } from './types';

class PrismaDataSource implements IDataSource {
  constructor(private prisma: PrismaClient) {}

  async query<T>(sql: string, params: unknown[] = []): Promise<T[]> {
    return this.prisma.$queryRawUnsafe<T[]>(sql, ...params);
  }
}

export const prismaDataSource = new PrismaDataSource(
  new PrismaClient()
);
```

---

## 5. UI Layer Recommendations

- **Report Browser**: Grid of report cards grouped by category with search/filter.
- **Individual Report Page**: Renders filter controls (from `report.filters`), calls `report.fetch()`, passes result to a matched `IReportRenderer`.
- **Renderer Selection**: Map from `ReportCategory` (or explicit renderer hint on the report) to a renderer component. Default to table.
- **Export**: Table renderer should support CSV download via `papaparse` or similar — no per-report code needed.
- **Refresh**: Each report page has a "Refresh" button + optional `refreshInterval` prop for live data.
- **Pagination**: Pass `pagination` in `ReportParams`; reports that support it will limit/offset their query.

---

## 6. Recommended Tech Stack for DevTools App

| Concern | Choice |
|---|---|
| Framework | Next.js 15 (App Router) — consistent with Vynl |
| Database client | Prisma (same schema, separate read-only connection) or direct `pg` for `$queryRawUnsafe` |
| Charts | Recharts or Tremor |
| Tables | TanStack Table v8 |
| Auth | Same Clerk instance — admin-only route group |
| Styling | Tailwind v4 (same as Vynl) |

---

## 7. Access Control Note

The DevTools app should connect to the same PostgreSQL database with a **read-only** database role. Never expose write access. Recommended: create a `devtools_readonly` Postgres role:

```sql
CREATE ROLE devtools_readonly LOGIN PASSWORD '...';
GRANT CONNECT ON DATABASE vynl_production TO devtools_readonly;
GRANT USAGE ON SCHEMA public TO devtools_readonly;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO devtools_readonly;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO devtools_readonly;
```

---

## 8. Checklist: Adding a New Report

1. Create `src/reports/categories/<category>/<report-name>.report.ts`
2. Implement `IReport<YourResultType>` — define `id`, `title`, `description`, `category`, `filters`, and `fetch()`
3. Register in `src/reports/index.ts` with one line
4. Done. The report browser and individual report page pick it up automatically.
