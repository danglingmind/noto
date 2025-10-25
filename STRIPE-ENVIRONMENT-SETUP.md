# Stripe Environment Setup Guide

This guide explains how to set up and switch between Stripe test and live environments.

## Environment Configuration

The application now supports easy switching between Stripe test and live modes through environment variables.

### Environment Variables

Add these to your `.env` file:

```env
# Stripe Configuration
# Set to 'test' for development or 'live' for production
STRIPE_ENVIRONMENT=test

# Test Mode Keys (for development)
STRIPE_TEST_SECRET_KEY=sk_test_...
NEXT_PUBLIC_STRIPE_TEST_PUBLISHABLE_KEY=pk_test_...
STRIPE_TEST_WEBHOOK_SECRET=whsec_...

# Live Mode Keys (for production)
STRIPE_LIVE_SECRET_KEY=sk_live_...
NEXT_PUBLIC_STRIPE_LIVE_PUBLISHABLE_KEY=pk_live_...
STRIPE_LIVE_WEBHOOK_SECRET=whsec_...
```

## Switching Environments

### For Development (Test Mode)
```env
STRIPE_ENVIRONMENT=test
```

### For Production (Live Mode)
```env
STRIPE_ENVIRONMENT=live
```

## Setting Up Test Products

1. **Go to Stripe Dashboard** (make sure you're in Test mode)
2. **Create Products:**
   - Pro Plan: $29/month
   - Enterprise Plan: $99/month
3. **Copy the Price IDs and Product IDs**
4. **Update the test configuration** in `src/lib/stripe-config.ts`:

```typescript
test: {
  pro: {
    priceId: 'price_YOUR_TEST_PRO_PRICE_ID',
    productId: 'prod_YOUR_TEST_PRO_PRODUCT_ID',
  },
  enterprise: {
    priceId: 'price_YOUR_TEST_ENTERPRISE_PRICE_ID',
    productId: 'prod_YOUR_TEST_ENTERPRISE_PRODUCT_ID',
  },
}
```

## Database Seeding

After updating the configuration, run the database seed to update the subscription plans:

```bash
npm run db:seed
```

## Verification

To verify the environment is working correctly:

1. Check the console logs when starting the application
2. The logs should show which Stripe environment is being used
3. Test subscription creation to ensure the correct Stripe keys are being used

## Troubleshooting

### Common Issues

1. **"No such customer" error**: This usually means you're using live customer IDs with test keys or vice versa. Clear the customer IDs from your database and let the system create new ones.

2. **Environment not switching**: Make sure to restart your application after changing environment variables.

3. **Missing environment variables**: Ensure all required keys are set for the environment you're using.

### Database Cleanup

If you encounter customer ID mismatches, run these SQL commands:

```sql
-- Clear all customer IDs to force recreation
UPDATE users SET stripeCustomerId = NULL;

-- Clear subscription customer IDs
UPDATE subscriptions SET stripeCustomerId = NULL;
```
