# API Optimization Summary - Quick Reference

## Problem

The `/project/<id>` page makes **8-10 redundant API calls** on every load:
- `syncUserWithClerk` - Called on every page (10+ times per session)
- `getWorkspaceAccessStatus` - Subscription check (5-10 times per session)
- `getProjectMembership` - Called TWICE per project page
- `getWorkspaceBasicInfo` - Called on every workspace page
- `getProjectData` - Called TWICE (with/without files)

## Solution

Create **app-level context providers** to cache user and workspace data:

1. **UserContext** - Caches user profile, subscription, and workspace memberships
2. **WorkspaceContext** - Caches workspace access status and basic info

## Expected Improvements

- **60-70% faster** page loads (800-1200ms → 300-500ms)
- **70-80% fewer** API calls (8-10 → 2-3 per page)
- **60-70% fewer** database queries (15-20 → 5-8 per page)
- **100% elimination** of redundant calls

## Implementation Plan

### Phase 1: Create Context Providers (Week 1)
- ✅ UserContext provider (user data, subscription, memberships)
- ✅ WorkspaceContext provider (workspace access, basic info)
- ✅ Update root layout to wrap app with providers

### Phase 2: Update Pages (Week 2)
- ✅ Remove redundant API calls from project page
- ✅ Remove redundant API calls from workspace pages
- ✅ Remove redundant API calls from file viewer pages

### Phase 3: Add Polling (Week 3)
- ✅ Subscription polling (5 min interval)
- ✅ Workspace access polling (60s interval)
- ✅ Membership polling (10 min interval)

### Phase 4: Cleanup (Week 4)
- ✅ Remove old redundant code
- ✅ Performance optimization
- ✅ Testing and documentation

## Key Files to Create

1. `src/contexts/user-context.tsx` - User data context
2. `src/contexts/workspace-context.tsx` - Workspace data context
3. `src/app/api/user/me/route.ts` - User data API endpoint
4. `src/app/api/workspaces/[id]/access/route.ts` - Workspace access API endpoint
5. `src/hooks/use-user-context.ts` - User context hooks
6. `src/hooks/use-workspace-context.ts` - Workspace context hooks

## Key Files to Update

1. `src/app/layout.tsx` - Add context providers
2. `src/app/project/[id]/page.tsx` - Remove redundant calls
3. `src/app/workspace/[id]/page.tsx` - Remove redundant calls
4. `src/app/project/[id]/file/[fileId]/page.tsx` - Remove redundant calls

## Data to Cache in Context

### UserContext
- User profile (id, name, email, avatarUrl)
- Subscription status (active, trial, expired)
- Trial end date
- Workspace memberships (workspaceId → role map)

### WorkspaceContext
- Current workspace (id, name, ownerId)
- Workspace access status (per workspace)
- Workspace basic info (per workspace)

## Polling Strategy

- **Subscription:** Every 5 minutes
- **Workspace Access:** Every 60 seconds (active workspace only)
- **Memberships:** Every 10 minutes

## Benefits

1. ✅ **Faster page loads** - 60-70% improvement
2. ✅ **Reduced server load** - 60-70% fewer queries
3. ✅ **Better UX** - Instant access to cached data
4. ✅ **Real-time updates** - Polling keeps data fresh
5. ✅ **Scalability** - Context shared across all pages

## Next Steps

1. Review the detailed analysis: `API-OPTIMIZATION-ANALYSIS.md`
2. Review the implementation plan: `CONTEXT-OPTIMIZATION-IMPLEMENTATION-PLAN.md`
3. Start with Phase 1: Create UserContext provider
4. Gradually migrate pages to use context
5. Monitor performance improvements

## Questions?

- See `API-OPTIMIZATION-ANALYSIS.md` for detailed analysis
- See `CONTEXT-OPTIMIZATION-IMPLEMENTATION-PLAN.md` for step-by-step plan




