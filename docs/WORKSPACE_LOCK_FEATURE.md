# Workspace Lock Feature

## Overview
This feature implements workspace-level subscription enforcement where workspaces become restricted when the owner's trial expires or payment fails. When locked, ALL workspace members are immediately blocked from accessing the workspace.

## Implementation Summary

### Core Components

#### 1. Workspace Access Service (`src/lib/workspace-access.ts`)
Centralized service for managing workspace access validation:
- `checkWorkspaceSubscriptionStatus(workspaceId)` - Returns lock status with reason
- `isWorkspaceLocked(ownerId)` - Checks if owner's subscription/trial is valid
- `getLockedWorkspacesForOwner(ownerId)` - Gets all locked workspaces for an owner
- `getWorkspaceOwner(workspaceId)` - Retrieves workspace owner information
- `getAllWorkspaceMembers(workspaceId)` - Gets all members of a workspace
- `getWorkspacesOwnedBy(userId)` - Lists all workspaces owned by a user

#### 2. Enhanced Subscription Service (`src/lib/subscription.ts`)
Added methods:
- `hasValidSubscription(userId)` - Returns boolean if user has ACTIVE subscription or valid trial
- `getUserSubscriptionStatus(userId)` - Returns detailed status object with trial info

#### 3. Auth Middleware Enhancement (`src/lib/auth.ts`)
Modified `checkWorkspaceAccess()` to:
- Check workspace subscription status after membership validation
- Throw error with lock details if workspace is locked
- Include lock reason, owner email, and owner name in error

#### 4. UI Components

**WorkspaceLockedBanner** (`src/components/workspace-locked-banner.tsx`)
Full-page blocked state component showing:
- Lock icon and clear message
- Reason for lock (trial expired / payment failed / subscription inactive)
- Different CTAs for owners vs members
- Owner contact information for members
- Direct links to upgrade (for owners) or dashboard

**Dashboard Lock Indicators** (`src/components/dashboard-content.tsx`)
- Lock icon badge on locked workspace cards
- Visual styling (border and background color) for locked workspaces
- Lock reason badge (Trial Expired, Payment Failed, Subscription Inactive)

### Notification System

#### Workspace Lock Notifications (`src/lib/workspace-lock-notifications.ts`)
Service for notifying users about workspace status changes:
- `notifyWorkspaceMembersOfLock(workspaceId, reason)` - Sends notifications when workspace becomes locked
- `notifyWorkspaceMembersOfUnlock(workspaceId)` - Sends notifications when workspace is unlocked
- `notifyAllWorkspacesForOwner(ownerId, action, reason)` - Notifies all workspaces owned by a user
- Creates both email notifications (via MailerLite) and in-app notifications

#### Database Changes
Added to `NotificationType` enum in `prisma/schema.prisma`:
- `WORKSPACE_LOCKED`
- `WORKSPACE_UNLOCKED`

### Protected Routes

#### Page Routes
All workspace pages check for lock status before rendering:
- `/workspace/[id]` - Main workspace page
- `/workspace/[id]/settings` - Workspace settings page
- Other workspace sub-pages (members, usage, etc.)

#### API Routes
Protected API endpoints return 403 with lock reason:
- `/api/workspaces/[id]` - GET, PATCH operations
- `/api/workspaces/[id]/projects` - Automatically protected via checkWorkspaceAccess
- `/api/comments` - POST (creating comments)
- `/api/annotations` - POST (creating annotations)
- All project and file operations (use checkWorkspaceAccess)

### Webhook Integration

#### Stripe Webhooks (`src/app/api/webhooks/stripe/route.ts`)

**Payment Failure Handler**
When payment fails:
1. Records failed payment in payment_history
2. Updates subscription status to PAST_DUE
3. Resets workspace tier to FREE
4. Sends payment failure email to owner
5. **Notifies all workspace members about workspace lock**

**Payment Success Handler**
When payment succeeds:
1. Records successful payment
2. Sends payment success email
3. Checks if subscription is now valid
4. **Notifies all workspace members about workspace unlock**

#### Trial Expiry Cron Job (`src/app/api/cron/trial-reminders/route.ts`)
Enhanced to:
1. Find users with expired trials
2. Update MailerLite fields
3. **Notify all workspace members about workspace lock due to trial expiry**

### Dashboard Integration

#### Dashboard Page (`src/app/dashboard/page.tsx`)
- Checks lock status for each workspace asynchronously
- Passes `isLocked` and `lockReason` to DashboardContent

#### Dashboard Content
- Displays lock icon and badge on locked workspaces
- Visual distinction (red border and background tint)
- Shows lock reason badge

## Lock Reasons

The system handles three lock reasons:

1. **trial_expired** - User's free trial has ended
2. **payment_failed** - Subscription payment failed (PAST_DUE or UNPAID status)
3. **subscription_inactive** - Subscription is inactive (no active subscription and no valid trial)

## User Experience

### For Workspace Owners
When their workspace is locked:
- See full-page block screen with "Upgrade Now" CTA
- Receive email notification about workspace lock
- Receive in-app notification
- All their owned workspaces are locked simultaneously
- Dashboard shows lock indicators on workspace cards

### For Workspace Members
When a workspace they're part of is locked:
- See full-page block screen with owner contact information
- "Contact Owner" button with pre-filled email
- Receive email notification about workspace lock
- Receive in-app notification
- Dashboard shows lock indicators

### When Workspace is Unlocked
- Owner pays/subscribes
- All members receive email and in-app notifications
- Access is immediately restored
- No manual intervention required

## Email Templates Required

The following MailerLite email templates need to be configured:

1. **workspaceLockedOwner** - Sent to workspace owner when locked
   - Fields: workspace_name, reason, upgrade_url, workspace_url

2. **workspaceLocked** - Sent to workspace members when locked
   - Fields: workspace_name, owner_name, owner_email, reason

3. **workspaceUnlocked** - Sent to owner and members when unlocked
   - Fields: workspace_name, workspace_url

## Testing Checklist

- [ ] Trial expiry locks workspace
- [ ] Payment failure locks workspace  
- [ ] Member attempts to access locked workspace (shows block screen)
- [ ] Owner attempts to access locked workspace (shows upgrade CTA)
- [ ] Owner upgrades → workspace unlocks
- [ ] Email notifications sent correctly
- [ ] In-app notifications created
- [ ] Multiple workspaces owned by same user (all locked together)
- [ ] Dashboard shows lock indicators correctly
- [ ] API endpoints return 403 for locked workspaces

## Migration

To apply the database changes:

```bash
# The migration file is already created in:
# prisma/migrations/add_workspace_lock_notifications/migration.sql

# Apply the migration:
npx prisma migrate deploy
```

Alternatively, if using Prisma's development workflow:
```bash
npx prisma migrate dev
```

## Maintenance Notes

- Lock status is checked on every workspace access (page load or API call)
- No caching is implemented - could be added for performance if needed
- Notifications are sent asynchronously and failures won't block the main operation
- Database enum cannot be rolled back easily - plan migrations carefully

