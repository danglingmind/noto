# Workspace Route Performance Analysis

## Executive Summary

The `/workspace/[id]` route is experiencing slow execution times on Vercel. Analysis reveals **critical performance bottlenecks** that are causing the route to take significantly longer than necessary.

## Current Route Structure

### Layout Component (`layout.tsx`)
1. `currentUser()` - Clerk auth check
2. `getWorkspaceData(workspaceId, user.id, false)` - Fetches workspace with projects list
3. `SubscriptionService.getWorkspaceSubscriptionInfo(workspaceId)` - **MAJOR BOTTLENECK**

### Page Component (`page.tsx`)
1. `currentUser()` - Clerk auth check (duplicate)
2. `getWorkspaceData(workspaceId, user.id, true)` - Fetches workspace with full project data including files

## Critical Performance Issues

### 🔴 Issue #1: `calculateWorkspaceUsage` is Extremely Inefficient

**Location:** `src/lib/subscription.ts:261-305`

**Current Implementation:**
```typescript
static async calculateWorkspaceUsage(workspaceId: string): Promise<UsageStats> {
  const workspace = await prisma.workspaces.findUnique({
    where: { id: workspaceId },
    include: {
      projects: {
        include: {
          files: {
            include: {
              annotations: true  // ⚠️ LOADS ALL ANNOTATIONS
            }
          }
        }
      },
      workspace_members: true
    }
  })
  
  // Then counts in JavaScript
  const totalFiles = workspace.projects.reduce(...)
  const totalAnnotations = workspace.projects.reduce(...)
}
```

**Problems:**
- Loads **ALL projects** for the workspace
- Loads **ALL files** for ALL projects
- Loads **ALL annotations** for ALL files
- Performs counting in JavaScript instead of database
- For a workspace with 100 projects, 1000 files, and 10,000 annotations, this loads **11,100+ records** just to count them!

**Impact:** 
- **500ms - 2000ms+** depending on data size
- Grows linearly with workspace size
- Can cause database timeouts on large workspaces

**Solution:** Use Prisma `_count` aggregations:
```typescript
const [workspace, projectCount, fileCount, annotationCount, memberCount] = await Promise.all([
  prisma.workspaces.findUnique({ where: { id: workspaceId } }),
  prisma.projects.count({ where: { workspaceId } }),
  prisma.files.count({ where: { projects: { workspaceId } } }),
  prisma.annotations.count({ where: { files: { projects: { workspaceId } } } }),
  prisma.workspace_members.count({ where: { workspaceId } })
])
```

**Expected Improvement:** **80-95% faster** (500-2000ms → 50-150ms)

### 🔴 Issue #2: `getWorkspaceSubscriptionInfo` Called on Every Layout Load

**Location:** `src/app/workspace/[id]/layout.tsx:33`

**Current Flow:**
1. Fetches workspace with users and members
2. Fetches subscription for owner
3. Fetches plan
4. Calls `calculateWorkspaceUsage` (the expensive function above)

**Problems:**
- Called on **every navigation** to any workspace route
- No caching despite subscription info changing infrequently
- Blocks layout rendering

**Impact:** **600-2500ms** per layout load

**Solution:** 
- Cache subscription info with `unstable_cache` (60-120s TTL)
- Move to client-side fetch if not critical for SSR
- Use React `cache()` for request-level deduplication

**Expected Improvement:** **70-90% faster** with caching

### 🟡 Issue #3: Duplicate Workspace Data Fetching

**Current Flow:**
- Layout: `getWorkspaceData(workspaceId, user.id, false)` - fetches workspace with projects
- Page: `getWorkspaceData(workspaceId, user.id, true)` - fetches workspace with projects + files

**Problems:**
- Both fetch workspace and projects
- Page fetches more data than needed initially
- No sharing of data between layout and page

**Impact:** **100-300ms** wasted

**Solution:**
- Layout only fetches minimal workspace info (name, id)
- Page fetches full workspace data
- Use React `cache()` to deduplicate requests

**Expected Improvement:** **50-70% reduction** in duplicate queries

### 🟡 Issue #4: No Request-Level Deduplication

**Current:**
- `currentUser()` called in both layout and page
- `getWorkspaceData` called with different parameters

