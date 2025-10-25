# Stripe Environment Setup Guide

This guide explains how to set up and manage Stripe environments for the Noto application, allowing easy switching between test and live modes.

## Table of Contents

- [Overview](#overview)
- [Environment Configuration](#environment-configuration)
- [Setting Up Test Environment](#setting-up-test-environment)
- [Setting Up Live Environment](#setting-up-live-environment)
- [Database Seeding](#database-seeding)
- [Switching Environments](#switching-environments)
- [Troubleshooting](#troubleshooting)
- [Best Practices](#best-practices)

## Overview

The Noto application now supports flexible Stripe environment management with the following features:

- **Environment-based configuration** (test/live)
- **Automatic key selection** based on environment
- **Backward compatibility** with existing setups
- **Type-safe configuration** with TypeScript
- **Easy switching** between environments

## Environment Configuration

### Environment Variables

Add these variables to your `.env` file:

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

# Legacy keys (for backward compatibility)
STRIPE_SECRET_KEY=sk_test_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
```

### Environment Switching

The application automatically selects the correct Stripe keys based on the `STRIPE_ENVIRONMENT` variable:

- **`test`** - Uses test mode keys for development
- **`live`** - Uses live mode keys for production

## Setting Up Test Environment

### 1. Stripe Dashboard Setup

1. **Go to [Stripe Dashboard](https://dashboard.stripe.com)**
2. **Switch to Test mode** (toggle in top-left corner)
3. **Navigate to Products** section

### 2. Create Test Products

#### Pro Plan Product
```
Product Name: Noto Pro Plan (Test)
Description: Advanced features for growing teams and agencies
Price: $29.00 USD
Billing: Monthly recurring
```

#### Enterprise Plan Product
```
Product Name: Noto Enterprise Plan (Test)
Description: Full-featured solution for large organizations
Price: $99.00 USD
Billing: Monthly recurring
```

### 3. Get Test API Keys

1. **Go to Developers > API Keys**
2. **Copy the test keys:**
   - Publishable key (starts with `pk_test_`)
   - Secret key (starts with `sk_test_`)

### 4. Create Test Webhook

1. **Go to Developers > Webhooks**
2. **Add endpoint:** `https://your-domain.com/api/webhooks/stripe`
3. **Select events:**
   - `checkout.session.completed`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.payment_succeeded`
   - `invoice.payment_failed`
4. **Copy webhook secret** (starts with `whsec_`)

### 5. Update Configuration

Update `src/lib/stripe-config.ts` with your test product IDs:

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

## Setting Up Live Environment

### 1. Stripe Dashboard Setup

1. **Go to [Stripe Dashboard](https://dashboard.stripe.com)**
2. **Switch to Live mode** (toggle in top-left corner)
3. **Navigate to Products** section

### 2. Create Live Products

Follow the same process as test environment but with live products:

#### Pro Plan Product
```
Product Name: Noto Pro Plan
Description: Advanced features for growing teams and agencies
Price: $29.00 USD
Billing: Monthly recurring
```

#### Enterprise Plan Product
```
Product Name: Noto Enterprise Plan
Description: Full-featured solution for large organizations
Price: $99.00 USD
Billing: Monthly recurring
```

### 3. Get Live API Keys

1. **Go to Developers > API Keys**
2. **Copy the live keys:**
   - Publishable key (starts with `pk_live_`)
   - Secret key (starts with `sk_live_`)

### 4. Create Live Webhook

1. **Go to Developers > Webhooks**
2. **Add endpoint:** `https://your-production-domain.com/api/webhooks/stripe`
3. **Select the same events** as test webhook
4. **Copy webhook secret** (starts with `whsec_`)

### 5. Update Configuration

Update `src/lib/stripe-config.ts` with your live product IDs:

```typescript
live: {
  pro: {
    priceId: 'price_YOUR_LIVE_PRO_PRICE_ID',
    productId: 'prod_YOUR_LIVE_PRO_PRODUCT_ID',
  },
  enterprise: {
    priceId: 'price_YOUR_LIVE_ENTERPRISE_PRICE_ID',
    productId: 'prod_YOUR_LIVE_ENTERPRISE_PRODUCT_ID',
  },
}
```

## Database Seeding

After updating the configuration, run the database seed to update subscription plans:

```bash
# Seed the database with environment-specific product IDs
npm run db:seed
```

This will:
- Create/update subscription plans with correct Stripe IDs
- Use the current environment's product configuration
- Maintain existing plan data while updating Stripe references

## Switching Environments

### Development to Production

1. **Update environment variable:**
   ```env
   STRIPE_ENVIRONMENT=live
   ```

2. **Ensure live keys are set:**
   ```env
   STRIPE_LIVE_SECRET_KEY=sk_live_...
   NEXT_PUBLIC_STRIPE_LIVE_PUBLISHABLE_KEY=pk_live_...
   STRIPE_LIVE_WEBHOOK_SECRET=whsec_...
   ```

3. **Restart the application:**
   ```bash
   npm run dev
   # or
   npm run build && npm start
   ```

### Production to Development

1. **Update environment variable:**
   ```env
   STRIPE_ENVIRONMENT=test
   ```

2. **Ensure test keys are set:**
   ```env
   STRIPE_TEST_SECRET_KEY=sk_test_...
   NEXT_PUBLIC_STRIPE_TEST_PUBLISHABLE_KEY=pk_test_...
   STRIPE_TEST_WEBHOOK_SECRET=whsec_...
   ```

3. **Restart the application**

## Troubleshooting

### Common Issues

#### 1. "No such customer" Error

**Problem:** Customer ID exists in database but not in current Stripe environment.

**Solution:**
```sql
-- Clear all customer IDs to force recreation
UPDATE users SET stripeCustomerId = NULL;
UPDATE subscriptions SET stripeCustomerId = NULL;
```

#### 2. Environment Not Switching

**Problem:** Application still uses old environment after changing variables.

**Solutions:**
- Restart the application completely
- Clear browser cache
- Check that environment variables are properly set

#### 3. Missing Environment Variables

**Problem:** Application fails to start with missing key errors.

**Solutions:**
- Ensure all required keys are set for the current environment
- Check that keys match the environment (test keys for test mode, live keys for live mode)
- Verify key format (test keys start with `sk_test_`, live keys start with `sk_live_`)

#### 4. Webhook Issues

**Problem:** Webhooks not receiving events or failing.

**Solutions:**
- Verify webhook endpoint URL is correct
- Check that webhook secret matches environment
- Ensure webhook is enabled in Stripe Dashboard
- Test webhook with Stripe CLI: `stripe listen --forward-to localhost:3000/api/webhooks/stripe`

### Debugging

#### Check Current Environment

Add this to any API route to verify environment:

```typescript
import { STRIPE_ENV } from '@/lib/stripe'

console.log('Current Stripe Environment:', STRIPE_ENV)
```

#### Verify Keys

Add this to check which keys are being used:

```typescript
import { stripe } from '@/lib/stripe'

// This will show which environment the Stripe instance is using
console.log('Stripe API Key:', process.env.STRIPE_SECRET_KEY?.substring(0, 10) + '...')
```

## Best Practices

### 1. Environment Separation

- **Never mix test and live keys** in the same environment
- **Use different webhook endpoints** for test and live
- **Keep test and live product IDs separate** in configuration

### 2. Security

- **Never commit live keys** to version control
- **Use environment variables** for all sensitive data
- **Rotate keys regularly** in production

### 3. Testing

- **Always test in test mode first** before deploying to live
- **Use Stripe CLI** for local webhook testing
- **Verify all subscription flows** work correctly

### 4. Deployment

- **Set environment variables** in your deployment platform
- **Use different environments** for staging and production
- **Monitor webhook delivery** in Stripe Dashboard

## File Structure

The Stripe environment system consists of these files:

```
src/
├── lib/
│   ├── stripe.ts              # Main Stripe configuration
│   ├── stripe-config.ts       # Product ID configuration
│   └── stripe-client.ts       # Client-side Stripe setup
├── types/
│   └── stripe.ts              # TypeScript type definitions
prisma/
└── seed.ts                    # Database seeding with environment-specific IDs
```

## Migration from Legacy Setup

If you're migrating from the old single-environment setup:

1. **Keep existing environment variables** for backward compatibility
2. **Add new environment-specific variables** alongside existing ones
3. **Set `STRIPE_ENVIRONMENT=test`** to use test mode
4. **Update product IDs** in `stripe-config.ts`
5. **Run database seed** to update subscription plans

The system maintains full backward compatibility, so existing setups will continue to work without changes.

## Support

For issues with Stripe environment setup:

1. **Check the troubleshooting section** above
2. **Verify all environment variables** are set correctly
3. **Test with Stripe CLI** for webhook issues
4. **Check Stripe Dashboard** for product and webhook configuration

## Related Documentation

- [Environment Variables Guide](./ENV-variables.md)
- [Webhook Implementation](./CRON-JOBS-AND-WEBHOOKS.md)
- [Stripe Setup Instructions](../STRIPE-SETUP-INSTRUCTIONS.md)
