# Context Optimization Implementation Plan

## Overview

This plan outlines the step-by-step implementation of app-level context providers to eliminate redundant API calls and improve performance across the application.

## Architecture

```
App Layout
├── UserContextProvider (app-level user data)
│   ├── User profile
│   ├── Subscription status
│   └── Workspace memberships
└── WorkspaceContextProvider (workspace-specific data)
    ├── Current workspace
    └── Workspace access status (per workspace)
```

## Phase 1: User Context Provider

### 1.1 Create User Context File
**File:** `src/contexts/user-context.tsx`

**Structure:**
```typescript
interface UserContextValue {
  // User data
  user: UserData | null
  isLoading: boolean
  error: string | null
  
  // Subscription
  subscription: SubscriptionData | null
  subscriptionLoading: boolean
  
  // Workspace memberships
  getWorkspaceRole: (workspaceId: string) => Role | null
  workspaceMemberships: Map<string, MembershipData>
  
  // Actions
  refreshUser: () => Promise<void>
  refreshSubscription: () => Promise<void>
  refreshMemberships: () => Promise<void>
}
```

**Key Features:**
- Load user data on mount
- Poll subscription every 5 minutes
- Poll memberships every 10 minutes
- Cache memberships in Map for O(1) lookup

### 1.2 Create API Endpoint for User Data
**File:** `src/app/api/user/me/route.ts`

**Purpose:** Single endpoint to fetch all user-related data
**Response:**
```typescript
{
  user: {
    id: string
    clerkId: string
    name: string | null
    email: string
    avatarUrl: string | null
  }
  subscription: {
    status: 'active' | 'trial' | 'expired' | 'inactive'
    trialEndDate: Date | null
    hasActiveSubscription: boolean
  }
  workspaceMemberships: Array<{
    workspaceId: string
    role: 'VIEWER' | 'COMMENTER' | 'EDITOR' | 'ADMIN' | 'OWNER'
  }>
}
```

### 1.3 Create Hook
**File:** `src/hooks/use-user-context.ts`

**Exports:**
- `useUser()` - Get user data
- `useUserSubscription()` - Get subscription data
- `useWorkspaceRole(workspaceId)` - Get role for workspace

## Phase 2: Workspace Context Provider

### 2.1 Create Workspace Context File
**File:** `src/contexts/workspace-context.tsx`

**Structure:**
```typescript
interface WorkspaceContextValue {
  // Current workspace
  currentWorkspace: WorkspaceData | null
  setCurrentWorkspace: (workspaceId: string) => void
  
  // Workspace access (per workspace)
  getWorkspaceAccess: (workspaceId: string) => WorkspaceAccessData | null
  workspaceAccess: Map<string, WorkspaceAccessData>
  
  // Loading states
  isLoading: boolean
  error: string | null
  
  // Actions
  refreshWorkspaceAccess: (workspaceId: string) => Promise<void>
  refreshAllWorkspaceAccess: () => Promise<void>
}
```

**Key Features:**
- Cache workspace access per workspace
- Poll active workspace access every 60 seconds
- Only poll workspaces user is currently viewing
- Invalidate cache on workspace changes

### 2.2 Create API Endpoint for Workspace Access
**File:** `src/app/api/workspaces/[id]/access/route.ts`

**Purpose:** Fetch workspace access status
**Response:**
```typescript
{
  workspaceId: string
  isLocked: boolean
  reason: 'trial_expired' | 'payment_failed' | 'subscription_inactive' | null
  ownerEmail: string
  ownerId: string
  ownerName: string | null
  workspace: {
    id: string
    name: string
    ownerId: string
  }
}
```

### 2.3 Create Hook
**File:** `src/hooks/use-workspace-context.ts`

**Exports:**
- `useWorkspaceAccess(workspaceId)` - Get access status for workspace
- `useCurrentWorkspace()` - Get current workspace data

## Phase 3: Update Root Layout

### 3.1 Wrap App with Providers
**File:** `src/app/layout.tsx`

**Changes:**
```typescript
export default function RootLayout({ children }) {
  return (
    <ClerkProvider>
      <UserContextProvider>
        <WorkspaceContextProvider>
          {children}
        </WorkspaceContextProvider>
      </UserContextProvider>
    </ClerkProvider>
  )
}
```

### 3.2 Initialize Context on Mount
- Load user data immediately on app mount
- Start polling mechanisms
- Handle authentication state changes

## Phase 4: Update Project Page

### 4.1 Remove Redundant Calls
**File:** `src/app/project/[id]/page.tsx`

**Remove:**
- `syncUserWithClerk(user)` - Use context instead
- `getProjectMembership()` duplicate - Use context instead
- `getWorkspaceAccessStatus()` - Use context instead
- `getWorkspaceBasicInfo()` - Use context instead

**Replace with:**
```typescript
// Get user from context (client component wrapper)
const user = useUser()
const workspaceRole = useWorkspaceRole(workspaceId)
const workspaceAccess = useWorkspaceAccess(workspaceId)

// Pass to server component as props
```

### 4.2 Create Client Wrapper
**File:** `src/components/project-page-client.tsx`