**Solution:**
- React `cache()` already used for `getWorkspaceData`
- Clerk's `currentUser()` is already cached
- Ensure all data fetchers use `cache()`

## Performance Metrics

### Current Performance (Estimated)
- Layout: **800-2500ms**
  - Workspace data: 100-300ms
  - Subscription info: 600-2200ms (includes usage calculation)
- Page: **200-500ms**
  - Workspace data: 200-500ms
- **Total: 1000-3000ms**

### Target Performance (After Optimization)
- Layout: **150-300ms**
  - Workspace data: 50-100ms
  - Subscription info: 100-200ms (cached + optimized)
- Page: **150-300ms**
  - Workspace data: 150-300ms
- **Total: 300-600ms**

**Expected Improvement: 70-80% faster**

## Optimization Implementation Plan

### Phase 1: Fix `calculateWorkspaceUsage` (HIGHEST IMPACT)

**File:** `src/lib/subscription.ts`

Replace the inefficient nested include with database aggregations:

```typescript
static async calculateWorkspaceUsage(workspaceId: string): Promise<UsageStats> {
  // Use parallel count queries instead of loading all data
  const [workspace, projectCount, fileCount, annotationCount, memberCount] = await Promise.all([
    prisma.workspaces.findUnique({
      where: { id: workspaceId },
      select: { id: true }
    }),
    prisma.projects.count({ where: { workspaceId } }),
    prisma.files.count({
      where: {
        projects: {
          workspaceId
        }
      }
    }),
    prisma.annotations.count({
      where: {
        files: {
          projects: {
            workspaceId
          }
        }
      }
    }),
    prisma.workspace_members.count({ where: { workspaceId } })
  ])

  if (!workspace) {
    return {
      workspaces: 0,
      projects: 0,
      files: 0,
      annotations: 0,
      teamMembers: 0,
      storageGB: 0
    }
  }

  // Estimate storage (simplified)
  const estimatedStorageGB = fileCount * 0.1

  return {
    workspaces: 1,
    projects: projectCount,
    files: fileCount,
    annotations: annotationCount,
    teamMembers: memberCount,
    storageGB: estimatedStorageGB
  }
}
```

**Expected Improvement:** 80-95% faster (500-2000ms → 50-150ms)

### Phase 2: Cache `getWorkspaceSubscriptionInfo`

**File:** `src/lib/subscription.ts`

Add caching to `getWorkspaceSubscriptionInfo`:

```typescript
import { unstable_cache } from 'next/cache'
import { cache } from 'react'

const getWorkspaceSubscriptionInfoInternal = async (workspaceId: string) => {
  // ... existing implementation
}

const getCachedWorkspaceSubscriptionInfo = unstable_cache(
  getWorkspaceSubscriptionInfoInternal,
  ['workspace-subscription-info'],
  {
    revalidate: 120, // Cache for 2 minutes
    tags: ['workspace-subscription', `workspace-${workspaceId}`]
  }
)

export const getWorkspaceSubscriptionInfo = cache(async (workspaceId: string) => {
  return await getCachedWorkspaceSubscriptionInfo(workspaceId)
})
```

**Expected Improvement:** 70-90% faster on subsequent requests

### Phase 3: Optimize Layout Data Fetching

**File:** `src/app/workspace/[id]/layout.tsx`

- Only fetch minimal workspace data needed for layout
- Consider making subscription info non-blocking (load in background)

### Phase 4: Add Database Indexes (If Needed)

Ensure indexes exist for:
- `projects(workspaceId)`
- `files(projectId)` with workspace lookup
- `annotations(fileId)` with workspace lookup
- `workspace_members(workspaceId)`

## Implementation Priority

1. **🔴 CRITICAL:** Fix `calculateWorkspaceUsage` (Phase 1)
2. **🔴 CRITICAL:** Cache `getWorkspaceSubscriptionInfo` (Phase 2)
3. **🟡 HIGH:** Optimize layout data fetching (Phase 3)
4. **🟢 MEDIUM:** Add database indexes (Phase 4)

## Expected Results

After implementing all optimizations:
- **Route execution time:** 1000-3000ms → 300-600ms (70-80% improvement)
- **Database queries:** Reduced from loading thousands of records to simple counts
- **User experience:** Much faster page loads, especially for large workspaces
- **Server costs:** Reduced database load and compute time

