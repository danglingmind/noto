# Contact Form Setup Guide

## Overview

The contact form feature has been implemented with a floating icon that appears on all pages except viewer pages. It uses **Gmail SMTP with nodemailer** for completely free email delivery and includes proper form validation.

## Features

- ✅ Floating contact icon (bottom-right corner)
- ✅ Hidden on viewer pages (`/file/` and `/shared/` routes)
- ✅ Form validation with Zod
- ✅ **FREE** email delivery via Gmail SMTP
- ✅ Toast notifications for user feedback
- ✅ Responsive design
- ✅ Easy email account switching

## Setup Instructions

### 1. Gmail App Password Setup

**Step 1: Enable 2-Factor Authentication**
1. Go to [Google Account Security](https://myaccount.google.com/security)
2. Enable 2-Factor Authentication if not already enabled

**Step 2: Generate App Password**
1. Go to [Google App Passwords](https://myaccount.google.com/apppasswords)
2. Select "Mail" as the app
3. Select "Other" as the device and name it "Noto Contact Form"
4. Copy the generated 16-character password (e.g., `abcd efgh ijkl mnop`)

### 2. Environment Variables

Add these variables to your `.env.local` file:

```bash
# Gmail SMTP Configuration (FREE)
GMAIL_USER="your-email@gmail.com"
GMAIL_APP_PASSWORD="abcd efgh ijkl mnop"  # 16-character app password

# Email Configuration
CONTACT_TO_EMAIL="your-email@gmail.com"  # Where to receive contact forms
```

### 3. Alternative Free Email Services

If you prefer not to use Gmail, here are other free options:

#### Option A: Formspree (50 submissions/month free)
```bash
# No environment variables needed
# Just change the form action in contact-form.tsx to:
# action="https://formspree.io/f/YOUR_FORM_ID"
```

#### Option B: EmailJS (200 emails/month free)
```bash
EMAILJS_SERVICE_ID="your_service_id"
EMAILJS_TEMPLATE_ID="your_template_id"
EMAILJS_PUBLIC_KEY="your_public_key"
```

### 4. Testing

1. Start the development server: `npm run dev`
2. Navigate to any page (except viewer pages)
3. Click the floating message icon in the bottom-right corner
4. Fill out and submit the form
5. Check your email for the message

## Free Email Service Comparison

| Service | Free Limit | Setup Difficulty | Notes |
|---------|------------|------------------|-------|
| **Gmail SMTP** | Unlimited | Easy | ✅ Recommended - Completely free |
| **Formspree** | 50/month | Very Easy | No server setup needed |
| **EmailJS** | 200/month | Easy | Client-side only |
| **Basin** | 100/month | Easy | Good spam protection |
| **99inbound** | 100/month | Easy | Simple integration |

## Why Gmail SMTP is Recommended

- ✅ **Completely FREE** - No monthly limits
- ✅ **Reliable** - Google's infrastructure
- ✅ **Easy setup** - Just need app password
- ✅ **No third-party dependencies** - Direct SMTP
- ✅ **High deliverability** - Emails rarely go to spam

## File Structure

```
src/
├── components/
│   ├── contact-form.tsx          # Contact form dialog
│   └── floating-contact-icon.tsx # Floating icon component
├── app/
│   ├── api/contact/route.ts      # API endpoint for form submission
│   └── layout.tsx                # Root layout with floating icon
```

## Customization

### Styling
- The floating icon uses Tailwind CSS classes
- Colors and positioning can be modified in `floating-contact-icon.tsx`
- Form styling is in `contact-form.tsx`

### Email Template
- HTML email template is in `/api/contact/route.ts`
- Modify the `html` field to change the email appearance
- Text version is also included for email clients that don't support HTML

### Form Fields
- Current fields: name, email, message
- Add/modify fields in `contact-form.tsx` and update the Zod schema
- Update the API route to handle new fields

## Security Features

- ✅ Form validation with Zod
- ✅ Input sanitization
- ✅ Rate limiting (handled by Resend)
- ✅ CSRF protection (Next.js built-in)
- ✅ XSS prevention

## Troubleshooting

### Common Issues

1. **Email not sending**: Check Resend API key and domain configuration
2. **Form not appearing**: Ensure you're not on a viewer page (`/file/` or `/shared/`)
3. **Validation errors**: Check form field requirements (name: 2+ chars, message: 10+ chars)

### Debug Mode

Enable debug logging by adding `console.log` statements in the API route to see detailed error messages.

## Future Enhancements

- [ ] Email templates with more customization
- [ ] Contact form analytics
- [ ] Auto-responder emails
- [ ] Integration with CRM systems
- [ ] File attachment support
