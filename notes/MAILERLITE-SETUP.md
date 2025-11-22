# MailerLite Integration Setup Guide (Field-Based Approach)

This guide will help you set up MailerLite for transactional emails using a field-based approach for better control and flexibility.

## 1. MailerLite Account Setup

### Create MailerLite Account
1. Sign up at [mailerlite.com](https://mailerlite.com)
2. Complete account verification

### Get API Token
1. Go to **Integrations** → **Developers** → **API**
2. Click **Generate new token**
3. Copy the token (starts with `ml_`)
4. Keep this token secure and never commit it to version control

## 2. Environment Variables

Add these to your `.env.local` file:

```bash
# MailerLite Configuration
MAILERLITE_API_TOKEN=your_mailerlite_api_token
MAILERLITE_WELCOME_GROUP_ID=168510873837504451
NEXT_PUBLIC_MAILERLITE_CONTACT_FORM_ID=your_contact_form_id

# Vercel Cron Security
CRON_SECRET=your_secure_random_string_here
```

## 3. MailerLite Dashboard Setup

### Create Groups
1. Go to **Subscribers** → **Groups**
2. Create the following group:
   - **Welcome Emails** (ID: 168510873837504451)

### Create Custom Fields
1. Go to **Subscribers** → **Fields**
2. Create the following custom fields:
   - **plan** (Text field) - values: "free", "pro", "enterprise"
   - **trial_status** (Text field) - values: "active", "expiring_soon", "expired", "completed"
   - **trial_days_remaining** (Number field) - values: 0-14

### Create Email Templates
Create email templates for different scenarios:

1. **Welcome Email**
   - Subject: "Welcome to Vynl! 🎉"
   - Content: Welcome message with onboarding information
   - Variables: `{{user_name}}`, `{{user_email}}`, `{{plan}}`, `{{trial_status}}`, `{{trial_days_remaining}}`

2. **Trial Reminder 3 Days**
   - Subject: "Your Vynl trial expires in 3 days"
   - Content: 3-day reminder with upgrade options
   - Variables: `{{user_name}}`, `{{trial_days_remaining}}`

3. **Trial Reminder 1 Day**
   - Subject: "Your Vynl trial expires tomorrow"
   - Content: 1-day reminder with urgent upgrade options
   - Variables: `{{user_name}}`, `{{trial_days_remaining}}`

4. **Trial Expired**
   - Subject: "Your Vynl trial has expired"
   - Content: Trial expired notification with upgrade options
   - Variables: `{{user_name}}`

### Create Field-Based Automations
Create automations that trigger based on field values:

1. **Welcome Automation**
   - Trigger: When subscriber is added to "Welcome Emails" group
   - Action: Send welcome email template
   - Remove from group after sending

2. **3-Day Trial Reminder**
   - Trigger: When `trial_days_remaining` = 3 AND `trial_status` = "expiring_soon"
   - Action: Send 3-day reminder email

3. **1-Day Trial Reminder**
   - Trigger: When `trial_days_remaining` = 1 AND `trial_status` = "expiring_soon"
   - Action: Send 1-day reminder email

4. **Trial Expired**
   - Trigger: When `trial_status` = "expired"
   - Action: Send trial expired email

## 4. Vercel Deployment

### Add Environment Variables
1. Go to your Vercel project dashboard
2. Navigate to **Settings** → **Environment Variables**
3. Add all the MailerLite environment variables
4. Set `CRON_SECRET` to a secure random string

### Enable Cron Jobs
The cron job is already configured in `vercel.json` to run daily at midnight UTC.

## 5. Testing

### Test Welcome Email
1. Create a new user account
2. Check MailerLite dashboard for new subscriber
3. Verify welcome email is sent
4. Check that custom fields are populated:
   - `plan: "free"`
   - `trial_status: "active"`
   - `trial_days_remaining: "14"`

### Test Trial Reminders
1. Create a test user with `trialEndDate` set to tomorrow
2. Manually call the cron endpoint:
   ```bash
   curl -X GET "https://your-domain.vercel.app/api/cron/trial-reminders" \
        -H "Authorization: Bearer your_cron_secret"
   ```
3. Check MailerLite for field updates and triggered emails

### Test Plan Purchase
1. Complete a subscription purchase
2. Check that the `plan` field is updated to "pro" or "enterprise"
3. Verify `trial_status` is set to "completed"

## 6. Field-Based Benefits

### Advantages of Field-Based Approach
1. **No Code Changes**: Update automations in MailerLite dashboard without deploying code
2. **Better Control**: Field-based filtering is more flexible than group membership
3. **Cleaner**: Fewer groups to manage
4. **Scalable**: Easy to add new plan types or trial statuses
5. **Maintainable**: Clear separation between code and marketing logic

### Field Values
- **plan**: "free", "pro", "enterprise"
- **trial_status**: "active", "expiring_soon", "expired", "completed"
- **trial_days_remaining**: "0" to "14"

## 7. Migration from Group-Based System

If you're migrating from the old group-based system:

1. **Export subscribers** from old groups:
   - "Trial Reminder 3 Days"
   - "Trial Reminder 1 Day"
   - "Trial Expired"

2. **Update their fields** using the `addFields` method:
   ```typescript
   await emailService.addFields({
     to: { email: 'user@example.com', name: 'User' },
     fields: {
       plan: 'free',
       trial_status: 'active',
       trial_days_remaining: '14'
     }
   })
   ```

3. **Remove them from old groups**

4. **Delete old groups** after migration is complete

## 8. Monitoring

### MailerLite Dashboard
- Monitor subscriber growth
- Check field values are being updated correctly
- Review automation performance
- Track email delivery rates

### Vercel Function Logs
- Check for errors in Vercel dashboard
- Monitor cron job execution
- Verify field updates are successful

## 9. Troubleshooting

### Common Issues

1. **Fields not updating**
   - Check API token is correct
   - Verify field names match exactly
   - Check subscriber exists in MailerLite

2. **Automations not triggering**
   - Verify field values are set correctly
   - Check automation conditions in MailerLite
   - Test automation manually

3. **Cron job not running**
   - Check `CRON_SECRET` is set correctly
   - Verify cron configuration in `vercel.json`
   - Check Vercel function logs

### Debug Commands

```bash
# Test locally with environment variables
npm run dev

# Check Vercel function logs
vercel logs

# Test specific endpoints
curl -X GET "https://your-domain.vercel.app/api/cron/trial-reminders" \
     -H "Authorization: Bearer your_cron_secret"
```

## 10. Security Best Practices

1. **API Token Security**
   - Never commit API tokens to version control
   - Use Vercel's environment variables for all secrets
   - Rotate API tokens regularly
   - Use different tokens for different environments

2. **Cron Job Security**
   - Use strong, random `CRON_SECRET`
   - Never expose cron endpoints publicly
   - Monitor for unusual activity

3. **MailerLite Security**
   - Limit API token permissions if possible
   - Monitor API usage in MailerLite dashboard
   - Set up rate limiting if needed