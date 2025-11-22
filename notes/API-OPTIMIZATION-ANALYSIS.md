# API Optimization Analysis - Project Page

## Executive Summary

The `/project/<id>` page makes **8-10 redundant API calls** on every load that could be cached in app-level context. Many of these checks are repeated across different pages, causing unnecessary database queries and slow page loads.

## Current API Calls on Project Page Load

### CriticalProjectData (Server Component)
1. ✅ `currentUser()` - Clerk auth (necessary)
2. ❌ `syncUserWithClerk(user)` - **REDUNDANT** - Called on every page
3. ❌ `getProjectData(projectId, user.id, false)` - Project info (necessary, but could cache)
4. ❌ `getWorkspaceAccessStatus(workspaceId)` - **REDUNDANT** - Subscription check (can cache)
5. ❌ `getProjectMembership(workspaceId, user.id)` - **REDUNDANT** - Role check (can cache)
6. ❌ `getWorkspaceBasicInfo(workspaceId)` - **REDUNDANT** - Basic info (can cache)
7. ❌ `calculateUsageNotification()` - Usage check (can cache)

### ProjectFilesStream (Server Component)
8. ❌ `getProjectData(projectId, clerkId, true, 20)` - **DUPLICATE** - Already fetched above
9. ❌ `getProjectFilesCount(projectId, clerkId)` - File count (necessary)
10. ❌ `getProjectMembership(workspaceId, clerkId)` - **DUPLICATE** - Already fetched above

## Redundant API Calls Identified

### 1. User Sync (`syncUserWithClerk`)
**Called on:** Every page (dashboard, project, workspace, file viewer, settings, etc.)
**Frequency:** 10+ times per session
**Impact:** ~50-100ms per call
**Solution:** Cache in app context, sync once on app load

### 2. Workspace Access Status (`getWorkspaceAccessStatus`)
**Called on:** Every project/workspace page
**Frequency:** 5-10 times per session
**Impact:** ~100-200ms per call (includes subscription check)
**Solution:** Cache in context with polling (60s interval)

### 3. Project Membership (`getProjectMembership`)
**Called on:** Every project page (called TWICE - CriticalProjectData + ProjectFilesStream)
**Frequency:** 2x per project page load
**Impact:** ~20-50ms per call
**Solution:** Cache workspace memberships in context (workspaceId -> role map)

### 4. Workspace Basic Info (`getWorkspaceBasicInfo`)
**Called on:** Every project/workspace page
**Frequency:** 5-10 times per session
**Impact:** ~20-50ms per call
**Solution:** Cache in context with workspace data

### 5. Project Data (`getProjectData`)
**Called on:** Every project page (called TWICE - once without files, once with files)
**Frequency:** 2x per project page load
**Impact:** ~100-200ms per call
**Solution:** Better caching strategy, avoid duplicate calls

## Data That Should Be in App Context

### User Context (App-Level)
- ✅ User profile (id, name, email, avatarUrl)
- ✅ User subscription status (active, trial, expired)
- ✅ User trial end date
- ✅ User's owned workspaces
- ✅ User's workspace memberships (workspaceId -> role map)

