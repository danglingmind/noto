# CRON Jobs and Stripe Webhooks Documentation

## Overview

This document provides comprehensive information about all CRON jobs and Stripe webhook flows in the Noto application. These systems handle trial management, payment processing, and workspace access control.

## Table of Contents

1. [CRON Jobs](#cron-jobs)
2. [Stripe Webhooks](#stripe-webhooks)
3. [Workspace Lock System](#workspace-lock-system)
4. [Email Notifications](#email-notifications)
5. [Testing and Debugging](#testing-and-debugging)
6. [Configuration](#configuration)

---

## CRON Jobs

### 1. Trial Reminders Cron Job

**File**: `src/app/api/cron/trial-reminders/route.ts`  
**Schedule**: `0 0 * * *` (Daily at midnight UTC)  
**Vercel Config**: `vercel.json`

#### Purpose
Automatically manages trial expiry notifications and workspace locking for users with expired trials.

#### What It Does

##### 3-Day Trial Reminder
- **Trigger**: Users whose trial ends in exactly 3 days
- **Action**: 
  - Updates MailerLite fields: `trial_days_remaining: '3'`, `trial_status: 'expiring_soon'`
  - Triggers MailerLite automation for 3-day reminder email
- **Query**: Users with `trialEndDate` between 3 days from now (start/end of day)

##### 1-Day Trial Reminder
- **Trigger**: Users whose trial ends in exactly 1 day
- **Action**:
  - Updates MailerLite fields: `trial_days_remaining: '1'`, `trial_status: 'expiring_soon'`
  - Triggers MailerLite automation for 1-day reminder email
- **Query**: Users with `trialEndDate` between 1 day from now (start/end of day)

##### Trial Expiry Handling
- **Trigger**: Users with `trialEndDate` < current time
- **Action**:
  - Updates MailerLite fields: `trial_days_remaining: '0'`, `trial_status: 'expired'`
  - **🔒 LOCKS ALL WORKSPACES** owned by these users
  - **📧 Sends workspace lock notifications** to all workspace members
  - Triggers MailerLite automation for trial expired email

#### Authentication
- **Required**: `Authorization: Bearer ${CRON_SECRET}`
- **Security**: Prevents unauthorized access to cron endpoints

#### Response Format
```json
{
  "success": true,
  "emailsSent": 1,
  "usersFor3DayReminder": 0,
  "usersFor1DayReminder": 0,
  "usersWithExpiredTrials": 1,
  "errors": []
}
```

#### Manual Testing
```bash
curl -X GET "http://localhost:3000/api/cron/trial-reminders" \
     -H "Authorization: Bearer your_secure_random_string_here"
```

---

## Stripe Webhooks

### Webhook Endpoint

**File**: `src/app/api/webhooks/stripe/route.ts`  
**URL**: `/api/webhooks/stripe`  
**Method**: `POST`

#### Authentication
- **Stripe Signature Verification**: Validates webhook authenticity
- **Secret**: `STRIPE_CONFIG.webhookSecret`

#### Event Storage
All webhook events are stored in `stripe_webhook_events` table for audit and debugging.

### Supported Events

#### 1. Checkout Session Events

##### `checkout.session.completed`
- **Trigger**: Successful payment completion
- **Action**: 
  - Creates/updates subscription in database
  - Updates user subscription status
  - **🔓 UNLOCKS WORKSPACES** if user now has active subscription
  - Sends payment success email

##### `checkout.session.async_payment_failed`
- **Trigger**: Async payment failed (bank transfers, etc.)
- **Action**:
  - Records failed payment
  - **🔒 LOCKS WORKSPACES** immediately
  - Sends payment failure notification

##### `checkout.session.expired`
- **Trigger**: Checkout session expired without payment
- **Action**:
  - Records expired session
  - No workspace action (user never had access)

#### 2. Subscription Events

##### `customer.subscription.created`
##### `customer.subscription.updated`
- **Trigger**: Subscription created or modified
- **Action**:
  - Updates subscription in database
  - Updates workspace access based on subscription status
  - **🔓 UNLOCKS WORKSPACES** if subscription is active
  - **🔒 LOCKS WORKSPACES** if subscription is inactive

##### `customer.subscription.deleted`
- **Trigger**: Subscription cancelled or deleted
- **Action**:
  - Updates subscription status to cancelled
  - **🔒 LOCKS ALL WORKSPACES** owned by user
  - Sends subscription cancellation notification

#### 3. Payment Events

##### `invoice.payment_succeeded`
- **Trigger**: Successful payment for subscription
- **Action**:
  - Records successful payment
  - Updates subscription status to active
  - **🔓 UNLOCKS WORKSPACES** if previously locked
  - Sends payment success email
  - **📧 Notifies workspace members** of unlock

##### `invoice.payment_failed`
- **Trigger**: Payment failed for subscription
- **Action**:
  - Records failed payment
  - Updates subscription status to `PAST_DUE`
  - Downgrades workspace tier to `FREE`
  - **🔒 LOCKS WORKSPACES** immediately
  - Sends payment failure email
  - **📧 Notifies all workspace members** of lock

##### `payment_intent.payment_failed`
- **Trigger**: Payment intent failed
- **Action**:
  - Records failed payment intent
  - **🔒 LOCKS WORKSPACES** immediately
  - Sends payment failure notification

##### `invoice.created`
- **Trigger**: New invoice created
- **Action**:
  - Records invoice creation
  - No immediate workspace action

### Webhook Event Flow

```
Stripe Event → Webhook Endpoint → Event Storage → Handler Function → Database Update → Workspace Action → Email Notification
```

---

## Workspace Lock System

### Core Components

#### 1. Workspace Access Service
**File**: `src/lib/workspace-access.ts`

**Key Methods**:
- `checkWorkspaceSubscriptionStatus(workspaceId)`: Checks if workspace is locked
- `isWorkspaceLocked(ownerId)`: Determines if owner's subscription is valid
- `getWorkspaceOwner(workspaceId)`: Gets workspace owner information
- `getAllWorkspaceMembers(workspaceId)`: Gets all workspace members

#### 2. Workspace Lock Notification Service
**File**: `src/lib/workspace-lock-notifications.ts`

**Key Methods**:
- `notifyWorkspaceMembersOfLock(workspaceId, reason)`: Notifies members of lock
- `notifyWorkspaceMembersOfUnlock(workspaceId)`: Notifies members of unlock
- `notifyAllWorkspacesForOwner(ownerId, action, reason)`: Notifies all owner's workspaces

### Lock Reasons

1. **`trial_expired`**: User's free trial has expired
2. **`payment_failed`**: Payment for subscription failed
3. **`subscription_inactive`**: Subscription is inactive/cancelled

### Workspace Lock Logic

```typescript
// Workspace is locked if:
// 1. Owner has no ACTIVE subscriptions AND
// 2. Owner's trial has expired (trialEndDate < now)

const isLocked = !hasActiveSubscription && !trialValid
```

### Lock Actions

#### When Workspace is Locked:
1. **API Access**: All workspace API endpoints return 403 Forbidden
2. **UI Access**: Workspace pages show lock screen
3. **Email Notifications**: All workspace members notified
4. **In-App Notifications**: Database notifications created
5. **Workspace Tier**: Downgraded to FREE

#### When Workspace is Unlocked:
1. **API Access**: Full access restored
2. **UI Access**: Normal workspace functionality
3. **Email Notifications**: All workspace members notified
4. **In-App Notifications**: Unlock notifications created
5. **Workspace Tier**: Restored based on subscription

---

## Email Notifications

### MailerLite Integration

#### Email Templates
- **`workspaceLockedOwner`**: Sent to workspace owner when locked
- **`workspaceLocked`**: Sent to workspace members when locked
- **`workspaceUnlocked`**: Sent to all when workspace unlocked
- **`trialReminder3d`**: 3-day trial reminder
- **`trialReminder1d`**: 1-day trial reminder
- **`trialExpired`**: Trial expired notification
- **`paymentSuccess`**: Payment successful
- **`paymentFailed`**: Payment failed

#### Fallback System
**File**: `src/lib/email/mailerlite-fallback.ts`

When MailerLite is not configured:
- Emails are logged instead of sent
- Prevents application crashes
- Provides clear feedback about what would be sent

### Notification Flow

```
Event Trigger → Workspace Lock Check → Email Service → MailerLite API → Email Sent
```

---

## Testing and Debugging

### Manual CRON Testing

```bash
# Test trial reminders cron
curl -X GET "http://localhost:3000/api/cron/trial-reminders" \
     -H "Authorization: Bearer your_cron_secret"
```

### Stripe Webhook Testing

```bash
# Test webhook endpoint (requires Stripe CLI)
stripe listen --forward-to localhost:3000/api/webhooks/stripe
```

### Environment Variables Check

```bash
# Check MailerLite configuration
curl -X GET "http://localhost:3000/api/debug/mailerlite-config"
```

### Database Queries for Testing

```sql
-- Check users with expired trials
SELECT id, email, "trialEndDate" 
FROM users 
WHERE "trialEndDate" < NOW() 
AND id NOT IN (
  SELECT "userId" FROM subscriptions WHERE status = 'ACTIVE'
);

-- Check workspace lock status
SELECT w.id, w.name, u.email as owner_email, u."trialEndDate"
FROM workspaces w
JOIN users u ON w."ownerId" = u.id
WHERE u."trialEndDate" < NOW()
AND u.id NOT IN (
  SELECT "userId" FROM subscriptions WHERE status = 'ACTIVE'
);
```

---

## Configuration

### Required Environment Variables

#### CRON Configuration
```bash
CRON_SECRET=your_secure_random_string_for_cron_auth
```

#### MailerLite Configuration
```bash
MAILERLITE_API_TOKEN=your_mailerlite_api_token
MAILERLITE_WELCOME_GROUP_ID=your_welcome_group_id
MAILERLITE_TRIAL_REMINDER_3D_GROUP_ID=your_3d_reminder_group_id
MAILERLITE_TRIAL_REMINDER_1D_GROUP_ID=your_1d_reminder_group_id
MAILERLITE_TRIAL_EXPIRED_GROUP_ID=your_expired_group_id
MAILERLITE_PAYMENT_SUCCESS_GROUP_ID=your_payment_success_group_id
MAILERLITE_PAYMENT_FAILED_GROUP_ID=your_payment_failed_group_id
MAILERLITE_WORKSPACE_INVITE_GROUP_ID=your_workspace_invite_group_id
MAILERLITE_WORKSPACE_LOCKED_OWNER_GROUP_ID=your_workspace_locked_owner_group_id
MAILERLITE_WORKSPACE_LOCKED_GROUP_ID=your_workspace_locked_group_id
MAILERLITE_WORKSPACE_UNLOCKED_GROUP_ID=your_workspace_unlocked_group_id
```

#### Stripe Configuration
```bash
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
```

### Vercel Configuration

**File**: `vercel.json`
```json
{
  "crons": [
    {
      "path": "/api/cron/trial-reminders",
      "schedule": "0 0 * * *"
    }
  ]
}
```

---

## Monitoring and Logs

### CRON Job Monitoring
- **Vercel Dashboard**: Check function logs for cron execution
- **Response Format**: JSON with success status and counts
- **Error Handling**: Failed operations are logged but don't stop execution

### Stripe Webhook Monitoring
- **Stripe Dashboard**: Monitor webhook delivery status
- **Database**: All webhook events stored in `stripe_webhook_events`
- **Error Handling**: Failed webhooks are logged with details

### Email Monitoring
- **MailerLite Dashboard**: Monitor email delivery and automation triggers
- **Fallback Logs**: Check console for fallback email logs
- **Error Handling**: Email failures don't stop workspace operations

---

## Troubleshooting

### Common Issues

#### 1. CRON Job Not Running
- **Check**: Vercel cron configuration
- **Verify**: `CRON_SECRET` is set correctly
- **Test**: Manual endpoint call with proper authorization

#### 2. Workspace Not Locking
- **Check**: User subscription status in database
- **Verify**: Trial end date is in the past
- **Test**: Manual workspace access check

#### 3. Emails Not Sending
- **Check**: MailerLite environment variables
- **Verify**: MailerLite groups exist
- **Test**: Fallback service logs

#### 4. Stripe Webhooks Failing
- **Check**: Webhook secret configuration
- **Verify**: Stripe webhook endpoint URL
- **Test**: Stripe CLI for local testing

### Debug Commands

```bash
# Check environment variables
node -e "console.log(process.env.MAILERLITE_API_TOKEN ? 'SET' : 'NOT SET')"

# Test MailerLite service
curl -X GET "http://localhost:3000/api/debug/mailerlite-config"

# Check database connections
npx prisma studio
```

---

## Security Considerations

### CRON Security
- **Authentication**: All cron endpoints require `CRON_SECRET`
- **Rate Limiting**: Vercel handles rate limiting automatically
- **Error Handling**: Failed operations don't expose sensitive data

### Webhook Security
- **Signature Verification**: All Stripe webhooks verified
- **Event Storage**: All events logged for audit
- **Error Handling**: Failed webhooks logged without exposing secrets

### Email Security
- **API Token**: MailerLite API token stored securely
- **Fallback System**: Prevents data exposure when email fails
- **Error Handling**: Email failures don't stop core functionality

---

## Performance Considerations

### CRON Job Performance
- **Batch Processing**: Users processed in batches
- **Error Isolation**: Individual user failures don't stop batch
- **Timeout Handling**: 60-second max duration per Vercel function

### Webhook Performance
- **Async Processing**: Webhook handlers are async
- **Database Optimization**: Efficient queries for workspace checks
- **Error Recovery**: Failed operations can be retried

### Email Performance
- **Fallback System**: Prevents blocking on email failures
- **Batch Notifications**: Multiple users notified efficiently
- **Error Handling**: Email failures don't impact core functionality

---

## Future Enhancements

### Potential Improvements
1. **Retry Logic**: Automatic retry for failed email sends
2. **Metrics**: Detailed metrics for cron job performance
3. **Alerting**: Alerts for failed cron jobs or webhook processing
4. **Batch Optimization**: Larger batch sizes for better performance
5. **Caching**: Cache workspace access checks for better performance

### Monitoring Enhancements
1. **Health Checks**: Endpoint health monitoring
2. **Performance Metrics**: Response time tracking
3. **Error Tracking**: Centralized error logging
4. **Usage Analytics**: Webhook and cron usage patterns

---

*Last Updated: October 21, 2025*
*Version: 1.0*
