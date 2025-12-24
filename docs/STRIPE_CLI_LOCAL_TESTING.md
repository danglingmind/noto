# Stripe CLI Local Webhook Testing Guide

This guide explains how to use Stripe CLI to test webhooks locally during development.

## Prerequisites

1. **Stripe Account**: You need a Stripe account (test mode is fine)
2. **Stripe CLI**: Install the Stripe CLI on your machine
3. **Local Server**: Your Next.js app should be running locally (typically on `http://localhost:3000`)

## Installation

### macOS (using Homebrew)
```bash
brew install stripe/stripe-cli/stripe
```

### Linux
```bash
# Download the latest release
wget https://github.com/stripe/stripe-cli/releases/latest/download/stripe_*_linux_x86_64.tar.gz
tar -xvf stripe_*_linux_x86_64.tar.gz
sudo mv stripe /usr/local/bin/
```

### Windows
Download the installer from: https://github.com/stripe/stripe-cli/releases/latest

### Verify Installation
```bash
stripe --version
```

## Setup Steps

### 1. Login to Stripe CLI

Authenticate the CLI with your Stripe account:

```bash
stripe login
```

This will:
- Open your browser
- Ask you to authorize the CLI
- Link the CLI to your Stripe account

### 2. Start Your Local Server

Make sure your Next.js application is running:

```bash
npm run dev
```

Your app should be accessible at `http://localhost:3000`

### 3. Forward Webhooks to Local Endpoint

In a **separate terminal**, run the Stripe CLI to forward webhooks:

```bash
stripe listen --forward-to localhost:3000/api/webhooks/stripe
```

**Important Notes:**
- Keep this terminal window open while testing
- The CLI will display a webhook signing secret (starts with `whsec_`)
- Copy this secret - you'll need it for your `.env` file

Example output:
```
> Ready! Your webhook signing secret is whsec_xxxxxxxxxxxxx (^C to quit)
```

### 4. Update Your Environment Variables

Add or update the webhook secret in your `.env` file:

```env
# Use the webhook secret from Stripe CLI output
STRIPE_WEBHOOK_SECRET=whsec_xxxxxxxxxxxxx
```

**Note:** The webhook secret from Stripe CLI is different from the one in your Stripe Dashboard. For local testing, use the CLI secret.

### 5. Restart Your Application

After updating the `.env` file, restart your Next.js server:

```bash
# Stop the server (Ctrl+C) and restart
npm run dev
```

## Testing Payment Flows

### Stripe Test Card Numbers

When testing payment flows through Stripe Checkout, use these test card numbers. These only work in **test mode**.

#### Successful Payments

**Visa (Most Common)**
```
Card Number: 4242 4242 4242 4242
Expiry: Any future date (e.g., 12/34)
CVC: Any 3 digits (e.g., 123)
ZIP: Any 5 digits (e.g., 12345)
```

**Visa (Debit)**
```
Card Number: 4000 0566 5566 5556
```

**Mastercard**
```
Card Number: 5555 5555 5555 4444
```

**American Express**
```
Card Number: 3782 822463 10005
```

#### Payment Failures

**Card Declined (Generic)**
```
Card Number: 4000 0000 0000 0002
```

**Insufficient Funds**
```
Card Number: 4000 0000 0000 9995
```

**Lost Card**
```
Card Number: 4000 0000 0000 9987
```

**Stolen Card**
```
Card Number: 4000 0000 0000 9979
```

**Expired Card**
```
Card Number: 4000 0000 0000 0069
```

**Incorrect CVC**
```
Card Number: 4000 0000 0000 0127
```

**Processing Error**
```
Card Number: 4000 0000 0000 0119
```

#### 3D Secure Authentication

**Requires Authentication (SCA)**
```
Card Number: 4000 0027 6000 3184
```
This card will trigger 3D Secure authentication flow.

**Authentication Fails**
```
Card Number: 4000 0082 6000 3178
```

#### Subscription Testing

**Card That Will Succeed Then Fail**
```
Card Number: 4000 0000 0000 0341
```
Useful for testing subscription payment failures.

### Using Test Cards

1. **Navigate to your checkout page** in your application
2. **Fill in the form** with one of the test card numbers above
3. **Use any future expiry date** (e.g., 12/34)
4. **Use any 3-digit CVC** (e.g., 123)
5. **Use any ZIP code** (e.g., 12345)
6. **Complete the payment** - it will process successfully in test mode

### Important Notes

- ⚠️ **Test cards only work in test mode** - Make sure `STRIPE_ENVIRONMENT=test` in your `.env`
- ✅ **No real money is charged** - These are simulated payments
- 🔄 **Use different cards** to test different scenarios (success, failure, 3D Secure, etc.)
- 📝 **All test cards use the same format** - Only the card number changes

## Testing Webhooks

### Trigger Test Events

Once the CLI is forwarding webhooks, you can trigger test events:

#### Test Checkout Session Completed
```bash
stripe trigger checkout.session.completed
```

#### Test Subscription Created
```bash
stripe trigger customer.subscription.created
```

#### Test Subscription Updated
```bash
stripe trigger customer.subscription.updated
```

#### Test Subscription Deleted
```bash
stripe trigger customer.subscription.deleted
```

#### Test Payment Succeeded
```bash
stripe trigger invoice.payment_succeeded
```

#### Test Payment Failed
```bash
stripe trigger invoice.payment_failed
```

### View Webhook Events

