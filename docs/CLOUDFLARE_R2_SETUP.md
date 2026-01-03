# Cloudflare R2 Setup Guide

This guide walks you through setting up Cloudflare R2 buckets for the application.

## Prerequisites

- Cloudflare account
- Access to Cloudflare Dashboard

## Step 1: Enable R2 in Cloudflare Dashboard

1. Log in to [Cloudflare Dashboard](https://dash.cloudflare.com)
2. Select your account
3. Navigate to **R2** in the left sidebar
4. If R2 is not enabled, click **Enable R2** and follow the prompts

## Step 2: Create R2 Buckets

You need to create buckets for different file types. You can use a single bucket or separate buckets for better organization.

### Option A: Single Bucket (Simpler)

Create one bucket for all files:

1. In R2 dashboard, click **Create bucket**
2. Name: `noto-files` (or your preferred name)
3. Location: Choose closest to your users
4. Click **Create bucket**

### Option B: Multiple Buckets (Recommended for Organization)

Create separate buckets for each file type:

1. **Project Files Bucket**
   - Name: `project-files`
   - Location: Choose closest to your users
   - Click **Create bucket**

2. **Snapshots Bucket**
   - Name: `snapshots`
   - Location: Same as above
   - Click **Create bucket**

3. **Invoices Bucket**
   - Name: `invoices`
   - Location: Same as above
   - Click **Create bucket**

4. **Comment Images Bucket**
   - Name: `comment-images`
   - Location: Same as above
   - Click **Create bucket**

## Step 3: Create API Token

You need API credentials to access R2 programmatically:

1. In R2 dashboard, click **Manage R2 API Tokens**
2. Click **Create API Token**
3. Fill in:
   - **Token Name**: `noto-r2-access` (or your preferred name)
   - **Permissions**: 
     - Select **Object Read & Write** (or **Admin Read & Write** for full access)
   - **TTL**: Leave empty for no expiration, or set expiration date
   - **Allow List Operations**: Check this if you need to list objects
4. Click **Create API Token**
5. **IMPORTANT**: Copy the credentials immediately - you won't be able to see them again!
   - **Access Key ID**: Copy this
   - **Secret Access Key**: Copy this

## Step 4: Get Account ID

1. In R2 dashboard, look at the top of the page
2. Your **Account ID** is displayed (or in the URL)
3. Copy this value

## Step 5: Configure Bucket Settings

For each bucket you created:

### Public Access (Optional)

If you want public URLs for files:

1. Click on the bucket name
2. Go to **Settings** tab
3. Under **Public Access**, you can:
   - Enable **Public Access** for the entire bucket (not recommended for private files)
   - Or use **Custom Domain** for public access via your domain

### Custom Domain (Recommended for Public Files)

1. In bucket settings, scroll to **Custom Domain**
2. Click **Connect Domain**
3. Add your domain (e.g., `files.yourdomain.com`)
4. Follow DNS setup instructions
5. Once verified, files will be accessible via `https://files.yourdomain.com/path/to/file`

## Step 6: Set Environment Variables

Add these to your `.env` file and Fly.io secrets:

### Required Variables

```bash
# R2 Account ID (from Step 4)
CLOUDFLARE_R2_ACCOUNT_ID=your-account-id-here

# R2 API Credentials (from Step 3)
CLOUDFLARE_R2_ACCESS_KEY_ID=your-access-key-id-here
CLOUDFLARE_R2_SECRET_ACCESS_KEY=your-secret-access-key-here

# Bucket Name (if using single bucket)
CLOUDFLARE_R2_BUCKET_NAME=noto-files

# Public URL (if using custom domain)
CLOUDFLARE_R2_PUBLIC_URL=https://files.yourdomain.com
```

### Optional: Separate Buckets

If using multiple buckets, you can override the default bucket names:

```bash
CLOUDFLARE_R2_BUCKET_PROJECT_FILES=project-files
CLOUDFLARE_R2_BUCKET_SNAPSHOTS=snapshots
CLOUDFLARE_R2_BUCKET_INVOICES=invoices
CLOUDFLARE_R2_BUCKET_COMMENT_IMAGES=comment-images
```

## Step 7: Set Fly.io Secrets

Set the secrets in Fly.io (these are sensitive, so use secrets, not build args):

```bash
fly secrets set CLOUDFLARE_R2_ACCOUNT_ID=your-account-id
fly secrets set CLOUDFLARE_R2_ACCESS_KEY_ID=your-access-key-id
fly secrets set CLOUDFLARE_R2_SECRET_ACCESS_KEY=your-secret-access-key
fly secrets set CLOUDFLARE_R2_BUCKET_NAME=noto-files
fly secrets set CLOUDFLARE_R2_PUBLIC_URL=https://files.yourdomain.com
```

Or set all at once:

```bash
fly secrets set \
  CLOUDFLARE_R2_ACCOUNT_ID=your-account-id \
  CLOUDFLARE_R2_ACCESS_KEY_ID=your-access-key-id \
  CLOUDFLARE_R2_SECRET_ACCESS_KEY=your-secret-access-key \
  CLOUDFLARE_R2_BUCKET_NAME=noto-files \
  CLOUDFLARE_R2_PUBLIC_URL=https://files.yourdomain.com
```

## Step 8: Test the Setup

You can test R2 access using the debug endpoint:

1. Deploy your application
2. Visit `/api/debug/storage` (requires authentication)
3. Check if buckets are accessible

Or test programmatically:

```typescript
import { r2Buckets } from '@/lib/r2-storage'

// Test upload
const r2 = r2Buckets.projectFiles()
await r2.upload('test.txt', Buffer.from('Hello R2'), 'text/plain')

// Test download
const buffer = await r2.downloadAsBuffer('test.txt')
console.log(buffer.toString()) // Should print "Hello R2"

// Test signed URL
const url = await r2.getSignedUrl('test.txt', 3600)
console.log(url) // Should print a presigned URL
```

## Bucket Structure

The application uses the following path structure:

```
project-files/
  └── {projectId}/
      └── {filename}

snapshots/
  └── {fileId}/
      └── {snapshotId}.html

invoices/
  └── invoices/
      └── invoice-{paymentId}.pdf

comment-images/
  └── comments/
      └── {commentId}/
          └── {imageName}
```

## Security Best Practices

1. **Never commit credentials to git** - Always use environment variables
2. **Use least privilege** - Create API tokens with only necessary permissions
3. **Rotate credentials regularly** - Update API tokens periodically
4. **Use signed URLs for private files** - Don't make buckets public if files are private
5. **Enable CORS if needed** - Configure CORS rules in bucket settings if accessing from browser

## CORS Configuration (If Needed)

If you need to access R2 directly from the browser:

1. Go to bucket settings
2. Scroll to **CORS Policy**
3. Add CORS rules:

```json
[
  {
    "AllowedOrigins": ["https://yourdomain.com"],
    "AllowedMethods": ["GET", "PUT", "POST", "DELETE"],
    "AllowedHeaders": ["*"],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3600
  }
]
```

## Troubleshooting

### Error: "R2 credentials not configured"
- Check that all three environment variables are set: `ACCOUNT_ID`, `ACCESS_KEY_ID`, `SECRET_ACCESS_KEY`

### Error: "Access Denied"
- Verify API token has correct permissions
- Check bucket name is correct
- Ensure bucket exists in your account

### Files not accessible via public URL
- Check if custom domain is properly configured
- Verify DNS records are correct
- Check bucket public access settings

### Signed URLs not working
- Verify API token has read permissions
- Check URL expiration time
- Ensure bucket name matches environment variable

## Cost Considerations

R2 pricing (as of 2024):
- **Storage**: $0.015 per GB/month
- **Class A Operations** (writes): $4.50 per million
- **Class B Operations** (reads): $0.36 per million
- **Egress**: Free (unlike S3)

Monitor usage in Cloudflare Dashboard > R2 > Usage

## Migration from Supabase Storage

If you have existing files in Supabase Storage:

1. Use Supabase Dashboard to download files
2. Or use a migration script to copy files from Supabase to R2
3. Update database records with new file paths if needed

Example migration script structure:

```typescript
// scripts/migrate-storage-to-r2.ts
import { r2Buckets } from '@/lib/r2-storage'
// Import Supabase client temporarily for migration
// Copy files from Supabase to R2
// Update database records
```

## Additional Resources

- [Cloudflare R2 Documentation](https://developers.cloudflare.com/r2/)
- [R2 API Reference](https://developers.cloudflare.com/r2/api/s3/api/)
- [R2 Pricing](https://developers.cloudflare.com/r2/pricing/)

