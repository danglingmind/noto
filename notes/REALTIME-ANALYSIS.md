# Realtime Collaboration Analysis

## Executive Summary

**❌ Supabase Realtime is NOT currently being utilized** in `website-viewer.tsx` and `image-viewer.tsx` components, despite the infrastructure existing in the codebase.

## Current State

### 1. `useAnnotations` Hook (src/hooks/use-annotations.ts)

**Status:** Realtime subscription code is **commented out**

```182:213:src/hooks/use-annotations.ts
	// TODO: Set up real-time subscriptions
	useEffect(() => {
		if (!realtime || !fileId) {
return
}

		// const channel = supabase
		//   .channel(`files:${fileId}`)
		//   .on('broadcast', { event: 'annotation.created' }, (payload) => {
		//     setAnnotations(prev => [...prev, payload.annotation])
		//   })
		//   .on('broadcast', { event: 'annotation.updated' }, (payload) => {
		//     setAnnotations(prev => prev.map(a =>
		//       a.id === payload.annotations.id ? payload.annotation : a
		//     ))
		//   })
		//   .on('broadcast', { event: 'annotation.deleted' }, (payload) => {
		//     setAnnotations(prev => prev.filter(a => a.id !== payload.annotationId))
		//   })
		//   .on('broadcast', { event: 'comment.created' }, (payload) => {
		//     setAnnotations(prev => prev.map(a =>
		//       a.id === payload.annotationId
		//         ? { ...a, comments: [...a.comments, payload.comment] }
		//         : a
		//     ))
		//   })
		//   .subscribe()

		// return () => {
		//   supabase.removeChannel(channel)
		// }
	}, [realtime, fileId])
```

**Current Behavior:**
- The hook accepts a `realtime` parameter (defaults to `true`)
- However, the actual Supabase subscription code is commented out
- The hook relies on:
  - Optimistic updates (immediate UI updates)
  - Background sync queue (polling every 2 seconds)
  - Manual `fetchAnnotations()` calls

### 2. Viewer Components

**`website-viewer.tsx` and `image-viewer.tsx`:**
- Both components use `useAnnotations` hook with `realtime: true`
- **Neither component uses the `useRealtime` hook**
- They rely entirely on the `useAnnotations` hook's polling mechanism

**Evidence from website-viewer.tsx:**
```174:179:src/components/viewers/website-viewer.tsx
  const annotationsHook = useAnnotations({ 
    fileId: files.id, 
    realtime: true,
    viewport: viewportSize.toUpperCase() as 'DESKTOP' | 'TABLET' | 'MOBILE',
    initialAnnotations: annotations
  })
```

**Evidence from image-viewer.tsx:**
```110:114:src/components/viewers/image-viewer.tsx
  const annotationsHook = useAnnotations({ 
    fileId: file.id, 
    realtime: !propCreateAnnotation, // Disable realtime if using props (optimization)
    initialAnnotations: propCreateAnnotation ? [] : annotations // Only use initial if no props
  })
```

### 3. API Routes

**Status:** Realtime broadcasting is **not implemented** (all commented out)

All annotation and comment API routes have TODO comments:

- `src/app/api/annotations/route.ts` (line 205-209)
- `src/app/api/annotations/[id]/route.ts` (lines 138-142, 232-236)
- `src/app/api/comments/route.ts` (line 184-188)
- `src/app/api/comments/[id]/route.ts` (lines 107-111, 194-198)

Example:
```typescript
// TODO: Send realtime notification
// await sendRealtimeUpdate(`files:${fileId}`, {
//   type: 'annotation.created',
//   annotation: annotationWithComments
// })
```

### 4. Existing Realtime Infrastructure

**✅ `useRealtime` Hook Exists** (`src/hooks/use-realtime.ts`):
- Properly implemented with Supabase channels
- Supports project, file, and annotation-level channels
- Has presence tracking for online users
- Has broadcast functionality

**✅ Realtime Utilities Exist** (`src/lib/supabase-realtime.ts`):
- `createProjectChannel(projectId)`
- `createAnnotationChannel(fileId)`
- `createCommentChannel(annotationId)`
- Proper Supabase client configuration

**✅ Used in `collaboration-viewer.tsx`:**
- This component DOES use `useRealtime` hook
- However, this component is not part of the main file viewer flow

## Current Collaboration Mechanism

Since realtime is not active, the system currently works via:

1. **Optimistic Updates**: Immediate UI updates on the client that created the annotation/comment
2. **Background Sync Queue**: Queues operations and retries every 2 seconds
3. **Polling**: The `useAnnotations` hook can manually refresh via `fetchAnnotations()`
4. **No Real-time Sync**: Other users won't see changes until they:
   - Refresh the page
   - Create their own annotation (triggers a fetch)
   - Wait for a manual refresh

## Impact

### What Works:
- ✅ Single-user annotation creation/editing (optimistic updates)
- ✅ Offline queue with retry logic
- ✅ Optimistic UI updates

### What Doesn't Work:
- ❌ Real-time collaboration (other users don't see changes immediately)
- ❌ Live presence indicators
- ❌ Instant updates across multiple clients
- ❌ Workspace-level real-time sync

## Recommendations

### Option 1: Enable Realtime in `useAnnotations` Hook (Recommended)

1. **Uncomment and fix the realtime subscription code** in `useAnnotations` hook
2. **Implement broadcasting in API routes** when annotations/comments are created/updated/deleted
3. **Use the existing `useRealtime` infrastructure** or integrate it into `useAnnotations`

### Option 2: Use `useRealtime` Hook in Viewer Components

1. **Add `useRealtime` hook** to `FileViewerContentClient` component
2. **Listen for realtime events** and update annotations state
3. **Broadcast events** when creating/updating/deleting annotations
4. **Keep optimistic updates** for immediate UI feedback

### Option 3: Hybrid Approach (Best UX)

1. **Keep optimistic updates** for immediate feedback
2. **Add realtime subscriptions** for collaborative updates
3. **Use realtime as the source of truth** for other users' changes
4. **Keep background sync queue** as a fallback for offline scenarios

## Implementation Checklist

If implementing realtime:

- [ ] Uncomment realtime subscription code in `useAnnotations` hook
- [ ] Implement `sendRealtimeUpdate` utility function
- [ ] Add broadcasting to all annotation API routes (create, update, delete)
- [ ] Add broadcasting to all comment API routes (create, update, delete)
- [ ] Test realtime subscriptions with multiple users
- [ ] Handle edge cases (network failures, reconnection)
- [ ] Add presence tracking for online users
- [ ] Update viewer components to show realtime connection status
- [ ] Consider rate limiting for realtime events
- [ ] Add error handling for subscription failures

## Files That Need Changes

1. `src/hooks/use-annotations.ts` - Uncomment and implement realtime subscriptions
2. `src/app/api/annotations/route.ts` - Add broadcasting on create
3. `src/app/api/annotations/[id]/route.ts` - Add broadcasting on update/delete
4. `src/app/api/comments/route.ts` - Add broadcasting on create
5. `src/app/api/comments/[id]/route.ts` - Add broadcasting on update/delete
6. `src/lib/supabase-realtime.ts` - Add `sendRealtimeUpdate` utility (if needed)
7. `src/components/file-viewer-content-client.tsx` - Optionally add `useRealtime` hook

## Conclusion

The codebase has all the infrastructure needed for realtime collaboration, but it's **not currently connected**. The system relies on optimistic updates and polling, which means users won't see each other's changes in real-time. To enable true collaborative editing, the realtime subscriptions need to be uncommented and the API routes need to broadcast events.