**Purpose:** Bridge between context (client) and server components
**Structure:**
```typescript
'use client'

export function ProjectPageClient({ projectId }) {
  const user = useUser()
  const workspaceRole = useWorkspaceRole(workspaceId)
  const workspaceAccess = useWorkspaceAccess(workspaceId)
  
  // Pass data to server component
  return <ProjectPageServer 
    projectId={projectId}
    user={user}
    workspaceRole={workspaceRole}
    workspaceAccess={workspaceAccess}
  />
}
```

## Phase 5: Update Other Pages

### 5.1 Workspace Pages
- Remove `syncUserWithClerk`
- Remove `getWorkspaceAccessStatus`
- Use context data instead

### 5.2 File Viewer Pages
- Remove `syncUserWithClerk`
- Remove `getProjectMembership`
- Use context data instead

### 5.3 Settings Pages
- Remove `syncUserWithClerk`
- Use context data instead

### 5.4 Dashboard Page
- Remove `syncUserWithClerk`
- Use context data instead

## Phase 6: Implement Polling

### 6.1 Subscription Polling
**Interval:** 5 minutes
**Implementation:**
```typescript
useEffect(() => {
  const interval = setInterval(() => {
    refreshSubscription()
  }, 5 * 60 * 1000) // 5 minutes
  
  return () => clearInterval(interval)
}, [])
```

**Features:**
- Poll only when user is authenticated
- Stop polling when component unmounts
- Handle errors gracefully
- Show toast on status change

### 6.2 Workspace Access Polling
**Interval:** 60 seconds
**Implementation:**
```typescript
useEffect(() => {
  if (!currentWorkspace) return
  
  const interval = setInterval(() => {
    refreshWorkspaceAccess(currentWorkspace.id)
  }, 60 * 1000) // 60 seconds
  
  return () => clearInterval(interval)
}, [currentWorkspace])
```

**Features:**
- Only poll active workspace
- Stop polling when workspace changes
- Show locked banner immediately on lock
- Handle errors gracefully

### 6.3 Membership Polling
**Interval:** 10 minutes
**Implementation:**
```typescript
useEffect(() => {
  const interval = setInterval(() => {
    refreshMemberships()
  }, 10 * 60 * 1000) // 10 minutes
  
  return () => clearInterval(interval)
}, [])
```

**Features:**
- Poll all memberships
- Update context on role changes
- Handle role downgrades

## Phase 7: Error Handling & Edge Cases

### 7.1 Error Handling
- Handle API errors gracefully
- Retry failed requests
- Show error messages to user
- Fallback to server-side data if context fails

### 7.2 Edge Cases
- Handle user logout (clear context)
- Handle workspace deletion (remove from cache)
- Handle role changes (update context)
- Handle subscription expiration (update context)

### 7.3 Cache Invalidation
- Invalidate on mutations (create/update/delete)
- Invalidate on workspace changes
- Invalidate on subscription changes
- Invalidate on membership changes

## Testing Plan

### 7.1 Unit Tests
- Test context providers
- Test hooks
- Test polling mechanisms
- Test error handling

### 7.2 Integration Tests
- Test page loads with context
- Test polling updates
- Test cache invalidation
- Test error scenarios

### 7.3 Performance Tests
- Measure page load times
- Measure API call counts
- Measure database query counts
- Compare before/after metrics

## Migration Strategy

### Step 1: Add Context (Non-Breaking)
- Create context providers
- Add to root layout
- Keep existing API calls (gradual migration)

### Step 2: Update Pages (Gradual)
- Update one page at a time
- Test each page thoroughly
- Monitor for errors

### Step 3: Remove Redundant Calls
- Remove old API calls
- Remove unused imports
- Clean up code

### Step 4: Optimize
- Fine-tune polling intervals
- Optimize cache strategies
- Monitor performance

## Success Metrics

### Performance
- ✅ 60-70% reduction in page load time
- ✅ 70-80% reduction in API calls
- ✅ 60-70% reduction in database queries

### User Experience
- ✅ Instant access to user data
- ✅ Real-time subscription updates
- ✅ Smooth navigation between pages

### Code Quality
- ✅ Reduced code duplication
- ✅ Better separation of concerns
- ✅ Easier to maintain

## Timeline

### Week 1: Foundation
- Day 1-2: Create UserContext provider
- Day 3-4: Create WorkspaceContext provider
- Day 5: Update root layout

### Week 2: Integration
- Day 1-2: Update project page
- Day 3-4: Update workspace pages
- Day 5: Update file viewer pages

### Week 3: Optimization
- Day 1-2: Implement polling
- Day 3-4: Error handling & edge cases
- Day 5: Testing & bug fixes

### Week 4: Cleanup
- Day 1-2: Remove redundant code
- Day 3-4: Performance optimization
- Day 5: Documentation & final testing

## Risk Mitigation

### Risk 1: Breaking Changes
**Mitigation:** Gradual migration, keep old code until new code is stable

### Risk 2: Performance Regression
**Mitigation:** Monitor performance metrics, rollback if needed

### Risk 3: Stale Data
**Mitigation:** Implement polling, invalidate on mutations

### Risk 4: Memory Leaks
**Mitigation:** Proper cleanup, test memory usage

## Next Steps

1. ✅ Create analysis document
2. ✅ Create implementation plan
3. ⏳ Create UserContext provider
4. ⏳ Create WorkspaceContext provider
5. ⏳ Update root layout
6. ⏳ Update project page
7. ⏳ Implement polling
8. ⏳ Test and measure




