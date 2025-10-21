# Vercel Deployment Guide for MailerLite Integration

## Authentication Setup for Vercel

### 1. Get MailerLite API Token

1. **Login to MailerLite Dashboard**
   - Go to [mailerlite.com](https://mailerlite.com)
   - Login to your account

2. **Generate API Token**
   - Navigate to **Integrations** → **Developers** → **API**
   - Click **Generate new token**
   - Copy the token (starts with `ml_`)
   - **Important**: Keep this token secure and never commit it to version control

### 2. Vercel Environment Variables Setup

1. **Go to Vercel Dashboard**
   - Navigate to your project
   - Go to **Settings** → **Environment Variables**

2. **Add Required Variables**
   ```bash
   # MailerLite Configuration
   MAILERLITE_API_TOKEN=ml_your_actual_api_token_here
   MAILERLITE_WELCOME_GROUP_ID=168510873837504451
   NEXT_PUBLIC_MAILERLITE_CONTACT_FORM_ID=your_contact_form_id
   
   # Vercel Cron Security
   CRON_SECRET=your_secure_random_string_here
   ```

3. **Set Environment Scope**
   - Set all variables for **Production**, **Preview**, and **Development**
   - This ensures they work in all environments

### 3. Deploy to Vercel

1. **Push to Repository**
   ```bash
   git add .
   git commit -m "Add MailerLite integration with production service"
   git push origin main
   ```

2. **Vercel Auto-Deploy**
   - Vercel will automatically detect the push
   - Build and deploy your application
   - Environment variables will be injected during build

### 4. Verify Deployment

1. **Check Environment Variables**
   - Go to Vercel Dashboard → Your Project → Settings → Environment Variables
   - Verify all variables are set correctly

2. **Test Welcome Email**
   - Create a new user account
   - Check MailerLite dashboard for new subscriber
   - Verify welcome automation is triggered

3. **Test Cron Job**
   - Wait for next scheduled run (daily at midnight UTC)
   - Or manually trigger: `GET /api/cron/trial-reminders` with proper auth header

## Security Best Practices

### 1. API Token Security
- **Never commit API tokens to version control**
- **Use Vercel's environment variables for all secrets**
- **Rotate API tokens regularly**
- **Use different tokens for different environments**

### 2. Cron Job Security
- **Use strong, random `CRON_SECRET`**
- **Never expose cron endpoints publicly**
- **Monitor for unusual activity**

### 3. MailerLite Security
- **Limit API token permissions if possible**
- **Monitor API usage in MailerLite dashboard**
- **Set up rate limiting if needed**

## Troubleshooting

### Common Issues

1. **"Missing required environment variables"**
   - Check all variables are set in Vercel
   - Verify variable names match exactly
   - Redeploy after adding variables

2. **"MailerLite API error: 401"**
   - Check API token is correct
   - Verify token hasn't expired
   - Check token permissions

3. **"MailerLite API error: 404"**
   - Verify group IDs are correct
   - Check groups exist in MailerLite dashboard
   - Ensure automations are set up

4. **Cron job not running**
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

## Monitoring

### 1. Vercel Monitoring
- **Function Logs**: Check for errors in Vercel dashboard
- **Performance**: Monitor function execution time
- **Usage**: Track API calls and costs

### 2. MailerLite Monitoring
- **Subscriber Growth**: Monitor new subscribers
- **Email Delivery**: Check delivery rates
- **Automation Performance**: Review automation triggers

### 3. Application Monitoring
- **Error Tracking**: Set up error monitoring (e.g., Sentry)
- **Logging**: Implement structured logging
- **Alerts**: Set up alerts for critical failures

## Production Checklist

- [ ] All environment variables set in Vercel
- [ ] API token is valid and has proper permissions
- [ ] Group IDs are correct and groups exist
- [ ] Automations are set up in MailerLite
- [ ] Cron job is scheduled and running
- [ ] Welcome email triggers on new user signup
- [ ] Trial reminders work correctly
- [ ] Contact form is embedded and functional
- [ ] Error handling is in place
- [ ] Monitoring and logging are configured

## Support

If you encounter issues:

1. **Check Vercel Function Logs** for error details
2. **Verify MailerLite Dashboard** for subscriber activity
3. **Test API endpoints** manually
4. **Review environment variables** in Vercel dashboard
5. **Check MailerLite API documentation** for latest changes

The integration is now production-ready and will work reliably on Vercel with proper authentication!
