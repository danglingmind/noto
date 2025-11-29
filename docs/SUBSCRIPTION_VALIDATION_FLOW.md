# Subscription Validation Flow Analysis

## Current Issue
Users with **CANCELED** subscriptions are seeing "trial expired" messages, even though they previously had a valid subscription.

## Current Flow: `isTrialExpired()`

### Location
- `src/lib/subscription.ts` - `SubscriptionService.isTrialExpired()`
- `src/lib/trial-check.ts` - `checkTrialExpired()`

### Current Logic

```typescript
1. Query user with subscriptions WHERE status = 'ACTIVE' ONLY
2. If user.subscriptions.length > 0:
   → Return false (trial not expired)
3. If user.subscriptions.length === 0:
   → Check if trialEndDate has passed
   → Return true if expired, false if not
```

### The Problem

**Issue:** The query only looks for `status: 'ACTIVE'` subscriptions. If a user has:
- A subscription with status `'CANCELED'`
- No active subscriptions
- An expired trial date

Then the system will:
1. Find 0 active subscriptions
2. Check trial expiry
3. Show "trial expired" even though they had a subscription

## Subscription Status Values

From the codebase, valid subscription statuses are:
- `'ACTIVE'` - Active subscription
- `'CANCELED'` - Canceled subscription
- `'PAST_DUE'` - Payment failed, past due
- `'UNPAID'` - Unpaid subscription
- `'TRIALING'` - In trial period
- `'INCOMPLETE'` - Incomplete payment
- `'INCOMPLETE_EXPIRED'` - Incomplete payment expired

## Where Subscription Checks Happen

### 1. `isTrialExpired()` - Trial Expiry Check
**Files:**
- `src/lib/subscription.ts:150`
- `src/lib/trial-check.ts:9`

**Current Logic:**
- Only checks for `status: 'ACTIVE'`
- Ignores canceled subscriptions
- **Problem:** Users with canceled subscriptions are treated as if they never subscribed

### 2. `getUserSubscription()` - Get Active Subscription
**File:** `src/lib/subscription.ts:117`

**Current Logic:**
- Only returns subscriptions with `status: 'ACTIVE'`
- Returns `null` if no active subscription
- Used to get current subscription details

### 3. `getUserSubscriptionStatus()` - Detailed Status
**File:** `src/lib/subscription.ts:947`

**Current Logic:**
- Queries subscriptions with status: `['ACTIVE', 'PAST_DUE', 'UNPAID', 'CANCELED', 'TRIALING']`
- Finds active subscription first
- Returns `hasActiveSubscription: !!activeSubscription`
- **Note:** This method DOES include canceled subscriptions in the query, but only considers ACTIVE as valid

### 4. `checkWorkspaceSubscriptionStatus()` - Workspace Access
**File:** `src/lib/workspace-access.ts:19`

**Current Logic:**
- Queries subscriptions with status: `['ACTIVE', 'PAST_DUE', 'UNPAID', 'CANCELED']`
- Checks if any subscription is `'ACTIVE'`
- If no active subscription, checks trial expiry
- **Problem:** Same issue - canceled subscriptions don't prevent trial expiry check

## Decision Parameters

### What Makes a Subscription "Valid"?

Currently, the system considers a subscription valid ONLY if:
1. `status === 'ACTIVE'`
2. Subscription exists in database
3. Plan exists in JSON config

### What Should Make a Subscription "Valid"?

**Option 1: Active Only (Current)**
- Only `status === 'ACTIVE'` subscriptions are valid
- Canceled subscriptions = no subscription
- **Problem:** Users with canceled subscriptions are blocked by trial expiry

**Option 2: Ever Had Subscription**
- If user has ANY subscription record (even canceled), they shouldn't be blocked by trial
- Trial expiry only applies to users who NEVER subscribed
- **Benefit:** Users who canceled can still access (grace period)

