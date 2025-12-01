# Supabase Realtime Setup Guide

## Overview

Since we're using **broadcast channels** (not database replication), the setup is simpler than table-based realtime. However, you still need to ensure Realtime is enabled in your Supabase project.

## Required Manual Steps

### Step 1: Enable Realtime Service

1. Go to your [Supabase Dashboard](https://app.supabase.com)
2. Select your project
3. Navigate to **Project Settings** (gear icon in sidebar)
4. Click on **Realtime** in the settings menu
5. Ensure **Enable Realtime service** is **ON** (toggle should be green/active)

**Note:** Realtime is usually enabled by default on new projects, but verify this setting.

### Step 2: Verify Environment Variables

Ensure these are set in your `.env.local` file:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

**Where to find these:**
- **Supabase URL & Anon Key:** Project Settings > API > Project URL & anon/public key
- **Service Role Key:** Project Settings > API > service_role key (⚠️ Keep this secret!)

### Step 3: No Database Replication Needed

✅ **Good News:** Since we're using **broadcast channels** (not database change listeners), you **DO NOT need to**:
- Enable replication for tables
- Set up RLS policies for realtime
- Configure table-level realtime settings

Broadcast channels work independently of database replication and don't require any table configuration.

## How It Works

### Broadcast Channels vs Database Replication

**Our Implementation (Broadcast Channels):**
- ✅ No database replication needed
- ✅ No RLS policies needed
- ✅ Works with any channel name
- ✅ Server-side broadcasting via API routes
- ✅ Client-side subscriptions via hooks

**Database Replication (Not Used):**
- ❌ Requires enabling replication per table
- ❌ Requires RLS policies
- ❌ Only works with database changes
- ❌ More complex setup

## Testing the Setup

### 1. Check Realtime Service Status

In Supabase Dashboard:
- Go to **Project Settings** > **Realtime**
- Status should show as **Active** or **Enabled**

### 2. Test Connection

Open browser console and check for:
```
✅ Realtime subscribed to annotations:fileId
```

If you see connection errors, verify:
- Realtime service is enabled
- Environment variables are correct
- Network/firewall allows WebSocket connections

### 3. Test Broadcasting

1. Open the same file in two different browsers (or incognito windows)
2. Create an annotation in one browser
3. It should appear in the other browser **immediately** (within 1-2 seconds)

## Troubleshooting

### Issue: "Channel subscription timeout"

**Possible Causes:**
- Realtime service not enabled in dashboard
- Incorrect Supabase URL or keys
- Network/firewall blocking WebSocket connections
- Service role key doesn't have proper permissions

**Solutions:**
1. Verify Realtime is enabled in dashboard
2. Double-check environment variables
3. Check browser console for WebSocket errors
4. Verify service role key is correct

### Issue: "Channel error" or "CHANNEL_ERROR"

**Possible Causes:**
- Realtime service disabled
- Invalid channel name format
- Rate limiting (too many connections)

**Solutions:**
1. Enable Realtime in dashboard
2. Check channel names match pattern: `annotations:${fileId}`
3. Check Supabase project limits

### Issue: Events not received

**Possible Causes:**
- Broadcasting not working (check API route logs)
- Client not subscribed (check browser console)
- Event deduplication filtering out events

**Solutions:**
1. Check API route logs for broadcast errors
2. Verify client subscription status in console
3. Check if events are being filtered as duplicates

## Security Considerations

### Service Role Key

⚠️ **IMPORTANT:** The `SUPABASE_SERVICE_ROLE_KEY` bypasses Row Level Security (RLS). 

**Best Practices:**
- ✅ Only use on server-side (API routes)
- ✅ Never expose in client-side code
- ✅ Keep in `.env.local` (not committed to git)
- ✅ Rotate if exposed

### Channel Names

Our channel names follow the pattern:
- `annotations:${fileId}` - File-specific annotation channel

These are automatically scoped to prevent cross-file access.

## Monitoring

### Check Realtime Usage

In Supabase Dashboard:
- Go to **Project Settings** > **Usage**
- Check **Realtime** section for:
  - Active connections
  - Messages sent/received
  - Bandwidth usage

### Logs

Check your application logs for:
- `✅ Realtime subscribed to annotations:${fileId}` - Success
- `❌ Realtime channel error` - Connection issues
- `🔄 Reconnecting to annotations:${fileId}` - Reconnection attempts

## Summary

**Required Steps:**
1. ✅ Enable Realtime service in Supabase Dashboard
2. ✅ Verify environment variables are set
3. ✅ Test with multiple browsers

**Not Required:**
- ❌ Database replication setup
- ❌ RLS policies for realtime
- ❌ Table-level configuration

**That's it!** Broadcast channels are simpler to set up than database replication. Once Realtime is enabled in the dashboard, your implementation should work immediately.

