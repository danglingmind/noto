# Product Requirement Document (PRD)

Product Name (Working): Markup Clone – Collaborative Feedback & Annotation Tool

## Objective

Develop a web application that replicates the functionality of Markup.io, enabling teams and clients to collaboratively review, annotate, and manage feedback on digital content (websites, PDFs, images, and videos).

The tool should be scalable, user-friendly, and designed for phased delivery: starting with an MVP and gradually expanding to advanced features and integrations.

## Tech Stack

**Frontend:** Next.js (App Router) + Shadcn UI (Tailwind-based component system)

**Authentication:** Clerk (user management, roles, external SSO in future)

**Backend / Database:** 

- **Primary:** Supabase (Postgres, Realtime, File Storage)

- **ORM/Schema Management:** Prisma (schema-first, migrations, type safety)

- **Alternative (if Supabase limitations arise):** Appwrite or Planetscale + Prisma

**File Storage:** Supabase storage (encrypted), with CDN delivery for assets

**Realtime Communication:** Supabase Realtime channels (for comments, notifications)

**Hosting/Deployment:** Vercel (frontend), Supabase cloud (backend)

**Browser Extension (Phase 2):** Chrome Extension powered by the same backend APIs

### Backend for frontend

BFF will sit between your frontend and Supabase, handling:

- Auth enforcement (Clerk → map to DB users/roles)

- Business logic (permissions, validation, transformations)

- Orchestration (calls to Supabase, storage, external APIs)

- Performance (caching, aggregation, rate limiting)

Hosting Solutions
#### Vercel

**How you’d set it up:**