**Option 3: Period-Based Access**
- Check `currentPeriodEnd` date on canceled subscriptions
- If canceled but period hasn't ended, still allow access
- After period ends, then check trial
- **Benefit:** Users get access until their paid period ends

**Option 4: Status-Based with Grace Period**
- `ACTIVE` = valid
- `CANCELED` with `currentPeriodEnd` in future = valid until period ends
- `CANCELED` with `currentPeriodEnd` in past = check trial
- `PAST_DUE` / `UNPAID` = check trial (payment issue)
- **Benefit:** Most flexible, handles all cases

## Implemented Fix

### Updated `isTrialExpired()` Logic

**Implementation:**
```typescript
// Check if user has EVER had a subscription (any status)
const hasEverSubscribed = await prisma.subscriptions.findFirst({
  where: { userId: user.id }
})

// If they've ever subscribed, trial expiry doesn't apply
// They should see subscription_inactive instead
if (hasEverSubscribed) {
  return false
}

// Only check trial expiry for users who have NEVER subscribed
return new Date() > user.trialEndDate
```

### Updated `isWorkspaceLocked()` Logic

**Now handles:**
- `ACTIVE` or `TRIALING` → Not locked
- `CANCELED` with `currentPeriodEnd` in future → Not locked (still within paid period)
- `CANCELED` with `currentPeriodEnd` in past → Locked
- `PAST_DUE` or `UNPAID` → Locked
- No subscription, valid trial → Not locked
- No subscription, expired trial → Locked

### Updated Reason Detection

**Priority order:**
1. `payment_failed` - If subscription is `PAST_DUE` or `UNPAID`
2. `subscription_inactive` - If subscription is `CANCELED` and period ended, or other inactive states
3. `trial_expired` - Only if user has NEVER subscribed and trial expired

## Files That Need Updates

1. **`src/lib/subscription.ts`** - `isTrialExpired()` method
2. **`src/lib/trial-check.ts`** - `checkTrialExpired()` function
3. **`src/lib/workspace-access.ts`** - `isWorkspaceLocked()` method (if it uses trial check)

## Testing Scenarios

1. **User with ACTIVE subscription**
   - Should: Not locked, no message
   - Status: ✅ Works

2. **User with CANCELED subscription (period not ended)**
   - Should: Not locked, still has access until period ends
   - Status: ✅ Fixed - Access until `currentPeriodEnd`

3. **User with CANCELED subscription (period ended)**
   - Should: Locked, reason: `subscription_inactive`
   - Message: "Your subscription has been canceled or is inactive. Reactivate your subscription to continue using this workspace."
   - Status: ✅ Fixed - Shows appropriate message

4. **User with PAST_DUE/UNPAID subscription**
   - Should: Locked, reason: `payment_failed`
   - Message: "The subscription payment for this workspace has failed. Please update your payment method to restore access."
   - Status: ✅ Fixed - Shows payment issue message

5. **User who never subscribed, trial expired**
   - Should: Locked, reason: `trial_expired`
   - Message: "The free trial for this workspace has expired. Upgrade to a paid plan to continue using this workspace."
   - Status: ✅ Works

6. **User who never subscribed, trial active**
   - Should: Not locked, allow access
   - Status: ✅ Works

## Access Blocking Messages

### `trial_expired`
- **When:** User never subscribed and trial expired
- **Message:** "The free trial for this workspace has expired. Upgrade to a paid plan to continue using this workspace."
- **Action:** "Start your free trial or upgrade to a paid plan to unlock all features."

### `payment_failed`
- **When:** Subscription is `PAST_DUE` or `UNPAID`
- **Message:** "The subscription payment for this workspace has failed. Please update your payment method to restore access."
- **Action:** "Update your payment method in billing settings to restore access immediately."

### `subscription_inactive`
- **When:** Subscription is `CANCELED` (and period ended) or other inactive states
- **Message:** "Your subscription has been canceled or is inactive. Reactivate your subscription to continue using this workspace."
- **Action:** "Reactivate your subscription or choose a new plan to continue using this workspace."