The Stripe CLI will show you:
- Event type
- Event ID
- Request payload
- Response from your server
- Response status code

Example output:
```
2024-01-15 10:30:45   --> checkout.session.completed [evt_xxxxx]
2024-01-15 10:30:45  <--  [200] POST http://localhost:3000/api/webhooks/stripe [evt_xxxxx]
```

## Common Workflow

### Complete Testing Workflow

1. **Terminal 1**: Start your Next.js app
   ```bash
   npm run dev
   ```

2. **Terminal 2**: Start Stripe CLI forwarding
   ```bash
   stripe listen --forward-to localhost:3000/api/webhooks/stripe
   ```
   - Copy the webhook secret (`whsec_...`)
   - Add it to your `.env` file as `STRIPE_WEBHOOK_SECRET`
   - Restart Terminal 1

3. **Terminal 3**: Trigger test events
   ```bash
   stripe trigger checkout.session.completed
   ```

4. **Check your application**:
   - Check server logs in Terminal 1
   - Check webhook logs in Terminal 2
   - Verify database changes
   - Check your application UI

## Advanced Usage

### Filter Specific Events

Forward only specific events:

```bash
stripe listen --forward-to localhost:3000/api/webhooks/stripe \
  --events checkout.session.completed,customer.subscription.updated
```

### Use Test Mode vs Live Mode

By default, Stripe CLI uses test mode. To use live mode:

```bash
stripe listen --forward-to localhost:3000/api/webhooks/stripe --api-key sk_live_...
```

**⚠️ Warning**: Be careful when using live mode. Test thoroughly in test mode first.

### Replay Events

Replay a specific event from your Stripe Dashboard:

```bash
stripe events resend evt_xxxxxxxxxxxxx
```

### View Event Details

Inspect an event payload:

```bash
stripe events retrieve evt_xxxxxxxxxxxxx
```

## Troubleshooting

### Issue: "Webhook signature verification failed"

**Solution:**
1. Make sure you're using the webhook secret from the CLI output (not from Dashboard)
2. Restart your server after updating `.env`
3. Check that `STRIPE_WEBHOOK_SECRET` is set correctly

### Issue: "Connection refused" or "Cannot connect"

**Solution:**
1. Ensure your Next.js app is running on `localhost:3000`
2. Check that the webhook endpoint path is correct: `/api/webhooks/stripe`
3. Verify no firewall is blocking the connection

### Issue: Events not being received

**Solution:**
1. Check that Stripe CLI is still running and forwarding
2. Verify the webhook secret matches in both CLI and `.env`
3. Check your server logs for errors
4. Ensure your webhook handler isn't crashing

### Issue: Wrong environment (test vs live)

**Solution:**
- Stripe CLI defaults to test mode
- Make sure your `.env` has `STRIPE_ENVIRONMENT=test` for local testing
- Use test API keys (`sk_test_...`) when testing locally

## Environment-Specific Webhook Secrets

If you're using the environment-based Stripe configuration:

```env
# For local testing with Stripe CLI
STRIPE_ENVIRONMENT=test
STRIPE_TEST_WEBHOOK_SECRET=whsec_xxxxxxxxxxxxx  # From Stripe CLI

# For production (from Stripe Dashboard)
STRIPE_LIVE_WEBHOOK_SECRET=whsec_xxxxxxxxxxxxx  # From Dashboard
```

**Important:** 
- Use the CLI secret for local testing (`STRIPE_TEST_WEBHOOK_SECRET`)
- Use the Dashboard secret for production (`STRIPE_LIVE_WEBHOOK_SECRET`)

## Best Practices

1. **Always test in test mode first** before testing with live events
2. **Keep the CLI terminal open** while testing webhooks
3. **Check both CLI output and server logs** for debugging
4. **Use specific event triggers** to test individual webhook handlers
5. **Verify database changes** after webhook events
6. **Test error scenarios** (payment failures, subscription cancellations, etc.)

## Quick Reference

### CLI Commands

```bash
# Login
stripe login

# Forward webhooks
stripe listen --forward-to localhost:3000/api/webhooks/stripe

# Trigger events
stripe trigger checkout.session.completed
stripe trigger customer.subscription.created
stripe trigger customer.subscription.updated
stripe trigger customer.subscription.deleted
stripe trigger invoice.payment_succeeded
stripe trigger invoice.payment_failed

# View events
stripe events list
stripe events retrieve evt_xxxxx

# Replay events
stripe events resend evt_xxxxx
```

### Test Card Numbers Quick Reference

| Scenario | Card Number | Notes |
|----------|-------------|-------|
| **Success** | `4242 4242 4242 4242` | Most common test card |
| **Declined** | `4000 0000 0000 0002` | Generic decline |
| **Insufficient Funds** | `4000 0000 0000 9995` | Payment failure |
| **3D Secure** | `4000 0027 6000 3184` | Requires authentication |
| **Expired Card** | `4000 0000 0000 0069` | Card expired error |

**All test cards use:**
- Expiry: Any future date (e.g., `12/34`)
- CVC: Any 3 digits (e.g., `123`)
- ZIP: Any 5 digits (e.g., `12345`)

## Related Documentation

- [Stripe Environment Setup](./STRIPE-ENVIRONMENT-SETUP.md)
- [Webhook Implementation](../documentation/CRON-JOBS-AND-WEBHOOKS.md)
- [Stripe Official CLI Docs](https://stripe.com/docs/stripe-cli)