### Workspace Context (Per-Workspace)
- ✅ Workspace basic info (id, name, ownerId)
- ✅ Workspace access status (isLocked, reason, ownerEmail)
- ✅ Workspace subscription status (owner's subscription)
- ✅ Workspace members (for current workspace only)

### Project Context (Per-Project)
- ⚠️ Project data (can be cached but less critical)
- ⚠️ Project files (can be cached but less critical)

## Optimization Plan

### Phase 1: Create App-Level Context (HIGH PRIORITY)

#### 1.1 User Context Provider
**File:** `src/contexts/user-context.tsx`

**Data to Store:**
```typescript
interface UserContextData {
  // User profile
  user: {
    id: string
    clerkId: string
    name: string | null
    email: string
    avatarUrl: string | null
  }
  
  // Subscription & trial
  subscription: {
    status: 'active' | 'trial' | 'expired' | 'inactive'
    trialEndDate: Date | null
    hasActiveSubscription: boolean
    lastChecked: Date
  }
  
  // Workspace memberships (workspaceId -> role)
  workspaceMemberships: Map<string, {
    role: 'VIEWER' | 'COMMENTER' | 'EDITOR' | 'ADMIN' | 'OWNER'
    workspaceId: string
    lastChecked: Date
  }>
  
  // Loading states
  isLoading: boolean
  error: string | null
}
```

**Features:**
- Load user data once on app initialization
- Poll subscription status every 5 minutes
- Poll workspace memberships every 10 minutes
- Provide hooks: `useUser()`, `useUserSubscription()`, `useWorkspaceRole(workspaceId)`

#### 1.2 Workspace Context Provider
**File:** `src/contexts/workspace-context.tsx`

**Data to Store:**
```typescript
interface WorkspaceContextData {
  // Current workspace
  currentWorkspace: {
    id: string
    name: string
    ownerId: string
    ownerEmail: string
    ownerName: string | null
  } | null
  
  // Workspace access status (per workspace)
  workspaceAccess: Map<string, {
    isLocked: boolean
    reason: 'trial_expired' | 'payment_failed' | 'subscription_inactive' | null
    ownerEmail: string
    ownerId: string
    ownerName: string | null
    lastChecked: Date
  }>
  
  // Loading states
  isLoading: boolean
  error: string | null
}
```

**Features:**
- Cache workspace access status per workspace
- Poll workspace access status every 60 seconds
- Provide hooks: `useWorkspaceAccess(workspaceId)`, `useCurrentWorkspace()`

### Phase 2: Update Server Components (MEDIUM PRIORITY)

#### 2.1 Remove Redundant Calls
- Remove `syncUserWithClerk` from individual pages (load from context)
- Remove `getProjectMembership` duplicate calls
- Remove `getWorkspaceAccessStatus` from pages (use context)
- Remove `getWorkspaceBasicInfo` from pages (use context)

#### 2.2 Use Context Data
- Pass user data from context to server components via props
- Pass workspace access status from context
- Pass membership roles from context

### Phase 3: Implement Polling Mechanism (MEDIUM PRIORITY)

#### 3.1 Subscription Polling
- Poll `/api/subscriptions` every 5 minutes
- Update context when subscription status changes
- Show toast notification on status change

#### 3.2 Workspace Access Polling
- Poll workspace access status every 60 seconds
- Only poll for active workspaces (workspaces user is currently viewing)
- Update context when access status changes
- Show locked banner immediately when workspace becomes locked

#### 3.3 Membership Polling
- Poll workspace memberships every 10 minutes
- Update context when role changes
- Handle role downgrades gracefully

### Phase 4: Optimize Project Data Loading (LOW PRIORITY)

#### 4.1 Better Caching
- Use React cache() more effectively
- Implement stale-while-revalidate pattern
- Cache project data with TTL

#### 4.2 Remove Duplicate Calls
- Combine `getProjectData` calls (with/without files)
- Use single query with conditional includes

## Implementation Steps

### Step 1: Create User Context Provider
1. Create `src/contexts/user-context.tsx`
2. Implement user data loading on mount
3. Implement subscription polling (5 min interval)
4. Implement membership polling (10 min interval)
5. Create hooks: `useUser()`, `useUserSubscription()`, `useWorkspaceRole()`

### Step 2: Create Workspace Context Provider
1. Create `src/contexts/workspace-context.tsx`
2. Implement workspace access caching
3. Implement workspace access polling (60s interval)
4. Create hooks: `useWorkspaceAccess()`, `useCurrentWorkspace()`

### Step 3: Update Root Layout
1. Wrap app with `UserContextProvider`
2. Wrap app with `WorkspaceContextProvider`
3. Load initial user data on app mount

### Step 4: Update Project Page
1. Remove `syncUserWithClerk` call
2. Remove `getProjectMembership` duplicate
3. Remove `getWorkspaceAccessStatus` call
4. Remove `getWorkspaceBasicInfo` call
5. Use context data instead

### Step 5: Update Other Pages
1. Update workspace pages
2. Update file viewer pages
3. Update settings pages
4. Update dashboard page

### Step 6: Add Polling Mechanism
1. Implement subscription polling in UserContext
2. Implement workspace access polling in WorkspaceContext
3. Implement membership polling in UserContext
4. Add error handling and retry logic

## Expected Performance Improvements

### Before Optimization
- Project page load: ~800-1200ms
- API calls per page: 8-10
- Database queries per page: 15-20
- Redundant calls: 5-7 per page

### After Optimization
- Project page load: ~300-500ms (**60-70% faster**)
- API calls per page: 2-3 (**70-80% reduction**)
- Database queries per page: 5-8 (**60-70% reduction**)
- Redundant calls: 0 (**100% elimination**)

## Benefits

1. **Faster Page Loads:** 60-70% improvement in page load time
2. **Reduced Server Load:** 60-70% reduction in database queries
3. **Better UX:** Instant access to user/workspace data
4. **Real-time Updates:** Polling keeps data fresh
5. **Scalability:** Context can be shared across all pages

## Risks & Mitigation

### Risk 1: Stale Data
**Mitigation:** Implement polling with reasonable intervals, invalidate on mutations

### Risk 2: Context Size
**Mitigation:** Only cache essential data, use Map for workspace data

### Risk 3: Memory Leaks
**Mitigation:** Proper cleanup in useEffect, clear intervals on unmount

### Risk 4: Race Conditions
**Mitigation:** Use proper state management, handle loading states

## Next Steps

1. ✅ Create analysis document (this file)
2. ⏳ Create UserContext provider
3. ⏳ Create WorkspaceContext provider
4. ⏳ Update root layout
5. ⏳ Update project page
6. ⏳ Update other pages
7. ⏳ Add polling mechanism
8. ⏳ Test and measure improvements




