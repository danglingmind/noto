# Supabase Dashboard Setup Guide

## Alternative Method: Using Supabase Dashboard (Recommended)

If you're getting permission errors with SQL commands, use the Supabase Dashboard instead:

### Step 1: Create Storage Bucket via Dashboard

1. **Go to your Supabase Dashboard**
2. **Navigate to Storage** (left sidebar)
3. **Click "New Bucket"**
4. **Configure bucket:**
   - **Name**: `project-files`
   - **Public**: `false` (keep it private)
   - **File size limit**: `500MB`
   - **Allowed MIME types**: 
     ```
     image/jpeg, image/png, image/gif, image/webp, image/svg+xml,
     application/pdf,
     video/mp4, video/webm, video/ogg,
     text/html
     ```

### Step 2: Configure RLS Policies via Dashboard

1. **In Storage section**, click on your `project-files` bucket
2. **Go to "Policies" tab**
3. **Click "New Policy"** for each policy below:

#### Policy 1: Allow Upload
- **Name**: `Users can upload to project folders`
- **Allowed operation**: `INSERT`
- **Target roles**: `authenticated`
- **USING expression**: 
  ```sql
  bucket_id = 'project-files'
  ```

#### Policy 2: Allow Read
- **Name**: `Users can read project files`
- **Allowed operation**: `SELECT`
- **Target roles**: `authenticated`
- **USING expression**:
  ```sql
  bucket_id = 'project-files'
  ```

#### Policy 3: Allow Update
- **Name**: `Users can update project files`
- **Allowed operation**: `UPDATE`
- **Target roles**: `authenticated`
- **USING expression**:
  ```sql
  bucket_id = 'project-files'
  ```

#### Policy 4: Allow Delete
- **Name**: `Users can delete project files`
- **Allowed operation**: `DELETE`
- **Target roles**: `authenticated`
- **USING expression**:
  ```sql
  bucket_id = 'project-files'
  ```

### Step 3: Verify Setup

1. **Check bucket exists**: Go to Storage > project-files
2. **Check policies**: Should see 4 policies listed
3. **Test upload**: Try uploading a test file through the dashboard

## Alternative SQL Method (If Dashboard Doesn't Work)

If you prefer SQL and have the right permissions, run these commands **one by one** in Supabase SQL Editor:

### Check Current Status First:
```sql
-- Check if bucket exists
SELECT * FROM storage.buckets WHERE id = 'project-files';

-- Check if RLS is enabled (should return 't')
SELECT relname, relrowsecurity 
FROM pg_class 
WHERE relname = 'objects' AND relnamespace = (
  SELECT oid FROM pg_namespace WHERE nspname = 'storage'
);
```

### If Bucket Doesn't Exist:
```sql
INSERT INTO storage.buckets (id, name, public) 
VALUES ('project-files', 'project-files', false);
```

### Create Policies (Skip RLS Enable):
```sql
-- Don't run the ALTER TABLE command, just create policies:

CREATE POLICY "Users can upload to project folders" ON storage.objects
  FOR INSERT WITH CHECK (
    auth.role() = 'authenticated' AND
    bucket_id = 'project-files'
  );

CREATE POLICY "Users can read project files" ON storage.objects
  FOR SELECT USING (
    auth.role() = 'authenticated' AND
    bucket_id = 'project-files'
  );

CREATE POLICY "Users can update project files" ON storage.objects
  FOR UPDATE USING (
    auth.role() = 'authenticated' AND
    bucket_id = 'project-files'
  );

CREATE POLICY "Users can delete project files" ON storage.objects
  FOR DELETE USING (
    auth.role() = 'authenticated' AND
    bucket_id = 'project-files'
  );
```

## Common Errors & Solutions

### Error: `42501: must be owner of table objects`
**Solution**: RLS is already enabled. Skip the `ALTER TABLE` command and just create policies.

### Error: `Policy already exists`
**Solution**: Policies are already created. Check existing policies:
```sql
SELECT policyname FROM pg_policies 
WHERE tablename = 'objects' AND schemaname = 'storage';
```

### Error: `Bucket already exists`
**Solution**: Use the existing bucket. Check with:
```sql
SELECT * FROM storage.buckets WHERE id = 'project-files';
```

## Quick Test

After setup, test the bucket works:

1. **Go to Supabase Dashboard > Storage > project-files**
2. **Try uploading a test image**
3. **If it works, your setup is complete!**

## Environment Variables Check

Make sure your `.env.local` has the correct Supabase credentials:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

## Next Steps

Once storage is set up:
1. Test the file upload in your app
2. Navigate to a project and click "Upload File"
3. Try uploading different file types
4. Verify files appear in the project

**The dashboard method is usually easier and avoids permission issues!** 🚀
