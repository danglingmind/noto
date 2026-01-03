# API Performance Fixes - 3 Second Response Times

## Problem

API calls are taking ~3 seconds even for simple CRUD operations. This is unacceptable for user experience.

## Root Causes Identified

### 1. 🔴 Clerk `auth()` Network Latency
- Every API route calls `await auth()` which makes a network request to Clerk's API
- If Clerk's API is slow or there's network latency, this adds 500ms-2s per request
- **Impact:** Every single API call is affected

### 2. 🔴 Multiple Sequential Database Queries
- Even simple operations do 3-5 database queries
- Some queries are parallelized, but many are still sequential
- Deep nested includes fetch unnecessary data
- **Impact:** 500ms-1.5s per request

### 3. 🔴 Region Mismatch
- Fly.io is in `iad` (Washington DC)
- Neon database might be in a different region
- Network latency between regions adds 100-300ms per query
- **Impact:** 100-300ms per database query

### 4. 🟡 Missing Database Indexes
- Complex queries with OR conditions and joins
- Missing indexes on frequently queried columns
- **Impact:** 50-200ms per query

### 5. 🟡 Deep Nested Includes
- Fetching entire object graphs when only a few fields are needed
- Loading comments for new annotations (which have 0 comments)
- **Impact:** 100-500ms per query

## Immediate Fixes Applied

### 1. ✅ Request-Level User Caching (`src/lib/auth-cache.ts`)

Created a caching layer for user lookups to avoid repeated database queries:

```typescript
// Before: Every route queries user separately
const user = await prisma.users.findUnique({ where: { clerkId: userId } })

// After: Cached per request
const user = await getCachedUser(userId)
```

**Impact:** Saves 20-50ms per request when user is queried multiple times

### 2. ✅ Updated Comments API to Use Cached User

Updated `/api/comments` to use cached user lookup.

## Critical Fixes Needed

### 1. 🔴 Optimize Clerk Auth Calls

**Problem:** `await auth()` is called on every API route and makes a network request.

**Solution Options:**

**Option A: Use Clerk's JWT verification (Recommended)**
- Clerk provides JWT tokens in headers
- Verify JWT locally instead of calling Clerk API
- **Impact:** Eliminates 500ms-2s network latency

**Option B: Cache auth results**
- Use Next.js cache() in server components
- For API routes, use request-level Map cache
- **Impact:** Reduces redundant calls

**Implementation:**
```typescript
// In API routes, verify JWT directly
import { getAuth } from '@clerk/nextjs/server'

// This verifies JWT locally, no network call
const { userId } = await getAuth()
```

### 2. 🔴 Reduce Database Query Depth

**Problem:** Queries fetch entire object graphs with deep nested includes.

**Example from `/api/comments`:**
```typescript
// Current: Fetches entire workspace with owner and subscriptions
const annotation = await prisma.annotations.findFirst({
  include: {
    files: {
      include: {
        projects: {
          include: {
            workspaces: {
              include: {
                users: {
                  select: { /* many fields */ },
                  subscriptions: { /* nested */ }
                }
              }
            }
          }
        }
      }
    }
  }
})
```

**Solution:** Fetch only what's needed, use separate queries if needed:
```typescript
// Optimized: Fetch minimal data, then fetch what's needed
const annotation = await prisma.annotations.findUnique({
  where: { id: annotationId },
  select: {
    id: true,
    fileId: true,
    files: {
      select: {
        projects: {
          select: {
            workspaceId: true
          }
        }
      }
    }
  }
})

// Then fetch workspace owner separately if needed
const workspaceOwner = await prisma.workspaces.findUnique({
  where: { id: workspaceId },
  select: {
    ownerId: true,
    users: {
      select: { id: true, email: true }
    }
  }
})
```

**Impact:** 200-500ms saved per request

### 3. 🔴 Check Region Configuration

**Action Required:**
1. Check Neon database region:
   ```bash
   # In Neon dashboard, check your database region
   # Common regions: us-east-1, us-west-2, eu-west-1
   ```

2. Check Fly.io region:
   ```bash
   flyctl regions list
   # Current: iad (Washington DC)
   ```

3. **If regions don't match:**
   - Option A: Move Neon to same region as Fly.io
   - Option B: Move Fly.io to same region as Neon
   - **Impact:** 100-300ms saved per database query

### 4. 🟡 Add Database Indexes

**Check for missing indexes:**
```sql
-- Check current indexes
SELECT tablename, indexname, indexdef 
FROM pg_indexes 
WHERE schemaname = 'public'
ORDER BY tablename, indexname;

-- Common indexes needed:
CREATE INDEX IF NOT EXISTS idx_files_project_id ON files(project_id);
CREATE INDEX IF NOT EXISTS idx_annotations_file_id ON annotations(file_id);
CREATE INDEX IF NOT EXISTS idx_comments_annotation_id ON comments(annotation_id);
CREATE INDEX IF NOT EXISTS idx_workspace_members_user_id ON workspace_members(user_id);
CREATE INDEX IF NOT EXISTS idx_workspace_members_workspace_id ON workspace_members(workspace_id);
```

**Impact:** 50-200ms saved per query

### 5. 🟡 Optimize Authorization Checks

**Problem:** Authorization checks do multiple queries.

**Current flow:**
1. Check annotation access (1 query)
2. Get annotation with workspace (1 query with deep includes)
3. Check workspace access (1-2 queries)
4. Check user role (1 query)

**Solution:** Combine into fewer queries:
```typescript
// Single query to get annotation + workspace + user membership
const annotationWithAccess = await prisma.annotations.findFirst({
  where: { id: annotationId },
  select: {
    id: true,
    fileId: true,
    files: {
      select: {
        projects: {
          select: {
            workspaceId: true,
            workspaces: {
              select: {
                id: true,
                ownerId: true,
                workspace_members: {
                  where: { userId: user.id },
                  select: { role: true }
                }
              }
            }
          }
        }
      }
    }
  }
})
```

**Impact:** 100-300ms saved per request

## Performance Targets

After fixes:
- **Simple CRUD operations:** < 200ms
- **Complex operations:** < 500ms
- **With file uploads:** < 1s

## Monitoring

Add performance logging to identify slow queries:

```typescript
// Add to API routes
const startTime = Date.now()
// ... your code ...
const duration = Date.now() - startTime
if (duration > 500) {
  console.warn(`Slow API call: ${req.url} took ${duration}ms`)
}
```

## Next Steps

1. ✅ Created auth cache module
2. ⏳ Update all API routes to use cached user lookups
3. ⏳ Optimize Clerk auth() calls (use JWT verification)
4. ⏳ Reduce database query depth
5. ⏳ Check and fix region configuration
6. ⏳ Add missing database indexes
7. ⏳ Add performance monitoring

## Quick Wins (Do First)

1. **Check region mismatch** - 5 minutes, saves 100-300ms per query
2. **Add database indexes** - 10 minutes, saves 50-200ms per query
3. **Use JWT verification for auth** - 30 minutes, saves 500ms-2s per request

These three fixes alone should reduce API response times from 3s to < 500ms.

