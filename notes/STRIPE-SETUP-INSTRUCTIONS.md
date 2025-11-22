# Stripe Setup Instructions for Noto Subscription System

This guide will walk you through setting up Stripe for the Noto subscription system, including creating products, prices, webhooks, and configuring environment variables.

## 📋 Prerequisites

- Stripe account (create at [stripe.com](https://stripe.com))
- Access to your Stripe Dashboard
- Your Noto application running locally

## 🔧 Step 1: Stripe Dashboard Setup

### 1.1 Create Products and Prices

1. **Login to Stripe Dashboard**
   - Go to [dashboard.stripe.com](https://dashboard.stripe.com)
   - Make sure you're in **Test mode** for development

2. **Create Free Plan Product**
   ```
   Product Name: Noto Free Plan
   Description: Perfect for individuals and small teams getting started
   ```

3. **Create Pro Plan Product**
   ```
   Product Name: Noto Pro Plan
   Description: Advanced features for growing teams and agencies
   ```

4. **Create Enterprise Plan Product**
   ```
   Product Name: Noto Enterprise Plan
   Description: Full-featured solution for large organizations
   ```

### 1.2 Create Prices for Each Product

For each product, create a **Recurring** price:

**Free Plan:**
- Price: $0.00 USD
- Billing period: Monthly
- Copy the **Price ID** (starts with `price_`)

**Pro Plan:**
- Price: $29.00 USD
- Billing period: Monthly
- Copy the **Price ID** (starts with `price_`)

**Enterprise Plan:**
- Price: $99.00 USD
- Billing period: Monthly
- Copy the **Price ID** (starts with `price_`)

### 1.3 Get Product IDs

For each product, copy the **Product ID** (starts with `prod_`).

## 🔑 Step 2: Environment Variables Setup

### 2.1 Get Stripe API Keys

1. **Go to Developers > API Keys** in Stripe Dashboard
2. **Copy the following keys:**
   - **Publishable key** (starts with `pk_test_`)
   - **Secret key** (starts with `sk_test_`)

### 2.2 Update Your .env File

Add these variables to your `.env` file:

```env
# Stripe Configuration
STRIPE_SECRET_KEY=sk_test_your_secret_key_here
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_your_publishable_key_here
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret_here
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Note: STRIPE_WEBHOOK_SECRET will be set in Step 3
```

## 🪝 Step 3: Webhook Setup

### 3.1 Create Webhook Endpoint

**Choose your setup based on your environment:**

#### **Option A: Local Development (Recommended)**
Use Stripe CLI for local development:

```bash
# Install Stripe CLI
# Then forward events to your local server
stripe listen --forward-to localhost:3000/api/webhooks/stripe
```

This will give you a webhook URL like: `https://webhook.stripe.com/whsec_...`
Copy the webhook secret from the CLI output.

#### **Option B: Direct Local Webhook (Alternative)**
1. **Go to Developers > Webhooks** in Stripe Dashboard
2. **Click "Add endpoint"**
3. **Endpoint URL:** `http://localhost:3000/api/webhooks/stripe`
   - ⚠️ **Note:** This only works if your local server is accessible from the internet
   - Consider using ngrok or similar tunneling service
4. **Select events to listen for:**
   ```
   customer.subscription.created
   customer.subscription.updated
   customer.subscription.deleted
   invoice.payment_succeeded
   invoice.payment_failed
   ```

5. **Click "Add endpoint"**
6. **Copy the webhook signing secret** (starts with `whsec_`)

#### **Option C: Production Webhook**
1. **Go to Developers > Webhooks** in Stripe Dashboard
2. **Click "Add endpoint"**
3. **Endpoint URL:** `https://yourdomain.com/api/webhooks/stripe`
   - Replace `yourdomain.com` with your actual domain
4. **Select events to listen for:**
   ```
   customer.subscription.created
   customer.subscription.updated
   customer.subscription.deleted
   invoice.payment_succeeded
   invoice.payment_failed
   ```

5. **Click "Add endpoint"**
6. **Copy the webhook signing secret** (starts with `whsec_`)

### 3.2 Update Environment Variables

Add the webhook secret to your `.env` file:

```env
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret_here
```

## 🗄️ Step 4: Update Database with Stripe IDs

### 4.1 Update Seed File

Edit `prisma/seed.ts` and replace the `stripePriceId` and `stripeProductId` values:

```typescript
// Free Plan
const freePlan = await prisma.subscriptionPlan.upsert({
  where: { name: 'free' },
  update: {},
  create: {
    name: 'free',
    displayName: 'Free',
    description: 'Perfect for individuals and small teams getting started',
    price: 0,
    billingInterval: 'MONTHLY',
    stripePriceId: 'price_YOUR_FREE_PRICE_ID', // Replace with actual ID
    stripeProductId: 'prod_YOUR_FREE_PRODUCT_ID', // Replace with actual ID
    isActive: true,
    sortOrder: 1,
    featureLimits: {
      // ... existing feature limits
    }
  }
})

// Pro Plan
const proPlan = await prisma.subscriptionPlan.upsert({
  where: { name: 'pro' },
  update: {},
  create: {
    name: 'pro',
    displayName: 'Pro',
    description: 'Advanced features for growing teams and agencies',
    price: 29,
    billingInterval: 'MONTHLY',
    stripePriceId: 'price_YOUR_PRO_PRICE_ID', // Replace with actual ID
    stripeProductId: 'prod_YOUR_PRO_PRODUCT_ID', // Replace with actual ID
    isActive: true,
    sortOrder: 2,
    featureLimits: {
      // ... existing feature limits
    }
  }
})

// Enterprise Plan
const enterprisePlan = await prisma.subscriptionPlan.upsert({
  where: { name: 'enterprise' },
  update: {},
  create: {
    name: 'enterprise',
    displayName: 'Enterprise',
    description: 'Full-featured solution for large organizations',
    price: 99,
    billingInterval: 'MONTHLY',
    stripePriceId: 'price_YOUR_ENTERPRISE_PRICE_ID', // Replace with actual ID
    stripeProductId: 'prod_YOUR_ENTERPRISE_PRODUCT_ID', // Replace with actual ID
    isActive: true,
    sortOrder: 3,
    featureLimits: {
      // ... existing feature limits
    }
  }
})
```

### 4.2 Run Database Seed

```bash
npm run db:seed
```

## 🧪 Step 5: Testing the Integration

### 5.1 Test Pricing Page

1. **Start your development server:**
   ```bash
   npm run dev
   ```

2. **Visit the pricing page:**
   ```
   http://localhost:3000/pricing
   ```

3. **Verify plans are displayed** with correct pricing and features

### 5.2 Test Subscription Flow

1. **Click "Get Started" on Pro or Enterprise plan**
2. **Complete Stripe Checkout** (use test card: `4242 4242 4242 4242`)
3. **Verify subscription is created** in Stripe Dashboard
4. **Check database** for new subscription record

### 5.3 Test Webhook Integration

1. **Create a test subscription** through your app
2. **Check Stripe Dashboard** for webhook delivery status
3. **Verify database** is updated with subscription status

## 🔍 Step 6: Verification Checklist

- [ ] All three products created in Stripe Dashboard
- [ ] All three prices created with correct amounts
- [ ] Environment variables set in `.env` file
- [ ] Webhook endpoint created and configured
- [ ] Database seed updated with Stripe IDs
- [ ] Pricing page displays plans correctly
- [ ] Subscription creation works end-to-end
- [ ] Webhook events are received and processed

## 🚀 Step 7: Production Setup

### 7.1 Switch to Live Mode

1. **In Stripe Dashboard, toggle to "Live mode"**
2. **Create the same products and prices** in live mode
3. **Update environment variables** with live keys
4. **Update webhook endpoint** to your production URL
5. **Update database** with live Stripe IDs

### 7.2 Environment Variables for Production

```env
# Production Stripe Configuration
STRIPE_SECRET_KEY=sk_live_your_live_secret_key
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_your_live_publishable_key
STRIPE_WEBHOOK_SECRET=whsec_your_live_webhook_secret
NEXT_PUBLIC_APP_URL=https://yourdomain.com
```

## 🛠️ Troubleshooting

### Common Issues

**1. "Plan not found" error:**
- Verify `stripePriceId` is correct in database
- Check that price exists in Stripe Dashboard

**2. Webhook not receiving events:**
- Verify webhook URL is correct
- Check webhook secret in environment variables
- Ensure webhook endpoint is accessible

**3. Subscription not created:**
- Check Stripe API keys are correct
- Verify customer creation is working
- Check browser console for errors

**4. Pricing page shows no plans:**
- Run `npm run db:seed` to populate plans
- Check database connection
- Verify API endpoint `/api/subscriptions/plans` is working

### Debug Commands

```bash
# Check database plans
npx prisma studio

# Test API endpoints
curl http://localhost:3000/api/subscriptions/plans

# Check webhook logs in Stripe Dashboard
# Go to Developers > Webhooks > Your endpoint > Recent deliveries
```

## 📚 Additional Resources

- [Stripe Documentation](https://stripe.com/docs)
- [Stripe Webhooks Guide](https://stripe.com/docs/webhooks)
- [Stripe Testing Guide](https://stripe.com/docs/testing)
- [Next.js API Routes](https://nextjs.org/docs/api-routes/introduction)

## 🔒 Security Notes

- **Never commit** `.env` file to version control
- **Use test keys** during development
- **Verify webhook signatures** (already implemented)
- **Validate all webhook events** before processing
- **Use HTTPS** in production for webhook endpoints

---

## 📞 Support

If you encounter issues during setup:

1. Check the troubleshooting section above
2. Review Stripe Dashboard logs
3. Check your application logs
4. Verify all environment variables are set correctly

The subscription system is now ready to handle payments and manage user subscriptions! 🎉
