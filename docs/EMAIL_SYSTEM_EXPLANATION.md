# Email System Architecture & Setup

## How Emails Are Currently Sent

### Current System: MailerLite Groups + Automations

The current email system **does NOT send direct transactional emails**. Instead, it uses a **group-based automation system**:

1. **User is added to a MailerLite group** (e.g., "workspace-locked-owner")
2. **MailerLite automation is triggered** when user joins the group
3. **Automation sends the email** using a pre-configured template

### Email Flow:

```
Code calls emailService.send() 
    ↓
User is upserted in MailerLite
    ↓
User is added to specific group (e.g., "workspace-locked-owner")
    ↓
MailerLite automation triggers
    ↓
Email is sent using automation template
```

## Required Setup in MailerLite

### 1. Create Groups in MailerLite

You need to create these groups in your MailerLite account:

- `workspace-locked-owner` - For workspace owners when their workspace is locked
- `workspace-locked` - For workspace members when workspace is locked  
- `workspace-unlocked` - For both owners and members when workspace is unlocked

### 2. Create Automations

For each group, create a MailerLite automation that:

1. **Trigger**: "Subscriber added to group"
2. **Group**: The specific group (e.g., "workspace-locked-owner")
3. **Email Template**: Create and configure the email template
4. **Send immediately**: Set to send right away

### 3. Configure Environment Variables

Add these group IDs to your environment variables:

```env
# Add to your .env file
MAILERLITE_WORKSPACE_LOCKED_OWNER_GROUP_ID=your_group_id_here
MAILERLITE_WORKSPACE_LOCKED_GROUP_ID=your_group_id_here  
MAILERLITE_WORKSPACE_UNLOCKED_GROUP_ID=your_group_id_here
```

### 4. Update Email Service Configuration

Update your email service configuration to include the new group IDs:

```typescript
// In your email service setup
const emailConfig = {
  apiToken: process.env.MAILERLITE_API_TOKEN,
  groupIds: {
    welcome: process.env.MAILERLITE_WELCOME_GROUP_ID,
    trialReminder3d: process.env.MAILERLITE_TRIAL_REMINDER_3D_GROUP_ID,
    trialReminder1d: process.env.MAILERLITE_TRIAL_REMINDER_1D_GROUP_ID,
    trialExpired: process.env.MAILERLITE_TRIAL_EXPIRED_GROUP_ID,
    paymentSuccess: process.env.MAILERLITE_PAYMENT_SUCCESS_GROUP_ID,
    paymentFailed: process.env.MAILERLITE_PAYMENT_FAILED_GROUP_ID,
    workspaceInvite: process.env.MAILERLITE_WORKSPACE_INVITE_GROUP_ID,
    // NEW: Add these
    workspaceLockedOwner: process.env.MAILERLITE_WORKSPACE_LOCKED_OWNER_GROUP_ID,
    workspaceLocked: process.env.MAILERLITE_WORKSPACE_LOCKED_GROUP_ID,
    workspaceUnlocked: process.env.MAILERLITE_WORKSPACE_UNLOCKED_GROUP_ID,
  }
}
```

## Email Templates Required

### 1. Workspace Locked (Owner) Template

**Subject**: Your workspace has been locked
**Template Variables Available**:
- `{{workspace_name}}` - Name of the workspace
- `{{reason}}` - Reason for lock (trial expiration, payment failure, etc.)
- `{{upgrade_url}}` - Link to pricing page
- `{{workspace_url}}` - Link to workspace

**Sample Content**:
```
Hi {{name}},

Your workspace "{{workspace_name}}" has been locked due to {{reason}}.

To restore access for you and your team members, please upgrade your subscription:

[Upgrade Now]({{upgrade_url}})

If you have any questions, please contact our support team.

Best regards,
The Vynl Team
```

### 2. Workspace Locked (Member) Template

**Subject**: Workspace access restricted
**Template Variables Available**:
- `{{workspace_name}}` - Name of the workspace
- `{{owner_name}}` - Name of workspace owner
- `{{owner_email}}` - Email of workspace owner
- `{{reason}}` - Reason for lock

**Sample Content**:
```
Hi {{name}},

Access to the workspace "{{workspace_name}}" has been restricted.

This workspace is currently unavailable due to {{reason}}. Please contact the workspace owner to resolve this issue:

Owner: {{owner_name}} ({{owner_email}})

We apologize for any inconvenience.

Best regards,
The Vynl Team
```

### 3. Workspace Unlocked Template

**Subject**: Workspace access restored
**Template Variables Available**:
- `{{workspace_name}}` - Name of the workspace
- `{{workspace_url}}` - Link to workspace

**Sample Content**:
```
Hi {{name}},

Great news! Access to the workspace "{{workspace_name}}" has been restored.

You can now access the workspace again:

[Access Workspace]({{workspace_url}})

Thank you for your patience.

Best regards,
The Vynl Team
```

## Alternative: Direct Transactional Emails

If you prefer to send **direct transactional emails** instead of using groups/automations, you would need to:

### Option A: Use MailerLite Transactional API
- Use MailerLite's transactional email API directly
- Send emails immediately without groups/automations
- Requires different implementation in the email service

### Option B: Use a Different Email Service
- Switch to SendGrid, Resend, or similar
- Implement direct transactional email sending
- More straightforward for transactional emails

## Current Implementation Status

✅ **Code is ready** - All workspace lock notification code is implemented
❌ **MailerLite setup needed** - Groups and automations need to be created
❌ **Environment variables needed** - Group IDs need to be configured
❌ **Email templates needed** - Templates need to be created in MailerLite

## Next Steps

1. **Create groups in MailerLite** for the three new email types
2. **Create automations** that trigger when users are added to these groups
3. **Create email templates** with the provided content
4. **Add environment variables** for the group IDs
5. **Update email service configuration** to include the new group IDs
6. **Test the email flow** by triggering a workspace lock

The system is designed to be **reliable and fault-tolerant** - if email sending fails, it won't break the main workspace lock functionality.
