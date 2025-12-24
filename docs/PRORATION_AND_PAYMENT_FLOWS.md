# Proration and Payment Success/Failure Flows Analysis

## Overview
This document analyzes the proration flow (subscription plan changes) and payment success/failure flows to ensure they handle edge cases correctly, especially when users have active subscriptions.

## 1. Proration Flow (Subscription Plan Change)

### Flow Steps:
1. **User initiates plan change** (`SubscriptionService.changeSubscription()`)
   - User has active subscription (e.g., yearly plan)
   - User wants to change to a different plan
   - System validates the change

2. **Proration Service updates Stripe subscription**
   - `ProrationService.updateSubscriptionWithProration()` is called
   - Updates the **existing** Stripe subscription (same subscription ID)
   - Stripe calculates proration amount
   - Creates an invoice for the proration charge

3. **Stripe webhook: `customer.subscription.updated`**
   - `handleSubscriptionChange()` is called
   - Updates database subscription with new `planId`
   - Updates `currentPeriodStart` and `currentPeriodEnd`
   - **Subscription remains ACTIVE in DB**

4. **Stripe creates invoice for proration**
   - Invoice is associated with the same subscription
   - If payment succeeds: `invoice.payment_succeeded` webhook fires
   - If payment fails: `invoice.payment_failed` webhook fires

### Potential Issues:

#### ✅ **Proration Payment Success - CORRECT**
- Invoice payment succeeds
- `handlePaymentSucceeded()` records payment
- Sends success email
- Unlocks workspace if needed
- **Does NOT modify subscription status** ✓

#### ⚠️ **Proration Payment Failure - NEEDS VERIFICATION**

**Scenario:** User changes plan, proration invoice is created, payment fails

**Current behavior:**
1. `invoice.payment_failed` webhook fires
2. `handlePaymentFailed()` is called
3. Checks if subscription exists in DB: ✓ (same subscription)
4. Checks if subscription is ACTIVE in DB: ✓ (still ACTIVE)
5. Checks if subscription is 'active' in Stripe: ❓ **This might be 'past_due' if payment failed**

**Issue:** If Stripe marks the subscription as 'past_due' when proration payment fails, our check `subscription.status === 'active'` would be false, and we wouldn't update the DB subscription to PAST_DUE. This could cause:
- Subscription remains ACTIVE in DB but is actually past_due in Stripe
- User might still have access when they shouldn't

**Fix needed:** We should also check for 'past_due' status in Stripe and update accordingly.

## 2. Payment Success Flow

### Flow Steps:
1. **Invoice payment succeeds**
   - `invoice.payment_succeeded` webhook fires
   - `handlePaymentSucceeded()` is called

2. **Payment recording**
   - Records payment in `payment_history` table
   - Status: 'SUCCEEDED'

3. **Email notification**
   - Sends payment success email to user

4. **Workspace unlock check**
   - Checks if user has valid subscription
   - If yes, unlocks workspace (notifies members)

### Analysis: ✅ **CORRECT**
- Does NOT modify subscription status (correct - subscription status is managed by `customer.subscription.updated` webhook)
- Only records payment and sends notifications
- Unlocks workspace if subscription is valid

## 3. Payment Failure Flow (After Fix)

### Flow Steps:
1. **Invoice payment fails**
   - `invoice.payment_failed` webhook fires
   - `handlePaymentFailed()` is called

2. **Payment recording**
   - Records payment in `payment_history` table
   - Status: 'FAILED'

3. **Subscription check**
   - If subscription doesn't exist in DB → **Ignore** (failed new purchase attempt)
   - If subscription is INCOMPLETE/INCOMPLETE_EXPIRED → **Ignore** (failed new purchase attempt)
   - If subscription exists, is ACTIVE in DB, and 'active' in Stripe → Mark as PAST_DUE

4. **Workspace lock**
   - Sets workspace tier to FREE
   - Sends payment failure email
   - Locks workspace (notifies members)

### Analysis: ✅ **CORRECT (After Fix)**
- Correctly ignores failed new purchase attempts
- Only affects existing active subscriptions
- Properly handles workspace locking

## 4. Edge Cases to Verify

### Edge Case 1: Proration Payment Failure
**Scenario:** User with active yearly subscription changes plan, proration payment fails

**Expected behavior:**
- Subscription should be marked as PAST_DUE in DB
- Workspace should be locked
- User should receive payment failure email

**Current implementation:**
- ⚠️ **POTENTIAL ISSUE:** If Stripe marks subscription as 'past_due' (not 'active'), our check might not catch it
- Need to verify: Does Stripe mark subscription as 'past_due' when proration payment fails?

**Recommendation:** Update `handlePaymentFailed()` to also check for 'past_due' status in Stripe:
```typescript
const isStripeSubscriptionActive = subscription.status === 'active'
const isStripeSubscriptionPastDue = subscription.status === 'past_due'
const isDbSubscriptionActive = existingSubscription.status === 'ACTIVE'

if ((isStripeSubscriptionActive || isStripeSubscriptionPastDue) && isDbSubscriptionActive) {
  // Mark as PAST_DUE
}
```

### Edge Case 2: New Purchase Attempt While Active Subscription Exists
**Scenario:** User has active yearly subscription, tries to buy a new plan, payment fails

**Expected behavior:**
- Active subscription should NOT be affected
- Failed payment should be recorded but subscription remains ACTIVE

**Current implementation:**
- ✅ **CORRECT:** Subscription doesn't exist in DB yet, so we ignore it completely

### Edge Case 3: Payment Success After Proration
**Scenario:** User changes plan, proration payment succeeds

**Expected behavior:**
- Payment is recorded
- Success email is sent
- Workspace remains unlocked (subscription is still active)

**Current implementation:**
- ✅ **CORRECT:** Payment success handler doesn't modify subscription status

## 5. Recommendations

1. **Update `handlePaymentFailed()` to handle 'past_due' status:**
   - When proration payment fails, Stripe might mark subscription as 'past_due'
   - We should check for both 'active' and 'past_due' statuses
   - If subscription is 'past_due' in Stripe but ACTIVE in DB, update to PAST_DUE

2. **Add logging for proration payment failures:**
   - Log when proration payment fails
   - Include subscription ID and status in logs
   - This helps debug issues

3. **Verify Stripe behavior:**
   - Test: What status does Stripe set when proration payment fails?
   - Test: Does Stripe create a new subscription or update existing one for proration?

## 6. Testing Checklist

- [ ] User with active subscription changes plan, proration payment succeeds
- [ ] User with active subscription changes plan, proration payment fails
- [ ] User with active subscription tries to buy new plan, payment fails (should not affect active subscription)
- [ ] User with active subscription tries to buy new plan, payment succeeds (should create new subscription)
- [ ] User with no subscription tries to buy plan, payment fails
- [ ] User with no subscription tries to buy plan, payment succeeds
