# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Noto** is a collaborative feedback and annotation platform for digital content. It enables teams to annotate images, PDFs, videos, and websites with contextual comments and discussions. The platform features real-time collaboration, advanced annotation targeting, and comprehensive project management.

## Core Architecture

### Tech Stack
- **Framework**: Next.js 15 with App Router and Turbopack
- **Language**: TypeScript with strict mode enabled
- **Database**: PostgreSQL via Prisma ORM with Prisma Accelerate
- **Authentication**: Clerk for user management
- **File Storage**: Supabase Storage for file uploads
- **UI**: Tailwind CSS with Shadcn/ui components built on Radix UI
- **Additional**: Puppeteer for website snapshot generation

### Key Design Patterns

**1. Workspace → Project → File Hierarchy**
- Workspaces contain multiple projects with RBAC (VIEWER, COMMENTER, EDITOR, ADMIN)
- Projects organize files and enable team collaboration
- Files support multiple formats (IMAGE, PDF, VIDEO, WEBSITE) with unified annotation system

**2. Advanced Annotation System**
- W3C-style targeting with fallbacks for robust annotation anchoring
- Coordinate system abstraction supporting multiple file types
- Sophisticated anchor resolution for web content (CSS selectors, XPath, text matching)
- Responsive positioning that adapts to zoom/scroll/resize

**3. Multi-Viewer Architecture**
- Type-specific viewers: `ImageViewer`, `PDFViewer`, `VideoViewer`, `WebsiteViewer`
- Shared annotation overlay system with viewport-aware positioning
- Unified zoom/pan/rotate controls across all viewer types

## Development Commands

### Essential Commands
```bash
# Development server with Turbopack
npm run dev

# Production build with Turbopack  
npm run build

# Start production server
npm start

# Linting
npm run lint
```

### Database Management
```bash
# Generate Prisma client after schema changes
npm run db:generate

# Create and apply migrations
npm run db:migrate

# Push schema directly to database (development)
npm run db:push

# Seed database with test data
npm run db:seed

# Open Prisma Studio
npm run db:studio
```

### Testing Commands
- No formal test framework configured yet
- Use manual testing via `npm run dev`
- Consider adding Jest + React Testing Library when implementing tests

## Project Structure

### Core Directories
```
src/
├── app/                    # Next.js App Router pages and API routes
│   ├── api/               # Backend API endpoints
│   ├── dashboard/         # Main dashboard page
│   ├── project/[id]/      # Project pages and file viewer
│   └── workspace/[id]/    # Workspace management
├── components/            # React components
│   ├── ui/               # Shadcn/ui base components
│   ├── viewers/          # File type-specific viewers
│   └── annotation/       # Annotation system components
├── hooks/                # Custom React hooks
├── lib/                  # Utility functions and core systems
└── middleware.ts         # Clerk authentication middleware
```

### Key Files
- `src/lib/annotation-system.ts` - Core annotation targeting and positioning logic
- `src/lib/prisma.ts` - Database client configuration
- `src/lib/supabase.ts` - File storage client setup  
- `src/components/file-viewer.tsx` - Main file viewing interface
- `prisma/schema.prisma` - Complete database schema with advanced features

## Database Schema Highlights

### Core Models
- **User**: Managed by Clerk, linked for workspace relationships
- **Workspace**: Team collaboration container with RBAC
- **Project**: File organization within workspaces
- **File**: Supports IMAGE, PDF, VIDEO, WEBSITE with metadata
- **Annotation**: Advanced targeting system with W3C-style selectors
- **Comment**: Threaded discussions on annotations

### Advanced Features
- **ShareableLink**: External collaboration without login
- **Notification**: Real-time user engagement updates
- **TaskAssignment**: Project management on annotations/comments
- **Tag/Folder**: Flexible content organization
- **CommentMention**: @user mentions with notifications

## Development Guidelines

### Code Style (from .cursor/rules)
- Use tabs for indentation, single quotes for strings
- PascalCase for components/types, kebab-case for files/directories
- camelCase for variables/functions/props, UPPERCASE for constants
- Prefix event handlers with 'handle', booleans with verbs
- Functional components with TypeScript interfaces

### File Naming Conventions
- Components: `kebab-case.tsx` (e.g., `file-viewer.tsx`)
- Hooks: `use-feature-name.ts` (e.g., `use-annotations.ts`)
- API routes: Standard Next.js App Router structure
- Types: `feature-types.ts` (e.g., `annotation-types.ts`)

### React Patterns
- Server Components by default, use 'use client' only when needed
- Custom hooks for reusable logic (see `hooks/` directory)
- Composition over configuration with Radix UI components
- Proper cleanup in useEffect hooks

### State Management
- Local state with useState/useReducer for component-level data
- Server state via API routes and React hooks for data fetching
- No global state management library currently implemented

## Environment Variables

Ensure these are configured:
- `DATABASE_URL` - PostgreSQL connection string
- `DIRECT_URL` - Direct database URL for migrations
- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` - Clerk public key
- `CLERK_SECRET_KEY` - Clerk private key
- `NEXT_PUBLIC_SUPABASE_URL` - Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Supabase anon key
- `SUPABASE_SERVICE_ROLE_KEY` - Supabase admin key

## Annotation System Implementation

The annotation system is the core feature with sophisticated targeting:

### Coordinate System
- **Normalized coordinates (0-1)** for storage
- **Design coordinates** for actual content positioning  
- **Screen coordinates** for user interaction
- **Viewport mapping** handles zoom/scroll/resize

### Target Types
- **RegionTarget**: Rectangular areas (images, PDFs, websites)
- **ElementTarget**: DOM elements with CSS selectors + XPath fallbacks
- **TextTarget**: Text ranges with contextual anchoring
- **TimestampTarget**: Video timeline positions

### File Type Support
- **Images**: Pan/zoom with annotation overlay
- **PDFs**: Page-aware annotations with react-pdf
- **Videos**: Timestamp-based annotations with video.js
- **Websites**: Snapshot-based with DOM element targeting

## Common Development Tasks

### Adding New File Types
1. Create viewer component in `src/components/viewers/`
2. Add file type to enum in `prisma/schema.prisma`
3. Update `FileViewer` component switch statement
4. Extend annotation system in `annotation-system.ts`

### Database Schema Changes
1. Modify `prisma/schema.prisma`
2. Run `npm run db:generate`
3. Create migration: `npm run db:migrate`
4. Update TypeScript types as needed

### Adding New API Endpoints
1. Create route in `src/app/api/` following Next.js App Router conventions
2. Use `prisma` client from `src/lib/prisma.ts`
3. Implement proper error handling and TypeScript types
4. Add authentication checks using Clerk middleware

### Styling Guidelines
- Use Tailwind utility classes for styling
- Extend theme in `tailwind.config.js` for custom values
- Follow mobile-first responsive design principles
- Use Shadcn/ui components for consistent design system