Keep BFF logic inside app/api/* routes (already serverless).

Protect routes with Clerk middleware.

Call Supabase/Postgres only through these routes, not directly from frontend.


**Setup:**

Host a separate Node.js BFF service (Express/Fastify).

Use Prisma to talk to Supabase (or connect Supabase Postgres directly).

Frontend calls BFF instead of Supabase.

**Recommended Approach for Your Project**

Since your frontend is already Next.js on Vercel, the simplest & most integrated option is:

👉 Use Next.js API routes (on Vercel) as your BFF layer.

That way:

You don’t need a separate backend service.

Clerk auth middleware already integrates with API routes.

Prisma client can run inside Vercel functions (with Supabase Postgres).

All logic (upload → annotate → comment) goes through /api/* endpoints, never directly to Supabase.

Setup Steps (BFF with Vercel)

**Create API routes in Next.js:**
```
  app/api/projects/route.ts
  app/api/comments/route.ts
  app/api/files/route.ts
```

**Protect routes with Clerk middleware:**
```
import { auth } from "@clerk/nextjs/server";

export async function POST(req: Request) {
  const { userId } = auth();
  if (!userId) return new Response("Unauthorized", { status: 401 });
  // business logic here
}
```

**Handle DB operations via Prisma:**

Frontend → BFF API → Prisma → Supabase DB.

Use Supabase only for storage & realtime:

BFF generates signed upload/download URLs.

BFF subscribes frontend clients to Supabase realtime channels securely.

**Deploy on Vercel:**

Push to GitHub repo → connect with Vercel → deploy.

Add environment variables (Clerk, Supabase, Prisma DB).


## Core User Roles

**Guest (no login):** Can access shared links, view content, add comments (if permissions allow).

**Registered User:** Can upload files, create projects, annotate, comment, manage workspaces.

**Admin (workspace owner):** Manage access, permissions, integrations, billing.

## Feature Breakdown & Priority
### Phase 1 (MVP – High Priority)

✅ Must-have for product launch

1. User Authentication & Workspaces (Clerk)

    - Sign-up/login with Clerk

    - User profile management

    - Workspace creation (single user or team)

2. File Upload & Management

    - Upload multiple formats: images (PNG/JPG), PDFs, website screenshots, video (basic support)

    - Secure Supabase storage + metadata in Postgres

3. Multi-format Annotation

    - Highlight & comment on text, areas (rectangles), or points

    - Contextual annotations tied to coordinates on file or timestamp (video)

4. Visual Commenting & Threads

    - Pin comments directly on content

    - Comment threads + reply support

5. Shareable Review Links

    - Public/private links to content

    - Permissions: view only, comment allowed

6. Team Collaboration (Realtime)

    - Live comment sync (via Supabase realtime)

    - Multiple users can view & comment simultaneously

7. Secure Data Storage

    - Encrypted file storage

    - Role-based access for workspaces

### Phase 2 (Medium Priority – Workflow Enhancers)

- File & Folder Organization

    - Projects & folders

    - Tagging & search

- Real-time Notifications

    - In-app + email notifications for new comments, replies, resolutions

- Task Statuses on Comments

    - Mark comments: Open, In Progress, Resolved

- Access Controls & Permissions

    - Role-based: Viewer, Commenter, Editor, Admin

    - Invite via email

- Chrome Extension

    - Capture website screenshots for annotation

    - Save directly to workspace

### Phase 3 (Low Priority – Advanced Features & Integrations)

- Video Annotation Timeline

    - Frame-based markers

    - Comments at timestamps

- User Mentions (@mentions)

    - Notify specific users within threads

- Assignment Management

    - Assign comments/tasks to team members

- API Integrations

    - Slack, Teams, Jira, Trello

- Calendar / Deadline Management

    - Feedback deadlines

    - Review scheduling

- Single Sign-On (SSO)

    - Enterprise identity integrations

- SOC2 Compliance Prep

    - Enterprise-ready audit support

## System Architecture

### Frontend (Next.js + Shadcn)

- UI Components: Annotation tools, project dashboard, comment threads

- Data Fetching: Supabase client SDK (via edge functions where needed)

- Auth Context: Clerk SDK

### Backend (Supabase + Prisma)

- Database: Postgres (schema via Prisma migrations)

- Storage: Supabase storage bucket (versioning enabled)

- Realtime: Supabase channels (comments, status updates)

- API Layer: Edge functions for custom logic (permissions, notifications)

### Authentication (Clerk)

- Email/password, Google login (phase 1)

- Org/workspace support (phase 2)

- Enterprise SSO (phase 3)

## Database Schema (Initial Draft with Prisma)
### Tables

1. Users (managed by Clerk)

   - id, email, name, clerk_id

2. Workspaces

   - id, name, owner_id (FK → Users), created_at

3. Projects

   - id, workspace_id (FK → Workspaces), name, description, created_at

4. Files

   - id, project_id (FK → Projects), file_url, file_type, metadata, created_at

5. Annotations

   - id, file_id (FK → Files), user_id (FK → Users), annotation_type, coordinates/timestamp, comment_id (FK → Comments)

6. Comments

   - id, annotation_id (FK → Annotations), user_id, text, status (open/in-progress/resolved), created_at

7. Invitations/Permissions

   - id, workspace_id, email, role (viewer/commenter/editor/admin)

8. Notifications

   - id, user_id, event_type, payload, read_status, created_at

## Non-Functional Requirements

- Performance: Handle files up to 500MB (PDF/Video) in MVP

- Security: Encrypted file storage, Clerk JWT-based access control

- Scalability: Modular schema for adding integrations later

- Availability: Hosted on Vercel + Supabase for reliability

## Release Plan

- Phase 1 (MVP) → 3 months target

- Phase 2 (Workflow Enhancers) → next 3–4 months

- Phase 3 (Enterprise Features) → after adoption growth




## User Flows & Wireframes
### User Flows
#### Flow 1: User Authentication (Clerk)

User opens the app → Landing Page

CTA: “Sign Up” / “Log In” → Clerk widget

Options: Email/Password, Google OAuth (Phase 1), SSO (Phase 3)

After login → Redirect to Dashboard

#### Flow 2: Workspace & Project Creation

User lands on Dashboard → sees list of Workspaces

CTA: “Create New Workspace” → Modal

Input: Workspace Name

Auto-assign: Owner role

Inside Workspace → “Create Project”

Input: Project Name, Description

Shadcn Form components for input

Project page opens → empty state with CTA: “Upload File”

#### Flow 3: File Upload & Annotation

User clicks Upload File

Modal with drag-and-drop area (Shadcn Dropzone)

Allowed types: Image, PDF, Video (basic), Web Screenshot

File uploaded → displayed in Viewer Canvas

Toolbar (top or left side) with tools:

Comment Pin (point)

Highlight/Box (region)

Text Annotation (optional in Phase 2)

User clicks on content → Places annotation → Comment modal opens

Comment thread appears in Right Sidebar

#### Flow 4: Collaboration & Sharing

User clicks Share Project

Modal with link generation

Options: Public (no login), Workspace-only, Specific Users

Role selection: Viewer / Commenter / Editor

External user opens link → Sees same file with annotation tools

Realtime sync: Comments/annotations appear instantly for all collaborators

#### Flow 5: Comment Management

Sidebar → Lists all comments with status chips (Open / In Progress / Resolved)

User can:

Reply to comment (threaded)

Change status

Assign to user (Phase 3)

Resolved comments collapse automatically

#### Flow 6: Notifications (Phase 2)

New comment/reply → Notification bubble in top nav

Clerk user receives email (optional toggle)

Clicking notification → Deep-link to file + annotation location

#### Flow 7: Chrome Extension (Phase 2)

User installs extension

While browsing → Click “Capture Page”

Screenshot auto-uploads to current workspace project

Opens web app in new tab with annotation tools ready

## Wireframe Descriptions (for AI to generate UI with Shadcn)
#### A. Landing Page

Hero section: Logo + tagline (“Collaborate on feedback with ease”)

CTA: “Get Started Free” (Clerk signup)

Features section (cards with icons)

Footer with links

#### B. Dashboard (After Login)

Top Navbar: Workspace switcher (dropdown), Profile avatar (Clerk), Notifications (bell icon)

Main Area:

Grid of Workspace cards → Each with Projects inside

“+ New Workspace” button (Shadcn Dialog/Modal)

#### C. Workspace Page

Sidebar: Project list

Main Panel: Project grid (thumbnail of last uploaded file)

CTA: “+ New Project”

#### D. Project Page (Core View)

- Top Navbar: Project title, Share button

- Main Area:

   - File Viewer (center, responsive container)

   - Annotation Toolbar (floating left panel with icons: Pin, Box, Highlight)

 - Right Sidebar: Comment threads (Shadcn Accordion/List)

   - Each comment: User avatar, text, status chip

   - Reply field (Shadcn Input + Send button)

#### Upload Modal

Drag-and-drop area (Shadcn Dropzone)

File type icons (Image/PDF/Video/Website)

Upload progress bar

#### Share Modal

- Toggle: Public / Workspace / Invite

- Role dropdown: Viewer, Commenter, Editor

- Generated link with Copy button

#### Notification Drawer (Phase 2)

- Slide-over drawer from right

- List of events: “@Alex replied to your comment”

- CTA to open related file

#### Extension Popup (Phase 2)

- Minimal UI with:

  - “Capture Page” button

  - Dropdown for selecting Workspace + Project

## UI Mapping to Shadcn Components

- Navbar / Sidebar → NavigationMenu, DropdownMenu, Avatar, Badge

- Dialogs/Modals → Dialog, Sheet

- Forms → Form, Input, Textarea, Select, Button

- File Upload → Custom Dropzone + Progress (shadcn Progress)

- Comment Threads → Card, Accordion, Badge (status)

- Notifications → Sheet (slide-over), List

- Toolbars → Button + Tooltip

#### 👉 With these flows + wireframe descriptions, your AI agent can scaffold:

- Pages (/, /dashboard, /workspace/[id], /project/[id])

- Components (CommentSidebar, AnnotationToolbar, ShareModal, UploadModal)

- Integration hooks (useClerkAuth, useSupabase, usePrisma)


#### Prisma Schema (Phase 1 – MVP)
``` // schema.prisma
// Phase 1 core schema for Markup.io clone
// Database: Supabase (Postgres)

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL") // Provided by Supabase
}

/// Users are managed by Clerk, but we store them here for workspace/project linkage
model User {
  id         String    @id @default(cuid())
  clerkId    String    @unique
  email      String    @unique
  name       String?
  avatarUrl  String?
  createdAt  DateTime  @default(now())

  // Relations
  workspaces   Workspace[] @relation("UserWorkspaces")
  projects     Project[]   @relation("UserProjects")
  comments     Comment[]
  annotations  Annotation[]
}

/// Workspaces group projects and users
model Workspace {
  id        String    @id @default(cuid())
  name      String
  createdAt DateTime  @default(now())

  // Owner
  ownerId String
  owner   User @relation(fields: [ownerId], references: [id])

  // Relations
  projects   Project[]
  members    WorkspaceMember[]
}

/// Membership table for RBAC (Viewer, Commenter, Editor, Admin)
model WorkspaceMember {
  id           String    @id @default(cuid())
  role         Role
  createdAt    DateTime  @default(now())

  // Relations
  userId      String
  workspaceId String
  user        User      @relation(fields: [userId], references: [id])
  workspace   Workspace @relation(fields: [workspaceId], references: [id])
}

enum Role {
  VIEWER
  COMMENTER
  EDITOR
  ADMIN
}

/// Projects live inside workspaces
model Project {
  id          String    @id @default(cuid())
  name        String
  description String?
  createdAt   DateTime  @default(now())

  // Relations
  workspaceId String
  workspace   Workspace @relation(fields: [workspaceId], references: [id])

  ownerId String
  owner   User @relation("UserProjects", fields: [ownerId], references: [id])

  files   File[]
}

/// Files are uploaded to Supabase storage, metadata is stored here
model File {
  id        String    @id @default(cuid())
  fileUrl   String
  fileType  FileType
  metadata  Json?
  createdAt DateTime  @default(now())

  // Relations
  projectId String
  project   Project   @relation(fields: [projectId], references: [id])

  annotations Annotation[]
}

enum FileType {
  IMAGE
  PDF
  VIDEO
  WEBSITE
}

/// Annotations link files and comments (point/box/timestamp)
model Annotation {
  id           String    @id @default(cuid())
  annotationType AnnotationType
  coordinates   Json?      // {x, y, width, height} or {timestamp}
  createdAt     DateTime   @default(now())

  // Relations
  fileId String
  file   File @relation(fields: [fileId], references: [id])

  userId String
  user   User @relation(fields: [userId], references: [id])

  comments Comment[]
}

enum AnnotationType {
  PIN
  BOX
  HIGHLIGHT
  TIMESTAMP // for video
}

/// Comments are threaded discussions on annotations
model Comment {
  id        String    @id @default(cuid())
  text      String
  status    CommentStatus @default(OPEN)
  createdAt DateTime  @default(now())

  // Relations
  annotationId String
  annotation   Annotation @relation(fields: [annotationId], references: [id])

  userId String
  user   User @relation(fields: [userId], references: [id])
}

enum CommentStatus {
  OPEN
  IN_PROGRESS
  RESOLVED
}
```

### Key Notes for AI Agent

#### Clerk integration:

- Store clerkId in User table.

- Sync profile info (email, name, avatar) on login.

#### Supabase storage:

- Use File.fileUrl for the Supabase public/private storage URL.

- Store file metadata (size, resolution, duration for video, etc.) in metadata.

#### Realtime sync:

- Supabase Realtime should watch Comment and Annotation tables.

- Push changes to frontend via websockets.

#### RBAC:

- WorkspaceMember.role determines what actions a user can take (comment, annotate, edit, admin).

### Suggested File Structure
```
markup-clone/
│── .env.local               # Local env vars (Clerk, Supabase, DB)
│── next.config.js           # Next.js config
│── tailwind.config.js       # Tailwind config
│── tsconfig.json            # TypeScript config
│── package.json
│── prisma/
│   ├── schema.prisma        # Prisma schema (from PRD)
│   ├── migrations/          # Auto-generated by Prisma
│   └── seed.ts              # Seed script
│
│── src/
│   ├── app/                 # Next.js App Router
│   │   ├── layout.tsx       # Root layout (ClerkProvider, Theme)
│   │   ├── page.tsx         # Landing page
│   │   │
│   │   ├── dashboard/       # User dashboard (workspaces)
│   │   │   └── page.tsx
│   │   │
│   │   ├── workspace/
│   │   │   └── [id]/page.tsx    # Workspace view (projects)
│   │   │
│   │   ├── project/
│   │   │   └── [id]/page.tsx    # Project page (file viewer + comments)
│   │   │
│   │   ├── api/              # BFF API routes
│   │   │   ├── projects/
│   │   │   │   └── route.ts  # Create/list projects
│   │   │   ├── comments/
│   │   │   │   └── route.ts  # Add/fetch comments
│   │   │   ├── files/
│   │   │   │   └── route.ts  # File upload URLs, metadata
│   │   │   └── auth/         # Clerk webhooks or helpers
│   │   │
│   │   ├── sign-in/          # Clerk auto-generated routes
│   │   └── sign-up/
│   │
│   ├── components/           # Reusable UI components
│   │   ├── ui/               # Shadcn UI components
│   │   ├── navbar.tsx
│   │   ├── sidebar.tsx
│   │   ├── upload-modal.tsx
│   │   ├── share-modal.tsx
│   │   ├── comment-sidebar.tsx
│   │   ├── annotation-toolbar.tsx
│   │   └── notification-drawer.tsx
│   │
│   ├── lib/                  # Utilities & clients
│   │   ├── prisma.ts         # Prisma client singleton
│   │   ├── supabase.ts       # Supabase client
│   │   ├── clerk.ts          # Clerk helpers
│   │   └── auth.ts           # Role-based access helpers
│   │
│   ├── hooks/                # Custom React hooks
│   │   ├── use-auth.ts
│   │   ├── use-project.ts
│   │   ├── use-annotations.ts
│   │   └── use-realtime.ts
│   │
│   └── styles/
│       └── globals.css       # Tailwind base styles
│
│── public/                   # Static assets
│   ├── logo.svg
│   └── icons/
```

#### Key Design Choices
##### app/api/* → BFF layer

- Next.js API routes act as your backend-for-frontend.

- All DB access (via Prisma + Supabase) happens here.

##### components/ → UI building blocks

- Shadcn UI lives in components/ui.

- Higher-level app components (modals, toolbars, sidebars) live at root.

##### lib/ → Service clients

- prisma.ts: ensures only one Prisma instance.

- supabase.ts: sets up Supabase client (for storage + realtime).

- auth.ts: helpers for RBAC checks.

##### hooks/ → Reusable stateful logic

- Keep frontend logic decoupled from views.

##### prisma/ → Schema + migrations

- Central place for schema management.

- Seed data included.

#### Example Flow in This Structure

- User uploads a file → UploadModal (component)

- Calls BFF API (/api/files/route.ts)

- API generates Supabase signed URL + DB entry (via Prisma)

- Frontend uses Supabase client (lib/supabase.ts) to push file

- File metadata shows up in ProjectPage (app/project/[id]/page.tsx)

#### ⚡ This structure is scalable for MVP → enterprise. You can plug in:

- integrations/ folder (Phase 3: Slack, Jira, etc.)

- tests/ folder (unit + integration tests)

- scripts/ folder (deployment helpers, migrations)